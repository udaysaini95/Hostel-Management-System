import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import {
  createPublicRegistrationUserValues,
  normalizeEmail,
} from "../domain/roles.js";

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const normalizedEmail = normalizeEmail(email);

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Insert into SQL table
    const [insertedUser] = await db
      .insert(users)
      .values(
        createPublicRegistrationUserValues({
          name,
          email: normalizedEmail,
          passwordHash: hash,
        })
      )
      .returning();

    const token = jwt.sign(
      { id: insertedUser.id, role: insertedUser.role, email: insertedUser.email },
      getRuntimeConfig().jwtSecret
    );

    res.json({
      message: "Registered Successfully",
      token,
      role: insertedUser.role,
      user: {
        id: insertedUser.id,
        name: insertedUser.name,
        email: insertedUser.email,
        role: insertedUser.role,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Register failed", error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Wrong password" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      getRuntimeConfig().jwtSecret
    );

    res.json({
      token,
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
