import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../lib/db";
import { brands, products, productVariants, adminUsers } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getAdminByEmail,
  verifyAdminBrandAccess,
  getAdminProductsWithVariants,
  createProductWithVariants,
  updateProductVariantStockAndPrice,
  deleteProductAdmin,
} from "../lib/db/queries/admin";

describe("Admin Product Management & Virtualization Suite", () => {
  let brand1: any;
  let brand2: any;
  let brandAdmin1: any;
  let createdTestProduct: any;

  beforeAll(async () => {
    // 1. Fetch the two test brands
    const [b1] = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, "urban-streetwear"));
    const [b2] = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, "linen-and-co"));

    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    brand1 = b1;
    brand2 = b2;

    // 2. Fetch Brand Admin (assigned exclusively to brand1)
    const adminRec = await getAdminByEmail("brandadmin1@ecom.local");
    expect(adminRec).not.toBeNull();
    brandAdmin1 = adminRec!.user;
  });

  it("creates a product with multiple size variants for Brand 1", async () => {
    const uniqueSlug = `test-tee-${Date.now()}`;
    const newProduct = await createProductWithVariants(brand1.id, {
      title: "Test Oversized Graphic Tee",
      slug: uniqueSlug,
      category: "T-Shirts",
      description: "Heavyweight 240 GSM combed cotton.",
      basePricePaise: 189900,
      compareAtPricePaise: 249900,
      images: ["https://example.com/tee1.jpg"],
      featured: true,
      variants: [
        {
          sku: `${uniqueSlug.toUpperCase()}-S`,
          title: "Test Oversized Graphic Tee - S",
          pricePaise: 189900,
          stockQuantity: 15,
          attributes: { size: "S" },
        },
        {
          sku: `${uniqueSlug.toUpperCase()}-M`,
          title: "Test Oversized Graphic Tee - M",
          pricePaise: 189900,
          stockQuantity: 20,
          attributes: { size: "M" },
        },
        {
          sku: `${uniqueSlug.toUpperCase()}-L`,
          title: "Test Oversized Graphic Tee - L",
          pricePaise: 189900,
          stockQuantity: 10,
          attributes: { size: "L" },
        },
      ],
    });

    expect(newProduct).toBeDefined();
    expect(newProduct.id).toBeDefined();
    expect(newProduct.brandId).toBe(brand1.id);
    expect(newProduct.title).toBe("Test Oversized Graphic Tee");
    expect(newProduct.variants.length).toBe(3);
    expect(newProduct.totalStock).toBe(45); // 15 + 20 + 10

    createdTestProduct = newProduct;
  });

  it("lists products with variants and aggregated stock under Brand 1", async () => {
    const list = await getAdminProductsWithVariants(brand1.id, 50);
    expect(list.length).toBeGreaterThan(0);

    const found = list.find((p) => p.id === createdTestProduct.id);
    expect(found).toBeDefined();
    expect(found?.variants.length).toBe(3);
    expect(found?.totalStock).toBe(45);
  });

  it("enforces tenant isolation: Brand 1's newly created product NEVER appears in Brand 2's list", async () => {
    const brand2Products = await getAdminProductsWithVariants(brand2.id, 50);
    const foundInBrand2 = brand2Products.find(
      (p) => p.id === createdTestProduct.id || p.slug === createdTestProduct.slug
    );
    expect(foundInBrand2).toBeUndefined();
  });

  it("rejects product creation attempts for unauthorized brands", async () => {
    // brandAdmin1 is authorized for brand1, but NOT brand2
    const hasAccessBrand2 = await verifyAdminBrandAccess(
      brandAdmin1.id,
      brandAdmin1.role,
      brand2.id
    );
    expect(hasAccessBrand2).toBe(false);
  });

  it("updates variant stock quantity and price cleanly within tenant", async () => {
    const targetVariant = createdTestProduct.variants[0];
    const updated = await updateProductVariantStockAndPrice(
      brand1.id,
      targetVariant.id,
      199900,
      35
    );

    expect(updated.id).toBe(targetVariant.id);
    expect(updated.stockQuantity).toBe(35);
    expect(updated.pricePaise).toBe(199900);
  });

  it("cross-tenant variant update is rejected by query layer", async () => {
    const targetVariant = createdTestProduct.variants[0];
    // Attempting to modify brand1's variant with brand2.id must throw
    await expect(
      updateProductVariantStockAndPrice(brand2.id, targetVariant.id, 149900, 99)
    ).rejects.toThrow(/Variant not found or unauthorized brand modification/);
  });

  it("cross-tenant product deletion is rejected by query layer", async () => {
    // Attempting to delete brand1's product with brand2.id must throw
    await expect(
      deleteProductAdmin(brand2.id, createdTestProduct.id)
    ).rejects.toThrow(/Product not found or unauthorized brand modification/);
  });

  it("deletes the product and cascades to its variants for Brand 1", async () => {
    const result = await deleteProductAdmin(brand1.id, createdTestProduct.id);
    expect(result).toBe(true);

    // Verify it is gone from products
    const [checkProd] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, createdTestProduct.id),
          eq(products.brandId, brand1.id)
        )
      );
    expect(checkProd).toBeUndefined();

    // Verify variants are gone
    const checkVariants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, createdTestProduct.id));
    expect(checkVariants.length).toBe(0);
  });
});
