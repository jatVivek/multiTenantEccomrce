import {
  getBrandSubscription,
  getBrandMonthToDateUsage,
  getBrandProductCount,
} from "@/lib/db/queries/platform";

export class FeatureGateError extends Error {
  public feature: string;
  public status: number;
  public currentUsage?: number;
  public limit?: number;

  constructor(message: string, feature: string, currentUsage?: number, limit?: number) {
    super(message);
    this.name = "FeatureGateError";
    this.feature = feature;
    this.status = 403;
    this.currentUsage = currentUsage;
    this.limit = limit;
  }
}

export type FeatureName =
  | "product_limit"
  | "staff_seats"
  | "storage_gb"
  | "custom_domain"
  | "bulk_importer"
  | "discount_codes"
  | "abandoned_cart_whatsapp"
  | "cod_confirmation"
  | "reviews"
  | "shipping_integration"
  | "gst_invoices"
  | "ai_listing"
  | "whatsapp_messages"
  | "custom_whatsapp_number"
  | "razorpay_gateway"
  | "hindi_admin"
  | "remove_powered_by"
  | "priority_support";

export interface FeatureGateResult {
  allowed: boolean;
  reason?: string;
  source: "plan" | "override" | "topup" | "none";
  currentUsage?: number;
  limit?: number;
  percentUsed?: number;
  warning?: boolean;
}

/**
 * Returns effective features and limits for a brand, taking into account
 * base plan, active overrides (checking expiry dates), and top-ups.
 */
export async function getEffectiveBrandFeatures(brandId: string) {
  try {
    const { subscription, plan } = await getBrandSubscription(brandId);

  // If no subscription found, assume starter defaults
  const baseFeatures: Record<string, any> = plan?.features || {
    product_limit: 50,
    staff_seats: 1,
    storage_gb: 1,
    custom_domain: false,
    bulk_importer: false,
    discount_codes: false,
    abandoned_cart_whatsapp: false,
    cod_confirmation: true,
    reviews: false,
    shipping_integration: false,
    gst_invoices: false,
    ai_listing_monthly_quota: 10,
    whatsapp_monthly_quota: 100,
    custom_whatsapp_number: false,
    razorpay_gateway: false,
    hindi_admin: false,
    remove_powered_by: false,
    priority_support: false,
  };

  const status = subscription?.status || "ACTIVE";
  const overrides = (subscription?.featureOverrides as Record<string, any>) || {};
  const topUps = (subscription?.topUpQuotas as Record<string, any>) || {};

  const now = new Date();
  const effective: Record<string, any> = { ...baseFeatures };
  const source: Record<string, "plan" | "override" | "topup"> = {};

  for (const k of Object.keys(baseFeatures)) {
    source[k] = "plan";
  }

  // Check trial expiration
  let isTrialExpired = false;
  if (status === "TRIAL" && subscription?.trialEndsAt) {
    const trialEnd = new Date(subscription.trialEndsAt);
    if (now > trialEnd) {
      isTrialExpired = true;
    }
  }

  // Apply overrides if valid and not expired
  for (const [k, override] of Object.entries(overrides)) {
    if (!override) continue;
    let expired = false;
    if (override.expiresAt) {
      const expDate = new Date(override.expiresAt);
      if (now > expDate) {
        expired = true;
      }
    }

    if (!expired) {
      if (typeof override.enabled === "boolean") {
        effective[k] = override.enabled;
        source[k] = "override";
      } else if (override.value !== undefined) {
        effective[k] = override.value;
        source[k] = "override";
      }
    }
  }

  // Fetch current month-to-date usage
  const usageData = await getBrandMonthToDateUsage(brandId);

  // Count current products via scoped query
  const productCount = await getBrandProductCount(brandId);

  const usage: Record<string, number> = {
    product_limit: productCount,
    ai_listing: usageData.ai_call?.quantity || 0,
    whatsapp_messages: usageData.whatsapp_message?.quantity || 0,
  };

  // Compute limits with top-ups
  const limits: Record<string, number> = {
    product_limit: Number(effective.product_limit ?? 50),
    ai_listing:
      Number(effective.ai_listing_monthly_quota ?? 10) +
      Number(topUps.ai_listing || 0),
    whatsapp_messages:
      Number(effective.whatsapp_monthly_quota ?? 100) +
      Number(topUps.whatsapp_messages || 0),
  };

  const warnings: string[] = [];
  if (status === "SUSPENDED") {
    warnings.push("Brand subscription is currently SUSPENDED. All operations are halted.");
  } else if (isTrialExpired) {
    warnings.push("Brand free trial period has ended. Upgrade to continue uninterrupted.");
  }

  // Check 80% quota warnings
  for (const [metric, limitVal] of Object.entries(limits)) {
    if (limitVal > 0) {
      const current = usage[metric] || 0;
      const pct = (current / limitVal) * 100;
      if (pct >= 100) {
        warnings.push(`Quota 100% reached for ${metric} (${current}/${limitVal}). Actions blocked.`);
      } else if (pct >= 80) {
        warnings.push(`Quota warning: ${metric} is at ${pct.toFixed(0)}% (${current}/${limitVal}).`);
      }
    }
  }

  return {
    status,
    isTrialExpired,
    planName: plan?.name || "Starter",
    planSlug: plan?.slug || "starter",
    effective,
    source,
    usage,
    limits,
    warnings,
  };
  } catch (err) {
    console.error("[getEffectiveBrandFeatures] DB error:", err);
    // Return a safe default so the layout still renders
    return null;
  }
}

