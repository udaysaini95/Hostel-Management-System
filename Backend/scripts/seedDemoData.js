import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema.js";
import {
  assertDemoSeedAllowed,
  resetDemoData,
  seedDemoData,
} from "../src/db/demoSeed.js";

const { Pool } = pg;
const shouldReset = process.argv.includes("--reset");

const run = async () => {
  assertDemoSeedAllowed(process.env);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });
  const database = drizzle(pool, { schema });

  try {
    const result = await database.transaction(async (transaction) => {
      if (shouldReset) {
        await resetDemoData(transaction);
      }

      return seedDemoData(
        transaction,
        process.env.DEMO_SEED_PASSWORD || "HostelMateDemo!2026"
      );
    });

    console.log(
      `Demo seed complete: ${result.hostels} hostels, ${result.users} users, ${result.memberships} memberships.`
    );
  } finally {
    await pool.end();
  }
};

run().catch((error) => {
  console.error(`Demo seed failed: ${error.message}`);
  process.exitCode = 1;
});
