import { describe, it, expect } from "vitest";
import app from "../src/api/index";
import { db } from "../src/db/index";
import { brands } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("Custom Domain Resolution & Combo Bundles", () => {
  it("resolves tenant automatically via Host header matching custom_domain", async () => {
    // 1. Assign custom_domain to demo-brand
    await db
      .update(brands)
      .set({ customDomain: "shop.democouture.local" })
      .where(eq(brands.slug, "demo-brand"));

    // 2. Request without :slug in path, but passing Host header to tenant-scoped route
    const res = await app.request("/api/tenant/products", {
      headers: {
        Host: "shop.democouture.local",
      },
    });

    // Brand is resolved from the Host header
    expect(res.status).toBe(200);
    const products = await res.json();
    expect(Array.isArray(products)).toBe(true);
  });

  it("GET /api/brands/:slug/bundles lists available combo packages", async () => {
    const res = await app.request("/api/brands/demo-brand/bundles");
    expect(res.status).toBe(200);
    const bundles = await res.json();
    expect(Array.isArray(bundles)).toBe(true);
    expect(bundles.length).toBeGreaterThan(0);
    expect(bundles[0]).toHaveProperty("bundlePricePaise");
    expect(bundles[0]).toHaveProperty("items");
  });
});
