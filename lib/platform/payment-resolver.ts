import { getBrandCredentialsDecrypted, getBrandSubscription } from "@/lib/db/queries/platform";
import { db } from "@/src/db";
import { brands } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export interface BrandPaymentGatewayResolution {
  mode: "RAZORPAY" | "MANUAL_UPI";
  keyId?: string;
  keySecret?: string;
  razorpayRouteAccountId?: string | null;
  commissionPercentBasisPoints?: number;
  upiVpa?: string | null;
  statusLabel: string;
  notice?: string;
}

/**
 * Resolves payment gateway credentials for a given brand.
 *
 * STRICT INVARIANT:
 * Payments NEVER fall back to a platform account.
 * If a brand does not have its own verified Razorpay keys configured (or its plan restricts it),
 * the store resolves to MANUAL_UPI (QR + UTR) with status "Payments: manual".
 */
export async function resolveBrandPaymentGateway(
  brandId: string
): Promise<BrandPaymentGatewayResolution> {
  // 1. Fetch brand details for UPI VPA fallback
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  const upiVpa = brand?.upiVpa || "payments@ecom.local";

  // 2. Check brand subscription plan to verify if razorpay_gateway is allowed
  const { plan, subscription } = await getBrandSubscription(brandId);
  const planFeatures: Record<string, any> = plan?.features || {};
  const overrides: Record<string, any> = (subscription?.featureOverrides as Record<string, any>) || {};

  // Check if feature is allowed (override takes precedence)
  let isAllowed = Boolean(planFeatures.razorpay_gateway);
  if (overrides.razorpay_gateway && overrides.razorpay_gateway.enabled !== undefined) {
    isAllowed = Boolean(overrides.razorpay_gateway.enabled);
  }

  if (!isAllowed) {
    return {
      mode: "MANUAL_UPI",
      upiVpa,
      statusLabel: "Payments: manual",
      notice: "Brand plan does not include automated Razorpay gateway. Manual UPI active.",
    };
  }

  // 3. Query brand credentials
  const brandCreds = await getBrandCredentialsDecrypted<{
    keyId?: string;
    keySecret?: string;
  }>(brandId, "RAZORPAY");

  if (!brandCreds?.keyId || !brandCreds?.keySecret) {
    return {
      mode: "MANUAL_UPI",
      upiVpa,
      statusLabel: "Payments: manual",
      notice: "Brand has not configured dedicated Razorpay credentials. Manual UPI active.",
    };
  }

  // 4. Return brand's own credentials
  return {
    mode: "RAZORPAY",
    keyId: brandCreds.keyId,
    keySecret: brandCreds.keySecret,
    statusLabel: "Payments: automated (Razorpay)",
  };
}
