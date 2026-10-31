import type { Context, Next } from "hono";
import { db } from "../db/index";
import { brands } from "../db/schema";
import { eq, or } from "drizzle-orm";
import type { AppEnv } from "../types/hono";

/**
 * Middleware that resolves a brand from:
 * 1. `:slug` route param (e.g. `/api/brands/:slug` or `/store/:slug`)
 * 2. Host header / Custom Domain (e.g. `Host: shop.demobrand.com`)
 */
export async function brandResolver(c: Context<AppEnv>, next: Next) {
  const slug = c.req.param("slug");
  const host = c.req.header("host")?.split(":")[0]?.toLowerCase();

  let brandRows;

  if (slug) {
    brandRows = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, slug))
      .limit(1);
  } else if (host && host !== "localhost" && host !== "127.0.0.1") {
    brandRows = await db
      .select()
      .from(brands)
      .where(eq(brands.customDomain, host))
      .limit(1);
  }

  if (!brandRows || brandRows.length === 0) {
    return c.json({ error: "Brand not found" }, 404);
  }

  c.set("brand", brandRows[0]);
  await next();
}
