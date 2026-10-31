import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../lib/db/index";
import { brands, adminUsers, adminBrandAccess, adminAuthCredentials } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { resolveStorefrontUrl } from "../lib/storefront-url";
import { updateBrandThemeConfig } from "../lib/db/queries/admin";
import {
  createBrandAdminUser,
  resetBrandAdminPassword,
  getBrandAdminUsers,
  revokeBrandAdminAccess,
  createBrandWithSubscription,
} from "../lib/db/queries/platform";
import { getAdminByEmail } from "../lib/db/queries/admin";
import { verifyPassword } from "../src/lib/auth";

describe("Dynamic Storefront Navigation & Elements", () => {
  it("resolves relative storefront URLs accurately without duplicate slugs", () => {
    const slug = "urban-streetwear";

    expect(resolveStorefrontUrl("/catalog", slug)).toBe("/urban-streetwear/catalog");
    expect(resolveStorefrontUrl("/catalog?category=Tops", slug)).toBe(
      "/urban-streetwear/catalog?category=Tops"
    );
    expect(resolveStorefrontUrl("/catalog?category=Bottoms", slug)).toBe(
      "/urban-streetwear/catalog?category=Bottoms"
    );
    expect(resolveStorefrontUrl("/", slug)).toBe("/urban-streetwear");
    expect(resolveStorefrontUrl("", slug)).toBe("/urban-streetwear");

    // Already includes slug
    expect(resolveStorefrontUrl("/urban-streetwear/catalog", slug)).toBe(
      "/urban-streetwear/catalog"
    );

    // External URLs / anchors
    expect(resolveStorefrontUrl("https://example.com/collection", slug)).toBe(
      "https://example.com/collection"
    );
    expect(resolveStorefrontUrl("#featured", slug)).toBe("#featured");
  });

  it("persists dynamic navLinks, hero CTAs, badge, and announcementLink in brand themeConfig", async () => {
    // Pick an existing brand or create a temp brand
    const [testBrand] = await db
      .insert(brands)
      .values({
        name: "Dynamic Theme Test Brand",
        slug: `dyn-theme-${Date.now()}`,
        currency: "INR",
        isActive: true,
        themeConfig: {},
      })
      .returning();

    const customNavLinks = [
      { label: "Home", url: "/" },
      { label: "Summer Drop", url: "/catalog?category=Summer" },
      { label: "Cargo Pants", url: "/catalog?category=Cargo" },
      { label: "Outerwear", url: "/catalog?category=Jackets" },
    ];

    const updated = await updateBrandThemeConfig(testBrand.id, {
      announcement: "⚡ FLASH SALE 50% OFF TODAY",
      announcementLink: "/catalog?category=Summer",
      heroBadge: "LIMITED EDITION // 2026",
      heroHeadline: "FUTURE APPAREL ARCHIVE",
      heroSubtitle: "Engineered high-density fabrics designed for modern utility.",
      heroCtaText: "Shop Collection",
      heroCtaLink: "/catalog?category=Summer",
      heroSecondaryCtaText: "Shop Cargo Pants",
      heroSecondaryCtaLink: "/catalog?category=Cargo",
      navLinks: customNavLinks,
    });

    const config = updated.themeConfig as any;
    expect(config.announcement).toBe("⚡ FLASH SALE 50% OFF TODAY");
    expect(config.announcementLink).toBe("/catalog?category=Summer");
    expect(config.heroBadge).toBe("LIMITED EDITION // 2026");
    expect(config.heroCtaText).toBe("Shop Collection");
    expect(config.heroCtaLink).toBe("/catalog?category=Summer");
    expect(config.heroSecondaryCtaText).toBe("Shop Cargo Pants");
    expect(config.heroSecondaryCtaLink).toBe("/catalog?category=Cargo");
    expect(config.navLinks).toHaveLength(4);
    expect(config.navLinks[1].label).toBe("Summer Drop");
    expect(config.navLinks[2].label).toBe("Cargo Pants");

    // Cleanup
    await db.delete(brands).where(eq(brands.id, testBrand.id));
  });
});

