import { db } from "../db/index.js";
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService.js";
import { handleControllerError } from "../utils/apiErrors.js";

export const getNotifications = async (req, res) => {
  try {
    return res.json(await listMyNotifications(db, req.user, req.query));
  } catch (error) {
    return handleControllerError(res, error, "List Notifications Error");
  }
};

export const getNotificationUnreadCount = async (req, res) => {
  try {
    return res.json(await getUnreadNotificationCount(db, req.user));
  } catch (error) {
    return handleControllerError(res, error, "Count Notifications Error");
  }
};

export const readNotification = async (req, res) => {
  try {
    return res.json(await markNotificationRead(db, req.user, req.params.id));
  } catch (error) {
    return handleControllerError(res, error, "Read Notification Error");
  }
};

export const readAllNotifications = async (req, res) => {
  try {
    return res.json(await markAllNotificationsRead(db, req.user));
  } catch (error) {
    return handleControllerError(res, error, "Read All Notifications Error");
  }
};
