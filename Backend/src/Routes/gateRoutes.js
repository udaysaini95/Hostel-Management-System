import express from "express";
import {
  getActiveOutsideStudents,
  createGateOverride,
  expireNormalizedGatePasses,
  getNormalizedGateMovements,
  getNormalizedOutsideRoster,
  getRecentGateLogs,
  logGateAction,
  logNormalizedGateMovement,
  verifyGatePass,
  verifyNormalizedGatePass,
} from "../Controllers/gateController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  gateActionSchema,
  gatePassVerificationSchema,
} from "../validation/operationalSchemas.js";
import {
  gateMovementRequestSchema,
  gateMovementHistoryQuerySchema,
  gateOverrideRequestSchema,
  expireGatePassesSchema,
  outsideRosterQuerySchema,
  secureGatePassVerificationSchema,
} from "../validation/gateSchemas.js";

const router = express.Router();

// Guard & Admin Gate Routes
router.post(
  "/passes/verify",
  protect,
  requirePermission(PERMISSIONS.GATE_VERIFY_PASS),
  validateRequest(secureGatePassVerificationSchema),
  verifyNormalizedGatePass
);
router.post(
  "/passes/movements",
  protect,
  requirePermission(PERMISSIONS.GATE_LOG_MOVEMENT),
  validateRequest(gateMovementRequestSchema),
  logNormalizedGateMovement
);
router.post(
  "/passes/expire",
  protect,
  requirePermission(PERMISSIONS.GATE_MANAGE_EXCEPTIONS),
  validateRequest(expireGatePassesSchema),
  expireNormalizedGatePasses
);
router.post(
  "/overrides",
  protect,
  requirePermission(PERMISSIONS.GATE_MANAGE_EXCEPTIONS),
  validateRequest(gateOverrideRequestSchema),
  createGateOverride
);
router.get(
  "/outside",
  protect,
  requirePermission(PERMISSIONS.GATE_READ_ACTIVITY),
  validateRequest(outsideRosterQuerySchema),
  getNormalizedOutsideRoster
);
router.get(
  "/movements",
  protect,
  requirePermission(PERMISSIONS.GATE_READ_ACTIVITY),
  validateRequest(gateMovementHistoryQuerySchema),
  getNormalizedGateMovements
);
router.post(
  "/verify",
  protect,
  requirePermission(PERMISSIONS.GATE_VERIFY_PASS),
  validateRequest(gatePassVerificationSchema),
  verifyGatePass
);
router.post(
  "/log-action",
  protect,
  requirePermission(PERMISSIONS.GATE_LOG_MOVEMENT),
  validateRequest(gateActionSchema),
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
