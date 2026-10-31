"use client";

import React, { useState, useEffect, useTransition } from "react";
import { updateProductAction } from "@/app/admin/actions";
import type { AdminProductItem } from "@/lib/db/queries/admin";
import { X, Sparkles, Loader2, AlertCircle, Save, Layers } from "lucide-react";
import MediaUploader, { MediaItem } from "@/components/media/MediaUploader";

interface EditProductModalProps {
  brandId: string;
  brandSlug: string;
  product: AdminProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedProduct: AdminProductItem) => void;
}

export function EditProductModal({
  brandId,
  brandSlug,
  product,
  isOpen,
  onClose,
  onSuccess,
}: EditProductModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Apparel");
  const [description, setDescription] = useState("");
  const [basePriceRupees, setBasePriceRupees] = useState("");
  const [compareAtPriceRupees, setCompareAtPriceRupees] = useState("");
  const [featured, setFeatured] = useState(false);
  const [mediaItems, setMediaItems] = useState<(string | MediaItem)[]>([]);
  const [variants, setVariants] = useState<
    { id: string; sku: string; title: string; priceRupees: string; stock: number }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Initialize form state whenever the selected product changes
  useEffect(() => {
    if (product) {
      setTitle(product.title || "");
      setCategory(product.category || "Apparel");
      setDescription(product.description || "");
      setBasePriceRupees(((product.basePricePaise || 0) / 100).toString());
      setCompareAtPriceRupees(
        product.compareAtPricePaise
          ? (product.compareAtPricePaise / 100).toString()
          : ""
      );
      setFeatured(Boolean(product.featured));
      setMediaItems(((product.images as string[]) || []) as (string | MediaItem)[]);
      setVariants(
        (product.variants || []).map((v) => ({
          id: v.id,
          sku: v.sku,
          title: v.title,
          priceRupees: ((v.pricePaise || product.basePricePaise) / 100).toString(),
          stock: v.stockQuantity || 0,
        }))
      );
      setError(null);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Product title is required.");
      return;
    }

    const basePriceNum = parseFloat(basePriceRupees);
    if (isNaN(basePriceNum) || basePriceNum <= 0) {
      setError("Please enter a valid base price.");
      return;
    }

    const basePricePaise = Math.round(basePriceNum * 100);
    const compareAtNum = parseFloat(compareAtPriceRupees);
    const compareAtPricePaise =
      !isNaN(compareAtNum) && compareAtNum > 0 ? Math.round(compareAtNum * 100) : null;

    // Extract image URLs
    const imageUrls = mediaItems
      .map((item) => (typeof item === "string" ? item : item.url))
      .filter(Boolean);

    startTransition(async () => {
      const res = await updateProductAction(brandId, product.id, {
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
        basePricePaise,
        compareAtPricePaise,
        featured,
        images: imageUrls,
        variants: variants.map((v) => ({
          id: v.id,
          sku: v.sku.trim(),
          title: v.title.trim(),
          pricePaise: Math.round((parseFloat(v.priceRupees) || basePriceNum) * 100),
          stockQuantity: v.stock >= 0 ? v.stock : 0,
        })),
      });

      if (!res.ok || !res.data) {
        setError(res.error || "Failed to save product updates.");
      } else {
        onSuccess(res.data);
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/40">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Edit Product</span>
              <span className="text-xs text-orange-400 font-mono">#{product.slug}</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Update product details, pricing, images, and variant inventory.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">
                Product Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">
                Base Selling Price (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={basePriceRupees}
                onChange={(e) => setBasePriceRupees(e.target.value)}
                className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">
                Original / Compare-At Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={compareAtPriceRupees}
                onChange={(e) => setCompareAtPriceRupees(e.target.value)}
                placeholder="Optional strike-through price"
                className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Featured Toggle */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-xs text-zinc-200 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Feature this product on homepage</span>
            </span>
          </label>

          {/* Product Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Product Media */}
          <div className="space-y-2 border-t border-zinc-800 pt-4">
            <label className="text-xs font-semibold text-zinc-300 block">
              Product Images
            </label>
            <MediaUploader
              brandId={brandId}
              value={mediaItems}
              onChange={setMediaItems}
              maxFiles={8}
            />
          </div>

          {/* Variants List & Stock */}
          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-orange-400" />
                <span>Variants &amp; Stock Levels</span>
              </label>
              <span className="text-[11px] text-zinc-400 font-mono">
                {variants.length} Variants
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {variants.map((v, idx) => (
                <div
                  key={v.id || idx}
                  className="grid grid-cols-[1fr_120px_100px] gap-2 items-center p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-xs"
                >
                  <div>
                    <input
                      type="text"
                      value={v.title}
                      onChange={(e) => {
                        const next = [...variants];
                        next[idx].title = e.target.value;
                        setVariants(next);
                      }}
                      className="w-full bg-transparent border-b border-zinc-800 text-white font-medium text-xs focus:outline-none focus:border-orange-500"
                      placeholder="Variant Title (e.g. Medium)"
                    />
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
                      SKU: {v.sku}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 block mb-0.5">Price (₹)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={v.priceRupees}
                      onChange={(e) => {
                        const next = [...variants];
                        next[idx].priceRupees = e.target.value;
                        setVariants(next);
                      }}
                      className="w-full h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 block mb-0.5">Stock</span>
                    <input
                      type="number"
                      min="0"
                      value={v.stock}
                      onChange={(e) => {
                        const next = [...variants];
                        next[idx].stock = parseInt(e.target.value) || 0;
                        setVariants(next);
                      }}
                      className="w-full h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm disabled:opacity-50 transition-colors"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Product</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
