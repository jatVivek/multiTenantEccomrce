import { describe, it, expect } from "vitest";
import app from "../src/api/index";
import { db } from "../src/db/index";
import { productVariants, brands } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("Inventory Decrement & Order Fulfillment", () => {
  let testVariantId = "";
  let brandId = "";
  let orderId = "";
  let adminToken = "";

  it("decrements variant stockQuantity atomically on order creation", async () => {
    // 1. Get a brand & variant
    const [brand] = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, "demo-brand"))
      .limit(1);
    brandId = brand.id;

    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: brand.id,
        brandId: brand.id,
        sku: `STOCK-TEST-${Date.now()}`,
        title: "Limited Inventory Hoodie",
        pricePaise: 149900,
        stockQuantity: 5,
      })
      .returning();
    testVariantId = variant.id;

    // 2. Order 2 units
    const res = await app.request("/api/brands/demo-brand/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Stock Buyer",
        customerPhone: "9876543210",
        deliveryAddress: {
          line1: "Street 4",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411001",
        },
        items: [
          {
            variantId: testVariantId,
            title: variant.title,
            sku: variant.sku,
            qty: 2,
            unitPricePaise: variant.pricePaise,
          },
        ],
        shippingPaise: 0,
        paymentMethod: "COD",
        idempotencyKey: `stock_order_${Date.now()}`,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    orderId = json.id;

    // 3. Verify stock decreased from 5 to 3
    const [updatedVariant] = await db
      .select({ stockQuantity: productVariants.stockQuantity })
      .from(productVariants)
      .where(eq(productVariants.id, testVariantId))
      .limit(1);

    expect(updatedVariant.stockQuantity).toBe(3);
  });

  it("rejects order when requested quantity exceeds available stock", async () => {
    // Try ordering 10 units when only 3 remain
    const res = await app.request("/api/brands/demo-brand/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Greedy Buyer",
        customerPhone: "9876543210",
        deliveryAddress: {
          line1: "Street 4",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411001",
        },
        items: [
          {
            variantId: testVariantId,
            title: "Limited Inventory Hoodie",
            sku: "SKU",
            qty: 10,
            unitPricePaise: 149900,
          },
        ],
        shippingPaise: 0,
        paymentMethod: "COD",
        idempotencyKey: `oversell_order_${Date.now()}`,
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Insufficient stock");
  });

  it("allows admin to view orders and update fulfillment details", async () => {
    // Register / Login admin
    const email = `fulfillment-admin-${Date.now()}@example.com`;
    const regRes = await app.request("/api/admin/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "securePassword123!",
        role: "SUPER_ADMIN",
      }),
    });
    const regData = await regRes.json();
    adminToken = regData.token;

    // List orders
    const listRes = await app.request("/api/admin/orders", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.status).toBe(200);
    const ordersList = await listRes.json();
    expect(Array.isArray(ordersList)).toBe(true);
    expect(ordersList.length).toBeGreaterThan(0);

    // Update fulfillment (status, courier, tracking)
    const patchRes = await app.request(`/api/admin/orders/${orderId}/fulfillment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: "DISPATCHED",
        courier: "Delhivery",
        trackingId: "DLV123456789IN",
      }),
    });

    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.order.status).toBe("DISPATCHED");
    expect(patchData.order.courier).toBe("Delhivery");
    expect(patchData.order.trackingId).toBe("DLV123456789IN");
  });
});
