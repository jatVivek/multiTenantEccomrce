import { describe, it, expect } from "vitest";
import { getBrandBySlug } from "../lib/db/queries/brands";
import {
  getCatalogProducts,
  getProductBySlug,
  getFeaturedProducts,
} from "../lib/db/queries/products";
import { getBundlesForProduct } from "../lib/db/queries/bundles";
import { getOrdersByBrand } from "../lib/db/queries/orders";

describe("Storefront Multi-Tenant Isolation & Theme Engine", () => {
  it("enforces brand scoping in getCatalogProducts: throws if brandId is missing", async () => {
    // @ts-expect-error testing missing brandId
    await expect(getCatalogProducts({})).rejects.toThrow("brandId is required");
  });

  it("enforces brand scoping in getProductBySlug: throws if brandId is missing", async () => {
    await expect(getProductBySlug("", "some-slug")).rejects.toThrow("brandId is required");
  });

  it("enforces brand scoping in getOrdersByBrand: throws if brandId is missing", async () => {
    await expect(getOrdersByBrand("")).rejects.toThrow("brandId is required");
  });

  it("strictly isolates products: Brand 1 products never leak to Brand 2 queries", async () => {
    const brand1 = await getBrandBySlug("urban-streetwear");
    const brand2 = await getBrandBySlug("linen-and-co");

    expect(brand1).not.toBeNull();
    expect(brand2).not.toBeNull();

    const b1Catalog = await getCatalogProducts({ brandId: brand1!.id });
    const b2Catalog = await getCatalogProducts({ brandId: brand2!.id });

    expect(b1Catalog.products.length).toBeGreaterThan(0);
    expect(b2Catalog.products.length).toBeGreaterThan(0);

    // All products in b1Catalog must strictly have brandId === brand1.id
    for (const p of b1Catalog.products) {
      expect(p.brandId).toBe(brand1!.id);
      for (const v of p.variants) {
        expect(v.brandId).toBe(brand1!.id);
      }
    }

    // All products in b2Catalog must strictly have brandId === brand2.id
    for (const p of b2Catalog.products) {
      expect(p.brandId).toBe(brand2!.id);
      for (const v of p.variants) {
        expect(v.brandId).toBe(brand2!.id);
      }
    }

    // Cross-brand leakage test: trying to fetch Brand 1's product slug with Brand 2's brandId must return null
    const crossProduct = await getProductBySlug(
      brand2!.id,
      "heavyweight-boxy-tee-380gsm" // this is a Brand 1 product
    );
    expect(crossProduct).toBeNull();
  });

  it("strictly isolates bundles between brands", async () => {
    const brand1 = await getBrandBySlug("urban-streetwear");
    const brand2 = await getBrandBySlug("linen-and-co");

    const b1Product = await getProductBySlug(brand1!.id, "heavyweight-boxy-tee-380gsm");
    expect(b1Product).not.toBeNull();

    // Querying bundles for Brand 1's product with Brand 2's brandId must return empty array
    const leakedBundles = await getBundlesForProduct(brand2!.id, b1Product!.id);
    expect(leakedBundles).toEqual([]);
  });

  it("returns distinct theme configs for the two seeded brands", async () => {
    const brand1 = await getBrandBySlug("urban-streetwear");
    const brand2 = await getBrandBySlug("linen-and-co");

    const t1 = brand1?.themeConfig as any;
    const t2 = brand2?.themeConfig as any;

    expect(t1).toBeDefined();
    expect(t2).toBeDefined();

    // Verify distinct colors
    expect(t1.colors.background).not.toBe(t2.colors.background);
    expect(t2.colors.background).toBe("#F9F7F2"); // Light cream mode
    expect(t1.colors.primary).not.toBe(t2.colors.primary);
    expect(t2.colors.primary).toBe("#3F4A3C"); // Forest Sage

    // Verify distinct styles and fonts
    expect(t1.heroStyle).toBe("bold-banner");
    expect(t2.heroStyle).toBe("editorial-split");
    expect(t1.fonts.heading).toContain("Space Grotesk");
    expect(t2.fonts.heading).toContain("Playfair Display");
  });

  it("returns null for nonexistent brand slug", async () => {
    const nonexistent = await getBrandBySlug("nonexistent-brand-slug-xyz");
    expect(nonexistent).toBeNull();
  });
});
