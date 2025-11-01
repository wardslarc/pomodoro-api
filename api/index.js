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

// ✅ Configure Express to trust Vercel's proxy
app.set("trust proxy", 1);

// Cached MongoDB connection (important for Vercel serverless)
let cachedConnection = null;

async function connectToDatabase() {
  // Return existing connection if already established
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  // Clean up stale connections
  if (cachedConnection) {
    await mongoose.disconnect();
    cachedConnection = null;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  try {
    // Mongoose settings for serverless use
    mongoose.set("bufferCommands", false);
    mongoose.set("bufferTimeoutMS", 30000);

    const options = {
      maxPoolSize: 5, // Reduced for serverless
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

    // Handle disconnection and reconnection events
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

// ✅ Enhanced CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://reflectivepomodoro.com",
  "https://www.reflectivepomodoro.com",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error("CORS policy violation"), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  maxAge: 86400,
};

// ✅ Middleware
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

// ✅ Health Check
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

  const statusCode =
    healthCheck.database === "connected" || healthCheck.database === "reconnected" ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// 🧪 ADD TEST EMAIL ENDPOINT HERE
import { send2FACode } from '../src/utils/emailService.js';

app.get("/api/test-email", async (req, res) => {
  try {
    console.log('\n🧪 === TESTING EMAIL SERVICE ===');
    
    const testEmail = 'cralsdale@gmail.com';
    const testCode = '123456';
    
    console.log(`📧 Testing with: ${testEmail}`);
    console.log(`🔐 Test code: ${testCode}`);
    console.log(`📤 Sender: ${process.env.EMAIL_USER}`);
    
    const result = await send2FACode(testEmail, testCode);
    
    console.log('✅ Email sent successfully!');
    console.log(`📨 Message ID: ${result.messageId}`);
    
    res.json({
      success: true,
      message: 'Test email sent successfully! Check your inbox and spam folder.',
      recipient: testEmail,
      messageId: result.messageId
    });
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Check the server logs for more information'
    });
  }
});

// ✅ Database connection middleware for API routes
app.use(async (req, res, next) => {
  if (req.path === "/api/health") return next();

  try {
    await connectToDatabase();
    req.dbConnected = true;
    next();
  } catch (error) {
    logger.error("Database connection failed in middleware:", error);
    req.dbConnected = false;

    if (
      req.path.startsWith("/api/auth") ||
      req.path.startsWith("/api/sessions") ||
      req.path.startsWith("/api/reflections")
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

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/reflections", reflectionsRoutes);
app.use("/api/users", usersRoutes);

// 404 Handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ✅ Global Error Handler
app.use(errorHandler);

// ✅ Graceful Shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, closing MongoDB connection");
  if (cachedConnection) {
    await mongoose.disconnect();
    cachedConnection = null;
  }
  process.exit(0);
});

// ✅ Export as Vercel Serverless Function Handler
export default async function handler(req, res) {
  return app(req, res);
}
