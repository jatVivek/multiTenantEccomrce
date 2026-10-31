import "dotenv/config";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Migrating Phase M2: Adding videos and media_order columns to products...");

  await db.execute(sql`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "videos" jsonb DEFAULT '[]'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS "media_order" jsonb DEFAULT '[]'::jsonb NOT NULL;
  `);

  console.log("Phase M2 columns confirmed on products table!");
  process.exit(0);
}

main().catch((err) => {
  console.error("M2 migration failed:", err);
  process.exit(1);
});
