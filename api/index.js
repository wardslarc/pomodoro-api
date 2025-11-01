import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";

// Import routes
import { authRoutes } from "./routes/auth.js";
import settingsRoutes from "./routes/settings.js";
import sessionsRoutes from "./routes/sessions.js";
import reflectionsRoutes from "./routes/reflections.js";
import usersRoutes from "./routes/users.js";

import { apiLimiter } from "./middleware/rateLimit.js";
import errorHandler from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";

dotenv.config();

const app = express();

// Serverless-compatible MongoDB connection
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  try {
    // For serverless, we need different connection options
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // Increased timeout
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0,
    };

    logger.info("Attempting to connect to MongoDB...");
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    
    logger.info("MongoDB connected successfully", {
      database: conn.connection.db?.databaseName || 'unknown',
      host: conn.connection.host
    });
    
    cachedDb = conn;
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
      cachedDb = null;
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      cachedDb = null;
    });
    
    return conn;
  } catch (error) {
    logger.error("MongoDB connection failed:", error);
    cachedDb = null;
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
    if (!origin || allowedOrigins.includes(origin)) {
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

// Middleware - ORDER MATTERS!
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

// CORS before other middleware
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/", apiLimiter);

// Health check that doesn't require DB
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// Database connection middleware - but don't block all requests if DB is down
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    // Don't block the request entirely if DB is down
    // Some routes might work without DB, or we can handle it in individual routes
    logger.error("Database connection failed in middleware:", error);
    // Attach DB status to request for routes to handle
    req.dbConnected = false;
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

// Vercel serverless function handler
export default async function handler(req, res) {
  // For serverless, we need to handle the request with our express app
  return app(req, res);
}