describe("Super Admin Brand Login (Email & Password) Provisioning", () => {
  let brandId: string;
  const brandSlug = `brand-auth-${Date.now()}`;
  const adminEmail = `admin-${Date.now()}@brandtest.com`;
  const initialPassword = "SecurePassword@123";

  beforeAll(async () => {
    const [b] = await db
      .insert(brands)
      .values({
        name: "Brand Login Test",
        slug: brandSlug,
        currency: "INR",
        isActive: true,
        themeConfig: {},
      })
      .returning();
    brandId = b.id;
  });

  afterAll(async () => {
    // Delete test brand and any test users
    await db.delete(brands).where(eq(brands.id, brandId));
    const [user] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, adminEmail));
    if (user) {
      await db.delete(adminBrandAccess).where(eq(adminBrandAccess.adminUserId, user.id));
      await db.delete(adminAuthCredentials).where(eq(adminAuthCredentials.adminUserId, user.id));
      await db.delete(adminUsers).where(eq(adminUsers.id, user.id));
    }
  });

  it("allows Super Admin to create email and password for a brand admin", async () => {
    const createdUser = await createBrandAdminUser(
      brandId,
      adminEmail,
      initialPassword
    );

    expect(createdUser.email).toBe(adminEmail.toLowerCase());
    expect(createdUser.role).toBe("BRAND_ADMIN");

    // Verify credentials in DB
    const adminRecord = await getAdminByEmail(adminEmail);
    expect(adminRecord).not.toBeNull();
    expect(adminRecord?.user.role).toBe("BRAND_ADMIN");

    // Verify password authentication
    const isValid = await verifyPassword(initialPassword, adminRecord!.passwordHash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword("WrongPassword123", adminRecord!.passwordHash);
    expect(isInvalid).toBe(false);
  });

  it("lists the created admin in getBrandAdminUsers", async () => {
    const admins = await getBrandAdminUsers(brandId);
    expect(admins.length).toBeGreaterThanOrEqual(1);

    const found = admins.find((a) => a.email === adminEmail.toLowerCase());
    expect(found).toBeDefined();
    expect(found?.role).toBe("BRAND_ADMIN");
  });

  it("allows Super Admin to reset the brand admin's password", async () => {
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, adminEmail.toLowerCase()))
      .limit(1);

    const newPassword = "UpdatedPassword@456";
    const resetResult = await resetBrandAdminPassword(user.id, newPassword);
    expect(resetResult.success).toBe(true);

    // Verify new password works and old password fails
    const adminRecord = await getAdminByEmail(adminEmail);
    expect(adminRecord).not.toBeNull();

    const oldValid = await verifyPassword(initialPassword, adminRecord!.passwordHash);
    expect(oldValid).toBe(false);

    const newValid = await verifyPassword(newPassword, adminRecord!.passwordHash);
    expect(newValid).toBe(true);
  });

  it("provisions a brand admin atomically when creating a new brand", async () => {
    const brandSlug2 = `brand-atomic-${Date.now()}`;
    const atomicEmail = `atomic-admin-${Date.now()}@brand.com`;
    const atomicPassword = "AtomicPassword#999";

    const res = await createBrandWithSubscription({
      name: "Atomic Provision Brand",
      slug: brandSlug2,
      currency: "INR",
      adminEmail: atomicEmail,
      adminPassword: atomicPassword,
    });

    expect(res.brand.slug).toBe(brandSlug2);
    expect(res.adminUser).not.toBeNull();
    expect(res.adminUser?.email).toBe(atomicEmail.toLowerCase());

    // Verify admin can authenticate immediately
    const record = await getAdminByEmail(atomicEmail);
    expect(record).not.toBeNull();
    const canLogin = await verifyPassword(atomicPassword, record!.passwordHash);
    expect(canLogin).toBe(true);

    // Cleanup
    await db.delete(brands).where(eq(brands.id, res.brand.id));
    if (res.adminUser?.id) {
      await db.delete(adminBrandAccess).where(eq(adminBrandAccess.adminUserId, res.adminUser.id));
      await db.delete(adminAuthCredentials).where(eq(adminAuthCredentials.adminUserId, res.adminUser.id));
      await db.delete(adminUsers).where(eq(adminUsers.id, res.adminUser.id));
    }
  });

  it("revokes brand admin access when requested", async () => {
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, adminEmail.toLowerCase()))
      .limit(1);

    const result = await revokeBrandAdminAccess(brandId, user.id);
    expect(result.success).toBe(true);

    const adminsAfter = await getBrandAdminUsers(brandId);
    const found = adminsAfter.find((a) => a.email === adminEmail.toLowerCase());
    expect(found).toBeUndefined();
  });
});
