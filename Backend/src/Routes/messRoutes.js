import express from "express";
import { 
  createMenu, 
  getCalendarMenu,
  getCalendarMenus,
  getCalendarMenuVersions,
  getManageableMessHostels,
  getTodayMenu, 
  createFeedback, 
  getFeedbackSummary,
  createIssue, 
  getMyIssues, 
  getAllIssues, 
  downloadIssueEvidence,
  publishCalendarMenu,
  updateStatus 
} from "../Controllers/messController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import messIssueEvidenceUpload from "../middlewares/messIssueEvidenceUpload.js";
import {
  menuRequestSchema,
} from "../validation/operationalSchemas.js";
import {
  messMenuDateQuerySchema,
  messMenuRangeQuerySchema,
  createMessFeedbackSchema,
  messFeedbackSummarySchema,
  publishMessMenuSchema,
} from "../validation/messSchemas.js";
import {
  createMessIssueSchema,
  managedMessIssueListSchema,
  messIssueResourceSchema,
  messIssueStatusUpdateSchema,
  ownMessIssueListSchema,
} from "../validation/messIssueSchemas.js";

const router = express.Router();

router.get(
  "/menus/hostels",
  protect,
  requirePermission(PERMISSIONS.MESS_MENU_MANAGE),
  getManageableMessHostels
);
router.put(
  "/menus/:date",
  protect,
  requirePermission(PERMISSIONS.MESS_MENU_MANAGE),
  validateRequest(publishMessMenuSchema),
  publishCalendarMenu
);
router.get(
  "/menus/:date/versions",
  protect,
  requirePermission(PERMISSIONS.MESS_MENU_MANAGE),
  validateRequest(messMenuDateQuerySchema),
  getCalendarMenuVersions
);
router.get(
  "/menus/:date",
  protect,
  requirePermission(PERMISSIONS.MESS_MENU_READ),
  validateRequest(messMenuDateQuerySchema),
  getCalendarMenu
);
router.get(
  "/menus",
  protect,
  requirePermission(PERMISSIONS.MESS_MENU_READ),
  validateRequest(messMenuRangeQuerySchema),
  getCalendarMenus
);

router.post(
  "/admin/create",
  protect,
  requirePermission(PERMISSIONS.MESS_MENU_MANAGE),
  validateRequest(menuRequestSchema),
  createMenu
);
router.get(
  "/today",
  protect,
  requirePermission(PERMISSIONS.MESS_MENU_READ),
  getTodayMenu
);
router.post(
  "/feedback",
  protect,
  requirePermission(PERMISSIONS.MESS_FEEDBACK_CREATE),
  validateRequest(createMessFeedbackSchema),
  createFeedback
);
router.get(
  "/feedback/summary",
  protect,
  requirePermission(PERMISSIONS.MESS_FEEDBACK_READ),
  validateRequest(messFeedbackSummarySchema),
  getFeedbackSummary
);

// Mess Issue Routes
router.post(
  "/issues",
  protect,
  requirePermission(PERMISSIONS.MESS_ISSUE_CREATE),
  messIssueEvidenceUpload.single("evidence"),
  validateRequest(createMessIssueSchema),
  createIssue
);
router.get(
  "/issues/mine",
  protect,
  requirePermission(PERMISSIONS.MESS_ISSUE_READ_OWN),
  validateRequest(ownMessIssueListSchema),
  getMyIssues
);
router.get(
  "/issues/managed",
  protect,
  requirePermission(PERMISSIONS.MESS_ISSUE_MANAGE),
  validateRequest(managedMessIssueListSchema),
  getAllIssues
);
router.patch(
  "/issues/:id/status",
  protect,
  requirePermission(PERMISSIONS.MESS_ISSUE_MANAGE),
  validateRequest(messIssueStatusUpdateSchema),
  updateStatus
);
router.get(
  "/issues/:id/evidence",
  protect,
  validateRequest(messIssueResourceSchema),
  downloadIssueEvidence
);

export default router;
