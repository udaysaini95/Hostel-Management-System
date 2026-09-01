import express from "express";
import { 
  verifyGatePass, 
  logGateAction, 
  getActiveOutsideStudents, 
  getRecentGateLogs 
} from "../Controllers/gateController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { PERMISSIONS } from "../domain/permissions.js";

const router = express.Router();

// Guard & Admin Gate Routes
router.post(
  "/verify",
  protect,
  requirePermission(PERMISSIONS.GATE_VERIFY_PASS),
  verifyGatePass
);
router.post(
  "/log-action",
  protect,
  requirePermission(PERMISSIONS.GATE_LOG_MOVEMENT),
  logGateAction
);
router.get(
  "/active-outside",
  protect,
  requirePermission(PERMISSIONS.GATE_READ_ACTIVITY),
  getActiveOutsideStudents
);
router.get(
  "/logs",
  protect,
  requirePermission(PERMISSIONS.GATE_READ_ACTIVITY),
  getRecentGateLogs
);

export default router;
