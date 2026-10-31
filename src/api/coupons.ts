import { Hono } from "hono";
import { db } from "../db/index";
import { discountCoupons } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { validateCouponSchema, createCouponSchema } from "../types/validators";
import type { AppEnv } from "../types/hono";

export const couponsRouter = new Hono<AppEnv>();

// Validate coupon code for checkout
couponsRouter.post("/validate", async (c) => {
  const brand = c.get("brand");
  const body = await c.req.json();
  const parsed = validateCouponSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { code, subtotalPaise } = parsed.data;

  const [coupon] = await db
    .select()
    .from(discountCoupons)
    .where(
      and(
        eq(discountCoupons.brandId, brand.id),
        eq(discountCoupons.code, code.toUpperCase()),
        eq(discountCoupons.isActive, true)
      )
    )
    .limit(1);

  if (!coupon) {
    return c.json({ valid: false, error: "Invalid or inactive promo code" }, 404);
  }

  if (subtotalPaise < coupon.minOrderPaise) {
    const minRs = (coupon.minOrderPaise / 100).toFixed(0);
    return c.json(
      {
        valid: false,
        error: `Minimum order amount for this coupon is ₹${minRs}`,
      },
      400
    );
  }

  // Calculate discount
  let discountPaise = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discountPaise = Math.round((subtotalPaise * coupon.discountValue) / 100);
  } else {
    // FLAT
    discountPaise = Math.min(coupon.discountValue, subtotalPaise);
  }

  return c.json({
    valid: true,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountPaise,
    finalAmountPaise: Math.max(0, subtotalPaise - discountPaise),
  });
});

// List active coupons for tenant
couponsRouter.get("/", async (c) => {
  const brand = c.get("brand");

  const list = await db
    .select({
      id: discountCoupons.id,
      code: discountCoupons.code,
      discountType: discountCoupons.discountType,
      discountValue: discountCoupons.discountValue,
      minOrderPaise: discountCoupons.minOrderPaise,
    })
    .from(discountCoupons)
    .where(
      and(
        eq(discountCoupons.brandId, brand.id),
        eq(discountCoupons.isActive, true)
      )
    );

  return c.json(list);
});

// Create new coupon
couponsRouter.post("/", async (c) => {
  const brand = c.get("brand");
  const body = await c.req.json();
  const parsed = createCouponSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [created] = await db
    .insert(discountCoupons)
    .values({
      brandId: brand.id,
      code: parsed.data.code.toUpperCase(),
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue,
      minOrderPaise: parsed.data.minOrderPaise,
    })
    .returning();

  return c.json(created, 201);
});
