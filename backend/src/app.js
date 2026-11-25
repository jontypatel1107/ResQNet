import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

// Routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import emergencyRoutes from "./routes/emergencyRoutes.js";
import volunteerRoutes from "./routes/volunteerRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

// Middleware
import { notFoundHandler, errorHandler } from "./middleware/errorMiddleware.js";

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors());

// Rate Limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// Request Parsing
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Logger
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Health & Root Endpoints
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to ResQNet API - Disaster Response & Emergency Network",
    version: "1.0.0",
  });
});

// mongoose readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];

app.get("/api/health", (req, res) => {
  const database = dbStates[mongoose.connection.readyState] ?? "unknown";
  const isConnected = mongoose.connection.readyState === 1;

  res.status(isConnected ? 200 : 503).json({
    success: isConnected,
    service: "ResQNet Backend",
    status: isConnected ? "healthy" : "degraded",
    database,
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/emergencies", emergencyRoutes);
app.use("/api/volunteers", volunteerRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/admin", adminRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
