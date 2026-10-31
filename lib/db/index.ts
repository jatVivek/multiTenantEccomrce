import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../src/db/schema";

declare global {
  // eslint-disable-next-line no-var
  var __clothing_db_pool: Pool | undefined;
}

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@127.0.0.1:5432/clothing_setup";

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
