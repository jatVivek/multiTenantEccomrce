import { db } from "@/src/db";
import {
  subscriptionPlans,
  brandSubscriptions,
  platformSecrets,
  platformSettings,
  brandCredentials,
  usageEvents,
  platformAuditLogs,
  platformDailyCaps,
  brands,
  products,
  productVariants,
  bundles,
  orders,
  brandOrderCounters,
  adminBrandAccess,
  adminUsers,
  adminAuthCredentials,
  discountCoupons,
  importBatches,
  mediaAssets,
  SubscriptionPlan,
  BrandSubscription,
} from "@/src/db/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import {
  encryptSecret,
  decryptSecret,
  encryptJson,
  decryptJson,
  sanitizeAuditDetails,
} from "@/lib/vault/crypto";
import { hashPassword } from "@/src/lib/auth";

export async function getBrandProductCount(brandId: string): Promise<number> {
  const [pCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.brandId, brandId));
  return Number(pCount?.count || 0);
}

// ── Plans ─────────────────────────────────────────────────────────────

export async function getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return await db
    .select()
    .from(subscriptionPlans)
    .orderBy(subscriptionPlans.pricePaise);
}

export async function getSubscriptionPlanBySlug(
  slug: string
): Promise<SubscriptionPlan | null> {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.slug, slug))
    .limit(1);
  return plan || null;
}

export async function getSubscriptionPlanById(
  id: string
): Promise<SubscriptionPlan | null> {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, id))
    .limit(1);
  return plan || null;
}

export async function updateSubscriptionPlan(
  id: string,
  data: {
    name?: string;
    pricePaise?: number;
    billingCycle?: string;
    features?: Record<string, any>;
    isActive?: boolean;
  }
): Promise<SubscriptionPlan | null> {
  const [updated] = await db
    .update(subscriptionPlans)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(subscriptionPlans.id, id))
    .returning();
  return updated || null;
}

// ── Brand Subscriptions & Overrides ───────────────────────────────────

export async function getBrandSubscription(
  brandId: string
): Promise<{
  subscription: BrandSubscription | null;
  plan: SubscriptionPlan | null;
}> {
  const [sub] = await db
    .select()
    .from(brandSubscriptions)
    .where(eq(brandSubscriptions.brandId, brandId))
    .limit(1);

  if (!sub) {
    return { subscription: null, plan: null };
  }

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, sub.planId))
    .limit(1);

  return { subscription: sub, plan: plan || null };
}

export interface ClientPlatformOverview {
  brandId: string;
  brandName: string;
  brandSlug: string;
  currency: string;
  isActive: boolean;
  whatsappNumber: string | null;
  upiVpa: string | null;
  customDomain: string | null;
  status: string;
  trialEndsAt: string | null;
  planId: string;
  planName: string;
  planSlug: string;
  planPricePaise: number;
  featureOverrides: Record<string, any>;
  topUpQuotas: Record<string, any>;
  usageMonth: {
    aiCalls: number;
    whatsappMessages: number;
    productCount: number;
    costPaise: number;
  };
}