/**
 * Checks if a specific feature or quota is allowed for this brand.
 */
export async function checkFeatureGate(
  brandId: string,
  feature: FeatureName,
  requiredAmount = 1
): Promise<FeatureGateResult> {
  const brandData = await getEffectiveBrandFeatures(brandId);

  if (brandData.status === "SUSPENDED") {
    return {
      allowed: false,
      reason: "Your brand subscription is currently suspended. Please contact support to reactivate.",
      source: "none",
    };
  }

  if (brandData.isTrialExpired) {
    return {
      allowed: false,
      reason: "Your trial period has expired. Please upgrade your plan to unlock this feature.",
      source: "none",
    };
  }

  // Check quota-limited features
  if (feature === "product_limit") {
    const limit = brandData.limits.product_limit;
    const current = brandData.usage.product_limit;
    if (limit === -1) {
      // Unlimited
      return { allowed: true, source: brandData.source.product_limit || "plan", currentUsage: current, limit };
    }
    const newTotal = current + requiredAmount;
    if (newTotal > limit) {
      return {
        allowed: false,
        reason: `Product catalog limit reached (${current}/${limit} products). Upgrade your plan to add more products.`,
        source: brandData.source.product_limit || "plan",
        currentUsage: current,
        limit,
        percentUsed: (current / limit) * 100,
      };
    }
    const percentUsed = (newTotal / limit) * 100;
    return {
      allowed: true,
      source: brandData.source.product_limit || "plan",
      currentUsage: current,
      limit,
      percentUsed,
      warning: percentUsed >= 80,
    };
  }

  if (feature === "ai_listing") {
    const limit = brandData.limits.ai_listing;
    const current = brandData.usage.ai_listing;
    const newTotal = current + requiredAmount;
    if (newTotal > limit) {
      return {
        allowed: false,
        reason: `Monthly AI descriptions quota reached (${current}/${limit}). Upgrade your plan or purchase a top-up pack to continue.`,
        source: brandData.source.ai_listing_monthly_quota || "plan",
        currentUsage: current,
        limit,
        percentUsed: (current / limit) * 100,
      };
    }
    const percentUsed = (newTotal / limit) * 100;
    return {
      allowed: true,
      source: brandData.source.ai_listing_monthly_quota || "plan",
      currentUsage: current,
      limit,
      percentUsed,
      warning: percentUsed >= 80,
    };
  }

  if (feature === "whatsapp_messages") {
    const limit = brandData.limits.whatsapp_messages;
    const current = brandData.usage.whatsapp_messages;
    const newTotal = current + requiredAmount;
    if (newTotal > limit) {
      return {
        allowed: false,
        reason: `Monthly WhatsApp messaging quota reached (${current}/${limit}). Upgrade your plan or purchase a top-up pack to continue.`,
        source: brandData.source.whatsapp_monthly_quota || "plan",
        currentUsage: current,
        limit,
        percentUsed: (current / limit) * 100,
      };
    }
    const percentUsed = (newTotal / limit) * 100;
    return {
      allowed: true,
      source: brandData.source.whatsapp_monthly_quota || "plan",
      currentUsage: current,
      limit,
      percentUsed,
      warning: percentUsed >= 80,
    };
  }

  // Boolean feature flags
  const isEnabled = Boolean(brandData.effective[feature]);
  const source = brandData.source[feature] || "plan";

  if (!isEnabled) {
    const featureLabels: Record<string, string> = {
      bulk_importer: "Bulk CSV Product Importer",
      discount_codes: "Promo & Discount Codes Engine",
      custom_domain: "Custom Domain Mapping",
      abandoned_cart_whatsapp: "Automated Abandoned Cart WhatsApp",
      reviews: "Customer Product Reviews",
      shipping_integration: "Automated Shiprocket Logistics Integration",
      gst_invoices: "Automated B2B GST Invoicing",
      custom_whatsapp_number: "Brand Dedicated WhatsApp Number",
      razorpay_gateway: "Automated Razorpay Payment Gateway",
      hindi_admin: "Hindi Language Admin Interface",
      remove_powered_by: "Whitelabel (Remove 'Powered by' badge)",
      priority_support: "24/7 Priority Support",
    };

    const label = featureLabels[feature] || feature;
    return {
      allowed: false,
      reason: `${label} is not included in your current plan (${brandData.planName}). Upgrade your plan to unlock this feature.`,
      source,
    };
  }

  return {
    allowed: true,
    source,
  };
}

/**
 * Strict assertion helper: throws a FeatureGateError if the feature is not allowed.
 */
export async function assertFeatureGate(
  brandId: string,
  feature: FeatureName,
  requiredAmount = 1
): Promise<FeatureGateResult> {
  const result = await checkFeatureGate(brandId, feature, requiredAmount);
  if (!result.allowed) {
    throw new FeatureGateError(
      result.reason || `Feature '${feature}' is restricted by your plan.`,
      feature,
      result.currentUsage,
      result.limit
    );
  }
  return result;
}
