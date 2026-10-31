import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import { getCatalogProducts, getCategories } from "@/lib/db/queries/products";
import { CatalogFilterBar } from "@/components/storefront/CatalogFilterBar";
import { CategoryPills } from "@/components/storefront/CategoryPills";
import { ProductCard } from "@/components/storefront/ProductCard";
import { LoadMoreProducts } from "@/components/storefront/LoadMoreProducts";
import { PackageOpen, RotateCcw, SlidersHorizontal } from "lucide-react";

// Force dynamic so we never statically pre-render (avoids DB at build time)
export const dynamic = "force-dynamic";

interface CatalogPageProps {
  params: Promise<{ brand_slug: string }>;
  searchParams: Promise<{
    category?: string;
    size?: string;
    priceRange?: string;
    inStock?: string;
    search?: string;
    sort?: "featured" | "price-asc" | "price-desc" | "newest";
  }>;
}

export async function generateMetadata({ params }: CatalogPageProps) {
  const { brand_slug } = await params;
  const brand = await getBrandBySlug(brand_slug);
  if (!brand) return { title: "Catalog Not Found" };

  return {
    title: `Catalog & Collections | ${brand.name}`,
    description: `Explore the complete clothing lineup and seasonal releases from ${brand.name}.`,
  };
}

export default async function CatalogPage({
  params,
  searchParams,
}: CatalogPageProps) {
  const { brand_slug } = await params;
  const brand = await getBrandBySlug(brand_slug);

  if (!brand) {
    notFound();
  }

  const query = await searchParams;
  const category = query.category || "";
  const size = query.size || "";
  const priceRange = query.priceRange || "";
  const inStockOnly = query.inStock === "true";
  const search = query.search || "";
  const sort = query.sort || "featured";

  // Parse price range
  let minPricePaise: number | undefined;
  let maxPricePaise: number | undefined;
  if (priceRange) {
    const [minStr, maxStr] = priceRange.split("-");
    if (minStr) minPricePaise = parseInt(minStr, 10);
    if (maxStr) maxPricePaise = parseInt(maxStr, 10);
  }

  const [categories, catalogResult] = await Promise.all([
    getCategories(brand.id),
    getCatalogProducts({
      brandId: brand.id,
      category: category || undefined,
      size: size || undefined,
      minPricePaise,
      maxPricePaise,
      inStockOnly,
      search: search || undefined,
      sort,
      limit: 12,
    }),
  ]);

  const { products, nextCursor } = catalogResult;

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* Catalog Header Banner */}
      <div className="bg-brand-surface border-b border-brand-border py-8 sm:py-10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-brand-muted">
                {brand.name} Collection
              </span>
              <h1 className="text-2xl sm:text-4xl font-heading font-bold text-brand-text mt-1">
                {category ? `${category}` : "All Garments & Apparel"}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-brand-muted">
              Showing {products.length} {products.length === 1 ? "piece" : "pieces"}
            </p>
          </div>

          {/* Category quick navigation */}
          <CategoryPills
            brandSlug={brand.slug}
            categories={categories}
            activeCategory={category || "All"}
          />
        </div>
      </div>

      {/* Sticky Quick-Filter Bar — wrapped in Suspense because CatalogFilterBar uses useSearchParams() */}
      <Suspense
        fallback={
          <div className="w-full bg-brand-surface border-b border-brand-border py-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4">
              <div className="h-11 flex-1 max-w-md bg-brand-secondary rounded-lg animate-pulse" />
              <div className="h-11 w-36 bg-brand-secondary rounded-lg animate-pulse" />
              <div className="ml-auto flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brand-muted animate-pulse" />
                <div className="h-4 w-16 bg-brand-secondary rounded animate-pulse" />
              </div>
            </div>
          </div>
        }
      >
        <CatalogFilterBar
          currentCategory={category}
          currentSize={size}
          currentPriceRange={priceRange}
          currentInStock={inStockOnly}
          currentSort={sort}
          currentSearch={search}
        />
      </Suspense>

      {/* Products Grid or Empty State */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-grow w-full">
        {products.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20 px-4 border border-dashed border-brand-border rounded-2xl bg-brand-surface/40 max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-brand-secondary flex items-center justify-center mx-auto text-brand-muted">
              <PackageOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-heading font-bold text-brand-text">
              No matching pieces found
            </h3>
            <p className="text-sm text-brand-muted leading-relaxed">
              We couldn&apos;t find any items matching your active filter criteria. Try clearing some filters or searching with different keywords.
            </p>
            <div className="pt-2">
              <Link
                href={`/${brand.slug}/catalog`}
                className="tap-target-44 px-6 py-2.5 rounded-lg bg-brand-primary text-brand-primary-foreground text-xs font-semibold uppercase tracking-wider hover:opacity-90 inline-flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 2-column mobile, 3-column tablet, 4-column desktop */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} brandSlug={brand.slug} />
              ))}
            </div>

            {/* Cursor-based Load More */}
            <LoadMoreProducts
              initialCursor={nextCursor}
              brandId={brand.id}
              brandSlug={brand.slug}
              filterParams={{
                category: category || undefined,
                size: size || undefined,
                minPricePaise,
                maxPricePaise,
                inStockOnly,
                search: search || undefined,
                sort,
                limit: 12,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
