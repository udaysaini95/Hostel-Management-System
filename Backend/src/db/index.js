import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL is not set in environment variables!");
}

const sql = neon(process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/hostel_db");
export const db = drizzle(sql, { schema });
