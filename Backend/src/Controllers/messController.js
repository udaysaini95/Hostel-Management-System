import { db } from "../db/index.js";
import { messMenus, messFeedbacks, messIssues, users } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

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

    res.json({ message: "Menu Created" });
  } catch (err) {
    console.error("Create Menu Error:", err);
    res.status(500).json({ message: "Menu save failed", error: err.message });
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
      return res.status(404).json({ message: "No menu today" });
    }

    const menu = todayMenus[0];
    res.json({
      ...menu,
      breakfast: menu.breakfast ? JSON.parse(menu.breakfast) : [],
      lunch: menu.lunch ? JSON.parse(menu.lunch) : [],
      dinner: menu.dinner ? JSON.parse(menu.dinner) : [],
    });
  } catch (err) {
    console.error("Today Menu Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
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

    res.json({ message: "Feedback Saved", feedback });
  } catch (error) {
    console.error("Create Feedback Error:", error);
    res.status(500).json({ message: "Feedback failed", error: error.message });
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
    console.error("Get Feedback Error:", error);
    res.status(500).json({ message: "Failed to load feedback", error: error.message });
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
  } catch (err) {
    console.error("Create Issue Error:", err);
    res.status(500).json({ message: "Failed to create issue", error: err.message });
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
  } catch (err) {
    console.error("Get My Issues Error:", err);
    res.status(500).json({ message: "Failed to fetch issues", error: err.message });
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
  } catch (err) {
    console.error("Get All Issues Error:", err);
    res.status(500).json({ message: "Failed to fetch issues", error: err.message });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const issueId = Number(req.params.id);
    const { status } = req.body;

    if (!["Pending", "In Progress", "Resolved"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const [updated] = await db
      .update(messIssues)
      .set({ status })
      .where(eq(messIssues.id, issueId))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Issue not found" });
    }

    res.json({ ...updated, _id: updated.id });
  } catch (err) {
    console.error("Update Mess Issue Status Error:", err);
    res.status(500).json({ message: "Failed to update status", error: err.message });
  }
};
