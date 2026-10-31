import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { config } from "dotenv";

config(); // load .env

// How many rows you want to generate (you can change this)
const TOTAL_BRANDS = 10;
const VARIANTS_PER_BRAND = 100;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool);

  // 1. Create demo brands
  const brandIds: string[] = [];
  for (let i = 1; i <= TOTAL_BRANDS; i++) {
    const result = await db.execute(sql`
      INSERT INTO brands (slug, name)
      VALUES (${`load-test-brand-${i}`}, ${`Load Test Brand ${i}`})
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    brandIds.push(result.rows[0].id as string);
  }
  console.log(`✅ ${brandIds.length} brands created`);

  // 2. Insert product_variants in batches for each brand
  let total = 0;
  for (const brandId of brandIds) {
    // We need a product_id — use the brand_id as a fake product_id (UUID column)
    const productId = brandId; // simplification for load‑test data

    const values: string[] = [];
    for (let i = 1; i <= VARIANTS_PER_BRAND; i++) {
      total++;
      const sku = `LT-${brandId.slice(0, 8)}-${String(i).padStart(4, "0")}`;
      const title = `Variant ${total}`;
      const pricePaise = randomInt(50000, 300000); // ₹500 – ₹3000
      const stock = randomInt(0, 200);
      values.push(
        `(gen_random_uuid(), '${productId}', '${brandId}', '${sku}', '${title}', ${pricePaise}, ${stock})`
      );
    }

    await db.execute(sql`
      INSERT INTO product_variants (id, product_id, brand_id, sku, title, price_paise, stock_quantity)
      VALUES ${sql.raw(values.join(",\n"))}
      ON CONFLICT (sku) DO NOTHING;
    `);
    console.log(`  Inserted ${total} / ${TOTAL_BRANDS * VARIANTS_PER_BRAND} variants`);
  }

  await pool.end();
  console.log("✅ Load‑test data generated");
}

main().catch((e) => {
  console.error("❌ Load‑test failed:", e);
  process.exit(1);
});
