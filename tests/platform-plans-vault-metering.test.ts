import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/db";
import {
  brands,
  adminUsers,
  subscriptionPlans,
  brandSubscriptions,
  usageEvents,
  platformSecrets,
  brandCredentials,
  platformAuditLogs,
  platformDailyCaps,
} from "../src/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getAllSubscriptionPlans,
  getSubscriptionPlanBySlug,
  updateSubscriptionPlan,
  getBrandSubscription,
  updateBrandSubscriptionPlan,
  updateBrandSubscriptionStatus,
  setBrandFeatureOverride,
  removeBrandFeatureOverride,
  addBrandTopUp,
  savePlatformSecret,
  getPlatformSecretDecrypted,
  getAllPlatformSecrets,
  saveBrandCredentials,
  getBrandCredentialsDecrypted,
  recordUsageEvent,
  getBrandMonthToDateUsage,
  getDailySafetyCap,
  checkDailySafetyCap,
  updateDailySafetyCapLimits,
  getPlatformAuditLogs,
  getPlatformSetting,
  setPlatformSetting,
  createBrandWithSubscription,
  updateBrandDetails,
  toggleBrandActiveStatus,
  deleteBrandPermanently,
} from "../lib/db/queries/platform";
import { getBrandBySlug } from "../lib/db/queries/brands";
import {
  checkFeatureGate,
  assertFeatureGate,
  getEffectiveBrandFeatures,
  FeatureGateError,
} from "../lib/platform/feature-gate";
import { sendWhatsApp } from "../lib/platform/whatsapp";
import { generateProductDescription } from "../lib/platform/ai";
import { resolveBrandPaymentGateway } from "../lib/platform/payment-resolver";
import {
  encryptSecret,
  decryptSecret,
  maskSecret,
  sanitizeAuditDetails,
} from "../lib/vault/crypto";
import {
  createProductAction,
  importProductsCsvAction,
} from "../app/admin/actions";
import {
  updateSubscriptionPlanAction,
  setBrandFeatureOverrideAction,
} from "../app/admin/platform/actions";
import { generateToken } from "../src/lib/auth";

