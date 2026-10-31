import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@127.0.0.1:5432/clothing_setup";

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
