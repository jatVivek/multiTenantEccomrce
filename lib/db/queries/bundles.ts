import { db } from "../index";
import { bundles, type Bundle } from "../../../src/db/schema";
import { eq, and } from "drizzle-orm";

export async function getBundlesForProduct(brandId: string, productId: string): Promise<Bundle[]> {
  if (!brandId) throw new Error("brandId is required");
  if (!productId) return [];

  return db
    .select()
    .from(bundles)
    .where(
      and(
        eq(bundles.brandId, brandId),
        eq(bundles.productId, productId),
        eq(bundles.isActive, true)
      )
    );
}

export async function getBrandBundles(brandId: string): Promise<Bundle[]> {
  if (!brandId) throw new Error("brandId is required");

  return db
    .select()
    .from(bundles)
    .where(and(eq(bundles.brandId, brandId), eq(bundles.isActive, true)));
}
