import jwt from "jsonwebtoken";
import { getRuntimeConfig } from "../config/runtimeConfig.js";

// Protect Routes (Verify JWT)
export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, getRuntimeConfig().jwtSecret);
    req.user = decoded; // id, role, email
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Admin Only
export const admin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Role-Based Access Control (RBAC) Middleware
export const requireRoles = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: Please log in." });
    }

    // "admin" always has super access, plus check specific role
    if (req.user.role === "admin" || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      message: `Access denied. Required roles: [${roles.join(", ")}]`,
    });
  };
};
