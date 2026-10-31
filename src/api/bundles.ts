import { Hono } from "hono";
import { db } from "../db/index";
import { bundles } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  createBundleSchema,
  updateBundleSchema,
} from "../types/validators";
import type { AppEnv } from "../types/hono";

export const bundlesRouter = new Hono<AppEnv>();

// List bundles for a brand
bundlesRouter.get("/", async (c) => {
  const brand = c.get("brand");

  const rows = await db
    .select()
    .from(bundles)
    .where(and(eq(bundles.brandId, brand.id), eq(bundles.isActive, true)));

  return c.json(rows);
});

// Get a single bundle
bundlesRouter.get("/:bundleId", async (c) => {
  const brand = c.get("brand");
  const bundleId = c.req.param("bundleId");

  const [row] = await db
    .select()
    .from(bundles)
    .where(and(eq(bundles.id, bundleId), eq(bundles.brandId, brand.id)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Bundle not found" }, 404);
  }

  return c.json(row);
});

// Create a new bundle
bundlesRouter.post("/", async (c) => {
  const brand = c.get("brand");
  const body = await c.req.json();
  const parsed = createBundleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [created] = await db
    .insert(bundles)
    .values({ ...parsed.data, brandId: brand.id })
    .returning();

  return c.json(created, 201);
});

// Update a bundle
bundlesRouter.patch("/:bundleId", async (c) => {
  const brand = c.get("brand");
  const bundleId = c.req.param("bundleId");
  const body = await c.req.json();
  const parsed = updateBundleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(bundles)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(and(eq(bundles.id, bundleId), eq(bundles.brandId, brand.id)))
    .returning();

  if (!updated) {
    return c.json({ error: "Bundle not found" }, 404);
  }

  return c.json(updated);
});

// Soft-delete (deactivate) a bundle
bundlesRouter.delete("/:bundleId", async (c) => {
  const brand = c.get("brand");
  const bundleId = c.req.param("bundleId");

  const [deactivated] = await db
    .update(bundles)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(and(eq(bundles.id, bundleId), eq(bundles.brandId, brand.id)))
    .returning();

  if (!deactivated) {
    return c.json({ error: "Bundle not found" }, 404);
  }

  return c.json({ message: "Bundle deactivated", bundle: deactivated });
});
