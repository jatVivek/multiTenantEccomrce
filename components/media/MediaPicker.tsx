"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileImage,
  Link as LinkIcon,
  X,
  Camera,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import MediaLibraryModal from "./MediaLibraryModal";
import { uploadMediaDirectAction } from "@/app/admin/media/actions";

interface MediaPickerProps {
  brandId: string;
  value: string;
  onChange: (url: string) => void;
  label?: string;
  recommendedSize?: string;
  className?: string;
}

export default function MediaPicker({
  brandId,
  value,
  onChange,
  label,
  recommendedSize,
  className = "",
}: MediaPickerProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("alt", label || "Brand asset");

      const res = await uploadMediaDirectAction(brandId, formData);
      if (res.ok && res.data) {
        onChange(res.data.url);
      } else {
        setErrorMsg(res.error || "Upload failed");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlDraft) return;
    onChange(urlDraft.trim());
    setUrlDraft("");
    setShowUrlInput(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-zinc-300">{label}</label>
          {recommendedSize && (
            <span className="text-[10px] text-zinc-500 font-mono">Rec: {recommendedSize}</span>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="text-[11px] text-red-400 bg-red-950/50 p-2 rounded-lg border border-red-900/50">
          {errorMsg}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Preview Thumbnail */}
        <div className="relative w-16 h-16 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
          ) : value ? (
            <>
              <img src={value} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange("")}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/80 hover:bg-red-600 text-white transition-colors"
                title="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <ImageIcon className="w-6 h-6 text-zinc-700" />
          )}
        </div>

        {/* Action Controls */}
        <div className="flex-1 space-y-1.5">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={handleUpload}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5 text-orange-400" />
              <span>{value ? "Change" : "Upload File"}</span>
            </button>

            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <FileImage className="w-3.5 h-3.5 text-zinc-400" />
              <span>Library</span>
            </button>

            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="px-2 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors"
              title="Paste image URL"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {showUrlInput && (
            <form onSubmit={handleApplyUrl} className="flex gap-1.5 pt-1">
              <input
                type="url"
                required
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 font-mono"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Apply
              </button>
            </form>
          )}
        </div>
      </div>

      {libraryOpen && (
        <MediaLibraryModal
          brandId={brandId}
          onSelectAsset={(asset) => onChange(asset.url)}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </div>
  );
}
