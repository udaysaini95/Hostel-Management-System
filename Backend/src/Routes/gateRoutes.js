import express from "express";
import { 
  verifyGatePass, 
  logGateAction, 
  getActiveOutsideStudents, 
  getRecentGateLogs 
} from "../Controllers/gateController.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Guard & Admin Gate Routes
router.post("/verify", protect, requireRoles(["guard", "admin"]), verifyGatePass);
router.post("/log-action", protect, requireRoles(["guard", "admin"]), logGateAction);
router.get("/active-outside", protect, requireRoles(["guard", "admin"]), getActiveOutsideStudents);
router.get("/logs", protect, requireRoles(["guard", "admin"]), getRecentGateLogs);

export default router;
