"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, Check } from "lucide-react";
import { useCart } from "../cart/CartContext";
import type { ProductWithVariants } from "@/lib/db/queries/products";

// Inline blur SVG placeholder for next/image
const shimmerPlaceholder = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120'%3E%3Crect width='100%25' height='100%25' fill='%23e5e7eb'/%3E%3C/svg%3E`;

interface ProductCardProps {
  product: ProductWithVariants;
  brandSlug: string;
}

export function ProductCard({ product, brandSlug }: ProductCardProps) {
  const [addedToast, setAddedToast] = useState(false);

  const images = Array.isArray(product.images) && product.images.length > 0
    ? (product.images as string[])
    : ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80"];

  const primaryImage = images[0];
  const secondaryImage = images[1] || primaryImage;

  // Calculate price and sale
  const minPrice = product.minPricePaise / 100;
  const compareAt = product.compareAtPricePaise ? product.compareAtPricePaise / 100 : null;
  const isSale = compareAt && compareAt > minPrice;
  const discountPercent = isSale ? Math.round(((compareAt - minPrice) / compareAt) * 100) : 0;

  // Stock calculation
  const totalStock = product.variants.length > 0
    ? product.variants.reduce((acc, v) => acc + (v.stockQuantity || 0), 0)
    : 10;
  const isSoldOut = totalStock === 0 || !product.hasStock;
  const isLowStock = !isSoldOut && totalStock <= 5;

  const { addItem } = useCart();

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSoldOut) return;

    // Pick first available variant with stock
    const variant = product.variants.find((v) => v.stockQuantity > 0) || product.variants[0];

    addItem({
      id: variant ? `${variant.id}-quick` : `${product.id}-quick`,
      productId: product.id,
      variantId: variant?.id,
      title: product.title,
      sku: variant?.sku || `PROD-${product.id.slice(0, 8)}`,
      pricePaise: variant?.pricePaise || product.basePricePaise,
      compareAtPricePaise: (variant?.attributes as any)?.compare_at_price_paise || product.compareAtPricePaise,
      image: primaryImage,
      attributes: variant?.attributes as any,
    });

    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2500);
  };

  return (
    <div className="group relative flex flex-col h-full bg-brand-surface rounded-lg border border-brand-border overflow-hidden transition-all duration-300 hover:shadow-lg focus-within:ring-2 focus-within:ring-brand-primary">
      {/* Product Image Link */}
      <Link
        href={`/${brandSlug}/products/${product.slug}`}
        className="relative aspect-[3/4] w-full overflow-hidden bg-brand-secondary/40 focus:outline-none"
        aria-label={`View details for ${product.title}`}
      >
        <Image
          src={primaryImage}
          alt={product.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          placeholder="blur"
          blurDataURL={shimmerPlaceholder}
          className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
        />

        {/* Hover swap image if available */}
        {secondaryImage !== primaryImage && (
          <Image
            src={secondaryImage}
            alt={`${product.title} secondary`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover object-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}

        {/* Badges Overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10">
          {isSale && (
            <span className="px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase bg-brand-accent text-brand-accent-foreground rounded shadow-sm">
              -{discountPercent}%
            </span>
          )}
          {isLowStock && (
            <span className="px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase bg-amber-500 text-white rounded shadow-sm">
              Low Stock
            </span>
          )}
          {isSoldOut && (
            <span className="px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase bg-zinc-800 text-white rounded shadow-sm">
              Sold Out
            </span>
          )}
        </div>

        {/* Overlay when sold out */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
            <span className="text-white font-heading font-semibold text-xs tracking-wider uppercase bg-black/70 px-3 py-1 rounded">
              Out of Stock
            </span>
          </div>
        )}
      </Link>

      {/* Content Info */}
      <div className="p-3 sm:p-4 flex flex-col flex-grow justify-between">
        <div>
          {product.category && (
            <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-muted">
              {product.category}
            </span>
          )}
          <h3 className="mt-1 text-sm sm:text-base font-heading font-medium text-brand-text line-clamp-1 group-hover:text-brand-primary transition-colors">
            <Link href={`/${brandSlug}/products/${product.slug}`}>
              {product.title}
            </Link>
          </h3>
        </div>

        <div className="mt-3 pt-2 border-t border-brand-border/40 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-bold text-brand-text">
              ₹{minPrice.toLocaleString("en-IN")}
            </span>
            {compareAt && compareAt > minPrice && (
              <span className="text-xs text-brand-muted line-through">
                ₹{compareAt.toLocaleString("en-IN")}
              </span>
            )}
          </div>

          {/* Quick Add Button (44px tap target) */}
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={isSoldOut}
            className={`tap-target-44 p-2 rounded-full border transition-all ${
              isSoldOut
                ? "opacity-40 cursor-not-allowed border-brand-border text-brand-muted"
                : addedToast
                ? "bg-emerald-600 text-white border-emerald-600"
                : "border-brand-border bg-brand-surface text-brand-text hover:bg-brand-primary hover:text-brand-primary-foreground hover:border-brand-primary"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
            aria-label={isSoldOut ? "Item is sold out" : `Add ${product.title} to bag`}
          >
            {addedToast ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Toast Notification for Quick Add */}
      {addedToast && (
        <div className="absolute bottom-2 left-2 right-2 bg-brand-primary text-brand-primary-foreground text-xs py-1.5 px-3 rounded shadow-lg text-center font-medium animate-bounce z-20">
          Added to cart (Phase 4 placeholder)
        </div>
      )}
    </div>
  );
}
