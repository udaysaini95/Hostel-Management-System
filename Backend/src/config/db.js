import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

const connectDb = async () => {
  await db.execute(sql`select 1`);
  console.log("PostgreSQL database connection verified.");
};

export default connectDb;
