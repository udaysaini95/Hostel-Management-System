import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import * as schema from "./schema.js";

const { databaseUrl } = getRuntimeConfig();
const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });
