import express from "express";
import {
  allComplaints,
  assignMaintenanceComplaint,
  createComplaint,
  createMaintenanceComplaint,
  deleteComplaintAttachment,
  deleteComplaint,
  downloadComplaintAttachment,
  getComplaintDetails,
  getComplaintSlaMetrics,
  listComplaintAttachments,
  listComplaintAssignees,
  listComplaintCategories,
  listManagedComplaints,
  listMaintenanceWorkQueue,
  listOwnComplaints,
  myComplaints,
  resolveMaintenanceComplaint,
  startMaintenanceComplaint,
  studentVerifyComplaint,
  updateStatus,
  uploadComplaintAttachment,
  verifyMaintenanceComplaint,
} from "../Controllers/complaintController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { PERMISSIONS } from "../domain/permissions.js";
import upload from "../middlewares/upload.js";
import complaintAttachmentUpload, {
  complaintResolutionUpload,
} from "../middlewares/complaintAttachmentUpload.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  complaintCreationSchema,
  complaintStatusSchema,
  complaintVerificationSchema,
  resourceIdSchema,
} from "../validation/operationalSchemas.js";
import {
  complaintAttachmentRequestSchema,
  complaintAssigneeListRequestSchema,
  complaintAssignmentRequestSchema,
  complaintCreateRequestSchema,
  complaintDetailRequestSchema,
  complaintListRequestSchema,
  complaintMetricsRequestSchema,
  complaintResolutionRequestSchema,
  complaintVerificationRequestSchema,
  complaintWorkQueueRequestSchema,
} from "../validation/complaintSchemas.js";

const router = express.Router();

// Normalized complaint API. The named legacy routes below remain available
// until the complaint frontend is rebuilt in CMP-05.
router.post(
  "/",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_CREATE),
  validateRequest(complaintCreateRequestSchema),
  createMaintenanceComplaint
);
router.get(
  "/categories",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_CREATE),
  listComplaintCategories
);
router.get(
  "/mine",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_READ_OWN),
  validateRequest(complaintListRequestSchema),
  listOwnComplaints
);
router.get(
  "/managed",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_READ_MANAGED),
  validateRequest(complaintListRequestSchema),
  listManagedComplaints
);
router.get(
  "/assignees",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_ASSIGN_MANAGED),
  validateRequest(complaintAssigneeListRequestSchema),
  listComplaintAssignees
);
router.get(
  "/work-queue",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_READ_ASSIGNED),
  validateRequest(complaintWorkQueueRequestSchema),
  listMaintenanceWorkQueue
);
router.get(
  "/metrics",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_READ_METRICS),
  validateRequest(complaintMetricsRequestSchema),
  getComplaintSlaMetrics
);
router.post(
  "/:id/assignments",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_ASSIGN_MANAGED),
  validateRequest(complaintAssignmentRequestSchema),
  assignMaintenanceComplaint
);
router.post(
  "/:id/start",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_UPDATE_ASSIGNED),
  validateRequest(complaintDetailRequestSchema),
  startMaintenanceComplaint
);
router.post(
  "/:id/resolve",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_UPDATE_ASSIGNED),
  validateRequest(complaintDetailRequestSchema),
  complaintResolutionUpload.single("file"),
  validateRequest(complaintResolutionRequestSchema),
  resolveMaintenanceComplaint
);
router.post(
  "/:id/verification",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_VERIFY_OWN),
  validateRequest(complaintVerificationRequestSchema),
  verifyMaintenanceComplaint
);
router.post(
  "/:id/attachments",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_CREATE),
  validateRequest(complaintDetailRequestSchema),
  complaintAttachmentUpload.single("file"),
  uploadComplaintAttachment
);
router.get(
  "/:id/attachments",
  protect,
  validateRequest(complaintDetailRequestSchema),
  listComplaintAttachments
);
router.get(
  "/:id/attachments/:attachmentId",
  protect,
  validateRequest(complaintAttachmentRequestSchema),
  downloadComplaintAttachment
);
router.delete(
  "/:id/attachments/:attachmentId",
  protect,
  validateRequest(complaintAttachmentRequestSchema),
  deleteComplaintAttachment
);

// ================= STUDENT ROUTES =================
router.post(
  "/create",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_CREATE),
  upload.single("image"),
  validateRequest(complaintCreationSchema),
  createComplaint
);
router.get(
  "/my",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_READ_OWN),
  myComplaints
);
router.delete(
  "/:id",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_DELETE_OWN),
  validateRequest(resourceIdSchema),
  deleteComplaint
);
router.put(
  "/verify/:id",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_VERIFY_OWN),
  validateRequest(complaintVerificationSchema),
  studentVerifyComplaint
);

// ================= ADMIN ROUTE ================
router.get(
  "/admin/complaints",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_READ_MANAGED),
  allComplaints
);
router.put(
  "/status/:id",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_UPDATE_MANAGED),
  validateRequest(complaintStatusSchema),
  updateStatus
);

// Keep the dynamic detail route last so named compatibility routes such as
// /my are never interpreted as complaint IDs.
router.get(
  "/:id",
  protect,
  validateRequest(complaintDetailRequestSchema),
  getComplaintDetails
);

export default router;
