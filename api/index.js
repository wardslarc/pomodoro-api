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

// Import logging and monitoring middleware
import securityLogger from "../src/middleware/securityLogger.js";
import { performanceMonitor, metricsCollector, apiMetrics } from "../src/middleware/monitoring.js";
import { cacheMiddleware, initializeRedis, closeRedis } from "../src/middleware/caching.js";

// Import database connection
import { connectDB } from "../src/config/database.js";

const app = express();

// Environment detection
const isVercel = process.env.VERCEL;
const isDevelopment = config.env === 'development';

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS policy violation attempt', { origin });
      callback(new Error('CORS policy violation'), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  maxAge: 86400,
};

// Middleware setup
app.set("trust proxy", 1);

// Security first
app.use(securityHeaders);
app.use(securityLogger); // Always enable security logging

// Performance monitoring and metrics collection
app.use(performanceMonitor(isDevelopment ? 2000 : 1000)); // Log requests slower than 2s in dev, 1s in prod
app.use(metricsCollector);

// Core middleware
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
app.use("/api/", apiLimiter);
app.use("/api/auth", authLimiter);

// Cache middleware for GET requests (5 minute TTL)
app.use("/api/settings", cacheMiddleware(300));
app.use("/api/reflections", cacheMiddleware(300));

// Initialize Redis for caching
if (!isVercel) {
  initializeRedis().catch((error) => {
    logger.warn('Redis initialization failed, continuing without cache:', error.message);
  });
}

// Database initialization for non-serverless environments
if (!isVercel) {
  connectDB().catch((error) => {
    logger.error('Failed to initialize database:', error);
    if (config.env === 'production') {
      process.exit(1);
    }
  });
}

// Health check endpoint
app.get("/api/health", async (req, res) => {
  const healthCheck = {
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
    environment: config.env,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
  };

  // Attempt reconnection if needed
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
      healthCheck.database = "reconnected";
    } catch (error) {
      healthCheck.database = "disconnected";
      healthCheck.databaseError = isDevelopment ? error.message : undefined;
    }
  }

  const statusCode = healthCheck.database === "disconnected" ? 503 : 200;
  res.status(statusCode).json(healthCheck);
});

// Metrics endpoint (only in development)
if (isDevelopment) {
  app.get("/api/metrics", (req, res) => {
    res.json({
      success: true,
      data: {
        summary: apiMetrics.getSummary(),
        endpoints: apiMetrics.getMetrics()
      }
    });
  });
}

// Database connection middleware for API routes
app.use(async (req, res, next) => {
  // Skip database check for health and metrics endpoints
  if (req.path === "/api/health" || req.path === "/api/metrics") {
    return next();
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    req.dbConnected = true;
    next();
  } catch (error) {
    logger.error("Database connection failed:", {
      error: error.message,
      path: req.path,
      method: req.method
    });
    
    // Critical routes get service unavailable response
    if (req.path.startsWith("/api/auth") || req.path.startsWith("/api/sessions")) {
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable",
        error: isDevelopment ? error.message : undefined,
      });
    }

    next();
  }
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/reflections", reflectionsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/social", socialRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });
});

// Error handler (must be last)
app.use(errorHandler);

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  
  try {
    // Close Redis connection
    await closeRedis();
    
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    }
    
    logger.info('Server shutdown completed gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Process event handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', {
    reason: reason instanceof Error ? reason.message : reason
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack
  });
  if (!isVercel) {
    process.exit(1);
  }
});

export default app;