import express from "express";
import {
  createStaffInvitation,
  updateAccountStatus,
} from "../Controllers/staffAccountController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { createStudentApproval } from "../Controllers/studentActivationController.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  accountStatusRequestSchema,
  staffInvitationRequestSchema,
  studentApprovalRequestSchema,
} from "../validation/authSchemas.js";

const router = express.Router();

router.post(
  "/staff/invitations",
  protect,
  requirePermission(PERMISSIONS.STAFF_PROVISION),
  validateRequest(staffInvitationRequestSchema),
  createStaffInvitation
);

router.patch(
  "/accounts/:id/status",
  protect,
  requirePermission(PERMISSIONS.ACCOUNT_DEACTIVATE),
  validateRequest(accountStatusRequestSchema),
  updateAccountStatus
);

router.post(
  "/students/approvals",
  protect,
  requirePermission(PERMISSIONS.STUDENT_APPROVE),
  validateRequest(studentApprovalRequestSchema),
  createStudentApproval
);

export default router;
