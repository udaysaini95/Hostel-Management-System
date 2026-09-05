import express from "express";
import {
  createStaffInvitation,
  updateAccountStatus,
} from "../Controllers/staffAccountController.js";
import {
  listApprovedStudents,
  reinstateStudentApproval,
  reissueStudentActivationEmail,
  revokeStudentApproval,
} from "../Controllers/approvedStudentController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { createStudentApproval } from "../Controllers/studentActivationController.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  accountStatusRequestSchema,
  approvedStudentActivationReissueRequestSchema,
  approvedStudentReinstatementRequestSchema,
  approvedStudentRevocationRequestSchema,
  approvedStudentSearchRequestSchema,
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

router.get(
  "/students/approvals",
  protect,
  requirePermission(PERMISSIONS.STUDENT_APPROVAL_MANAGE),
  validateRequest(approvedStudentSearchRequestSchema),
  listApprovedStudents
);

router.patch(
  "/students/approvals/:id/revoke",
  protect,
  requirePermission(PERMISSIONS.STUDENT_APPROVAL_MANAGE),
  validateRequest(approvedStudentRevocationRequestSchema),
  revokeStudentApproval
);

router.patch(
  "/students/approvals/:id/reinstate",
  protect,
  requirePermission(PERMISSIONS.STUDENT_APPROVAL_MANAGE),
  validateRequest(approvedStudentReinstatementRequestSchema),
  reinstateStudentApproval
);

router.post(
  "/students/approvals/:id/activation-email",
  protect,
  requirePermission(PERMISSIONS.STUDENT_APPROVAL_MANAGE),
  validateRequest(approvedStudentActivationReissueRequestSchema),
  reissueStudentActivationEmail
);

export default router;
