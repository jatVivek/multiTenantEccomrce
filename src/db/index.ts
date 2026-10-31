import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let databaseUrl: string;
if (process.env.DATABASE_URL) {
  databaseUrl = process.env.DATABASE_URL;
} else if (process.env.NODE_ENV === "development") {
  // Local development fallback
  databaseUrl = "postgres://postgres:postgres@127.0.0.1:5432/clothing_setup";
} else {
  // In production the DB URL must be set.
  throw new Error("DATABASE_URL is required in production. Configure it in Vercel environment variables.");
}

let pool: Pool;
try {
  const url = new URL(databaseUrl);
  pool = new Pool({
    host: url.hostname || "127.0.0.1",
    port: Number(url.port) || 5432,
    database: url.pathname.slice(1) || "clothing_setup",
    user: url.username || "postgres",
    password: url.password || "postgres",
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
} catch {
  pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export const db = drizzle(pool, { schema });
export { pool };
