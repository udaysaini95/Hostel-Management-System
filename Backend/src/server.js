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

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Database
connectDB();

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

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
