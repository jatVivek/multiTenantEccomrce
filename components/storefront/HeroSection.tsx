import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { BrandThemeConfig } from "@/lib/db/queries/brands";
import { resolveStorefrontUrl } from "@/lib/storefront-url";

interface HeroSectionProps {
  brandSlug: string;
  theme: BrandThemeConfig;
}

export function HeroSection({ brandSlug, theme }: HeroSectionProps) {
  const headline = theme.heroHeadline || "New Season Arrivals";
  const subtitle =
    theme.heroSubtitle ||
    "Carefully crafted garments engineered with exceptional materials and timeless silhouettes.";
  const ctaText = theme.heroCtaText || "Explore Catalog";
  const ctaLink = resolveStorefrontUrl(theme.heroCtaLink || "/catalog", brandSlug);

  const defaultBadge =
    theme.heroStyle === "editorial-split"
      ? "Handcrafted Pure Linen Collection"
      : "TECHWEAR / DROP 04";
  const heroBadge = theme.heroBadge !== undefined ? theme.heroBadge : defaultBadge;

  const defaultSecondaryText =
    theme.heroStyle === "editorial-split" ? "Linen Shirts" : "Shop Cargo Pants";
  const secondaryText =
    theme.heroSecondaryCtaText !== undefined
      ? theme.heroSecondaryCtaText
      : defaultSecondaryText;

  const defaultSecondaryLink =
    theme.heroStyle === "editorial-split"
      ? "/catalog?category=Shirts"
      : "/catalog?category=Bottoms";
  const secondaryLink = resolveStorefrontUrl(
    theme.heroSecondaryCtaLink || defaultSecondaryLink,
    brandSlug
  );

  const imageUrl =
    theme.heroImageUrl ||
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1600&q=80";

  // Style 1: Editorial Split (Linen & Co)
  if (theme.heroStyle === "editorial-split") {
    return (
      <section className="relative w-full overflow-hidden bg-brand-surface border-b border-brand-border py-12 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Text column */}
            <div className="lg:col-span-7 space-y-6">
              {heroBadge && heroBadge.trim().length > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-secondary text-brand-secondary-foreground text-xs font-medium tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
                  <span>{heroBadge}</span>
                </div>
              )}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-medium tracking-tight text-brand-text leading-tight">
                {headline}
              </h1>
              <p className="text-base sm:text-lg text-brand-muted max-w-xl leading-relaxed">
                {subtitle}
              </p>
              <div className="pt-2 flex flex-wrap gap-4">
                <Link
                  href={ctaLink}
                  className="tap-target-44 px-7 py-3 rounded-md bg-brand-primary text-brand-primary-foreground font-medium text-sm tracking-wide shadow-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary flex items-center gap-2"
                >
                  <span>{ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                {secondaryText && secondaryText.trim().length > 0 && (
                  <Link
                    href={secondaryLink}
                    className="tap-target-44 px-6 py-3 rounded-md border border-brand-border bg-brand-surface text-brand-text font-medium text-sm tracking-wide hover:bg-brand-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    {secondaryText}
                  </Link>
                )}
              </div>
            </div>

            {/* Image column */}
            <div className="lg:col-span-5 relative">
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-brand-border/60">
                <Image
                  src={imageUrl}
                  alt={headline}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover object-center"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Style 2: Bold Banner (Urban Streetwear)
  return (
    <section className="relative w-full overflow-hidden border-b border-brand-border bg-brand-surface">
      <div className="relative min-h-[460px] sm:min-h-[540px] flex items-center justify-center">
        {/* Background image with high contrast gradient overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src={imageUrl}
            alt={headline}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-40 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-background via-brand-background/80 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-6">
          {heroBadge && heroBadge.trim().length > 0 && (
            <div className="inline-block px-3 py-1 rounded bg-brand-primary text-brand-primary-foreground font-mono text-xs font-bold uppercase tracking-widest shadow-md">
              {heroBadge}
            </div>
          )}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-heading font-extrabold tracking-tight uppercase text-brand-text max-w-4xl mx-auto leading-tight">
            {headline}
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-brand-muted max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={ctaLink}
              className="tap-target-44 w-full sm:w-auto px-8 py-3.5 rounded font-heading font-bold text-sm tracking-wider uppercase bg-brand-primary text-brand-primary-foreground shadow-lg hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary flex items-center justify-center gap-2"
            >
              <span>{ctaText}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            {secondaryText && secondaryText.trim().length > 0 && (
              <Link
                href={secondaryLink}
                className="tap-target-44 w-full sm:w-auto px-8 py-3.5 rounded font-heading font-semibold text-sm tracking-wider uppercase border border-brand-border bg-brand-surface/60 backdrop-blur-sm text-brand-text hover:bg-brand-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary flex items-center justify-center"
              >
                {secondaryText}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
