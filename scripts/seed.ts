import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { config } from "dotenv";

config(); // load .env

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool);

  // Insert a demo brand (uses slug as the unique constraint)
  await db.execute(sql`
    INSERT INTO brands (slug, name)
    VALUES ('demo-brand', 'Demo Brand')
    ON CONFLICT (slug) DO NOTHING;
  `);

  console.log("✅ Seed data inserted");
  await pool.end();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
