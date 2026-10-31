"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, Check, X } from "lucide-react";

interface CatalogFilterBarProps {
  currentCategory?: string;
  currentSize?: string;
  currentPriceRange?: string;
  currentInStock?: boolean;
  currentSort?: string;
  currentSearch?: string;
}

const AVAILABLE_SIZES = ["S", "M", "L", "XL", "30", "32", "34"];
const PRICE_RANGES = [
  { label: "All Prices", value: "" },
  { label: "Under ₹2,000", value: "0-200000" },
  { label: "₹2,000 - ₹3,500", value: "200000-350000" },
  { label: "Above ₹3,500", value: "350000-9999999" },
];

export function CatalogFilterBar({
  currentCategory = "",
  currentSize = "",
  currentPriceRange = "",
  currentInStock = false,
  currentSort = "featured",
  currentSearch = "",
}: CatalogFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Debounce search update to URL
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== currentSearch) {
        updateQuery({ search: searchInput || undefined });
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [searchInput]);

  const updateQuery = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, val]) => {
      if (val === undefined || val === "") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const hasActiveFilters = Boolean(
    currentSize || currentPriceRange || currentInStock || currentSearch
  );

  const clearAllFilters = () => {
    setSearchInput("");
    const params = new URLSearchParams();
    if (currentCategory) params.set("category", currentCategory);
    if (currentSort) params.set("sort", currentSort);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="sticky top-16 z-30 w-full bg-brand-surface/95 backdrop-blur-md border-b border-brand-border py-3 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
        {/* Top line: Search Bar, Sort & Mobile Filters toggle */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Debounced Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-muted">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products, styles, fabrics..."
              aria-label="Search catalog"
              className="w-full h-11 pl-9 pr-8 text-sm bg-brand-background border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-muted hover:text-brand-text"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filters Toggle (Mobile) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="tap-target-44 md:hidden px-3 py-2 text-xs font-semibold rounded-lg border border-brand-border bg-brand-background text-brand-text flex items-center gap-2 hover:bg-brand-secondary"
              aria-expanded={mobileFiltersOpen}
              aria-label="Toggle filter drawer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-brand-primary" />
              )}
            </button>

            {/* Sort Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="catalog-sort" className="hidden sm:inline text-xs font-medium text-brand-muted whitespace-nowrap">
                Sort by:
              </label>
              <select
                id="catalog-sort"
                value={currentSort}
                onChange={(e) => updateQuery({ sort: e.target.value })}
                className="h-11 px-3 text-xs sm:text-sm font-medium bg-brand-background border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                aria-label="Sort products"
              >
                <option value="featured">Featured First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="newest">Newest Arrivals</option>
              </select>
            </div>
          </div>
        </div>

        {/* Desktop Quick-Filter Strip / Mobile Collapsible */}
        <div
          className={`${
            mobileFiltersOpen ? "block" : "hidden"
          } md:flex items-center justify-between gap-4 pt-2 border-t border-brand-border/60 flex-wrap`}
        >
          <div className="flex items-center gap-3 flex-wrap">
            {/* Size Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold uppercase text-brand-muted mr-1">
                Size:
              </span>
              {AVAILABLE_SIZES.map((sz) => {
                const isSelected = currentSize === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateQuery({ size: isSelected ? undefined : sz })}
                    aria-pressed={isSelected}
                    className={`tap-target-44 min-w-[38px] px-2.5 py-1 text-xs font-semibold rounded border transition-all ${
                      isSelected
                        ? "bg-brand-primary text-brand-primary-foreground border-brand-primary shadow-sm"
                        : "bg-brand-background text-brand-text border-brand-border hover:border-brand-primary/50"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>

            {/* Price Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold uppercase text-brand-muted mr-1">
                Price:
              </span>
              {PRICE_RANGES.map((pr) => {
                const isSelected = currentPriceRange === pr.value;
                return (
                  <button
                    key={pr.label}
                    type="button"
                    onClick={() =>
                      updateQuery({ priceRange: isSelected ? undefined : pr.value })
                    }
                    aria-pressed={isSelected}
                    className={`tap-target-44 px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
                      isSelected
                        ? "bg-brand-primary text-brand-primary-foreground border-brand-primary"
                        : "bg-brand-background text-brand-text border-brand-border hover:bg-brand-secondary"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
                  >
                    {pr.label}
                  </button>
                );
              })}
            </div>

            {/* In-stock toggle */}
            <label className="tap-target-44 inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-brand-text select-none">
              <input
                type="checkbox"
                checked={currentInStock}
                onChange={(e) =>
                  updateQuery({ inStock: e.target.checked ? "true" : undefined })
                }
                className="w-4 h-4 rounded text-brand-primary border-brand-border focus:ring-brand-primary"
              />
              <span>In Stock Only</span>
            </label>
          </div>

          {/* Active filters clear */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="tap-target-44 text-xs font-semibold text-brand-accent hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
