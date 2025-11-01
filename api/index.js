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

// Cached MongoDB connection for serverless
let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (cachedConnection) {
    await mongoose.disconnect();
    cachedConnection = null;
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

// ✅ Database connection middleware
app.use(async (req, res, next) => {
  if (req.path === "/api/health") return next();

  try {
    await connectToDatabase();
    next();
  } catch (error) {
    logger.error("Database connection failed:", error);
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable",
    });
  }
});

// ✅ Health Check
app.get("/api/health", async (req, res) => {
  const healthCheck = {
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    nodeVersion: process.version,
  };

  res.status(healthCheck.database === "connected" ? 200 : 503).json(healthCheck);
});

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/reflections", reflectionsRoutes);
app.use("/api/users", usersRoutes);

// ✅ 404 Handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ✅ Error Handler
app.use(errorHandler);

// ✅ Export for Vercel
export default app;