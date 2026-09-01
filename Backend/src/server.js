import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";

import connectDB from "./config/db.js";
import authRoutes from "./Routes/authRoutes.js";
import complaintRoutes from "./Routes/complaintRoutes.js";
import leaveRoutes from "./Routes/leaveRoutes.js";
import messRoutes from "./Routes/messRoutes.js";
import gateRoutes from "./Routes/gateRoutes.js";
import { protect } from "./middlewares/authMiddleware.js";
import { getProfile } from "./Controllers/authController.js";
import { getRuntimeConfig } from "./config/runtimeConfig.js";

const runtimeConfig = getRuntimeConfig();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/student/profile", protect, getProfile);
app.use("/api/complaints", complaintRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/mess", messRoutes);
app.use("/api/gate", gateRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("Hostel Management System API Running 🚀");
});

// HTTP Server
const server = http.createServer(app);

const startServer = async () => {
  await connectDB();

  server.listen(runtimeConfig.port, () => {
    console.log(`Server running on port ${runtimeConfig.port}`);
  });
};

startServer().catch((error) => {
  console.error(`Server startup failed: ${error.message}`);
  process.exitCode = 1;
});