export async function getAllBrandSubscriptions(): Promise<ClientPlatformOverview[]> {
  const allBrands = await db.select().from(brands).orderBy(brands.name);
  const allPlans = await getAllSubscriptionPlans();
  const planMap = new Map(allPlans.map((p) => [p.id, p]));

  const allSubs = await db.select().from(brandSubscriptions);
  const subMap = new Map(allSubs.map((s) => [s.brandId, s]));

  // Month-to-date timestamp for usage calculation
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const results: ClientPlatformOverview[] = [];

  for (const b of allBrands) {
    const sub = subMap.get(b.id);
    const plan = sub ? planMap.get(sub.planId) : null;

    // Count products
    const [pCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.brandId, b.id));

    // Aggregate monthly usage
    const usageRes = await db
      .select({
        type: usageEvents.type,
        totalQty: sql<number>`sum(${usageEvents.quantity})`,
        totalCost: sql<number>`sum(${usageEvents.costEstimatePaise})`,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.brandId, b.id),
          gte(usageEvents.createdAt, startOfMonth.toISOString())
        )
      )
      .groupBy(usageEvents.type);

    let aiCalls = 0;
    let whatsappMessages = 0;
    let costPaise = 0;

    for (const row of usageRes) {
      costPaise += Number(row.totalCost || 0);
      if (row.type === "ai_call") aiCalls += Number(row.totalQty || 0);
      if (row.type === "whatsapp_message") whatsappMessages += Number(row.totalQty || 0);
    }

    results.push({
      brandId: b.id,
      brandName: b.name,
      brandSlug: b.slug,
      currency: b.currency,
      isActive: b.isActive ?? true,
      whatsappNumber: b.whatsappNumber || null,
      upiVpa: b.upiVpa || null,
      customDomain: b.customDomain || null,
      status: sub ? sub.status : "ACTIVE",
      trialEndsAt: sub ? sub.trialEndsAt : null,
      planId: plan?.id || "",
      planName: plan?.name || "Starter",
      planSlug: plan?.slug || "starter",
      planPricePaise: plan?.pricePaise || 99900,
      featureOverrides: (sub?.featureOverrides as Record<string, any>) || {},
      topUpQuotas: (sub?.topUpQuotas as Record<string, any>) || {},
      usageMonth: {
        aiCalls,
        whatsappMessages,
        productCount: Number(pCount?.count || 0),
        costPaise,
      },
    });
  }

  return results;
}

