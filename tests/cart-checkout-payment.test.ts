import { describe, it, expect, beforeAll } from "vitest";
import { getBrandBySlug } from "../lib/db/queries/brands";
import { getProductBySlug } from "../lib/db/queries/products";
import { updateProductVariantStockAndPrice } from "../lib/db/queries/admin";
import {
  createOrderWithStockDecrement,
  getOrderById,
  recordUpiUtr,
} from "../lib/db/queries/orders";
import { validateCouponForOrder } from "../lib/db/queries/coupons";
import { generateUpiPaymentUrl, generateWhatsAppOrderLink } from "../src/lib/payments";

describe("Phase 4: Cart, Checkout & Payment Workflow", () => {
  beforeAll(async () => {
    const brand = await getBrandBySlug("urban-streetwear");
    if (brand) {
      const product = await getProductBySlug(brand.id, "heavyweight-boxy-tee-380gsm");
      if (product && product.variants) {
        for (const v of product.variants) {
          await updateProductVariantStockAndPrice(brand.id, v.id, undefined, 50);
        }
      }
    }
  });
  it("validates percentage and flat discount coupons correctly", async () => {
    const brand = await getBrandBySlug("urban-streetwear");
    expect(brand).not.toBeNull();

    // 1. Valid percentage coupon (STREET10: 10% off on min ₹1,499)
    const validPercent = await validateCouponForOrder(brand!.id, "STREET10", 200000); // ₹2,000
    expect(validPercent.valid).toBe(true);
    expect(validPercent.discountType).toBe("PERCENTAGE");
    expect(validPercent.discountPaise).toBe(20000); // ₹200 off
    expect(validPercent.finalAmountPaise).toBe(180000);

    // 2. Minimum threshold enforcement (Subtotal ₹1,000 < ₹1,499)
    const belowMin = await validateCouponForOrder(brand!.id, "STREET10", 100000);
    expect(belowMin.valid).toBe(false);
    expect(belowMin.error).toContain("Minimum order amount");

    // 3. Flat coupon (FLAT200: ₹200 off on min ₹1,999)
    const validFlat = await validateCouponForOrder(brand!.id, "FLAT200", 250000);
    expect(validFlat.valid).toBe(true);
    expect(validFlat.discountType).toBe("FLAT");
    expect(validFlat.discountPaise).toBe(20000); // ₹200
    expect(validFlat.finalAmountPaise).toBe(230000);

    // 4. Invalid coupon
    const invalid = await validateCouponForOrder(brand!.id, "NONEXISTENT", 500000);
    expect(invalid.valid).toBe(false);
  });

  it("atomically places an order, decrements variant stock, and generates payment links", async () => {
    const brand = await getBrandBySlug("urban-streetwear");
    expect(brand).not.toBeNull();

    const product = await getProductBySlug(brand!.id, "heavyweight-boxy-tee-380gsm");
    expect(product).not.toBeNull();
    expect(product!.variants.length).toBeGreaterThan(0);

    // Pick a variant with stock
    const variant = product!.variants.find((v) => v.stockQuantity > 2)!;
    expect(variant).toBeDefined();

    const initialStock = variant.stockQuantity;
    const orderQty = 2;

    // Place order
    const result = await createOrderWithStockDecrement({
      brand: brand!,
      customerName: "Rahul Verma",
      customerPhone: "9876543210",
      deliveryAddress: {
        street: "742 Evergreen Terrace",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      },
      items: [
        {
          variantId: variant.id,
          productId: product!.id,
          title: `${product!.title} (${variant.title})`,
          sku: variant.sku,
          qty: orderQty,
          unitPricePaise: variant.pricePaise,
        },
      ],
      shippingPaise: 0,
      paymentMethod: "UPI",
    });

    expect(result.order).toBeDefined();
    expect(result.order.id).toBeDefined();
    expect(result.order.orderNumber).toBeGreaterThan(0);
    expect(result.order.customerName).toBe("Rahul Verma");
    expect(result.order.paymentStatus).toBe("PENDING");
    expect(result.upiPaymentUrl).toContain("upi://pay?");
    expect(result.upiPaymentUrl).toContain(encodeURIComponent(brand!.name));
    expect(result.whatsAppUrl).toContain("https://wa.me/");

    // Check stock decremented
    const refreshedProduct = await getProductBySlug(brand!.id, "heavyweight-boxy-tee-380gsm");
    const refreshedVariant = refreshedProduct!.variants.find((v) => v.id === variant.id)!;
    expect(refreshedVariant.stockQuantity).toBe(initialStock - orderQty);
  });

  it("submits UPI UTR and marks payment as PAID", async () => {
    const brand = await getBrandBySlug("urban-streetwear");
    const product = await getProductBySlug(brand!.id, "heavyweight-boxy-tee-380gsm");
    const variant = product!.variants.find((v) => v.stockQuantity > 0)!;

    const result = await createOrderWithStockDecrement({
      brand: brand!,
      customerName: "Pooja Shah",
      customerPhone: "9876543211",
      deliveryAddress: {
        street: "12 Marine Drive",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400020",
      },
      items: [
        {
          variantId: variant.id,
          productId: product!.id,
          title: product!.title,
          sku: variant.sku,
          qty: 1,
          unitPricePaise: variant.pricePaise,
        },
      ],
      shippingPaise: 0,
      paymentMethod: "UPI",
    });

    const testUtr = "UTR998877665544";
    const updated = await recordUpiUtr(brand!.id, result.order.id, testUtr);

    expect(updated.upiUtr).toBe(testUtr);
    expect(updated.paymentStatus).toBe("PAID");

    // Fetch by ID to confirm persistent update
    const fetched = await getOrderById(brand!.id, result.order.id);
    expect(fetched!.paymentStatus).toBe("PAID");
    expect(fetched!.upiUtr).toBe(testUtr);
  });

  it("enforces tenant isolation: Brand 2 cannot query Brand 1 orders", async () => {
    const brand1 = await getBrandBySlug("urban-streetwear");
    const brand2 = await getBrandBySlug("linen-and-co");

    const product = await getProductBySlug(brand1!.id, "heavyweight-boxy-tee-380gsm");
    const variant = product!.variants.find((v) => v.stockQuantity > 0)!;

    const b1Order = await createOrderWithStockDecrement({
      brand: brand1!,
      customerName: "Isolation Test Customer",
      customerPhone: "9876543299",
      deliveryAddress: {
        street: "Secret Road",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
      },
      items: [
        {
          variantId: variant.id,
          productId: product!.id,
          title: product!.title,
          sku: variant.sku,
          qty: 1,
          unitPricePaise: variant.pricePaise,
        },
      ],
      shippingPaise: 0,
      paymentMethod: "COD",
    });

    // Attempting to fetch b1Order using Brand 2's ID must return null
    const crossBrandOrder = await getOrderById(brand2!.id, b1Order.order.id);
    expect(crossBrandOrder).toBeNull();
  });

  it("rejects order when requested quantity exceeds available stock", async () => {
    const brand = await getBrandBySlug("urban-streetwear");
    const product = await getProductBySlug(brand!.id, "heavyweight-boxy-tee-380gsm");
    const variant = product!.variants.find((v) => v.stockQuantity > 0)!;

    await expect(
      createOrderWithStockDecrement({
        brand: brand!,
        customerName: "Excess Buyer",
        customerPhone: "9876543200",
        deliveryAddress: {
          street: "Over Stock Way",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411001",
        },
        items: [
          {
            variantId: variant.id,
            productId: product!.id,
            title: product!.title,
            sku: variant.sku,
            qty: variant.stockQuantity + 500, // exceeds available stock
            unitPricePaise: variant.pricePaise,
          },
        ],
        shippingPaise: 0,
        paymentMethod: "COD",
      })
    ).rejects.toThrow("Insufficient stock");
  });
});
