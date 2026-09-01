import "dotenv/config";
import { requireDatabaseUrl } from "./src/config/runtimeConfig.js";

const databaseUrl = requireDatabaseUrl();

/** @type { import("drizzle-kit").Config } */
export default {
  schema: "./src/db/schema.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
};
