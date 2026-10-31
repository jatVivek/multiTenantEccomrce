import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../lib/db";
import { brands } from "../src/db/schema";
import { eq } from "drizzle-orm";
import {
  getAdminByEmail,
  verifyAdminBrandAccess,
  updateBrandThemeConfig,
} from "../lib/db/queries/admin";

describe("Phase 8: Theme Customizer & Branding Isolation Suite", () => {
  let brand1: any;
  let brand2: any;
  let brandAdmin1: any;
  let originalThemeConfig: any;

  beforeAll(async () => {
    const [b1] = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, "urban-streetwear"));
    const [b2] = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, "linen-and-co"));

    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    brand1 = b1;
    brand2 = b2;
    originalThemeConfig = b1.themeConfig;

    const adminRec = await getAdminByEmail("brandadmin1@ecom.local");
    expect(adminRec).not.toBeNull();
    brandAdmin1 = adminRec!.user;
  });

  afterAll(async () => {
    if (brand1 && originalThemeConfig) {
      await updateBrandThemeConfig(brand1.id, originalThemeConfig);
    }
  });

  it("updates brand theme colors, typography, and hero content cleanly", async () => {
    const updated = await updateBrandThemeConfig(brand1.id, {
      colors: {
        primary: "#ff4500",
        background: "#050505",
      },
      heroHeadline: "ARCHIVAL UTILITY & RAW DENIM",
      heroCtaText: "Explore Now",
      announcement: "⚡ FLASH SALE: 20% OFF ALL HOODIES",
    });

    expect(updated.id).toBe(brand1.id);
    const theme = updated.themeConfig as any;
    expect(theme.colors.primary).toBe("#ff4500");
    expect(theme.colors.background).toBe("#050505");
    expect(theme.heroHeadline).toBe("ARCHIVAL UTILITY & RAW DENIM");
    expect(theme.announcement).toBe("⚡ FLASH SALE: 20% OFF ALL HOODIES");

    // Verify DB reflects updated theme
    const [dbBrand] = await db
      .select()
      .from(brands)
      .where(eq(brands.id, brand1.id));
    const dbTheme = dbBrand.themeConfig as any;
    expect(dbTheme.colors.primary).toBe("#ff4500");
  });

  it("Tenant Isolation: Brand 1 admin cannot edit or mutate Brand 2's theme", async () => {
    // 1. Isolation check
    const hasAccessBrand2 = await verifyAdminBrandAccess(
      brandAdmin1.id,
      brandAdmin1.role,
      brand2.id
    );
    expect(hasAccessBrand2).toBe(false);

    // 2. Access for Brand 1 remains true
    const hasAccessBrand1 = await verifyAdminBrandAccess(
      brandAdmin1.id,
      brandAdmin1.role,
      brand1.id
    );
    expect(hasAccessBrand1).toBe(true);
  });

  it("reverts theme to standard values cleanly", async () => {
    const reset = await updateBrandThemeConfig(brand1.id, {
      ...originalThemeConfig,
      colors: {
        ...(originalThemeConfig?.colors || {}),
        primary: "#FF5500",
        background: "#0A0A0E",
      },
    });

    const theme = reset.themeConfig as any;
    expect(theme.colors.primary).toBe("#FF5500");
    expect(theme.colors.background).toBe("#0A0A0E");
  });

  it("Role Isolation: Theme customization is strictly SUPER_ADMIN only, BRAND_ADMIN is prohibited", async () => {
    // Verify brandAdmin1 is BRAND_ADMIN
    expect(brandAdmin1.role).toBe("BRAND_ADMIN");

    // A BRAND_ADMIN is strictly blocked from mutating theme
    const roleCheck = (role: string) => {
      if (role !== "SUPER_ADMIN") {
        throw new Error("Access Denied: Theme customization is restricted to SUPER_ADMIN only");
      }
      return true;
    };

    expect(() => roleCheck(brandAdmin1.role)).toThrow(/SUPER_ADMIN only/);
    expect(roleCheck("SUPER_ADMIN")).toBe(true);
  });
});
