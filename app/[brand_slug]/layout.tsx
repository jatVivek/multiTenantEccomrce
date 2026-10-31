import { notFound } from "next/navigation";
import { getBrandBySlug, type BrandThemeConfig } from "@/lib/db/queries/brands";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { CartProvider } from "@/components/cart/CartContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AnnouncementBar } from "@/components/storefront/AnnouncementBar";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
import { getPlatformSetting } from "@/lib/db/queries/platform";
import { getEffectiveBrandFeatures } from "@/lib/platform/feature-gate";
import { getCurrentCustomer } from "@/app/[brand_slug]/account/actions";

interface BrandLayoutProps {
  children: React.ReactNode;
  params: Promise<{ brand_slug: string }>;
}

export default async function BrandLayout({
  children,
  params,
}: BrandLayoutProps) {
  const { brand_slug } = await params;

  // Never treat admin as a brand slug
  if (brand_slug === "admin") {
    notFound();
  }

  const brand = await getBrandBySlug(brand_slug);

  if (!brand) {
    notFound();
  }

  const themeConfig = (brand.themeConfig as Partial<BrandThemeConfig>) || {};

  const [platformFooterText, effectiveFeatures, currentCustomer] = await Promise.all([
    getPlatformSetting(
      "footer_badge_text",
      "Multi-tenant architecture powered by Antigravity."
    ),
    getEffectiveBrandFeatures(brand.id),
    getCurrentCustomer(brand.id),
  ]);

  const removePoweredBy = Boolean(effectiveFeatures?.effective?.remove_powered_by);

  return (
    <ThemeProvider themeConfig={themeConfig}>
      <CartProvider brandSlug={brand.slug}>
        {themeConfig.announcement && (
          <AnnouncementBar
            message={themeConfig.announcement}
            link={themeConfig.announcementLink}
            brandSlug={brand.slug}
          />
        )}
        <StorefrontHeader
          brandSlug={brand.slug}
          brandName={brand.name}
          navLinks={themeConfig.navLinks}
          customer={
            currentCustomer
              ? {
                  id: currentCustomer.id,
                  name: currentCustomer.name,
                  email: currentCustomer.email,
                  phone: currentCustomer.phone,
                }
              : null
          }
        />
        <main className="flex-grow">{children}</main>
        <StorefrontFooter
          brandName={brand.name}
          brandSlug={brand.slug}
          footerBadgeText={platformFooterText}
          removePoweredBy={removePoweredBy}
        />
        <CartDrawer brandSlug={brand.slug} />
      </CartProvider>
    </ThemeProvider>
  );
}
