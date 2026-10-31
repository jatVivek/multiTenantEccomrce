"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShoppingBag,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  PackageCheck,
  Layers,
} from "lucide-react";
import { useCart } from "../cart/CartContext";
import ProductGallery, { GalleryMediaItem } from "./ProductGallery";
import type { ProductWithVariants } from "@/lib/db/queries/products";
import type { Bundle } from "@/src/db/schema";

interface ProductDetailViewProps {
  product: ProductWithVariants;
  bundles: Bundle[];
  brandSlug: string;
  brandName: string;
}

export function ProductDetailView({
  product,
  bundles,
  brandSlug,
  brandName,
}: ProductDetailViewProps) {
  const images = Array.isArray(product.images) && product.images.length > 0
    ? (product.images as string[])
    : ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80"];

  const galleryMedia: GalleryMediaItem[] = useMemo(() => {
    const list: GalleryMediaItem[] = [];
    if (Array.isArray(product.images)) {
      for (const img of product.images) {
        if (typeof img === "string" && img.trim()) {
          list.push({ type: "image", url: img.trim() });
        }
      }
    }
    const rawVideos = (product as any).videos;
    if (Array.isArray(rawVideos)) {
      for (const v of rawVideos) {
        if (v && v.url) {
          list.push({
            type: "video",
            url: v.url,
            posterUrl: v.posterUrl,
            id: v.id,
          });
        }
      }
    }
    return list;
  }, [product.images, (product as any).videos]);

  // Gallery state
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Variant options extraction
  const variants = product.variants;

  // Extract unique colors
  const availableColors = useMemo(() => {
    const map = new Map<string, { name: string; hex?: string }>();
    variants.forEach((v) => {
      const attrs = (v.attributes as any) || {};
      if (attrs.color) {
        map.set(attrs.color, {
          name: attrs.color,
          hex: attrs.colorHex || "#111111",
        });
      }
    });
    return Array.from(map.values());
  }, [variants]);

  // Extract unique sizes
  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    variants.forEach((v) => {
      const attrs = (v.attributes as any) || {};
      if (attrs.size) set.add(attrs.size);
    });
    return Array.from(set);
  }, [variants]);

  // Check if product has waist/inseam
  const hasWaistInseam = useMemo(() => {
    return variants.some((v) => {
      const attrs = (v.attributes as any) || {};
      return attrs.waist !== undefined && attrs.inseam !== undefined;
    });
  }, [variants]);

  const availableWaists = useMemo(() => {
    const set = new Set<number>();
    variants.forEach((v) => {
      const attrs = (v.attributes as any) || {};
      if (attrs.waist) set.add(Number(attrs.waist));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [variants]);

  const availableInseams = useMemo(() => {
    const set = new Set<number>();
    variants.forEach((v) => {
      const attrs = (v.attributes as any) || {};
      if (attrs.inseam) set.add(Number(attrs.inseam));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [variants]);

  // Initial selection state
  const [selectedColor, setSelectedColor] = useState<string>(
    availableColors[0]?.name || ""
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    availableSizes[0] || ""
  );
  const [selectedWaist, setSelectedWaist] = useState<number>(
    availableWaists[0] || 32
  );
  const [selectedInseam, setSelectedInseam] = useState<number>(
    availableInseams[0] || 30
  );
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [cartToastMessage, setCartToastMessage] = useState<string | null>(null);

  // Determine current active variant based on selection
  const currentVariant = useMemo(() => {
    if (variants.length === 0) return null;

    if (hasWaistInseam) {
      const match = variants.find((v) => {
        const attrs = (v.attributes as any) || {};
        const matchesWaist = Number(attrs.waist) === selectedWaist;
        const matchesInseam = Number(attrs.inseam) === selectedInseam;
        const matchesColor = !selectedColor || attrs.color === selectedColor;
        return matchesWaist && matchesInseam && matchesColor;
      });
      return match || variants[0];
    }

    const match = variants.find((v) => {
      const attrs = (v.attributes as any) || {};
      const matchesSize = !selectedSize || attrs.size === selectedSize;
      const matchesColor = !selectedColor || attrs.color === selectedColor;
      return matchesSize && matchesColor;
    });

    return match || variants[0];
  }, [variants, selectedColor, selectedSize, selectedWaist, selectedInseam, hasWaistInseam]);

  // Selected bundle calculation
  const activeBundle = useMemo(() => {
    return bundles.find((b) => b.id === selectedBundleId) || null;
  }, [bundles, selectedBundleId]);

  // Price calculation
  const displayPricePaise = activeBundle
    ? activeBundle.bundlePricePaise
    : currentVariant
    ? currentVariant.pricePaise
    : product.basePricePaise;

  const compareAtPaise = activeBundle
    ? null
    : (currentVariant?.attributes as any)?.compare_at_price_paise || product.compareAtPricePaise;

  const currentPrice = displayPricePaise / 100;
  const compareAtPrice = compareAtPaise ? compareAtPaise / 100 : null;
  const isSale = compareAtPrice && compareAtPrice > currentPrice;
  const discountPercent = isSale ? Math.round(((compareAtPrice - currentPrice) / compareAtPrice) * 100) : 0;

  // Stock status
  const currentStock = currentVariant ? currentVariant.stockQuantity : 10;
  const isOutOfStock = currentStock === 0;
  const isLowStock = !isOutOfStock && currentStock <= 5;

  // Swipe gallery handling
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 50) {
      // swipe left -> next
      setActiveImageIndex((prev) => (prev + 1) % images.length);
    } else if (diff < -50) {
      // swipe right -> prev
      setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
    setTouchStartX(null);
  };

  const { addItem } = useCart();

  const handleAddToCart = () => {
    if (isOutOfStock && !activeBundle) return;

    if (activeBundle) {
      addItem({
        id: `bundle-${activeBundle.id}`,
        productId: product.id,
        bundleId: activeBundle.id,
        title: activeBundle.title,
        sku: `BUNDLE-${activeBundle.id.slice(0, 8)}`,
        pricePaise: activeBundle.bundlePricePaise,
        image: images[0],
        bundleItems: Array.isArray(activeBundle.items) ? (activeBundle.items as any[]) : [],
        attributes: { type: "bundle" },
      });
      setCartToastMessage(`Added combo bundle: ${activeBundle.title}`);
    } else if (currentVariant) {
      addItem({
        id: `${currentVariant.id}-${selectedSize || selectedWaist}-${selectedColor}`,
        productId: product.id,
        variantId: currentVariant.id,
        title: product.title,
        sku: currentVariant.sku,
        pricePaise: currentVariant.pricePaise,
        compareAtPricePaise: (currentVariant.attributes as any)?.compare_at_price_paise,
        image: images[0],
        attributes: {
          size: selectedSize || (hasWaistInseam ? `${selectedWaist}W x ${selectedInseam}L` : undefined),
          color: selectedColor || undefined,
          waist: hasWaistInseam ? selectedWaist : undefined,
          inseam: hasWaistInseam ? selectedInseam : undefined,
        },
      });
      setCartToastMessage(`Added to bag: ${product.title} (${currentVariant.title})`);
    }

    setTimeout(() => setCartToastMessage(null), 3000);
  };

  // Helper to check if a specific size is in stock
  const isSizeInStock = (size: string) => {
    const v = variants.find((item) => {
      const attrs = (item.attributes as any) || {};
      const matchesColor = !selectedColor || attrs.color === selectedColor;
      return attrs.size === size && matchesColor;
    });
    return v ? v.stockQuantity > 0 : true;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-14">
      {/* Breadcrumb navigation */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-brand-muted">
        <Link href={`/${brandSlug}`} className="hover:text-brand-text">Home</Link>
        <span>/</span>
        <Link href={`/${brandSlug}/catalog`} className="hover:text-brand-text">Catalog</Link>
        <span>/</span>
        {product.category && (
          <>
            <Link
              href={`/${brandSlug}/catalog?category=${encodeURIComponent(product.category)}`}
              className="hover:text-brand-text"
            >
              {product.category}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-brand-text font-medium truncate">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14">
        {/* Left: Gallery (Swipeable, Thumbnails, Reels/Video Autoplay) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <ProductGallery
            media={galleryMedia}
            productTitle={product.title}
            activeVariantAttributes={currentVariant?.attributes as any}
          >
            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10 pointer-events-none">
              {isSale && !activeBundle && (
                <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-brand-accent text-brand-accent-foreground rounded shadow">
                  -{discountPercent}% OFF
                </span>
              )}
              {isLowStock && (
                <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-amber-500 text-white rounded shadow">
                  Only {currentStock} left
                </span>
              )}
              {isOutOfStock && !activeBundle && (
                <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-zinc-800 text-white rounded shadow">
                  Sold Out
                </span>
              )}
            </div>
          </ProductGallery>
        </div>

        {/* Right: Product Details, Variant Toggles, Bundles & Add to Bag */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          {/* Header */}
          <div>
            {product.category && (
              <span className="text-xs uppercase tracking-wider font-semibold text-brand-muted">
                {product.category}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-brand-text mt-1">
              {product.title}
            </h1>

            {/* Price display with variant updates */}
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-brand-text">
                ₹{currentPrice.toLocaleString("en-IN")}
              </span>
              {compareAtPrice && compareAtPrice > currentPrice && (
                <span className="text-base text-brand-muted line-through">
                  ₹{compareAtPrice.toLocaleString("en-IN")}
                </span>
              )}
              {isSale && (
                <span className="text-xs font-bold text-brand-accent uppercase tracking-wider">
                  Save ₹{(compareAtPrice! - currentPrice).toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <p className="text-xs text-brand-muted mt-1">Inclusive of all taxes • Free express shipping</p>
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-sm text-brand-muted leading-relaxed border-t border-brand-border/60 pt-4">
              {product.description}
            </p>
          )}

          {/* Color Swatches */}
          {availableColors.length > 0 && (
            <div className="space-y-2 border-t border-brand-border/60 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-brand-text">
                  Color: <span className="font-normal text-brand-muted">{selectedColor}</span>
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap" role="radiogroup" aria-label="Choose color">
                {availableColors.map((c) => {
                  const isSelected = selectedColor === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedColor(c.name)}
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={c.name}
                      className={`tap-target-44 relative w-10 h-10 rounded-full border-2 p-0.5 transition-all ${
                        isSelected
                          ? "border-brand-primary ring-2 ring-brand-primary/30 scale-110"
                          : "border-brand-border hover:border-brand-primary/50"
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
                    >
                      <span
                        className="w-full h-full rounded-full block shadow-inner"
                        style={{ backgroundColor: c.hex }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Waist & Inseam toggles (if pants/trousers) */}
          {hasWaistInseam ? (
            <div className="space-y-4 border-t border-brand-border/60 pt-4">
              {/* Waist toggle */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-text block">
                  Waist Size: <span className="font-normal text-brand-muted">{selectedWaist} inches</span>
                </span>
                <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="Waist size">
                  {availableWaists.map((w) => {
                    const isSelected = selectedWaist === w;
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setSelectedWaist(w)}
                        role="radio"
                        aria-checked={isSelected}
                        className={`tap-target-44 min-w-[48px] px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                          isSelected
                            ? "bg-brand-primary text-brand-primary-foreground border-brand-primary shadow-sm"
                            : "bg-brand-surface text-brand-text border-brand-border hover:bg-brand-secondary"
                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inseam toggle */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-text block">
                  Inseam Length: <span className="font-normal text-brand-muted">{selectedInseam} inches</span>
                </span>
                <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="Inseam length">
                  {availableInseams.map((ins) => {
                    const isSelected = selectedInseam === ins;
                    return (
                      <button
                        key={ins}
                        type="button"
                        onClick={() => setSelectedInseam(ins)}
                        role="radio"
                        aria-checked={isSelected}
                        className={`tap-target-44 min-w-[48px] px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                          isSelected
                            ? "bg-brand-primary text-brand-primary-foreground border-brand-primary shadow-sm"
                            : "bg-brand-surface text-brand-text border-brand-border hover:bg-brand-secondary"
                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
                      >
                        {ins}L
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Size Chips (for Tops / Shirts / Standard apparel) */
            availableSizes.length > 0 && (
              <div className="space-y-2 border-t border-brand-border/60 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-brand-text">
                    Select Size: <span className="font-normal text-brand-muted">{selectedSize}</span>
                  </span>
                  <span className="text-brand-muted">True to size</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="Select size">
                  {availableSizes.map((sz) => {
                    const isSelected = selectedSize === sz;
                    const inStock = isSizeInStock(sz);
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        disabled={!inStock}
                        role="radio"
                        aria-checked={isSelected}
                        aria-disabled={!inStock}
                        className={`tap-target-44 min-w-[50px] px-3.5 py-2 text-xs font-bold rounded-lg border transition-all relative ${
                          !inStock
                            ? "opacity-35 cursor-not-allowed border-brand-border line-through bg-brand-surface/40 text-brand-muted"
                            : isSelected
                            ? "bg-brand-primary text-brand-primary-foreground border-brand-primary shadow-sm"
                            : "bg-brand-surface text-brand-text border-brand-border hover:bg-brand-secondary hover:border-brand-primary/50"
                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Twinning / Combo Bundles Selector */}
          {bundles.length > 0 && (
            <div className="border border-brand-border rounded-xl p-4 bg-brand-secondary/30 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-text">
                <Layers className="w-4 h-4 text-brand-primary" />
                <span>Pair & Save: Combo Packages</span>
              </div>

              <div className="space-y-2">
                {/* Standard single product option */}
                <label className="flex items-center justify-between p-3 rounded-lg border border-brand-border/70 bg-brand-surface cursor-pointer hover:border-brand-primary/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="bundle-selection"
                      checked={selectedBundleId === null}
                      onChange={() => setSelectedBundleId(null)}
                      className="text-brand-primary focus:ring-brand-primary w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-brand-text">
                      Single Item: {product.title}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-brand-text">
                    ₹{(currentVariant ? currentVariant.pricePaise / 100 : product.basePricePaise / 100).toLocaleString("en-IN")}
                  </span>
                </label>

                {/* Bundle options */}
                {bundles.map((bundle) => {
                  const isSelected = selectedBundleId === bundle.id;
                  const bundlePrice = bundle.bundlePricePaise / 100;
                  return (
                    <label
                      key={bundle.id}
                      className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary"
                          : "border-brand-border bg-brand-surface hover:border-brand-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="bundle-selection"
                            checked={isSelected}
                            onChange={() => setSelectedBundleId(bundle.id)}
                            className="text-brand-primary focus:ring-brand-primary w-4 h-4"
                          />
                          <span className="text-xs font-bold text-brand-text">{bundle.title}</span>
                        </div>
                        <span className="text-xs font-extrabold text-brand-primary">
                          ₹{bundlePrice.toLocaleString("en-IN")}
                        </span>
                      </div>

                      {/* Bundle Items list */}
                      {Array.isArray(bundle.items) && bundle.items.length > 0 && (
                        <div className="mt-2 pl-6 space-y-1 text-[11px] text-brand-muted">
                          {(bundle.items as any[]).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span>• {item.title || item.name}</span>
                              <span className="font-medium text-brand-text">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add to Cart Button (44px tap target, wired to placeholder for Phase 4) */}
          <div className="pt-2 space-y-3">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isOutOfStock && !activeBundle}
              className={`tap-target-44 w-full py-4 px-6 rounded-xl font-heading font-bold text-sm tracking-wide uppercase transition-all shadow-md flex items-center justify-center gap-2 ${
                isOutOfStock && !activeBundle
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60"
                  : "bg-brand-primary text-brand-primary-foreground hover:brightness-110 active:scale-[0.99]"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
            >
              <ShoppingBag className="w-5 h-5" />
              <span>
                {isOutOfStock && !activeBundle
                  ? "Out of Stock"
                  : activeBundle
                  ? `Add Bundle to Bag • ₹${(activeBundle.bundlePricePaise / 100).toLocaleString("en-IN")}`
                  : `Add to Bag • ₹${currentPrice.toLocaleString("en-IN")}`}
              </span>
            </button>

            {/* Notification toast */}
            {cartToastMessage && (
              <div className="p-3 bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center justify-between animate-fade-in">
                <span>{cartToastMessage} (Phase 4 placeholder)</span>
                <Check className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Value Props & Assurance Badges */}
          <div className="border-t border-brand-border/60 pt-4 grid grid-cols-2 gap-3 text-xs text-brand-muted">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-primary flex-shrink-0" />
              <span>2-4 Day Express Dispatch</span>
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-brand-primary flex-shrink-0" />
              <span>7-Day Easy Size Exchange</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-primary flex-shrink-0" />
              <span>100% Quality Guaranteed</span>
            </div>
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-brand-primary flex-shrink-0" />
              <span>Direct-to-Consumer Pricing</span>
            </div>
          </div>
        </div>
      </div>

      {/* JSON-LD Product Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org/",
            "@type": "Product",
            name: product.title,
            image: images,
            description: product.description,
            brand: {
              "@type": "Brand",
              name: brandName,
            },
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "INR",
              lowPrice: (product.minPricePaise / 100).toFixed(2),
              highPrice: (product.maxPricePaise / 100).toFixed(2),
              offerCount: product.variants.length,
              availability: product.hasStock
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            },
          }),
        }}
      />
    </div>
  );
}
