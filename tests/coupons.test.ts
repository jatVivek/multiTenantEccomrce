import { describe, it, expect } from "vitest";
import app from "../src/api/index";

describe("Discount & Promo Coupons Engine", () => {
  it("validates percentage coupon code correctly", async () => {
    const res = await app.request("/api/brands/demo-brand/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "WELCOME10",
        subtotalPaise: 100000, // ₹1,000.00
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(true);
    expect(json.discountPaise).toBe(10000); // 10% of 1000 = ₹100
    expect(json.finalAmountPaise).toBe(90000);
  });

  it("validates flat discount coupon code correctly", async () => {
    const res = await app.request("/api/brands/demo-brand/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "FLAT100",
        subtotalPaise: 80000, // ₹800.00
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(true);
    expect(json.discountPaise).toBe(10000); // ₹100 flat
    expect(json.finalAmountPaise).toBe(70000);
  });

  it("rejects coupon if order subtotal is below minimum threshold", async () => {
    const res = await app.request("/api/brands/demo-brand/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "WELCOME10",
        subtotalPaise: 20000, // ₹200.00 (< ₹500 min requirement)
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Minimum order amount");
  });

  it("rejects invalid coupon codes", async () => {
    const res = await app.request("/api/brands/demo-brand/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "NONEXISTENT99",
        subtotalPaise: 100000,
      }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.valid).toBe(false);
  });
});
