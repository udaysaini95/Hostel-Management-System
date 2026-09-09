import { db } from "../db/index.js";
import {
  getUnreadNoticeCount,
  listManagedNotices,
  listMyNotices,
  markNoticeRead,
  publishNotice,
} from "../services/noticeService.js";
import { handleControllerError } from "../utils/apiErrors.js";

export const createNotice = async (req, res) => {
  try {
    const notice = await publishNotice(db, req.user, req.body);
    return res.status(201).json(notice);
  } catch (error) {
    return handleControllerError(res, error, "Publish Notice Error");
  }
};

export const getMyNotices = async (req, res) => {
  try {
    return res.json(await listMyNotices(db, req.user, req.query));
  } catch (error) {
    return handleControllerError(res, error, "List My Notices Error");
  }
};

export const getManagedNotices = async (req, res) => {
  try {
    return res.json(await listManagedNotices(db, req.user, req.query));
  } catch (error) {
    return handleControllerError(res, error, "List Managed Notices Error");
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    return res.json(await getUnreadNoticeCount(db, req.user));
  } catch (error) {
    return handleControllerError(res, error, "Count Unread Notices Error");
  }
};

export const readNotice = async (req, res) => {
  try {
    return res.json(await markNoticeRead(db, req.user, req.params.id));
  } catch (error) {
    return handleControllerError(res, error, "Read Notice Error");
  }
};
