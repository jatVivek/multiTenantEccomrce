import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../src/db/schema";

declare global {
  // eslint-disable-next-line no-var
  var __clothing_db_pool: Pool | undefined;
}

let connectionString: string;
if (process.env.DATABASE_URL) {
  connectionString = process.env.DATABASE_URL;
} else if (process.env.NODE_ENV === "development") {
  // Local development fallback
  connectionString = "postgres://postgres:postgres@127.0.0.1:5432/clothing_setup";
} else {
  // In production the DB URL must be provided. Throw a clear error.
  throw new Error("DATABASE_URL is not set in production environment. Please configure the connection string in Vercel environment variables.");
}

const pool =
  global.__clothing_db_pool ||
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  global.__clothing_db_pool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
