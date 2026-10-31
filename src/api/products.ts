import { Hono } from "hono";
import { db } from "../db/index";
import { productVariants } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  createProductVariantSchema,
  updateProductVariantSchema,
} from "../types/validators";
import type { AppEnv } from "../types/hono";

export const productsRouter = new Hono<AppEnv>();

// List all variants for a brand (brand resolved by middleware)
productsRouter.get("/", async (c) => {
  const brand = c.get("brand");

  const rows = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.brandId, brand.id))
    .orderBy(productVariants.position);

  return c.json(rows);
});

// Get a single variant by ID
productsRouter.get("/:variantId", async (c) => {
  const brand = c.get("brand");
  const variantId = c.req.param("variantId");

  const [row] = await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.brandId, brand.id)
      )
    )
    .limit(1);

  if (!row) {
    return c.json({ error: "Variant not found" }, 404);
  }

  return c.json(row);
});

// Create a new variant for a brand
productsRouter.post("/", async (c) => {
  const brand = c.get("brand");
  const body = await c.req.json();
  const parsed = createProductVariantSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [created] = await db
    .insert(productVariants)
    .values({ ...parsed.data, brandId: brand.id })
    .returning();

  return c.json(created, 201);
});

// Update a variant
productsRouter.patch("/:variantId", async (c) => {
  const brand = c.get("brand");
  const variantId = c.req.param("variantId");
  const body = await c.req.json();
  const parsed = updateProductVariantSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(productVariants)
    .set(parsed.data)
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.brandId, brand.id)
      )
    )
    .returning();

  if (!updated) {
    return c.json({ error: "Variant not found" }, 404);
  }

  return c.json(updated);
});

// Delete a variant
productsRouter.delete("/:variantId", async (c) => {
  const brand = c.get("brand");
  const variantId = c.req.param("variantId");

  const [deleted] = await db
    .delete(productVariants)
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.brandId, brand.id)
      )
    )
    .returning();

  if (!deleted) {
    return c.json({ error: "Variant not found" }, 404);
  }

  return c.json({ message: "Variant deleted", variant: deleted });
});
