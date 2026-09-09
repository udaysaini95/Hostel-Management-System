import express from "express";
import {
  applyLeave,
  approveLeave,
  createStudentLeaveRequest,
  decideStudentLeaveRequest,
  downloadStudentGatePassPdf,
  getAllLeaves,
  getStudentGatePass,
  listLeaveReviewQueue,
  listMyStudentLeaveRequests,
  myLeaves,
  rejectLeave,
  viewStudentGatePassQr,
} from "../Controllers/leaveController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  leaveApplicationSchema,
  resourceIdSchema,
} from "../validation/operationalSchemas.js";
import {
  leaveCreateRequestSchema,
  leaveDecisionRequestSchema,
  leaveReviewListSchema,
  studentLeaveListSchema,
} from "../validation/leaveSchemas.js";

const router = express.Router();

router.post(
  "/",
  protect,
  requirePermission(PERMISSIONS.LEAVE_CREATE_OWN),
  validateRequest(leaveCreateRequestSchema),
  createStudentLeaveRequest
);
router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.LEAVE_READ_OWN),
  validateRequest(studentLeaveListSchema),
  listMyStudentLeaveRequests
);
router.get(
  "/review",
  protect,
  requirePermission(PERMISSIONS.LEAVE_REVIEW),
  validateRequest(leaveReviewListSchema),
  listLeaveReviewQueue
);
router.post(
  "/:id/decision",
  protect,
  requirePermission(PERMISSIONS.LEAVE_REVIEW),
  validateRequest(leaveDecisionRequestSchema),
  decideStudentLeaveRequest
);
router.get(
  "/:id/pass",
  protect,
  requirePermission(PERMISSIONS.GATE_PASS_READ),
  validateRequest(resourceIdSchema),
  getStudentGatePass
);
router.get(
  "/:id/pass/qr",
  protect,
  requirePermission(PERMISSIONS.GATE_PASS_READ),
  validateRequest(resourceIdSchema),
  viewStudentGatePassQr
);
router.get(
  "/:id/pass/pdf",
  protect,
  requirePermission(PERMISSIONS.GATE_PASS_READ),
  validateRequest(resourceIdSchema),
  downloadStudentGatePassPdf
);

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
