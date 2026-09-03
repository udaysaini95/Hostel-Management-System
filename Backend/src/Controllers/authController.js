import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { normalizeEmail } from "../domain/roles.js";
import { createAccessSession } from "../services/accessTokenService.js";
import { canStartSession } from "../domain/accountStatuses.js";

const DUMMY_PASSWORD_HASH =
  "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi";

export const register = (req, res) => {
  return res.status(410).json({
    code: "STUDENT_ACTIVATION_REQUIRED",
    message: "Students must activate an administrator-approved record",
  });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = normalizeEmail(email);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));

    const match = await bcrypt.compare(
      password,
      user?.password ?? DUMMY_PASSWORD_HASH
    );
    if (!user || !match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!canStartSession(user.accountStatus)) {
      return res.status(403).json({
        code: "ACCOUNT_INACTIVE",
        message: "This account is not active. Contact an administrator.",
      });
    }

    const authenticatedAt = new Date();
    await db
      .update(users)
      .set({ lastLoginAt: authenticatedAt, updatedAt: authenticatedAt })
      .where(eq(users.id, user.id));

    const session = createAccessSession(user);

    res.json({
      ...session,
      role: user.role,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const [user] = await db
      .select({
        id: users.id,
        _id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ message: "Failed to get profile", error: error.message });
  }
};
