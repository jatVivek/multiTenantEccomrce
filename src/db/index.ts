import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const url = new URL(databaseUrl);

const pool = new Pool({
  host: url.hostname,
  port: Number(url.port) || 5432,
  database: url.pathname.slice(1), // remove leading /
  user: url.username,
  password: url.password,
  max: 20,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });
export { pool };
