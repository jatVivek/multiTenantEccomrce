import { db } from "../index";
import { brands } from "../../../src/db/schema";
import { eq, and } from "drizzle-orm";

export interface NavLinkItem {
  label: string;
  url: string;
}

export interface BrandThemeConfig {
  colors: {
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  heroStyle: "bold-banner" | "editorial-split" | "minimal";
  layoutStyle: "compact" | "spacious" | "editorial";
  announcement?: string;
  announcementLink?: string;
  heroBadge?: string;
  heroHeadline?: string;
  heroSubtitle?: string;
  heroCtaText?: string;
  heroCtaLink?: string;
  heroSecondaryCtaText?: string;
  heroSecondaryCtaLink?: string;
  heroImageUrl?: string;
  navLinks?: NavLinkItem[];
}

export async function getBrandBySlug(slug: string) {
  if (!slug) return null;
  try {
    const [brand] = await db
      .select()
      .from(brands)
      .where(and(eq(brands.slug, slug), eq(brands.isActive, true)))
      .limit(1);
    return brand ?? null;
  } catch (err) {
    console.error('Failed to fetch brand by slug:', err);
    return null;
  }
}

export async function getBrandById(id: string) {
  if (!id) return null;
  try {
    const [brand] = await db
      .select()
      .from(brands)
      .where(and(eq(brands.id, id), eq(brands.isActive, true)))
      .limit(1);
    return brand ?? null;
  } catch (err) {
    console.error('Failed to fetch brand by id:', err);
    return null;
  }
}

export async function getAllActiveBrands() {
  return db
    .select()
    .from(brands)
    .where(eq(brands.isActive, true));
}
