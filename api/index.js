import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";

import { authRoutes } from "../src/routes/auth.js";
import settingsRoutes from "../src/routes/settings.js";
import sessionsRoutes from "../src/routes/sessions.js";
import reflectionsRoutes from "../src/routes/reflections.js";
import usersRoutes from "../src/routes/users.js";
import socialRoutes from "../src/routes/social.js";

import { apiLimiter } from "../src/middleware/rateLimit.js";
import errorHandler from "../src/middleware/errorHandler.js";
import logger from "../src/utils/logger.js";

const app = express();

// Parse ALLOWED_ORIGINS from environment or use defaults
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173", 
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://reflectivepomodoro.com",
      "https://www.reflectivepomodoro.com",
    ];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy violation: ${origin} not allowed`), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  maxAge: 86400,
};

// Middleware
app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api/", apiLimiter);

// Database connection cache
let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  try {
    mongoose.set("bufferCommands", false);
    mongoose.set("bufferTimeoutMS", 30000);

    const options = {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    };

    logger.info("Attempting to connect to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, options);

    cachedConnection = mongoose.connection;

    logger.info("✅ MongoDB connected successfully", {
      database: mongoose.connection.db?.databaseName || "unknown",
      host: mongoose.connection.host,
      readyState: mongoose.connection.readyState,
    });

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
      cachedConnection = null;
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
      cachedConnection = null;
    });

    return cachedConnection;
  } catch (error) {
    logger.error("❌ MongoDB connection failed:", error);
    cachedConnection = null;
    throw error;
  }
}

// Routes
app.get("/api/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "API is working!",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/social/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "Social routes are working!",
    timestamp: new Date().toISOString()
  });
});

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

// Database middleware for API routes
app.use(async (req, res, next) => {
  if (req.path === "/api/health" || req.path === "/api/test" || req.path === "/api/social/test") {
    return next();
  }

  try {
    await connectToDatabase();
    req.dbConnected = true;
    next();
  } catch (error) {
    logger.error("Database connection failed in middleware:", error);
    
    if (
      req.path.startsWith("/api/auth") ||
      req.path.startsWith("/api/sessions") ||
      req.path.startsWith("/api/reflections") ||
      req.path.startsWith("/api/social")
    ) {
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable - database connection failed",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
  });
});

// Error handler
app.use(errorHandler);

// Export for Vercel serverless
export default app;