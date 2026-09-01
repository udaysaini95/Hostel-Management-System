import "dotenv/config";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const { Pool } = pg;

const run = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run database migrations.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });

  try {
    const database = drizzle(pool);
    const migrationsFolder = fileURLToPath(
      new URL("../drizzle", import.meta.url)
    );

    await migrate(database, { migrationsFolder });
    console.log("Database migrations completed successfully.");
  } finally {
    await pool.end();
  }
};

run().catch((error) => {
  console.error(`Database migration failed: ${error.message}`);
  process.exitCode = 1;
});
