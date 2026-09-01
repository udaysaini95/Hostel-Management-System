import "dotenv/config";
import pg from "pg";
import { requireDatabaseUrl } from "../config/runtimeConfig.js";

const { Pool } = pg;

async function runMigration() {
  const migrationPool = new Pool({
    connectionString: requireDatabaseUrl(),
    max: 1,
  });

  try {
    console.log("Applying legacy complaint schema updates...");

    await migrationPool.query(`
      ALTER TABLE complaints
      ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'P2 - Medium' NOT NULL,
      ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP,
      ADD COLUMN IF NOT EXISTS resolution_note TEXT;
    `);

    await migrationPool.query(`
      ALTER TABLE complaint_timelines
      ADD COLUMN IF NOT EXISTS note TEXT;
    `);

    console.log("Complaint schema migration completed successfully.");
  } finally {
    await migrationPool.end();
  }
}

runMigration().catch((error) => {
  console.error("Migration error:", error);
  process.exitCode = 1;
});
