import { describe, it, expect } from "vitest";
import app from "../src/api/index";
import { db } from "../src/db/index";
import { productVariants, brands } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("Payment & WhatsApp Integrations", () => {
  let createdOrderId = "";
  let variantId = "";

  it("POST /api/brands/demo-brand/orders generates UPI and WhatsApp links for UPI payment", async () => {
    // Ensure demo-brand has a variant with stock
    const [demoBrand] = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, "demo-brand"))
      .limit(1);

    const [v] = await db
      .insert(productVariants)
      .values({
        productId: demoBrand.id,
        brandId: demoBrand.id,
        sku: `PAY-SHIRT-${Date.now()}`,
        title: "Pure Cotton Shirt",
        pricePaise: 79900,
        stockQuantity: 20,
      })
      .returning();
    variantId = v.id;

    const res = await app.request("/api/brands/demo-brand/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "UPI Tester",
        customerPhone: "919988776655",
        deliveryAddress: {
          line1: "Flat 101, Residency",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
        },
        items: [
          {
            variantId: variantId,
            title: "Pure Cotton Shirt",
            sku: v.sku,
            qty: 1,
            unitPricePaise: 79900,
          },
        ],
        shippingPaise: 0,
        paymentMethod: "UPI",
        idempotencyKey: `upi_test_${Date.now()}`,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    createdOrderId = json.id;

    expect(json.paymentMethod).toBe("UPI");
    expect(json.paymentStatus).toBe("PENDING");
    expect(json.paymentLinks).toBeDefined();
    expect(json.paymentLinks.upi).toContain("upi://pay?");
    expect(json.paymentLinks.upi).toContain("pa=demobrand@okhdfcbank");
    expect(json.paymentLinks.whatsapp).toContain("https://wa.me/");
  });

  it("POST /api/brands/demo-brand/orders/:id/upi-utr records payment reference and marks PAID", async () => {
    const res = await app.request(`/api/brands/demo-brand/orders/${createdOrderId}/upi-utr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upiUtr: "UTR987654321012",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.order.upiUtr).toBe("UTR987654321012");
    expect(json.order.paymentStatus).toBe("PAID");
  });
});
