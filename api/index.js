import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";

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
let cachedDb = null;

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://reflectivepomodoro.com",
  "https://www.reflectivepomodoro.com",
].filter(Boolean);

// Enhanced CORS configuration
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
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

// Handle OPTIONS preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/", apiLimiter);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/reflections", reflectionsRoutes);
app.use("/api/users", usersRoutes);

app.use("*", (req, res) => {
  logger.warn(`404 - Route not found: ${req.originalUrl}`, {
    ip: req.ip,
    method: req.method,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({ 
    success: false, 
    message: "Route not found" 
  });
});

app.use(errorHandler);

async function connectDB() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  try {
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    
    logger.info("MongoDB connected successfully", {
      database: conn.connection.db.databaseName,
      host: conn.connection.host
    });
    
    cachedDb = conn;
    
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      cachedDb = null;
    });
    
    return conn;
  } catch (error) {
    logger.error("MongoDB connection failed:", error);
    throw error;
  }
}

function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);
    
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    }
    
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

const startServer = async () => {
  try {
    await connectDB();
    
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
    
    setupGracefulShutdown(server);
    
    return server;
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app;