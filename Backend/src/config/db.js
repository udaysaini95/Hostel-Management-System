import { db } from "../db/index.js";

const connectDb = async () => {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn("⚠️ DATABASE_URL environment variable is missing!");
      return;
    }
    console.log("⚡ Drizzle PostgreSQL Database Initialized!");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  }
};

export default connectDb;