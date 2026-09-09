import { db } from "../db/index.js";
import { handleControllerError } from "../utils/apiErrors.js";
import {
  getMessMenuByDate,
  listManageableMessHostels,
  listMessMenus,
  listMessMenuVersions,
  publishMessMenu,
} from "../services/messMenuService.js";
import {
  getMessFeedbackSummary,
  submitMessFeedback,
} from "../services/messFeedbackService.js";
import {
  createMessIssue as createNormalizedMessIssue,
  listManagedMessIssues,
  listOwnMessIssues,
  readMessIssueEvidence,
  transitionMessIssue,
} from "../services/messIssueService.js";

const contentDisposition = (filename) => {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

export const getManageableMessHostels = async (req, res) => {
  try {
    return res.json(await listManageableMessHostels(db, req.user));
  } catch (error) {
    return handleControllerError(res, error, "List Mess Hostels Error");
  }
};

export const publishCalendarMenu = async (req, res) => {
  try {
    const menu = await publishMessMenu(db, req.user, {
      date: req.params.date,
      hostelId: req.body.hostelId,
      meals: req.body.meals,
    });
    return res.status(menu.version === 1 ? 201 : 200).json({ menu });
  } catch (error) {
    return handleControllerError(res, error, "Publish Mess Menu Error");
  }
};

export const getCalendarMenu = async (req, res) => {
  try {
    const menu = await getMessMenuByDate(db, req.user, {
      date: req.params.date,
      hostelId: req.query.hostelId,
    });
    return res.json({ menu });
  } catch (error) {
    return handleControllerError(res, error, "Get Mess Menu Error");
  }
};

export const getCalendarMenus = async (req, res) => {
  try {
    return res.json(await listMessMenus(db, req.user, req.query));
  } catch (error) {
    return handleControllerError(res, error, "List Mess Menus Error");
  }
};

export const getCalendarMenuVersions = async (req, res) => {
  try {
    return res.json(await listMessMenuVersions(db, req.user, {
      date: req.params.date,
      hostelId: req.query.hostelId,
    }));
  } catch (error) {
    return handleControllerError(res, error, "List Mess Menu Versions Error");
  }
};

// ================= CREATE / UPDATE MENU =================
export const createMenu = async (req, res) => {
  try {
    const { date, breakfast, lunch, dinner } = req.body;
    const calendarDate = (date || new Date().toISOString()).slice(0, 10);
    const menu = await publishMessMenu(db, req.user, {
      date: calendarDate,
      hostelId: req.body.hostelId,
      meals: {
        breakfast: Array.isArray(breakfast) ? breakfast : [breakfast],
        lunch: Array.isArray(lunch) ? lunch : [lunch],
        dinner: Array.isArray(dinner) ? dinner : [dinner],
      },
    }, {
      allowDefaultHostel: true,
    });
    return res.status(menu.version === 1 ? 201 : 200).json({
      message: menu.version === 1 ? "Menu Created" : "Menu Updated",
      menu,
    });
  } catch (error) {
    return handleControllerError(res, error, "Create Menu Error");
  }
};

// ================= GET TODAY MENU =================
export const getTodayMenu = async (req, res) => {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const menu = await getMessMenuByDate(db, req.user, { date });
    return res.json({
      ...menu,
      menuDate: menu.date,
      breakfast: menu.meals.breakfast,
      lunch: menu.meals.lunch,
      dinner: menu.meals.dinner,
    });
  } catch (error) {
    return handleControllerError(res, error, "Get Today Menu Error");
  }
};

// ================= CREATE FEEDBACK =================
export const createFeedback = async (req, res) => {
  try {
    const feedback = await submitMessFeedback(db, req.user, req.body);
    return res.status(201).json({ message: "Rating submitted", feedback });
  } catch (error) {
    return handleControllerError(res, error, "Submit Mess Feedback Error");
  }
};

export const getFeedbackSummary = async (req, res) => {
  try {
    return res.json(await getMessFeedbackSummary(db, req.user, req.query));
  } catch (error) {
    return handleControllerError(res, error, "Get Mess Feedback Summary Error");
  }
};

// ================= MESS ISSUES =================
export const createIssue = async (req, res) => {
  try {
    const issue = await createNormalizedMessIssue(
      db,
      req.user,
      req.body,
      req.file
    );
    return res.status(201).json({ issue });
  } catch (error) {
    return handleControllerError(res, error, "Create Mess Issue Error");
  }
};

export const getMyIssues = async (req, res) => {
  try {
    return res.json(await listOwnMessIssues(db, req.user, req.query));
  } catch (error) {
    return handleControllerError(res, error, "Get My Mess Issues Error");
  }
};

export const getAllIssues = async (req, res) => {
  try {
    return res.json(await listManagedMessIssues(db, req.user, req.query));
  } catch (error) {
    return handleControllerError(res, error, "Get All Mess Issues Error");
  }
};

export const updateStatus = async (req, res) => {
  try {
    const issue = await transitionMessIssue(
      db,
      req.user,
      req.params.id,
      req.body
    );
    return res.json({ issue });
  } catch (error) {
    return handleControllerError(res, error, "Update Mess Issue Status Error");
  }
};

export const downloadIssueEvidence = async (req, res) => {
  try {
    const evidence = await readMessIssueEvidence(db, req.user, req.params.id);
    res.set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDisposition(evidence.originalName),
      "Content-Length": String(evidence.contents.length),
      "Content-Type": evidence.mimeType,
      "X-Content-Type-Options": "nosniff",
    });
    return res.send(evidence.contents);
  } catch (error) {
    return handleControllerError(res, error, "Download Mess Issue Evidence Error");
  }
};
