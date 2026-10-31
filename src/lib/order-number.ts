import { db } from "../db/index";
import { brandOrderCounters } from "../db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Atomically generates the next order number for a given brand.
 *
 * Uses INSERT … ON CONFLICT + RETURNING to guarantee uniqueness
 * even under concurrent requests.
 */
export async function nextOrderNumber(brandId: string): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO brand_order_counters (brand_id, last_number)
    VALUES (${brandId}, 1)
    ON CONFLICT (brand_id) DO UPDATE
      SET last_number = brand_order_counters.last_number + 1
    RETURNING last_number;
  `);

  return result.rows[0].last_number as number;
}
