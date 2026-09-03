import express from "express";
import { 
  createMenu, 
  getTodayMenu, 
  createFeedback, 
  getAllFeedback, 
  createIssue, 
  getMyIssues, 
  getAllIssues, 
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

const router = express.Router();

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