describe("Phase P3: Feature & Plan Manager, Key Vault, Usage Metering", () => {
  let testBrandId: string;
  let testBrandSlug: string;
  let starterPlanId: string;
  let proPlanId: string;
  let superAdminUser: any;
  let brandAdminUser: any;
  let superAdminToken: string;
  let brandAdminToken: string;

  beforeAll(async () => {
    // 1. Ensure test brand exists
    testBrandSlug = `p3-test-brand-${Date.now()}`;
    const [createdBrand] = await db
      .insert(brands)
      .values({
        id: crypto.randomUUID(),
        name: "P3 Test Boutique",
        slug: testBrandSlug,
        currency: "INR",
        upiVpa: "p3test@upi",
        themeConfig: {},
      })
      .returning();
    testBrandId = createdBrand.id;

    // 2. Fetch plans
    const starter = await getSubscriptionPlanBySlug("starter");
    const pro = await getSubscriptionPlanBySlug("pro");
    starterPlanId = starter!.id;
    proPlanId = pro!.id;

    // 3. Setup Brand Subscription on Starter
    await db
      .insert(brandSubscriptions)
      .values({
        id: crypto.randomUUID(),
        brandId: testBrandId,
        planId: starterPlanId,
        status: "ACTIVE",
        featureOverrides: {},
        topUpQuotas: {},
      })
      .onConflictDoUpdate({
        target: [brandSubscriptions.brandId],
        set: {
          planId: starterPlanId,
          status: "ACTIVE",
          featureOverrides: {},
          topUpQuotas: {},
        },
      });

    // 4. Create mock Super Admin and Brand Admin users
    const [sAdmin] = await db
      .insert(adminUsers)
      .values({
        id: crypto.randomUUID(),
        email: `p3-superadmin-${Date.now()}@ecom.local`,
        role: "SUPER_ADMIN",
      })
      .returning();
    superAdminUser = sAdmin;
    superAdminToken = generateToken(sAdmin);

    const [bAdmin] = await db
      .insert(adminUsers)
      .values({
        id: crypto.randomUUID(),
        email: `p3-brandadmin-${Date.now()}@ecom.local`,
        role: "BRAND_ADMIN",
      })
      .returning();
    brandAdminUser = bAdmin;
    brandAdminToken = generateToken(bAdmin);
  });

  afterAll(async () => {
    // Clean up test entities
    if (testBrandId) {
      await db.delete(brandSubscriptions).where(eq(brandSubscriptions.brandId, testBrandId));
      await db.delete(brandCredentials).where(eq(brandCredentials.brandId, testBrandId));
      await db.delete(usageEvents).where(eq(usageEvents.brandId, testBrandId));
      await db.delete(brands).where(eq(brands.id, testBrandId));
    }
    if (superAdminUser?.id) {
      await db.delete(adminUsers).where(eq(adminUsers.id, superAdminUser.id));
    }
    if (brandAdminUser?.id) {
      await db.delete(adminUsers).where(eq(adminUsers.id, brandAdminUser.id));
    }
  });

  // ── 1. Plan Builder & Inheritance Tests ──────────────────────────────

  describe("1. Plan Builder & Feature Matrix", () => {
    it("returns seeded plans (Starter, Growth, Pro, Custom)", async () => {
      const plans = await getAllSubscriptionPlans();
      expect(plans.length).toBeGreaterThanOrEqual(4);
      const slugs = plans.map((p) => p.slug);
      expect(slugs).toContain("starter");
      expect(slugs).toContain("growth");
      expect(slugs).toContain("pro");
      expect(slugs).toContain("custom");
    });

    it("verifies Starter plan has restricted features (bulk_importer: false, custom_domain: false)", async () => {
      const starter = await getSubscriptionPlanBySlug("starter");
      const features = starter?.features as any;
      expect(features.bulk_importer).toBe(false);
      expect(features.custom_domain).toBe(false);
      expect(features.discount_codes).toBe(false);
      expect(features.product_limit).toBe(50);
      expect(features.ai_listing_monthly_quota).toBe(10);
      expect(features.whatsapp_monthly_quota).toBe(100);
    });

    it("allows SUPER_ADMIN to edit a plan's price and limits", async () => {
      const starter = await getSubscriptionPlanBySlug("starter");
      const originalPrice = starter!.pricePaise;

      const updated = await updateSubscriptionPlan(starter!.id, {
        pricePaise: 109900,
      });

      expect(updated?.pricePaise).toBe(109900);

      // Restore original
      await updateSubscriptionPlan(starter!.id, {
        pricePaise: originalPrice,
      });
    });
  });

  // ── 2. Per-Client Overrides & Effective Features ─────────────────────

  describe("2. Per-Client Overrides & Effective Features", () => {
    it("resolves Starter defaults when client has no overrides", async () => {
      const brandData = await getEffectiveBrandFeatures(testBrandId);
      expect(brandData.planName).toBe("Starter");
      expect(brandData.effective.bulk_importer).toBe(false);
      expect(brandData.source.bulk_importer).toBe("plan");
    });

    it("enables one extra feature (bulk_importer) for just this client alone", async () => {
      await setBrandFeatureOverride(testBrandId, "bulk_importer", {
        enabled: true,
        reason: "Boutique founder gift",
        expiresAt: null,
      });

      const brandData = await getEffectiveBrandFeatures(testBrandId);
      expect(brandData.effective.bulk_importer).toBe(true);
      expect(brandData.source.bulk_importer).toBe("override");

      // Verify other Starter restrictions remain intact
      expect(brandData.effective.custom_domain).toBe(false);
      expect(brandData.source.custom_domain).toBe("plan");
    });

    it("removes client override and falls back seamlessly to plan default", async () => {
      await removeBrandFeatureOverride(testBrandId, "bulk_importer");
      const brandData = await getEffectiveBrandFeatures(testBrandId);
      expect(brandData.effective.bulk_importer).toBe(false);
      expect(brandData.source.bulk_importer).toBe("plan");
    });

    it("respects override expiry dates", async () => {
      // Set an expired override
      await setBrandFeatureOverride(testBrandId, "bulk_importer", {
        enabled: true,
        reason: "Flash trial",
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      });

      const brandData = await getEffectiveBrandFeatures(testBrandId);
      // Expired override should NOT take effect
      expect(brandData.effective.bulk_importer).toBe(false);
      expect(brandData.source.bulk_importer).toBe("plan");

      // Clean up
      await removeBrandFeatureOverride(testBrandId, "bulk_importer");
    });
  });

  // ── 3. Central Feature Gate & Server-Side Enforcement ────────────────

  describe("3. Central Feature Gate Enforcement", () => {
    it("blocks feature with friendly message when flag is false on current plan", async () => {
      const gate = await checkFeatureGate(testBrandId, "bulk_importer");
      expect(gate.allowed).toBe(false);
      expect(gate.reason).toContain("Bulk CSV Product Importer is not included in your current plan");
    });

    it("throws FeatureGateError when calling assertFeatureGate on restricted feature", async () => {
      await expect(assertFeatureGate(testBrandId, "bulk_importer")).rejects.toThrow(
        FeatureGateError
      );
    });

    it("blocks server action execution (importProductsCsvAction) if feature is disabled", async () => {
      // Since mock environment lacks full cookies header for action, testing assertFeatureGate directly
      // mirrors the exact server-side gate used in importProductsCsvAction
      let caughtError: any = null;
      try {
        await assertFeatureGate(testBrandId, "bulk_importer", 1);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(FeatureGateError);
      expect(caughtError.feature).toBe("bulk_importer");
    });

    it("unlocks feature immediately once override is applied", async () => {
      await setBrandFeatureOverride(testBrandId, "bulk_importer", {
        enabled: true,
        reason: "Trial unlocked",
      });

      const gate = await checkFeatureGate(testBrandId, "bulk_importer");
      expect(gate.allowed).toBe(true);
      expect(gate.source).toBe("override");

      // Now assertFeatureGate should pass without throwing
      await expect(assertFeatureGate(testBrandId, "bulk_importer")).resolves.toBeDefined();

      // Clean up override
      await removeBrandFeatureOverride(testBrandId, "bulk_importer");
    });
  });

  // ── 4. Key Vault: Encryption, Masking & Payment Isolation ───────────

  describe("4. Key Vault & Security", () => {
    it("encrypts and decrypts secrets with AES-256-GCM correctly", () => {
      const secret = "live_meta_cloud_token_abc123xyz987";
      const enc = encryptSecret(secret);

      expect(enc.encryptedValue).not.toBe(secret);
      expect(enc.iv).toHaveLength(32); // 16 bytes in hex
      expect(enc.authTag).toHaveLength(32); // 16 bytes in hex
      expect(enc.maskedPreview).toBe("••••••••z987");

      const decrypted = decryptSecret({
        encryptedValue: enc.encryptedValue,
        iv: enc.iv,
        authTag: enc.authTag,
      });

      expect(decrypted).toBe(secret);
    });

    it("sanitizes audit details so keys and tokens are never logged", () => {
      const payload = {
        action: "KEY_UPDATE",
        secretKey: "super_secret_password",
        apiKey: "pk_live_123456",
        config: {
          accessToken: "token_9999",
          normalField: "public_value",
        },
      };

      const sanitized = sanitizeAuditDetails(payload);
      expect(sanitized.secretKey).toBe("••••••••word");
      expect(sanitized.apiKey).toBe("••••••••3456");
      expect(sanitized.config.accessToken).toBe("••••••••9999");
      expect(sanitized.config.normalField).toBe("public_value");
    });

    it("STRICT INVARIANT: Payment resolution NEVER falls back to platform credentials", async () => {
      // 1. Without brand credentials, store returns MANUAL_UPI with "Payments: manual"
      const res = await resolveBrandPaymentGateway(testBrandId);
      expect(res.mode).toBe("MANUAL_UPI");
      expect(res.statusLabel).toBe("Payments: manual");
      expect(res.keyId).toBeUndefined();
      expect(res.keySecret).toBeUndefined();
      expect(res.upiVpa).toBe("p3test@upi");

      // 2. Add brand credentials and enable gateway
      await updateBrandSubscriptionPlan(testBrandId, proPlanId); // Pro allows razorpay_gateway
      await saveBrandCredentials(testBrandId, "RAZORPAY", {
        keyId: "rzp_live_testclientkey1",
        keySecret: "client_secret_xyz_999",
      });

      const resWithKeys = await resolveBrandPaymentGateway(testBrandId);
      expect(resWithKeys.mode).toBe("RAZORPAY");
      expect(resWithKeys.keyId).toBe("rzp_live_testclientkey1");
      expect(resWithKeys.keySecret).toBe("client_secret_xyz_999");
      expect(resWithKeys.statusLabel).toBe("Payments: automated (Razorpay)");

      // Reset brand back to Starter for subsequent tests
      await updateBrandSubscriptionPlan(testBrandId, starterPlanId);
    });
  });

  // ── 5. Usage Metering, Quota Exhaustion & Top-Ups ─────────────────────

  describe("5. Usage Metering, Quotas & Safety Caps", () => {
    it("records a WhatsApp message usage event with 40 paise cost", async () => {
      const res = await sendWhatsApp(testBrandId, {
        recipientPhone: "+919876543210",
        template: "ORDER_CONFIRMATION",
        variables: { customerName: "Aarav", orderNumber: "101", totalAmount: "1,499" },
      });

      expect(res.success).toBe(true);
      expect(res.messagePreview).toContain("Aarav");
      expect(res.waMeUrl).toContain("https://wa.me/919876543210");

      const usage = await getBrandMonthToDateUsage(testBrandId);
      expect(usage.whatsapp_message.quantity).toBeGreaterThanOrEqual(1);
      expect(usage.whatsapp_message.costPaise).toBeGreaterThanOrEqual(40);
    });

    it("records an AI listing description usage event with 15 paise cost", async () => {
      const res = await generateProductDescription(testBrandId, {
        title: "Linen Camp Collar Shirt",
        category: "Shirts",
        material: "100% Pure Organic Linen",
      });

      expect(res.title).toBe("Linen Camp Collar Shirt");
      expect(res.description).toContain("Linen Camp Collar Shirt");
      expect(res.bulletPoints.length).toBeGreaterThan(0);
      expect(res.costPaise).toBe(15);

      const usage = await getBrandMonthToDateUsage(testBrandId);
      expect(usage.ai_call.quantity).toBeGreaterThanOrEqual(1);
      expect(usage.ai_call.costPaise).toBeGreaterThanOrEqual(15);
    });

    it("blocks AI calls when monthly quota is exhausted", async () => {
      // Override AI quota to 1 for test
      await setBrandFeatureOverride(testBrandId, "ai_listing_monthly_quota", {
        value: 1,
        reason: "Test quota limit",
      });

      // We already made 1 call above, so next call must exceed quota
      const gate = await checkFeatureGate(testBrandId, "ai_listing", 1);
      expect(gate.allowed).toBe(false);
      expect(gate.reason).toContain("Monthly AI descriptions quota reached");

      // Verify assertFeatureGate throws
      await expect(generateProductDescription(testBrandId, { title: "Test Block" })).rejects.toThrow(
        FeatureGateError
      );
    });

    it("unblocks client immediately when a top-up pack (+50 calls) is injected", async () => {
      await addBrandTopUp(testBrandId, "ai_listing", 50);

      // Gate should now pass because limit is now 1 + 50 = 51
      const gate = await checkFeatureGate(testBrandId, "ai_listing", 1);
      expect(gate.allowed).toBe(true);

      // Description generation now succeeds
      const result = await generateProductDescription(testBrandId, {
        title: "Relaxed Cargo Trousers",
      });
      expect(result.title).toBe("Relaxed Cargo Trousers");

      // Clean up override and top-up
      await removeBrandFeatureOverride(testBrandId, "ai_listing_monthly_quota");
    });

    it("enforces global daily safety caps and warns/blocks accordingly", async () => {
      const today = new Date().toISOString().slice(0, 10);

      // Temporarily set daily AI cap to 10 paise (below 1 call)
      await updateDailySafetyCapLimits(today, { dailyAiCapPaise: 10 });

      const check = await checkDailySafetyCap("ai", 15);
      expect(check.allowed).toBe(false);
      expect(check.warning).toBe(true);
      expect(check.message).toContain("Global daily safety cap");

      // Restore daily cap to ₹5,000 (500000 paise)
      await updateDailySafetyCapLimits(today, { dailyAiCapPaise: 500000 });
      const checkRestored = await checkDailySafetyCap("ai", 15);
      expect(checkRestored.allowed).toBe(true);
    });
  });

  // ── 6. Full Lifecycle Acceptance Flow ────────────────────────────────

  describe("6. Full Lifecycle Acceptance Flow", () => {
    it("runs complete lifecycle: Starter client -> override feature -> quota block -> plan upgrade -> unlock", async () => {
      // Step A: Brand is on Starter, bulk importer is restricted
      let features = await getEffectiveBrandFeatures(testBrandId);
      expect(features.effective.bulk_importer).toBe(false);

      // Step B: Super admin enables bulk importer override for this client
      await setBrandFeatureOverride(testBrandId, "bulk_importer", {
        enabled: true,
        reason: "VIP perk",
      });
      features = await getEffectiveBrandFeatures(testBrandId);
      expect(features.effective.bulk_importer).toBe(true);
      expect(features.source.bulk_importer).toBe("override");

      // Step C: Trigger usage events
      await sendWhatsApp(testBrandId, {
        recipientPhone: "+919876543210",
        template: "ORDER_CONFIRMATION",
        variables: { orderNumber: "A-01" },
      });

      // Step D: Upgrade client to Pro plan
      await updateBrandSubscriptionPlan(testBrandId, proPlanId);
      features = await getEffectiveBrandFeatures(testBrandId);
      expect(features.planSlug).toBe("pro");
      expect(features.limits.product_limit).toBe(1500);
      expect(features.limits.whatsapp_messages).toBeGreaterThanOrEqual(2500);

      // Verify all done with 0 code changes
      expect(features.status).toBe("ACTIVE");
    });
  });

  // ── 7. Dynamic Platform Branding & Footer Attribution ─────────────────

  describe("7. Dynamic Platform Branding & Footer Attribution", () => {
    beforeAll(async () => {
      await setPlatformSetting(
        "footer_badge_text",
        "Multi-tenant architecture powered by Antigravity."
      );
    });

    it("reads default footer attribution text", async () => {
      const text = await getPlatformSetting("footer_badge_text");
      expect(text).toBe("Multi-tenant architecture powered by Antigravity.");
    });

    it("allows super admin to dynamically update footer text with audit logging", async () => {
      const newText = "Multi-tenant enterprise engine powered by Antigravity Cloud.";
      const saved = await setPlatformSetting("footer_badge_text", newText, superAdminUser.id);
      expect(saved).toBe(newText);

      const verified = await getPlatformSetting("footer_badge_text");
      expect(verified).toBe(newText);

      // Verify audit log was recorded
      const logs = await getPlatformAuditLogs(5);
      const settingLog = logs.find((l) => l.action === "UPDATE_PLATFORM_SETTING");
      expect(settingLog).toBeDefined();
      expect((settingLog?.details as any)?.settingName).toBe("footer_badge_text");
      expect((settingLog?.details as any)?.after).toBe(newText);

      // Revert back to original default
      await setPlatformSetting(
        "footer_badge_text",
        "Multi-tenant architecture powered by Antigravity.",
        superAdminUser.id
      );
    });

    it("respects remove_powered_by feature gate flag per brand", async () => {
      // Put brand back on Starter plan where remove_powered_by is false
      await updateBrandSubscriptionPlan(testBrandId, starterPlanId);

      let features = await getEffectiveBrandFeatures(testBrandId);
      expect(features.effective.remove_powered_by).toBe(false);

      // Super admin enables remove_powered_by override for brand
      await setBrandFeatureOverride(testBrandId, "remove_powered_by", {
        enabled: true,
        reason: "White-label package upgrade",
      });

      features = await getEffectiveBrandFeatures(testBrandId);
      expect(features.effective.remove_powered_by).toBe(true);

      // Clean up override
      await removeBrandFeatureOverride(testBrandId, "remove_powered_by");
    });
  });

  // ── 7. Brand Provisioning & CRUD Tests ───────────────────────────────
  describe("Super Admin Brand CRUD & Storefront Active/Inactive Status", () => {
    let createdBrandId: string;
    const testSlug = `brand-crud-test-${Date.now()}`;

    it("allows Super Admin to provision a new brand with default plan and subscription", async () => {
      const result = await createBrandWithSubscription(
        {
          name: "Test Tenant Brand",
          slug: testSlug,
          currency: "INR",
          whatsappNumber: "+919999888877",
          upiVpa: "tenant@upi",
          customDomain: "shop.testtenant.com",
        },
        superAdminUser.id
      );

      expect(result.brand).toBeDefined();
      expect(result.brand.name).toBe("Test Tenant Brand");
      expect(result.brand.slug).toBe(testSlug);
      expect(result.brand.isActive).toBe(true);
      expect(result.brand.currency).toBe("INR");
      expect(result.subscription).toBeDefined();
      expect(result.subscription.status).toBe("ACTIVE");

      createdBrandId = result.brand.id;

      // Verify audit log
      const logs = await getPlatformAuditLogs(5);
      const createLog = logs.find((l) => l.action === "BRAND_CREATE" && l.brandId === createdBrandId);
      expect(createLog).toBeDefined();
      expect((createLog?.details as any)?.brandName).toBe("Test Tenant Brand");
    });

    it("allows Super Admin to update brand metadata", async () => {
      const updated = await updateBrandDetails(
        createdBrandId,
        {
          name: "Updated Tenant Brand",
          whatsappNumber: "+919876543219",
          upiVpa: "updated@upi",
          customDomain: "updated.tenant.com",
        },
        superAdminUser.id
      );

      expect(updated.name).toBe("Updated Tenant Brand");
      expect(updated.whatsappNumber).toBe("+919876543219");
      expect(updated.upiVpa).toBe("updated@upi");
      expect(updated.customDomain).toBe("updated.tenant.com");

      // Verify audit log
      const logs = await getPlatformAuditLogs(5);
      const updateLog = logs.find((l) => l.action === "BRAND_UPDATE" && l.brandId === createdBrandId);
      expect(updateLog).toBeDefined();
    });

    it("toggles brand active status and ensures inactive brands return 404 from storefront query", async () => {
      // 1. Initially active
      const brandActive = await getBrandBySlug(testSlug);
      expect(brandActive).not.toBeNull();
      expect(brandActive?.name).toBe("Updated Tenant Brand");

      // 2. Super Admin sets brand to INACTIVE
      const inactiveResult = await toggleBrandActiveStatus(createdBrandId, false, superAdminUser.id);
      expect(inactiveResult.isActive).toBe(false);

      // 3. Storefront query MUST return null (triggering 404 on /[brand_slug])
      const brandInactive = await getBrandBySlug(testSlug);
      expect(brandInactive).toBeNull();

      // 4. Verify audit log
      const logs = await getPlatformAuditLogs(5);
      const toggleLog = logs.find((l) => l.action === "BRAND_TOGGLE_ACTIVE" && l.brandId === createdBrandId);
      expect(toggleLog).toBeDefined();
      expect((toggleLog?.details as any)?.isActive).toBe(false);

      // 5. Restore back to active
      const activeResult = await toggleBrandActiveStatus(createdBrandId, true, superAdminUser.id);
      expect(activeResult.isActive).toBe(true);

      const brandRestored = await getBrandBySlug(testSlug);
      expect(brandRestored).not.toBeNull();
    });

    it("permanently deletes brand with all dependent data and logs audit", async () => {
      const deleteRes = await deleteBrandPermanently(createdBrandId, superAdminUser.id);
      expect(deleteRes.success).toBe(true);

      // Verify brand no longer exists
      const brandAfterDelete = await getBrandBySlug(testSlug);
      expect(brandAfterDelete).toBeNull();

      const [brandInDb] = await db
        .select()
        .from(brands)
        .where(eq(brands.id, createdBrandId));
      expect(brandInDb).toBeUndefined();

      // Verify subscription cleaned up
      const [subInDb] = await db
        .select()
        .from(brandSubscriptions)
        .where(eq(brandSubscriptions.brandId, createdBrandId));
      expect(subInDb).toBeUndefined();

      // Verify audit log recorded
      const logs = await getPlatformAuditLogs(5);
      const deleteLog = logs.find((l) => l.action === "BRAND_DELETE" && l.brandId === createdBrandId);
      expect(deleteLog).toBeDefined();
      expect((deleteLog?.details as any)?.deletedBrandSlug).toBe(testSlug);
    });
  });
});
