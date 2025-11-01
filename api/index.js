import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";

// Import routes
import { authRoutes } from "../src/routes/auth.js";
import settingsRoutes from "../src/routes/settings.js";
import sessionsRoutes from "../src/routes/sessions.js";
import reflectionsRoutes from "../src/routes/reflections.js";
import usersRoutes from "../src/routes/users.js";

import { apiLimiter } from "../src/middleware/rateLimit.js";
import errorHandler from "../src/middleware/errorHandler.js";
import logger from "../src/utils/logger.js";

dotenv.config();

const app = express();

// FIX: Configure Express to trust Vercel's proxy
app.set('trust proxy', 1);

// Serverless-compatible MongoDB connection with connection caching
let cachedConnection = null;

async function connectToDatabase() {
  // If we have a cached connection and it's connected, return it
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  // If there's a connection but it's not ready, clean it up
  if (cachedConnection) {
    await mongoose.disconnect();
    cachedConnection = null;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  try {
    // Configure mongoose for serverless environment
    mongoose.set('bufferCommands', false);
    mongoose.set('bufferTimeoutMS', 30000);
    
    const options = {
      maxPoolSize: 5, // Reduced for serverless
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0,
    };

    logger.info("Attempting to connect to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, options);
    
    cachedConnection = mongoose.connection;
    
    logger.info("MongoDB connected successfully", {
      database: mongoose.connection.db?.databaseName || 'unknown',
      host: mongoose.connection.host,
      readyState: mongoose.connection.readyState
    });
    
    // Event handlers for connection issues
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
      cachedConnection = null;
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      cachedConnection = null;
    });
    
    return cachedConnection;
  } catch (error) {
    logger.error("MongoDB connection failed:", error);
    cachedConnection = null;
    throw error;
  }
}

// Enhanced CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://reflectivepomodoro.com",
  "https://www.reflectivepomodoro.com",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('CORS policy violation'), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With",
    "Accept",
    "Origin"
  ],
  maxAge: 86400,
};

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/", apiLimiter);

// Enhanced Health check
app.get("/api/health", async (req, res) => {
  const healthCheck = {
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
  };

  // Try to reconnect if database is disconnected
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectToDatabase();
      healthCheck.database = "reconnected";
      healthCheck.message = "API is running - database reconnected";
    } catch (error) {
      healthCheck.database = "disconnected";
      healthCheck.message = "API is running - database disconnected";
      healthCheck.databaseError = error.message;
    }
  }

  const statusCode = healthCheck.database === "connected" || healthCheck.database === "reconnected" ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// Database connection middleware for API routes
app.use(async (req, res, next) => {
  // Skip database connection for health check
  if (req.path === '/api/health') {
    return next();
  }

  try {
    await connectToDatabase();
    req.dbConnected = true;
    next();
  } catch (error) {
    logger.error("Database connection failed in middleware:", error);
    req.dbConnected = false;
    
    // For critical routes, you might want to return an error immediately
    if (req.path.startsWith('/api/auth') || 
        req.path.startsWith('/api/sessions') ||
        req.path.startsWith('/api/reflections')) {
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable - database connection failed",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    next();
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/reflections", reflectionsRoutes);
app.use("/api/users", usersRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: "Route not found" 
  });
});

// Error handler
app.use(errorHandler);

// Graceful shutdown handling for serverless
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing MongoDB connection');
  if (cachedConnection) {
    await mongoose.disconnect();
    cachedConnection = null;
  }
  process.exit(0);
});

// Vercel serverless function handler
export default async function handler(req, res) {
  return app(req, res);
}