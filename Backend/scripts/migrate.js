import "dotenv/config";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { requireDatabaseUrl } from "../src/config/runtimeConfig.js";

const { Pool } = pg;

const run = async () => {
  const databaseUrl = requireDatabaseUrl();

  const pool = new Pool({
    connectionString: databaseUrl,
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
