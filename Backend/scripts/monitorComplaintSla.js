import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema.js";
import { monitorComplaintSlaBreaches } from "../src/services/complaintSlaService.js";

const { Pool } = pg;

const run = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });
  const database = drizzle(pool, { schema });

  try {
    const result = await monitorComplaintSlaBreaches(database);
    console.log(`Complaint SLA monitor recorded ${result.processed} breach(es).`);
  } finally {
    await pool.end();
  }
};

run().catch((error) => {
  console.error(`Complaint SLA monitor failed: ${error.message}`);
  process.exitCode = 1;
});
