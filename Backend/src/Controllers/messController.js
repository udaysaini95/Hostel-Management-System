import { db } from "../db/index.js";
import { messMenus, messFeedbacks, messIssues, users } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import {
  handleControllerError,
  sendApiError,
} from "../utils/apiErrors.js";

// ================= CREATE / UPDATE MENU =================
export const createMenu = async (req, res) => {
  try {
    const { date, breakfast, lunch, dinner } = req.body;
    const menuDate = date ? new Date(date) : new Date();

    const [existing] = await db
      .select()
      .from(messMenus)
      .where(eq(messMenus.menuDate, menuDate));

    const breakfastStr = Array.isArray(breakfast) ? JSON.stringify(breakfast) : breakfast;
    const lunchStr = Array.isArray(lunch) ? JSON.stringify(lunch) : lunch;
    const dinnerStr = Array.isArray(dinner) ? JSON.stringify(dinner) : dinner;

    if (existing) {
      await db
        .update(messMenus)
        .set({
          breakfast: breakfastStr,
          lunch: lunchStr,
          dinner: dinnerStr,
        })
        .where(eq(messMenus.id, existing.id));

      return res.json({ message: "Menu Updated" });
    }

    await db.insert(messMenus).values({
      menuDate,
      breakfast: breakfastStr,
      lunch: lunchStr,
      dinner: dinnerStr,
    });

    res.status(201).json({ message: "Menu Created" });
  } catch (error) {
    return handleControllerError(res, error, "Create Menu Error");
  }
};

// ================= GET TODAY MENU =================
export const getTodayMenu = async (req, res) => {
  try {
    const todayMenus = await db
      .select()
      .from(messMenus)
      .orderBy(desc(messMenus.menuDate))
      .limit(1);

    if (todayMenus.length === 0) {
      return sendApiError(res, 404, "MENU_NOT_FOUND", "No menu is available");
    }

    const menu = todayMenus[0];
    res.json({
      ...menu,
      breakfast: menu.breakfast ? JSON.parse(menu.breakfast) : [],
      lunch: menu.lunch ? JSON.parse(menu.lunch) : [],
      dinner: menu.dinner ? JSON.parse(menu.dinner) : [],
    });
  } catch (error) {
    return handleControllerError(res, error, "Get Today Menu Error");
  }
};

// ================= CREATE FEEDBACK =================
export const createFeedback = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const { rating, mealType, foodItem } = req.body;

    const [feedback] = await db
      .insert(messFeedbacks)
      .values({
        userId,
        rating: Number(rating) || 5,
        mealType: mealType || "General",
        foodItem: foodItem || "General",
      })
      .returning();

    res.status(201).json({ message: "Feedback Saved", feedback });
  } catch (error) {
    return handleControllerError(res, error, "Create Mess Feedback Error");
  }
};

// ================= GET ALL FEEDBACK (ADMIN) =================
export const getAllFeedback = async (req, res) => {
  try {
    const results = await db
      .select({
        id: messFeedbacks.id,
        mealType: messFeedbacks.mealType,
        foodItem: messFeedbacks.foodItem,
        rating: messFeedbacks.rating,
        feedbackDate: messFeedbacks.feedbackDate,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(messFeedbacks)
      .leftJoin(users, eq(messFeedbacks.userId, users.id))
      .orderBy(desc(messFeedbacks.feedbackDate));

    res.json(results);
  } catch (error) {
    return handleControllerError(res, error, "Get Mess Feedback Error");
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
