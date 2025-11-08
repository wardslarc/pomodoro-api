import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import compression from "compression";

// Import centralized config
import config from "../src/config/config.js";

// Import routes
import { authRoutes } from "../src/routes/auth.js";
import settingsRoutes from "../src/routes/settings.js";
import sessionsRoutes from "../src/routes/sessions.js";
import reflectionsRoutes from "../src/routes/reflections.js";
import usersRoutes from "../src/routes/users.js";
import socialRoutes from "../src/routes/social.js";

// Import middleware
import { securityHeaders, authLimiter, apiLimiter } from "../src/middleware/security.js";
import errorHandler from "../src/middleware/errorHandler.js";
import logger from "../src/utils/logger.js";

// Import logging middleware
import requestLogger from "../src/middleware/requestLogger.js";
import securityLogger from "../src/middleware/securityLogger.js";

// Import database connection
import { connectDB, gracefulShutdown } from "../src/config/database.js";

const app = express();

// Vercel detection
const isVercel = process.env.VERCEL;
const isDevelopment = process.env.NODE_ENV === 'development';

// Use config for CORS origins
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS policy violation attempt', { origin });
      callback(new Error(`CORS policy violation: ${origin} not allowed`), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  maxAge: 86400,
};

// Middleware - ORDER MATTERS!
app.set("trust proxy", 1);

// 1. First apply security headers (always enabled)
app.use(securityHeaders);

// 2. Apply logging middleware conditionally
if (!isVercel || isDevelopment) {
  // Full logging in development or non-Vercel environments
  app.use(requestLogger);
  app.use(securityLogger);
} else {
  // Minimal logging in Vercel production - only security events
  app.use(securityLogger);
}

// 3. Other essential middleware
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Apply rate limiting using config values
app.use("/api/", apiLimiter);

// Database connection initialization
const initializeDatabase = async () => {
  try {
    await connectDB();
    logger.info('Database connection initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database connection:', error);
    if (config.env === 'production') {
      process.exit(1);
    }
  }
};

// Initialize database on startup (only if not in serverless)
if (!isVercel) {
  initializeDatabase();
} else {
  // In serverless, we'll connect on first request
  logger.info('Running in serverless mode - database will connect on first request');
}

// Health check endpoint (optimized for serverless)
app.get("/api/health", async (req, res) => {
  const healthCheck = {
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
    environment: config.env,
    platform: isVercel ? 'vercel' : 'traditional',
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
  };

  // In serverless, we might not have a persistent connection
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
      healthCheck.database = "reconnected";
      healthCheck.message = "API is running - database reconnected";
    } catch (error) {
      healthCheck.database = "disconnected";
      healthCheck.message = "API is running - database disconnected";
      healthCheck.databaseError = isDevelopment ? error.message : "Database unavailable";
    }
  }

  const statusCode = healthCheck.database === "connected" || healthCheck.database === "reconnected" ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// Test endpoints
app.get("/api/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "API is working!",
    timestamp: new Date().toISOString(),
    environment: config.env,
    platform: isVercel ? 'vercel' : 'traditional'
  });
});

app.get("/api/social/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "Social routes are working!",
    timestamp: new Date().toISOString(),
    environment: config.env
  });
});

// Database middleware for API routes
app.use(async (req, res, next) => {
  // Skip database check for health and test endpoints
  if (req.path === "/api/health" || req.path === "/api/test" || req.path === "/api/social/test") {
    return next();
  }

  try {
    // Ensure database is connected (especially important in serverless)
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    req.dbConnected = true;
    next();
  } catch (error) {
    logger.error("Database connection failed in middleware:", {
      error: error.message,
      path: req.path,
      method: req.method
    });
    
    // Return service unavailable for critical routes
    if (
      req.path.startsWith("/api/auth") ||
      req.path.startsWith("/api/sessions") ||
      req.path.startsWith("/api/reflections") ||
      req.path.startsWith("/api/social")
    ) {
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable - database connection failed",
        error: isDevelopment ? error.message : undefined,
      });
    }

    next();
  }
});

// Apply specific rate limiters to routes
app.use("/api/auth", authLimiter);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/reflections", reflectionsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/social", socialRoutes);

// 404 handler
app.use("*", (req, res) => {
  logger.warn('Route not found', { 
    path: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });
});

// Error handler
app.use(errorHandler);

// Graceful shutdown handling (only in traditional environments)
if (!isVercel) {
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { 
    reason: reason instanceof Error ? reason.message : reason,
    promise: typeof promise
  });
  
  // In production serverless, we don't want to exit the process
  if (!isVercel && config.env === 'production') {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', {
    message: error.message,
    stack: error.stack
  });
  
  // In production serverless, we don't want to exit the process
  if (!isVercel) {
    process.exit(1);
  }
});

// Serverless function optimization
if (isVercel) {
  // Optimize for serverless cold starts
  logger.info('Vercel serverless environment detected');
  
  // Pre-warm database connection for better performance
  setTimeout(async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        await connectDB();
        logger.info('Database pre-warmed for serverless');
      }
    } catch (error) {
      logger.warn('Database pre-warm failed:', error.message);
    }
  }, 1000);
}

export default app;