export async function updateBrandSubscriptionPlan(
  brandId: string,
  newPlanId: string
): Promise<BrandSubscription | null> {
  const [existing] = await db
    .select()
    .from(brandSubscriptions)
    .where(eq(brandSubscriptions.brandId, brandId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(brandSubscriptions)
      .set({
        planId: newPlanId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(brandSubscriptions.brandId, brandId))
      .returning();
    return updated || null;
  } else {
    const [created] = await db
      .insert(brandSubscriptions)
      .values({
        brandId,
        planId: newPlanId,
        status: "ACTIVE",
        featureOverrides: {},
        topUpQuotas: {},
      })
      .returning();
    return created || null;
  }
}

export async function updateBrandSubscriptionStatus(
  brandId: string,
  status: string,
  trialEndsAt?: string | null
): Promise<BrandSubscription | null> {
  const [updated] = await db
    .update(brandSubscriptions)
    .set({
      status,
      trialEndsAt: trialEndsAt !== undefined ? trialEndsAt : undefined,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(brandSubscriptions.brandId, brandId))
    .returning();
  return updated || null;
}

export async function setBrandFeatureOverride(
  brandId: string,
  featureKey: string,
  overrideData: {
    enabled?: boolean;
    value?: any;
    expiresAt?: string | null;
    reason?: string;
  }
): Promise<BrandSubscription | null> {
  const [sub] = await db
    .select()
    .from(brandSubscriptions)
    .where(eq(brandSubscriptions.brandId, brandId))
    .limit(1);

  if (!sub) return null;

  const currentOverrides = (sub.featureOverrides as Record<string, any>) || {};
  const updatedOverrides = {
    ...currentOverrides,
    [featureKey]: overrideData,
  };

  const [updated] = await db
    .update(brandSubscriptions)
    .set({
      featureOverrides: updatedOverrides,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(brandSubscriptions.brandId, brandId))
    .returning();

  return updated || null;
}

export async function removeBrandFeatureOverride(
  brandId: string,
  featureKey: string
): Promise<BrandSubscription | null> {
  const [sub] = await db
    .select()
    .from(brandSubscriptions)
    .where(eq(brandSubscriptions.brandId, brandId))
    .limit(1);

  if (!sub) return null;

  const currentOverrides = { ...((sub.featureOverrides as Record<string, any>) || {}) };
  delete currentOverrides[featureKey];

  const [updated] = await db
    .update(brandSubscriptions)
    .set({
      featureOverrides: currentOverrides,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(brandSubscriptions.brandId, brandId))
    .returning();

  return updated || null;
}

export async function addBrandTopUp(
  brandId: string,
  quotaKey: string,
  amount: number
): Promise<BrandSubscription | null> {
  const [sub] = await db
    .select()
    .from(brandSubscriptions)
    .where(eq(brandSubscriptions.brandId, brandId))
    .limit(1);

  if (!sub) return null;

  const currentTopUps = (sub.topUpQuotas as Record<string, any>) || {};
  const currentVal = Number(currentTopUps[quotaKey] || 0);

  const updatedTopUps = {
    ...currentTopUps,
    [quotaKey]: currentVal + amount,
  };

  const [updated] = await db
    .update(brandSubscriptions)
    .set({
      topUpQuotas: updatedTopUps,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(brandSubscriptions.brandId, brandId))
    .returning();

  return updated || null;
}

// ── Key Vault (Platform & Brand) ──────────────────────────────────────

export async function getAllPlatformSecrets(includeEncrypted = false) {
  const secrets = await db.select().from(platformSecrets);
  if (!includeEncrypted) {
    return secrets.map((s) => ({
      id: s.id,
      keyName: s.keyName,
      maskedPreview: s.maskedPreview,
      lastRotatedAt: s.lastRotatedAt,
      lastUsedAt: s.lastUsedAt,
    }));
  }
  return secrets;
}

export async function getPlatformSecretDecrypted(
  keyName: string
): Promise<string | null> {
  const [sec] = await db
    .select()
    .from(platformSecrets)
    .where(eq(platformSecrets.keyName, keyName))
    .limit(1);

  if (!sec) {
    // Check fallback in process.env
    const envVal = process.env[keyName];
    if (envVal) {
      return envVal;
    }
    return null;
  }

  // Update lastUsedAt
  await db
    .update(platformSecrets)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(platformSecrets.id, sec.id));

  return decryptSecret({
    encryptedValue: sec.encryptedValue,
    iv: sec.iv,
    authTag: sec.authTag,
  });
}

export async function savePlatformSecret(
  keyName: string,
  plainValue: string
) {
  const enc = encryptSecret(plainValue);

  const [existing] = await db
    .select()
    .from(platformSecrets)
    .where(eq(platformSecrets.keyName, keyName))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(platformSecrets)
      .set({
        encryptedValue: enc.encryptedValue,
        iv: enc.iv,
        authTag: enc.authTag,
        maskedPreview: enc.maskedPreview,
        lastRotatedAt: new Date().toISOString(),
      })
      .where(eq(platformSecrets.keyName, keyName))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(platformSecrets)
      .values({
        keyName,
        encryptedValue: enc.encryptedValue,
        iv: enc.iv,
        authTag: enc.authTag,
        maskedPreview: enc.maskedPreview,
        lastRotatedAt: new Date().toISOString(),
      })
      .returning();
    return created;
  }
}

export async function getBrandCredentials(
  brandId: string,
  service: string
) {
  const [cred] = await db
    .select()
    .from(brandCredentials)
    .where(
      and(
        eq(brandCredentials.brandId, brandId),
        eq(brandCredentials.service, service)
      )
    )
    .limit(1);
  return cred || null;
}

export async function getAllBrandCredentialsForAdmin(brandId: string) {
  const list = await db
    .select({
      id: brandCredentials.id,
      service: brandCredentials.service,
      maskedPreview: brandCredentials.maskedPreview,
      razorpayRouteAccountId: brandCredentials.razorpayRouteAccountId,
      commissionPercentBasisPoints: brandCredentials.commissionPercentBasisPoints,
      isVerified: brandCredentials.isVerified,
      lastTestedAt: brandCredentials.lastTestedAt,
      updatedAt: brandCredentials.updatedAt,
    })
    .from(brandCredentials)
    .where(eq(brandCredentials.brandId, brandId));
  return list;
}

export async function getBrandCredentialsDecrypted<T = Record<string, any>>(
  brandId: string,
  service: string
): Promise<T | null> {
  const cred = await getBrandCredentials(brandId, service);
  if (!cred) return null;

  try {
    return decryptJson<T>({
      encryptedData: cred.encryptedData,
      iv: cred.iv,
      authTag: cred.authTag,
    });
  } catch (err) {
    console.error(`Failed to decrypt credentials for brand ${brandId} service ${service}:`, err);
    return null;
  }
}

export async function saveBrandCredentials(
  brandId: string,
  service: string,
  plainData: Record<string, any>,
  extra?: {
    razorpayRouteAccountId?: string;
    commissionPercentBasisPoints?: number;
    isVerified?: boolean;
  }
) {
  const enc = encryptJson(plainData);

  const [existing] = await db
    .select()
    .from(brandCredentials)
    .where(
      and(
        eq(brandCredentials.brandId, brandId),
        eq(brandCredentials.service, service)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(brandCredentials)
      .set({
        encryptedData: enc.encryptedData,
        iv: enc.iv,
        authTag: enc.authTag,
        maskedPreview: enc.maskedPreview,
        razorpayRouteAccountId: extra?.razorpayRouteAccountId ?? existing.razorpayRouteAccountId,
        commissionPercentBasisPoints: extra?.commissionPercentBasisPoints ?? existing.commissionPercentBasisPoints,
        isVerified: extra?.isVerified ?? existing.isVerified,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(brandCredentials.id, existing.id))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(brandCredentials)
      .values({
        brandId,
        service,
        encryptedData: enc.encryptedData,
        iv: enc.iv,
        authTag: enc.authTag,
        maskedPreview: enc.maskedPreview,
        razorpayRouteAccountId: extra?.razorpayRouteAccountId || null,
        commissionPercentBasisPoints: extra?.commissionPercentBasisPoints || 0,
        isVerified: extra?.isVerified ?? false,
      })
      .returning();
    return created;
  }
}

export async function updateBrandCredentialVerification(
  brandId: string,
  service: string,
  isVerified: boolean
) {
  const [updated] = await db
    .update(brandCredentials)
    .set({
      isVerified,
      lastTestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(brandCredentials.brandId, brandId),
        eq(brandCredentials.service, service)
      )
    )
    .returning();
  return updated || null;
}

// ── Usage Events & Metering ───────────────────────────────────────────

export async function recordUsageEvent(
  brandId: string,
  type: string,
  quantity = 1,
  costEstimatePaise = 0,
  metadata: Record<string, any> = {}
) {
  const [event] = await db
    .insert(usageEvents)
    .values({
      brandId,
      type,
      quantity,
      costEstimatePaise,
      metadata,
    })
    .returning();

  // Also update daily platform cost tally
  if (type === "ai_call" || type === "whatsapp_message") {
    await recordDailyCapSpending(
      costEstimatePaise,
      type === "ai_call" ? "ai" : "whatsapp"
    );
  }

  return event;
}

export async function getBrandMonthToDateUsage(
  brandId: string,
  monthDate = new Date()
) {
  const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

  const rows = await db
    .select({
      type: usageEvents.type,
      totalQty: sql<number>`sum(${usageEvents.quantity})`,
      totalCostPaise: sql<number>`sum(${usageEvents.costEstimatePaise})`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.brandId, brandId),
        gte(usageEvents.createdAt, startOfMonth.toISOString())
      )
    )
    .groupBy(usageEvents.type);

  const usageMap: Record<string, { quantity: number; costPaise: number }> = {
    whatsapp_message: { quantity: 0, costPaise: 0 },
    ai_call: { quantity: 0, costPaise: 0 },
    storage: { quantity: 0, costPaise: 0 },
    email: { quantity: 0, costPaise: 0 },
  };

  for (const r of rows) {
    if (usageMap[r.type]) {
      usageMap[r.type] = {
        quantity: Number(r.totalQty || 0),
        costPaise: Number(r.totalCostPaise || 0),
      };
    }
  }

  return usageMap;
}

// ── Daily Safety Caps ─────────────────────────────────────────────────

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDailySafetyCap(dateStr = getTodayString()) {
  const [cap] = await db
    .select()
    .from(platformDailyCaps)
    .where(eq(platformDailyCaps.date, dateStr))
    .limit(1);

  if (cap) return cap;

  // Insert default cap for today
  const [created] = await db
    .insert(platformDailyCaps)
    .values({
      date: dateStr,
      aiCostPaise: 0,
      whatsappCostPaise: 0,
      dailyAiCapPaise: 500000, // ₹5,000
      dailyWhatsappCapPaise: 1000000, // ₹10,000
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [existing] = await db
    .select()
    .from(platformDailyCaps)
    .where(eq(platformDailyCaps.date, dateStr))
    .limit(1);
  return existing;
}

export async function checkDailySafetyCap(
  type: "ai" | "whatsapp",
  additionalCostPaise = 0
): Promise<{ allowed: boolean; percentUsed: number; warning: boolean; message?: string }> {
  const cap = await getDailySafetyCap();
  if (!cap) return { allowed: true, percentUsed: 0, warning: false };

  const currentCost = type === "ai" ? cap.aiCostPaise : cap.whatsappCostPaise;
  const maxCap = type === "ai" ? cap.dailyAiCapPaise : cap.dailyWhatsappCapPaise;

  const newTotal = currentCost + additionalCostPaise;
  const percentUsed = maxCap > 0 ? (newTotal / maxCap) * 100 : 0;

  if (newTotal > maxCap) {
    return {
      allowed: false,
      percentUsed,
      warning: true,
      message: `Global daily safety cap of ₹${(maxCap / 100).toFixed(0)} for ${type.toUpperCase()} reached. Prevented runaway bill.`,
    };
  }

  return {
    allowed: true,
    percentUsed,
    warning: percentUsed >= 70,
    message: percentUsed >= 70 ? `Alert: Global ${type.toUpperCase()} daily cap is at ${percentUsed.toFixed(0)}%!` : undefined,
  };
}

async function recordDailyCapSpending(costPaise: number, type: "ai" | "whatsapp") {
  const dateStr = getTodayString();
  await getDailySafetyCap(dateStr); // Ensures row exists

  if (type === "ai") {
    await db
      .update(platformDailyCaps)
      .set({
        aiCostPaise: sql`${platformDailyCaps.aiCostPaise} + ${costPaise}`,
      })
      .where(eq(platformDailyCaps.date, dateStr));
  } else {
    await db
      .update(platformDailyCaps)
      .set({
        whatsappCostPaise: sql`${platformDailyCaps.whatsappCostPaise} + ${costPaise}`,
      })
      .where(eq(platformDailyCaps.date, dateStr));
  }
}

export async function updateDailySafetyCapLimits(
  dateStr: string,
  caps: { dailyAiCapPaise?: number; dailyWhatsappCapPaise?: number }
) {
  await getDailySafetyCap(dateStr);
  const [updated] = await db
    .update(platformDailyCaps)
    .set({
      ...caps,
    })
    .where(eq(platformDailyCaps.date, dateStr))
    .returning();
  return updated;
}

// ── Platform Audit Logs ───────────────────────────────────────────────

export async function writePlatformAuditLog(
  adminUserId: string | null,
  brandId: string | null,
  action: string,
  details: Record<string, any>,
  ipAddress?: string
) {
  const sanitized = sanitizeAuditDetails(details);
  const [log] = await db
    .insert(platformAuditLogs)
    .values({
      adminUserId,
      brandId,
      action,
      details: sanitized,
      ipAddress: ipAddress || null,
    })
    .returning();
  return log;
}

export async function getPlatformAuditLogs(limit = 100) {
  return await db
    .select()
    .from(platformAuditLogs)
    .orderBy(desc(platformAuditLogs.createdAt))
    .limit(limit);
}

// ── Platform Settings (Branding & Dynamic Powered-By) ─────────────────

export async function getPlatformSetting(
  key: string,
  defaultValue = ""
): Promise<string> {
  try {
    const [row] = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1);
    return row ? row.value : defaultValue;
  } catch (err) {
    console.error(`[getPlatformSetting] Failed for key="${key}":`, err);
    return defaultValue;
  }
}

export async function getAllPlatformSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(platformSettings);
  const result: Record<string, string> = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
}

export async function setPlatformSetting(
  key: string,
  value: string,
  adminUserId?: string
): Promise<string> {
  const existing = await getPlatformSetting(key, "");
  const [row] = await db
    .insert(platformSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  if (adminUserId) {
    await writePlatformAuditLog(adminUserId, null, "UPDATE_PLATFORM_SETTING", {
      settingName: key,
      before: existing,
      after: value,
    });
  }

  return row.value;
}

// ── Super Admin: Brand Provisioning & CRUD ─────────────────────────────

export interface CreateBrandInput {
  name: string;
  slug: string;
  currency?: string;
  whatsappNumber?: string;
  upiVpa?: string;
  customDomain?: string;
  planId?: string;
  adminEmail?: string;
  adminPassword?: string;
}

export interface UpdateBrandDetailsInput {
  name?: string;
  slug?: string;
  currency?: string;
  whatsappNumber?: string;
  upiVpa?: string;
  customDomain?: string;
}

export async function createBrandWithSubscription(
  input: CreateBrandInput,
  adminUserId?: string
) {
  const cleanSlug = input.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");
  if (!cleanSlug) {
    throw new Error("Invalid brand slug");
  }

  // Check if slug is unique
  const [existing] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.slug, cleanSlug))
    .limit(1);

  if (existing) {
    throw new Error(`A brand with slug '${cleanSlug}' already exists`);
  }

  // Determine initial plan
  let targetPlanId = input.planId;
  if (!targetPlanId) {
    const plans = await getAllSubscriptionPlans();
    const starterPlan = plans.find((p) => p.slug === "starter") || plans[0];
    if (!starterPlan) {
      throw new Error("No subscription plans available");
    }
    targetPlanId = starterPlan.id;
  }

  // Create brand
  const [newBrand] = await db
    .insert(brands)
    .values({
      name: input.name.trim(),
      slug: cleanSlug,
      currency: (input.currency || "INR").toUpperCase().trim(),
      whatsappNumber: input.whatsappNumber?.trim() || null,
      upiVpa: input.upiVpa?.trim() || null,
      customDomain: input.customDomain?.trim() || null,
      isActive: true,
      themeConfig: {},
    })
    .returning();

  // Create brand subscription
  const [sub] = await db
    .insert(brandSubscriptions)
    .values({
      brandId: newBrand.id,
      planId: targetPlanId,
      status: "ACTIVE",
      featureOverrides: {},
      topUpQuotas: {},
    })
    .returning();

  // Grant admin user access if provided
  if (adminUserId) {
    await db
      .insert(adminBrandAccess)
      .values({
        adminUserId,
        brandId: newBrand.id,
      })
      .onConflictDoNothing();
  }

  // Audit log
  if (adminUserId) {
    await writePlatformAuditLog(adminUserId, newBrand.id, "BRAND_CREATE", {
      brandName: newBrand.name,
      slug: newBrand.slug,
      planId: targetPlanId,
    });
  }

  // Provision Brand Admin credentials if specified
  let createdAdminUser: { id: string; email: string } | null = null;
  if (input.adminEmail && input.adminPassword) {
    createdAdminUser = await createBrandAdminUser(
      newBrand.id,
      input.adminEmail,
      input.adminPassword,
      adminUserId
    );
  }

  return { brand: newBrand, subscription: sub, adminUser: createdAdminUser };
}

export async function updateBrandDetails(
  brandId: string,
  input: UpdateBrandDetailsInput,
  adminUserId?: string
) {
  const [existing] = await db
    .select()
    .from(brands)
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!existing) {
    throw new Error("Brand not found");
  }

  const updates: Record<string, any> = {
    updatedAt: sql`now()`,
  };

  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.currency !== undefined) updates.currency = input.currency.toUpperCase().trim();
  if (input.whatsappNumber !== undefined) updates.whatsappNumber = input.whatsappNumber?.trim() || null;
  if (input.upiVpa !== undefined) updates.upiVpa = input.upiVpa?.trim() || null;
  if (input.customDomain !== undefined) updates.customDomain = input.customDomain?.trim() || null;
  if (input.slug !== undefined) {
    const cleanSlug = input.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");
    if (cleanSlug !== existing.slug) {
      const [conflict] = await db
        .select({ id: brands.id })
        .from(brands)
        .where(eq(brands.slug, cleanSlug))
        .limit(1);
      if (conflict) {
        throw new Error(`A brand with slug '${cleanSlug}' already exists`);
      }
      updates.slug = cleanSlug;
    }
  }

  const [updated] = await db
    .update(brands)
    .set(updates)
    .where(eq(brands.id, brandId))
    .returning();

  if (adminUserId) {
    await writePlatformAuditLog(adminUserId, brandId, "BRAND_UPDATE", {
      before: {
        name: existing.name,
        slug: existing.slug,
        currency: existing.currency,
        whatsappNumber: existing.whatsappNumber,
        upiVpa: existing.upiVpa,
        customDomain: existing.customDomain,
      },
      after: updates,
    });
  }

  return updated;
}

export async function toggleBrandActiveStatus(
  brandId: string,
  isActive: boolean,
  adminUserId?: string
) {
  const [existing] = await db
    .select()
    .from(brands)
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!existing) {
    throw new Error("Brand not found");
  }

  const [updated] = await db
    .update(brands)
    .set({
      isActive,
      updatedAt: sql`now()`,
    })
    .where(eq(brands.id, brandId))
    .returning();

  if (adminUserId) {
    await writePlatformAuditLog(adminUserId, brandId, "BRAND_TOGGLE_ACTIVE", {
      isActive,
      brandName: existing.name,
      slug: existing.slug,
    });
  }

  return updated;
}

export async function deleteBrandPermanently(
  brandId: string,
  adminUserId?: string
) {
  const [brand] = await db
    .select()
    .from(brands)
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!brand) {
    throw new Error("Brand not found");
  }

  await db.transaction(async (tx) => {
    // 1. Delete product variants
    await tx.delete(productVariants).where(eq(productVariants.brandId, brandId));
    // 2. Delete bundles
    await tx.delete(bundles).where(eq(bundles.brandId, brandId));
    // 3. Delete products
    await tx.delete(products).where(eq(products.brandId, brandId));
    // 4. Delete orders
    await tx.delete(orders).where(eq(orders.brandId, brandId));
    // 5. Delete brand order counters
    await tx.delete(brandOrderCounters).where(eq(brandOrderCounters.brandId, brandId));
    // 6. Delete discount coupons
    await tx.delete(discountCoupons).where(eq(discountCoupons.brandId, brandId));
    // 7. Delete import batches
    await tx.delete(importBatches).where(eq(importBatches.brandId, brandId));
    // 8. Delete media assets
    await tx.delete(mediaAssets).where(eq(mediaAssets.brandId, brandId));
    // 9. Delete brand subscriptions
    await tx.delete(brandSubscriptions).where(eq(brandSubscriptions.brandId, brandId));
    // 10. Delete brand credentials
    await tx.delete(brandCredentials).where(eq(brandCredentials.brandId, brandId));
    // 11. Delete usage events
    await tx.delete(usageEvents).where(eq(usageEvents.brandId, brandId));
    // 12. Delete admin brand access
    await tx.delete(adminBrandAccess).where(eq(adminBrandAccess.brandId, brandId));
    // 13. Delete brand
    await tx.delete(brands).where(eq(brands.id, brandId));
  });

  if (adminUserId) {
    await writePlatformAuditLog(adminUserId, brandId, "BRAND_DELETE", {
      deletedBrandName: brand.name,
      deletedBrandSlug: brand.slug,
    });
  }

  return { success: true, brandName: brand.name, brandSlug: brand.slug };
}

