import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { getBrandBySlug, type BrandThemeConfig } from "@/lib/db/queries/brands";
import { getFeaturedProducts, getCategories } from "@/lib/db/queries/products";
import { HeroSection } from "@/components/storefront/HeroSection";
import { CategoryPills } from "@/components/storefront/CategoryPills";
import { ProductCard } from "@/components/storefront/ProductCard";
import ReelsStrip, { type ReelProduct } from "@/components/storefront/ReelsStrip";

interface HomePageProps {
  params: Promise<{ brand_slug: string }>;
}

export const dynamic = "force-dynamic";

  const { brand_slug } = await params;
  const brand = await getBrandBySlug(brand_slug);
  if (!brand) return { title: "Brand Not Found" };

  return {
    title: `${brand.name} | Official Storefront`,
    description: `Discover curated apparel and collections from ${brand.name}. High performance clothing engineered with precision.`,
  };
}

export default async function BrandHomePage({ params }: HomePageProps) {
  const { brand_slug } = await params;
  const brand = await getBrandBySlug(brand_slug);

  if (!brand) {
    notFound();
  }

  const [featuredProducts, categories] = await Promise.all([
    getFeaturedProducts(brand.id, 8),
    getCategories(brand.id),
  ]);

  const themeConfig = (brand.themeConfig as Partial<BrandThemeConfig>) || {};

  const reelItems: ReelProduct[] = [];
  for (const prod of featuredProducts) {
    const vids = Array.isArray((prod as any).videos) ? (prod as any).videos : [];
    for (const v of vids) {
      if (v && v.url) {
        reelItems.push({
          id: v.id || `${prod.id}-${reelItems.length}`,
          slug: prod.slug,
          title: prod.title,
          basePricePaise: prod.basePricePaise,
          videoUrl: v.url,
          posterUrl: v.posterUrl,
          brandSlug: brand.slug,
        });
      }
    }
  }

  return (
    <div className="w-full flex flex-col space-y-12 pb-16">
      {/* 1. Hero Section */}
      <HeroSection brandSlug={brand.slug} theme={themeConfig as BrandThemeConfig} />

      {/* 2. Category Pills Navigation Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between pb-2 border-b border-brand-border/60 mb-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-muted">
            <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
            <span>Browse Categories</span>
          </div>
          <Link
            href={`/${brand.slug}/catalog`}
            className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <CategoryPills brandSlug={brand.slug} categories={categories} />
      </section>

      {/* 2.5 Reels Strip (Vertical 9:16 Video Showcase) */}
      {reelItems.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <ReelsStrip reels={reelItems} />
        </section>
      )}

      {/* 3. Featured 2-Column Mobile-First Product Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-brand-border/60 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-muted">
              Handpicked Styles
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-brand-text">
              Featured Essentials
            </h2>
          </div>
          <Link
            href={`/${brand.slug}/catalog`}
            className="tap-target-44 text-sm font-semibold text-brand-primary hover:opacity-80 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Explore Complete Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-brand-border rounded-xl">
            <p className="text-sm text-brand-muted">No featured items currently active.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {featuredProducts.map((p) => (
              <ProductCard key={p.id} product={p} brandSlug={brand.slug} />
            ))}
          </div>
        )}

        <div className="pt-6 flex justify-center">
          <Link
            href={`/${brand.slug}/catalog`}
            className="tap-target-44 px-8 py-3 rounded-lg bg-brand-primary text-brand-primary-foreground font-heading font-bold text-sm tracking-wider uppercase shadow-md hover:brightness-110 transition-all flex items-center gap-2"
          >
            <span>View All Products</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
