"use client";

import React, { useState } from "react";
import { createProductAction } from "@/app/admin/actions";
import { X, Plus, Sparkles, Loader2, AlertCircle } from "lucide-react";
import MediaUploader, { MediaItem } from "@/components/media/MediaUploader";
import VideoUploader, { VideoItem } from "@/components/media/VideoUploader";

interface CreateProductModalProps {
  brandId: string;
  brandSlug: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_SIZES = ["S", "M", "L", "XL"];

export function CreateProductModal({
  brandId,
  brandSlug,
  isOpen,
  onClose,
  onSuccess,
}: CreateProductModalProps) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("T-Shirts");
  const [description, setDescription] = useState("");
  const [basePriceRupees, setBasePriceRupees] = useState("1999");
  const [compareAtPriceRupees, setCompareAtPriceRupees] = useState("2499");
  const [mediaItems, setMediaItems] = useState<(string | MediaItem)[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [featured, setFeatured] = useState(false);

  // Variant generator state
  const [selectedSizes, setSelectedSizes] = useState<string[]>(DEFAULT_SIZES);
  const [defaultStock, setDefaultStock] = useState(25);
  const [customVariants, setCustomVariants] = useState<
    { size: string; sku: string; stock: number; priceRupees: string; imageIndex?: number }[]
  >(
    DEFAULT_SIZES.map((size) => ({
      size,
      sku: "",
      stock: 25,
      priceRupees: "1999",
      imageIndex: 0,
    }))
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Derive slug automatically when title changes if user hasn't explicitly edited it
  const handleTitleChange = (val: string) => {
    setTitle(val);
    const autoSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(autoSlug);

    // Update SKUs for variants
    setCustomVariants((prev) =>
      prev.map((v) => ({
        ...v,
        sku: `${autoSlug.toUpperCase() || "SKU"}-${v.size}`,
      }))
    );
  };

  const toggleSize = (size: string) => {
    if (selectedSizes.includes(size)) {
      if (selectedSizes.length <= 1) return; // Keep at least one size
      const newSizes = selectedSizes.filter((s) => s !== size);
      setSelectedSizes(newSizes);
      setCustomVariants((prev) => prev.filter((v) => v.size !== size));
    } else {
      const newSizes = [...selectedSizes, size];
      setSelectedSizes(newSizes);
      const prefix = slug.toUpperCase() || "SKU";
      setCustomVariants((prev) => [
        ...prev,
        {
          size,
          sku: `${prefix}-${size}`,
          stock: defaultStock,
          priceRupees: basePriceRupees,
          imageIndex: 0,
        },
      ]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !slug.trim()) {
      setError("Title and slug are required");
      return;
    }

    const pricePaise = Math.round(parseFloat(basePriceRupees) * 100);
    const comparePaise = compareAtPriceRupees
      ? Math.round(parseFloat(compareAtPriceRupees) * 100)
      : undefined;

    if (isNaN(pricePaise) || pricePaise <= 0) {
      setError("Invalid base price");
      return;
    }

    const images = mediaItems
      .map((item) => (typeof item === "string" ? item.trim() : item.url.trim()))
      .filter(Boolean);

    const variants = customVariants.map((v) => {
      const variantImages =
        v.imageIndex !== undefined && images[v.imageIndex]
          ? [images[v.imageIndex]]
          : [];
      return {
        sku: v.sku.trim() || `${slug.toUpperCase()}-${v.size}`,
        title: `${title} - ${v.size}`,
        pricePaise: Math.round((parseFloat(v.priceRupees) || parseFloat(basePriceRupees)) * 100),
        stockQuantity: v.stock >= 0 ? v.stock : 0,
        attributes: {
          size: v.size,
          ...(variantImages.length > 0 ? { images: variantImages } : {}),
        },
      };
    });

    const videoPayload = videos.map((v) => ({
      id: v.id,
      url: v.url,
      posterUrl: v.posterUrl,
      durationSeconds: v.durationSeconds,
    }));

    setLoading(true);
    try {
      const res = await createProductAction(brandId, {
        title: title.trim(),
        slug: slug.trim(),
        category: category.trim(),
        description: description.trim(),
        basePricePaise: pricePaise,
        compareAtPricePaise: comparePaise,
        images,
        videos: videoPayload,
        featured,
        variants,
      });

      if (!res.ok) {
        setError(res.error || "Failed to create product");
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl text-white my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold">Create New Product</h2>
            <p className="text-xs text-zinc-400">
              Add a new clothing item with size variants to {brandSlug}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Product Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Heavyweight Boxy Tee"
                className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                URL Slug *
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. heavyweight-boxy-tee"
                className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Category & Featured */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="T-Shirts">T-Shirts</option>
                <option value="Shirts">Shirts</option>
                <option value="Hoodies">Hoodies &amp; Sweatshirts</option>
                <option value="Pants">Pants &amp; Trousers</option>
                <option value="Denim">Denim &amp; Jeans</option>
                <option value="Outerwear">Outerwear</option>
                <option value="Accessories">Accessories</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="featured-check"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 rounded bg-zinc-950 border-zinc-800 text-orange-600 focus:ring-orange-500 focus:ring-offset-0"
              />
              <label
                htmlFor="featured-check"
                className="text-xs font-semibold text-zinc-200 cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Feature on Brand Homepage
              </label>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Base Selling Price (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={basePriceRupees}
                onChange={(e) => setBasePriceRupees(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Compare-at MRP (₹) (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                value={compareAtPriceRupees}
                onChange={(e) => setCompareAtPriceRupees(e.target.value)}
                placeholder="2499.00"
                className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Crafted from 100% pre-shrunk heavyweight cotton..."
              className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
            />
          </div>

          {/* Product Media Uploader */}
          <div className="pt-1">
            <MediaUploader
              brandId={brandId}
              value={mediaItems}
              onChange={setMediaItems}
              maxFiles={8}
              cropPreset="4:5"
              label="Product Images (Cover, Gallery, & Thumbnails)"
            />
          </div>

          {/* Product Video / Reel Uploader */}
          <div className="pt-1">
            <VideoUploader
              brandId={brandId}
              value={videos}
              onChange={setVideos}
              maxVideos={3}
              label="Product Reels / Videos (Short form, 9:16 or 1:1, max 30s, max 25 MB)"
            />
          </div>

          {/* Variant Generation */}
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">
                  Size Variants &amp; Inventory
                </span>
                <span className="text-[11px] text-zinc-400">
                  Select available sizes, set prices, and map variant-specific images
                </span>
              </div>
            </div>

            {/* Size Pills */}
            <div className="flex flex-wrap gap-2">
              {["XS", "S", "M", "L", "XL", "XXL"].map((s) => {
                const active = selectedSizes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSize(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? "bg-orange-600 text-white shadow-sm"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    Size {s}
                  </button>
                );
              })}
            </div>

            {/* Variant Table */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800/80 overflow-hidden">
              <div className="grid grid-cols-[50px_1fr_85px_65px_110px] p-2.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                <div>Size</div>
                <div>SKU</div>
                <div>Price (₹)</div>
                <div>Stock</div>
                <div>Image</div>
              </div>

              {customVariants.map((v, idx) => (
                <div
                  key={v.size}
                  className="grid grid-cols-[50px_1fr_85px_65px_110px] items-center p-2 text-xs"
                >
                  <div className="font-bold text-white">{v.size}</div>
                  <div className="pr-2">
                    <input
                      type="text"
                      value={v.sku}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, sku: val } : item
                          )
                        );
                      }}
                      className="w-full h-8 px-2 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono text-white"
                    />
                  </div>
                  <div className="pr-2">
                    <input
                      type="number"
                      step="0.01"
                      value={v.priceRupees}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, priceRupees: val } : item
                          )
                        );
                      }}
                      className="w-full h-8 px-2 rounded bg-zinc-900 border border-zinc-800 text-xs text-white"
                    />
                  </div>
                  <div className="pr-2">
                    <input
                      type="number"
                      min="0"
                      value={v.stock}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setCustomVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, stock: val } : item
                          )
                        );
                      }}
                      className="w-full h-8 px-2 rounded bg-zinc-900 border border-zinc-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <select
                      value={v.imageIndex ?? 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setCustomVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, imageIndex: val } : item
                          )
                        );
                      }}
                      className="w-full h-8 px-1.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 focus:outline-none"
                    >
                      {mediaItems.map((_, mIdx) => (
                        <option key={mIdx} value={mIdx}>
                          {mIdx === 0 ? "Cover Img" : `Img ${mIdx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs tracking-wide transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Product...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create Product</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