// ── Brand Admin User Credentials Management ──────────────────────────

export async function getBrandAdminUsers(brandId: string) {
  if (!brandId) return [];

  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      createdAt: adminUsers.createdAt,
    })
    .from(adminUsers)
    .innerJoin(
      adminBrandAccess,
      eq(adminBrandAccess.adminUserId, adminUsers.id)
    )
    .where(eq(adminBrandAccess.brandId, brandId))
    .orderBy(desc(adminUsers.createdAt));

  return rows;
}

export async function createBrandAdminUser(
  brandId: string,
  email: string,
  password: string,
  superAdminUserId?: string
) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Valid email address is required");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  // Verify brand exists
  const [brand] = await db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!brand) {
    throw new Error("Target brand does not exist");
  }

  const hashedPassword = await hashPassword(password);

  // Check if admin user already exists
  const [existingUser] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, cleanEmail))
    .limit(1);

  let targetUserId: string;

  if (existingUser) {
    targetUserId = existingUser.id;

    // Update password credentials
    await db
      .insert(adminAuthCredentials)
      .values({
        adminUserId: targetUserId,
        passwordHash: hashedPassword,
      })
      .onConflictDoUpdate({
        target: adminAuthCredentials.adminUserId,
        set: {
          passwordHash: hashedPassword,
          updatedAt: new Date().toISOString(),
        },
      });

    // Ensure brand access
    await db
      .insert(adminBrandAccess)
      .values({
        adminUserId: targetUserId,
        brandId,
      })
      .onConflictDoNothing();
  } else {
    // Create new admin user
    const newId = crypto.randomUUID();
    const [newUser] = await db
      .insert(adminUsers)
      .values({
        id: newId,
        email: cleanEmail,
        role: "BRAND_ADMIN",
      })
      .returning();

    targetUserId = newUser.id;

    // Save auth credentials
    await db.insert(adminAuthCredentials).values({
      adminUserId: targetUserId,
      passwordHash: hashedPassword,
    });

    // Grant brand access
    await db.insert(adminBrandAccess).values({
      adminUserId: targetUserId,
      brandId,
    });
  }

  if (superAdminUserId) {
    await writePlatformAuditLog(superAdminUserId, brandId, "BRAND_ADMIN_CREATED", {
      adminEmail: cleanEmail,
      brandName: brand.name,
    });
  }

  return { id: targetUserId, email: cleanEmail, role: "BRAND_ADMIN" };
}

