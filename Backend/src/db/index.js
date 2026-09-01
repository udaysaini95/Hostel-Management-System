import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import * as schema from "./schema.js";

const { databaseUrl } = getRuntimeConfig();
const { Pool } = pg;

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });
