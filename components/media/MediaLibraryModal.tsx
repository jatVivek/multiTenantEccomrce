"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FileImage, Search, Check, X, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { listBrandMediaAssetsAction } from "@/app/admin/media/actions";

interface MediaLibraryModalProps {
  brandId: string;
  onSelectAsset: (asset: { id: string; url: string; alt?: string | null }) => void;
  onClose: () => void;
}

export default function MediaLibraryModal({
  brandId,
  onSelectAsset,
  onClose,
}: MediaLibraryModalProps) {
  const [assets, setAssets] = useState<any[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const fetchAssets = useCallback(async (isCurrent: () => boolean) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await listBrandMediaAssetsAction(brandId, {
        search: search.trim() || undefined,
        limit: 40,
      });

      if (!isCurrent()) return; // Prevent race conditions on unmount or fast search typing

      if (res.ok && res.data) {
        setAssets(res.data.assets);
        setStatus("success");
      } else {
        setErrorMessage(res.error || "Failed to load media assets");
        setStatus("error");
      }
    } catch (err: any) {
      if (!isCurrent()) return;
      setErrorMessage(err.message || "Network error loading media assets");
      setStatus("error");
    }
  }, [brandId, search]);

  useEffect(() => {
    let active = true;
    const isCurrent = () => active;

    fetchAssets(isCurrent);

    return () => {
      active = false;
    };
  }, [fetchAssets, retryTrigger]);

  const handleConfirm = () => {
    const chosen = assets.find((a) => a.id === selectedId);
    if (chosen) {
      onSelectAsset({ id: chosen.id, url: chosen.url, alt: chosen.alt });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <FileImage className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-white text-base">Brand Media Library</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Filter */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by label or keyword..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Assets Grid / Loading / Error Container */}
        <div className="flex-1 overflow-y-auto min-h-[300px] border border-zinc-800/60 rounded-xl p-3 bg-zinc-950">
          {status === "loading" && (
            // Layout-matching skeleton loader preventing layout shift
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-zinc-900 border border-zinc-800/60 animate-pulse relative overflow-hidden"
                >
                  <div className="absolute inset-x-2 bottom-2 h-3 bg-zinc-800/60 rounded" />
                </div>
              ))}
            </div>
          )}

          {status === "error" && (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-rose-300">
                  {errorMessage || "Failed to retrieve media library"}
                </p>
                <p className="text-[11px] text-zinc-500">
                  Please check your connection and try again.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRetryTrigger((prev) => prev + 1)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Fetch</span>
              </button>
            </div>
          )}

          {status === "success" && assets.length === 0 && (
            // Explicit Empty State (never fallback dummy data)
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-zinc-500 text-xs py-12 text-center space-y-2">
              <FileImage className="w-8 h-8 opacity-40 mb-1" />
              <p className="font-semibold text-zinc-400">No media assets found</p>
              <p className="text-[11px] text-zinc-500 max-w-xs">
                {search.trim()
                  ? `No files matched "${search}". Try searching for another keyword.`
                  : "Upload photos or banners to build this brand's media asset library."}
              </p>
            </div>
          )}

          {status === "success" && assets.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {assets.map((asset) => {
                const isSelected = selectedId === asset.id;
                const sizeKb = (asset.sizeBytes / 1024).toFixed(0);

                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedId(asset.id)}
                    className={`group relative aspect-square rounded-xl overflow-hidden border-2 text-left transition-all ${
                      isSelected
                        ? "border-orange-500 ring-2 ring-orange-500/30"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <img
                      src={asset.url}
                      alt={asset.alt || "Media thumbnail"}
                      className="w-full h-full object-cover"
                    />

                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-orange-600 flex items-center justify-center text-white shadow">
                        <Check className="w-3 h-3" />
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1.5 text-[10px] text-zinc-300 truncate">
                      <span>{asset.alt || asset.mime}</span>
                      <span className="block text-[9px] text-zinc-400 font-mono">{sizeKb} KB</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <span className="text-xs text-zinc-400">
            {selectedId ? "1 asset selected" : "Click an asset to select"}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={handleConfirm}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Use Selected Image</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