export async function resetBrandAdminPassword(
  adminUserId: string,
  newPassword: string,
  superAdminUserId?: string,
  brandId?: string
) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long");
  }

  const [user] = await db
    .select({ id: adminUsers.id, email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.id, adminUserId))
    .limit(1);

  if (!user) {
    throw new Error("Admin user not found");
  }

  const hashedPassword = await hashPassword(newPassword);

  await db
    .insert(adminAuthCredentials)
    .values({
      adminUserId,
      passwordHash: hashedPassword,
    })
    .onConflictDoUpdate({
      target: adminAuthCredentials.adminUserId,
      set: {
        passwordHash: hashedPassword,
        updatedAt: new Date().toISOString(),
      },
    });

  if (superAdminUserId) {
    await writePlatformAuditLog(
      superAdminUserId,
      brandId || null,
      "BRAND_ADMIN_PASSWORD_RESET",
      {
        adminUserId,
        adminEmail: user.email,
      }
    );
  }

  return { success: true, email: user.email };
}

export async function revokeBrandAdminAccess(
  brandId: string,
  adminUserId: string,
  superAdminUserId?: string
) {
  await db
    .delete(adminBrandAccess)
    .where(
      and(
        eq(adminBrandAccess.brandId, brandId),
        eq(adminBrandAccess.adminUserId, adminUserId)
      )
    );

  if (superAdminUserId) {
    await writePlatformAuditLog(
      superAdminUserId,
      brandId,
      "BRAND_ADMIN_REVOKED",
      { adminUserId }
    );
  }

  return { success: true };
}

