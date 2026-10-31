import { Hono } from "hono";
import { db } from "../db/index";
import { brands } from "../db/schema";
import { eq } from "drizzle-orm";
import { createBrandSchema, updateBrandSchema } from "../types/validators";

export const brandsRouter = new Hono();

// List all active brands
brandsRouter.get("/", async (c) => {
  const rows = await db
    .select()
    .from(brands)
    .where(eq(brands.isActive, true))
    .orderBy(brands.name);

  return c.json(rows);
});

// Get a single brand by slug
brandsRouter.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const row = await db
    .select()
    .from(brands)
    .where(eq(brands.slug, slug))
    .limit(1);

  if (row.length === 0) {
    return c.json({ error: "Brand not found" }, 404);
  }

  return c.json(row[0]);
});

// Create a new brand
brandsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createBrandSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [created] = await db.insert(brands).values(parsed.data).returning();
  return c.json(created, 201);
});

// Update an existing brand
brandsRouter.patch("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json();
  const parsed = updateBrandSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(brands)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(brands.slug, slug))
    .returning();

  if (!updated) {
    return c.json({ error: "Brand not found" }, 404);
  }

  return c.json(updated);
});

// Soft-delete (deactivate) a brand
brandsRouter.delete("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const [deactivated] = await db
    .update(brands)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(brands.slug, slug))
    .returning();

  if (!deactivated) {
    return c.json({ error: "Brand not found" }, 404);
  }

  return c.json({ message: "Brand deactivated", brand: deactivated });
});
