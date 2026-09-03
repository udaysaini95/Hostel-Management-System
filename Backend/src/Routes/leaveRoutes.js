import express from "express";
import { applyLeave, myLeaves, getAllLeaves, approveLeave, rejectLeave } from "../Controllers/leaveController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  leaveApplicationSchema,
  resourceIdSchema,
} from "../validation/operationalSchemas.js";

const router = express.Router();

router.post(
  "/apply",
  protect,
  requirePermission(PERMISSIONS.LEAVE_CREATE_OWN),
  validateRequest(leaveApplicationSchema),
  applyLeave
);
router.get(
  "/mine",
  protect,
  requirePermission(PERMISSIONS.LEAVE_READ_OWN),
  myLeaves
);
router.get(
  "/admin/all",
  protect,
  requirePermission(PERMISSIONS.LEAVE_REVIEW),
  getAllLeaves
);
router.put(
  "/admin/approve/:id",
  protect,
  requirePermission(PERMISSIONS.LEAVE_REVIEW),
  validateRequest(resourceIdSchema),
  approveLeave
);
router.put(
  "/admin/reject/:id",
  protect,
  requirePermission(PERMISSIONS.LEAVE_REVIEW),
  validateRequest(resourceIdSchema),
  rejectLeave
);

export default router;
