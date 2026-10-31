"use client";

import React, { useState } from "react";
import { ProductCard } from "./ProductCard";
import { loadMoreProductsAction } from "@/app/[brand_slug]/catalog/actions";
import type { ProductWithVariants, CatalogFilterParams } from "@/lib/db/queries/products";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface LoadMoreProductsProps {
  initialCursor: string | null;
  brandId: string;
  brandSlug: string;
  filterParams: Omit<CatalogFilterParams, "brandId" | "cursor">;
}

export function LoadMoreProducts({
  initialCursor,
  brandId,
  brandSlug,
  filterParams,
}: LoadMoreProductsProps) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [additionalProducts, setAdditionalProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cursor && additionalProducts.length === 0) return null;

  const handleLoadMore = async () => {
    if (loading || !cursor) return;
    setLoading(true);
    setError(null);

    try {
      const res = await loadMoreProductsAction({
        brandId,
        cursor,
        ...filterParams,
      });

      setAdditionalProducts((prev) => [...prev, ...res.products]);
      setCursor(res.nextCursor);
    } catch (err: any) {
      setError(err?.message || "Failed to load additional pieces. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8 mt-8">
      {/* Grid of loaded items */}
      {additionalProducts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 animate-fade-in">
          {additionalProducts.map((p) => (
            <ProductCard key={p.id} product={p} brandSlug={brandSlug} />
          ))}
        </div>
      )}

      {/* Error prompt with retry */}
      {error && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleLoadMore}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold inline-flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Load More Button */}
      {cursor && !error && (
        <div className="flex justify-center pt-6">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading}
            className="tap-target-44 px-8 py-3 rounded-lg border border-brand-border bg-brand-surface text-brand-text font-heading font-medium text-sm hover:bg-brand-primary hover:text-brand-primary-foreground hover:border-brand-primary transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary flex items-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                <span>Loading more pieces...</span>
              </>
            ) : (
              <span>Load More Products</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
