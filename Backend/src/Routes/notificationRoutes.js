import express from "express";
import {
  getNotifications,
  getNotificationUnreadCount,
  readAllNotifications,
  readNotification,
} from "../Controllers/notificationController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  notificationListSchema,
  notificationResourceSchema,
} from "../validation/notificationSchemas.js";

const router = express.Router();

router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.NOTIFICATION_READ),
  validateRequest(notificationListSchema),
  getNotifications
);
router.get(
  "/unread-count",
  protect,
  requirePermission(PERMISSIONS.NOTIFICATION_READ),
  getNotificationUnreadCount
);
router.patch(
  "/read-all",
  protect,
  requirePermission(PERMISSIONS.NOTIFICATION_READ),
  readAllNotifications
);
router.patch(
  "/:id/read",
  protect,
  requirePermission(PERMISSIONS.NOTIFICATION_READ),
  validateRequest(notificationResourceSchema),
  readNotification
);

export default router;
