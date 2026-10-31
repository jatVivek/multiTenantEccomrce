import { db } from "../index";
import { discountCoupons, type DiscountCoupon } from "../../../src/db/schema";
import { eq, and } from "drizzle-orm";

export interface ValidateCouponResult {
  valid: boolean;
  error?: string;
  code?: string;
  discountType?: "PERCENTAGE" | "FLAT";
  discountValue?: number;
  discountPaise?: number;
  finalAmountPaise?: number;
}

export async function validateCouponForOrder(
  brandId: string,
  code: string,
  subtotalPaise: number
): Promise<ValidateCouponResult> {
  if (!brandId) throw new Error("brandId is required");
  if (!code || !code.trim()) {
    return { valid: false, error: "Promo code is required" };
  }

  const cleanCode = code.trim().toUpperCase();

  const [coupon] = await db
    .select()
    .from(discountCoupons)
    .where(
      and(
        eq(discountCoupons.brandId, brandId),
        eq(discountCoupons.code, cleanCode),
        eq(discountCoupons.isActive, true)
      )
    )
    .limit(1);

  if (!coupon) {
    return { valid: false, error: "Invalid or expired promo code" };
  }

  if (subtotalPaise < coupon.minOrderPaise) {
    const minRs = (coupon.minOrderPaise / 100).toLocaleString("en-IN");
    return {
      valid: false,
      error: `Minimum order amount for this coupon is ₹${minRs}`,
    };
  }

  let discountPaise = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discountPaise = Math.round((subtotalPaise * coupon.discountValue) / 100);
  } else {
    discountPaise = Math.min(coupon.discountValue, subtotalPaise);
  }

  return {
    valid: true,
    code: coupon.code,
    discountType: coupon.discountType as "PERCENTAGE" | "FLAT",
    discountValue: coupon.discountValue,
    discountPaise,
    finalAmountPaise: Math.max(0, subtotalPaise - discountPaise),
  };
}
