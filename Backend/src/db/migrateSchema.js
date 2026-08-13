import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function runMigration() {
  try {
    console.log("Applying schema updates to Neon DB...");
    const sql = neon(process.env.DATABASE_URL);

    // 1. Update complaints table for FAANG SLA & Resolution Loop
    await sql`
      ALTER TABLE complaints 
      ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'P2 - Medium' NOT NULL,
      ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP,
      ADD COLUMN IF NOT EXISTS resolution_note TEXT;
    `;

    // 2. Update complaint_timelines for detailed audit trail
    await sql`
      ALTER TABLE complaint_timelines
      ADD COLUMN IF NOT EXISTS note TEXT;
    `;

    console.log("✅ Complaint schema migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
}

runMigration();
