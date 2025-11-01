// server.js
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import dotenv from "dotenv";

// Import your routes
import authRoutes from "../src/routes/auth";
import settingsRoutes from "../src/routes/settings";
import sessionsRoutes from "../src/routes/sessions";
import reflectionsRoutes from "../src/routes/reflections";
import usersRoutes from "../src/routes/users";

import { apiLimiter } from "../src/middleware/rateLimit";
import errorHandler from "../src/middleware/errorHandler";

dotenv.config();

const app = express();

// Security headers
app.use(helmet());

// --- CORS Middleware ---
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://reflectivepomodoro.com",
    "https://www.reflectivepomodoro.com",
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);

  next();
});

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiter for API routes
app.use("/api/", apiLimiter);

// Health check
app.get("/api/health", (req, res) =>
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/reflections", reflectionsRoutes);
app.use("/api/users", usersRoutes);

// 404 handler
app.use("*", (req, res) =>
  res.status(404).json({ success: false, message: "Route not found" })
);

// Global error handler
app.use(errorHandler);

// --- MongoDB Connection ---
let cachedDb = null;

async function connectDB() {
  if (cachedDb) return cachedDb;

  if (!process.env.MONGODB_URI) {
    throw new Error("MongoDB connection string is missing");
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");
    cachedDb = conn;
    return conn;
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}

// For Vercel serverless
const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT || 5000;
  return app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

// Only start server if running locally (not serverless)
if (process.env.NODE_ENV !== "production") {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export default app;
