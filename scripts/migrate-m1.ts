import "dotenv/config";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Migrating Phase M1: Creating media_assets table...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "media_assets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "brand_id" uuid NOT NULL REFERENCES "brands"("id") ON DELETE CASCADE,
      "type" varchar(20) DEFAULT 'image' NOT NULL,
      "url" text NOT NULL,
      "storage_path" text NOT NULL,
      "mime" varchar(100) NOT NULL,
      "size_bytes" integer NOT NULL,
      "width" integer,
      "height" integer,
      "duration_seconds" integer,
      "alt" text,
      "blur_data_url" text,
      "poster_url" text,
      "created_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "media_assets_brand_id_idx" ON "media_assets" ("brand_id");
    CREATE INDEX IF NOT EXISTS "media_assets_created_at_idx" ON "media_assets" ("created_at");
  `);

  console.log("Backfilling existing product images into media_assets via set-based query...");

  const res: any = await db.execute(sql`
    INSERT INTO "media_assets" (
      "brand_id",
      "type",
      "url",
      "storage_path",
      "mime",
      "size_bytes",
      "alt",
      "blur_data_url"
    )
    SELECT DISTINCT ON (p.brand_id, img_url)
      p.brand_id,
      'image',
      img_url,
      'legacy/' || md5(img_url),
      'image/jpeg',
      150000,
      p.title,
      'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoKAAoAPm0wlkukKSQipCAA4CYJaQAA3b/xAA=='
    FROM "products" p,
    LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(p.images) = 'array' THEN p.images ELSE '[]'::jsonb END) AS img_url
    WHERE p.images IS NOT NULL AND jsonb_typeof(p.images) = 'array'
    ON CONFLICT DO NOTHING;
  `);

  console.log(`Phase M1 migration complete! Ingested ${res.rowCount || 0} distinct assets.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
