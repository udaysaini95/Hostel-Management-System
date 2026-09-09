import { db } from "../db/index.js";
import { messIssues, users } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import {
  handleControllerError,
  sendApiError,
} from "../utils/apiErrors.js";
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
    const studentId = Number(req.user.id);
    const { issueType, mealType, description } = req.body;

    // Get student name
    const [user] = await db.select().from(users).where(eq(users.id, studentId));
    const studentName = user ? user.name : "Student";

    const [issue] = await db
      .insert(messIssues)
      .values({
        studentId,
        studentName,
        issueType,
        mealType,
        description,
        status: "Pending",
      })
      .returning();

    res.status(201).json({ ...issue, _id: issue.id });
  } catch (error) {
    return handleControllerError(res, error, "Create Mess Issue Error");
  }
};

export const getMyIssues = async (req, res) => {
  try {
    const studentId = Number(req.user.id);

    const issues = await db
      .select()
      .from(messIssues)
      .where(eq(messIssues.studentId, studentId))
      .orderBy(desc(messIssues.createdAt));

    const formatted = issues.map((i) => ({ ...i, _id: i.id }));
    res.json(formatted);
  } catch (error) {
    return handleControllerError(res, error, "Get My Mess Issues Error");
  }
};

export const getAllIssues = async (req, res) => {
  try {
    const issues = await db
      .select()
      .from(messIssues)
      .orderBy(desc(messIssues.createdAt));

    const formatted = issues.map((i) => ({ ...i, _id: i.id }));
    res.json(formatted);
  } catch (error) {
    return handleControllerError(res, error, "Get All Mess Issues Error");
  }
};

export const updateStatus = async (req, res) => {
  try {
    const issueId = Number(req.params.id);
    const { status } = req.body;

    if (!["Pending", "In Progress", "Resolved"].includes(status)) {
      return sendApiError(
        res,
        422,
        "VALIDATION_ERROR",
        "Enter a valid issue status"
      );
    }

    const [updated] = await db
      .update(messIssues)
      .set({ status })
      .where(eq(messIssues.id, issueId))
      .returning();

    if (!updated) {
      return sendApiError(
        res,
        404,
        "MESS_ISSUE_NOT_FOUND",
        "Mess issue not found"
      );
    }

    res.json({ ...updated, _id: updated.id });
  } catch (error) {
    return handleControllerError(res, error, "Update Mess Issue Status Error");
  }
};
