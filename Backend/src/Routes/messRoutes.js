import express from "express";
import { 
  createMenu, 
  getCalendarMenu,
  getCalendarMenus,
  getCalendarMenuVersions,
  getTodayMenu, 
  createFeedback, 
  getAllFeedback, 
  createIssue, 
  getMyIssues, 
  getAllIssues, 
  publishCalendarMenu,
  updateStatus 
} from "../Controllers/messController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  menuRequestSchema,
  messFeedbackSchema,
  messIssueCreationSchema,
  messIssueStatusSchema,
} from "../validation/operationalSchemas.js";
import {
  messMenuDateQuerySchema,
  messMenuRangeQuerySchema,
  publishMessMenuSchema,
} from "../validation/messSchemas.js";

const router = express.Router();

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
  "/create",
  protect,
  requirePermission(PERMISSIONS.MESS_FEEDBACK_CREATE),
  validateRequest(messFeedbackSchema),
  createFeedback
);
router.get(
  "/admin",
  protect,
  requirePermission(PERMISSIONS.MESS_FEEDBACK_READ),
  getAllFeedback
);

// Mess Issue Routes
router.post(
  "/issue/create",
  protect,
  requirePermission(PERMISSIONS.MESS_ISSUE_CREATE),
  validateRequest(messIssueCreationSchema),
  createIssue
);
router.get(
  "/my",
  protect,
  requirePermission(PERMISSIONS.MESS_ISSUE_READ_OWN),
  getMyIssues
);
router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.MESS_ISSUE_MANAGE),
  getAllIssues
);
router.put(
  "/:id/status",
  protect,
  requirePermission(PERMISSIONS.MESS_ISSUE_MANAGE),
  validateRequest(messIssueStatusSchema),
  updateStatus
);

export default router;
