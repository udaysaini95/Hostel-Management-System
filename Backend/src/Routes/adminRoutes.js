import express from "express";
import {
  createStaffInvitation,
  updateAccountStatus,
} from "../Controllers/staffAccountController.js";
import {
  listApprovedStudents,
  importApprovedStudents,
  reinstateStudentApproval,
  reissueStudentActivationEmail,
  revokeStudentApproval,
} from "../Controllers/approvedStudentController.js";
import {
  getHostels,
  patchHostel,
  patchHostelStatus,
  postHostel,
} from "../Controllers/hostelController.js";
import {
  getInventory,
  patchRoom,
  patchRoomStatus,
  postRoom,
} from "../Controllers/hostelInventoryController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { createStudentApproval } from "../Controllers/studentActivationController.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { studentCsvUpload } from "../middlewares/studentCsvUpload.js";
import {
  accountStatusRequestSchema,
  approvedStudentActivationReissueRequestSchema,
  approvedStudentReinstatementRequestSchema,
  approvedStudentRevocationRequestSchema,
  approvedStudentSearchRequestSchema,
  staffInvitationRequestSchema,
  studentApprovalRequestSchema,
  studentApprovalImportRequestSchema,
} from "../validation/authSchemas.js";
import {
  hostelCreateRequestSchema,
  hostelListRequestSchema,
  hostelStatusRequestSchema,
  hostelUpdateRequestSchema,
} from "../validation/hostelSchemas.js";
import {
  hostelInventoryRequestSchema,
  roomCreateRequestSchema,
  roomStatusRequestSchema,
  roomUpdateRequestSchema,
} from "../validation/hostelInventorySchemas.js";

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

router.post(
  "/students/approvals/import",
  protect,
  requirePermission(PERMISSIONS.STUDENT_IMPORT),
  validateRequest(studentApprovalImportRequestSchema),
  studentCsvUpload.single("file"),
  importApprovedStudents
);

router.get(
  "/hostels",
  protect,
  requirePermission(PERMISSIONS.HOSTEL_MANAGE),
  validateRequest(hostelListRequestSchema),
  getHostels
);

router.post(
  "/hostels",
  protect,
  requirePermission(PERMISSIONS.HOSTEL_MANAGE),
  validateRequest(hostelCreateRequestSchema),
  postHostel
);

router.patch(
  "/hostels/:id/status",
  protect,
  requirePermission(PERMISSIONS.HOSTEL_MANAGE),
  validateRequest(hostelStatusRequestSchema),
  patchHostelStatus
);

router.patch(
  "/hostels/:id",
  protect,
  requirePermission(PERMISSIONS.HOSTEL_MANAGE),
  validateRequest(hostelUpdateRequestSchema),
  patchHostel
);

router.get(
  "/hostels/:id/inventory",
  protect,
  requirePermission(PERMISSIONS.HOSTEL_MANAGE),
  validateRequest(hostelInventoryRequestSchema),
  getInventory
);

router.post(
  "/hostels/:id/rooms",
  protect,
  requirePermission(PERMISSIONS.HOSTEL_MANAGE),
  validateRequest(roomCreateRequestSchema),
  postRoom
);

router.patch(
  "/hostels/:id/rooms/:roomId/status",
  protect,
  requirePermission(PERMISSIONS.HOSTEL_MANAGE),
  validateRequest(roomStatusRequestSchema),
  patchRoomStatus
);

router.patch(
  "/hostels/:id/rooms/:roomId",
  protect,
  requirePermission(PERMISSIONS.HOSTEL_MANAGE),
  validateRequest(roomUpdateRequestSchema),
  patchRoom
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
