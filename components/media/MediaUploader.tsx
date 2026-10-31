"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  Camera,
  FileImage,
  Link as LinkIcon,
  X,
  Star,
  Crop,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import ImageCropperModal from "./ImageCropperModal";
import MediaLibraryModal from "./MediaLibraryModal";
import { uploadMediaDirectAction } from "@/app/admin/media/actions";

export interface MediaItem {
  id?: string;
  url: string;
  alt?: string;
  isCover?: boolean;
}

interface MediaUploaderProps {
  brandId: string;
  value: (string | MediaItem)[];
  onChange: (items: (string | MediaItem)[]) => void;
  maxFiles?: number;
  label?: string;
  cropPreset?: "1:1" | "4:5" | "16:9" | "free";
}

export default function MediaUploader({
  brandId,
  value = [],
  onChange,
  maxFiles = 8,
  label = "Product Images",
  cropPreset = "4:5",
}: MediaUploaderProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [pastedUrl, setPastedUrl] = useState("");
  const [pastedAlt, setPastedAlt] = useState("");

  const [cropperOpen, setCropperOpen] = useState(false);
  const [croppingImageSrc, setCroppingImageSrc] = useState<string | null>(null);
  const [croppingIndex, setCroppingIndex] = useState<number | null>(null);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number }[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Normalize input value into structured MediaItem array
  const items: MediaItem[] = value.map((item, idx) => {
    if (typeof item === "string") {
      return { url: item, alt: `Image ${idx + 1}`, isCover: idx === 0 };
    }
    return { ...item, isCover: idx === 0 || item.isCover };
  });

  // Client-side resizing and compression helper: max 2000px, WebP quality ~80, strips EXIF
  const compressClientImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const maxDim = 2000;
          let w = img.width;
          let h = img.height;

          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            "image/webp",
            0.82
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);

    const availableSlots = maxFiles - items.length;
    if (availableSlots <= 0) {
      setErrorMsg(`Maximum of ${maxFiles} images reached.`);
      return;
    }

    const fileArray = Array.from(files).slice(0, availableSlots);
    const newItems: MediaItem[] = [...items];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadingFiles((prev) => [...prev, { name: file.name, progress: 20 }]);

      try {
        // 1. Client-side compression and resizing (strips EXIF automatically via canvas)
        const compressedBlob = await compressClientImage(file);
        setUploadingFiles((prev) =>
          prev.map((u) => (u.name === file.name ? { ...u, progress: 50 } : u))
        );

        // 2. Server upload action
        const formData = new FormData();
        const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, ".webp"), {
          type: "image/webp",
        });
        formData.append("file", compressedFile);
        formData.append("alt", file.name.replace(/\.[^/.]+$/, ""));

        const res = await uploadMediaDirectAction(brandId, formData);
        setUploadingFiles((prev) =>
          prev.map((u) => (u.name === file.name ? { ...u, progress: 95 } : u))
        );

        if (res.ok && res.data) {
          newItems.push({
            id: res.data.id,
            url: res.data.url,
            alt: res.data.alt || "",
            isCover: newItems.length === 0,
          });
        } else {
          setErrorMsg(res.error || "Upload failed");
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to upload image.");
      } finally {
        setUploadingFiles((prev) => prev.filter((u) => u.name !== file.name));
      }
    }

    onChange(newItems);
  };

  const handlePasteUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedUrl) return;

    if (items.length >= maxFiles) {
      setErrorMsg(`Maximum of ${maxFiles} images reached.`);
      return;
    }

    const updated = [
      ...items,
      {
        url: pastedUrl.trim(),
        alt: pastedAlt.trim() || `Image ${items.length + 1}`,
        isCover: items.length === 0,
      },
    ];

    onChange(updated);
    setPastedUrl("");
    setPastedAlt("");
    setActiveTab("upload");
  };

  const handleDelete = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    if (updated.length > 0 && !updated.some((i) => i.isCover)) {
      updated[0].isCover = true;
    }
    onChange(updated);
  };

  const handleSetCover = (index: number) => {
    const updated = items.map((item, idx) => ({
      ...item,
      isCover: idx === index,
    }));
    onChange(updated);
  };

  const handleMove = (index: number, direction: "left" | "right") => {
    const targetIdx = direction === "left" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const copy = [...items];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    onChange(copy);
  };

  const handleAltChange = (index: number, newAlt: string) => {
    const updated = items.map((item, idx) => (idx === index ? { ...item, alt: newAlt } : item));
    onChange(updated);
  };

  const handleCropComplete = (blob: Blob, previewUrl: string) => {
    if (croppingIndex !== null && items[croppingIndex]) {
      // Create uploaded asset from crop
      const formData = new FormData();
      formData.append("file", blob, "cropped-image.webp");
      formData.append("alt", items[croppingIndex].alt || "Cropped image");

      uploadMediaDirectAction(brandId, formData).then((res) => {
        if (res.ok && res.data) {
          const updated = [...items];
          updated[croppingIndex] = {
            id: res.data.id,
            url: res.data.url,
            alt: res.data.alt || "",
            isCover: items[croppingIndex].isCover,
          };
          onChange(updated);
        }
      });
    }
    setCropperOpen(false);
  };

  return (
    <div className="space-y-3">
      {/* Header and Mode Toggle */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-zinc-300">
          {label} ({items.length}/{maxFiles})
        </label>

        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              activeTab === "upload"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
              activeTab === "url"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <LinkIcon className="w-3 h-3" />
            <span>Paste URL</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-950/60 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="ml-auto text-xs text-red-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab: Direct Upload Zone */}
      {activeTab === "upload" && (
        <div className="space-y-3">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 hover:border-orange-500/80 bg-zinc-950/60 hover:bg-zinc-900/60 rounded-2xl p-6 text-center cursor-pointer transition-all group"
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            {/* Separate mobile camera input */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-orange-400 group-hover:border-orange-500/50 transition-colors">
                <UploadCloud className="w-6 h-6" />
              </div>

              <div>
                <span className="text-xs font-semibold text-white group-hover:text-orange-400 transition-colors">
                  Click to upload or drag &amp; drop
                </span>
                <span className="block text-[11px] text-zinc-500 mt-0.5">
                  WebP, PNG, JPEG, or AVIF (auto-resized &amp; compressed to WebP, max 8 MB)
                </span>
              </div>

              {/* Quick Actions Bar */}
              <div
                className="flex items-center gap-2 pt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors sm:hidden"
                >
                  <Camera className="w-3.5 h-3.5 text-orange-400" />
                  <span>Take Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                >
                  <FileImage className="w-3.5 h-3.5 text-orange-400" />
                  <span>Choose from Library</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Paste URL */}
      {activeTab === "url" && (
        <form onSubmit={handlePasteUrl} className="space-y-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
          <input
            type="url"
            required
            value={pastedUrl}
            onChange={(e) => setPastedUrl(e.target.value)}
            placeholder="https://images.unsplash.com/photo-..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-orange-500"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={pastedAlt}
              onChange={(e) => setPastedAlt(e.target.value)}
              placeholder="Alt description (e.g. Front view black tee)"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
            >
              Add URL
            </button>
          </div>
        </form>
      )}

      {/* Uploading File Indicators */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-1.5">
          {uploadingFiles.map((u, i) => (
            <div
              key={i}
              className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500 shrink-0" />
                <span className="text-zinc-300 truncate">{u.name}</span>
              </div>
              <span className="font-mono text-zinc-500 text-[10px] ml-2">{u.progress}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Images List with Thumbnails, Reorder, Alt-text, Crop */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`group relative bg-zinc-950 border rounded-2xl overflow-hidden flex flex-col justify-between transition-all ${
                item.isCover ? "border-orange-500 ring-1 ring-orange-500/50" : "border-zinc-800"
              }`}
            >
              <div className="relative aspect-square w-full bg-zinc-900 overflow-hidden">
                <img
                  src={item.url}
                  alt={item.alt || `Media ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {item.isCover && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-orange-600 text-white text-[10px] font-bold flex items-center gap-1 shadow">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    Cover
                  </span>
                )}

                {/* Quick overlay controls */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => {
                      setCroppingImageSrc(item.url);
                      setCroppingIndex(idx);
                      setCropperOpen(true);
                    }}
                    className="p-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 shadow"
                    title="Crop image"
                  >
                    <Crop className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="p-1 rounded-lg bg-red-950/90 hover:bg-red-900 text-red-300 shadow"
                    title="Delete image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Reorder arrows */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMove(idx, "left")}
                      className="p-1 rounded-md bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 shadow"
                      title="Move left"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                  )}
                  {idx < items.length - 1 && (
                    <button
                      type="button"
                      onClick={() => handleMove(idx, "right")}
                      className="p-1 rounded-md bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 shadow"
                      title="Move right"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Alt text field & cover toggle */}
              <div className="p-2 space-y-1.5 border-t border-zinc-900">
                <input
                  type="text"
                  value={item.alt || ""}
                  onChange={(e) => handleAltChange(idx, e.target.value)}
                  placeholder="Alt text (for SEO & a11y)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
                />

                {!item.isCover && (
                  <button
                    type="button"
                    onClick={() => handleSetCover(idx)}
                    className="text-[10px] text-zinc-500 hover:text-orange-400 font-semibold block transition-colors"
                  >
                    Set as cover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Cropper */}
      {cropperOpen && croppingImageSrc && (
        <ImageCropperModal
          imageSrc={croppingImageSrc}
          initialAspect={cropPreset}
          onCropComplete={handleCropComplete}
          onClose={() => setCropperOpen(false)}
        />
      )}

      {/* Modal: Brand Media Library */}
      {libraryOpen && (
        <MediaLibraryModal
          brandId={brandId}
          onSelectAsset={(asset) => {
            if (items.length < maxFiles) {
              onChange([
                ...items,
                {
                  id: asset.id,
                  url: asset.url,
                  alt: asset.alt || `Media ${items.length + 1}`,
                  isCover: items.length === 0,
                },
              ]);
            }
          }}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </div>
  );
}
