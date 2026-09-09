import express from "express";
import {
  createNotice,
  getManagedNotices,
  getMyNotices,
  getUnreadCount,
  readNotice,
} from "../Controllers/noticeController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  managedNoticeListSchema,
  noticeResourceSchema,
  ownNoticeListSchema,
  publishNoticeSchema,
} from "../validation/noticeSchemas.js";

const router = express.Router();

router.post(
  "/",
  protect,
  requirePermission(PERMISSIONS.NOTICE_PUBLISH),
  validateRequest(publishNoticeSchema),
  createNotice
);
router.get(
  "/mine",
  protect,
  requirePermission(PERMISSIONS.NOTICE_READ),
  validateRequest(ownNoticeListSchema),
  getMyNotices
);
router.get(
  "/unread-count",
  protect,
  requirePermission(PERMISSIONS.NOTICE_READ),
  getUnreadCount
);
router.get(
  "/managed",
  protect,
  requirePermission(PERMISSIONS.NOTICE_PUBLISH),
  validateRequest(managedNoticeListSchema),
  getManagedNotices
);
router.patch(
  "/:id/read",
  protect,
  requirePermission(PERMISSIONS.NOTICE_READ),
  validateRequest(noticeResourceSchema),
  readNotice
);

export default router;
