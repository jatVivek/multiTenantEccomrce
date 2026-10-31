"use client";

import React, { useState, useRef, useEffect } from "react";
import { Crop, Check, X, RotateCw } from "lucide-react";

interface ImageCropperModalProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob, previewUrl: string) => void;
  onClose: () => void;
  initialAspect?: "1:1" | "4:5" | "16:9" | "free";
}

export default function ImageCropperModal({
  imageSrc,
  onCropComplete,
  onClose,
  initialAspect = "4:5", // Default clothing portrait
}: ImageCropperModalProps) {
  const [aspect, setAspect] = useState<"1:1" | "4:5" | "16:9" | "free">(initialAspect);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      drawCanvas();
    };
  }, [imageSrc]);

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [aspect, zoom, rotation, imageLoaded]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Determine target canvas dimensions based on preset aspect ratio
    let targetWidth = 800;
    let targetHeight = 1000;

    if (aspect === "1:1") {
      targetWidth = 800;
      targetHeight = 800;
    } else if (aspect === "4:5") {
      targetWidth = 800;
      targetHeight = 1000;
    } else if (aspect === "16:9") {
      targetWidth = 1280;
      targetHeight = 720;
    } else {
      // Free: preserve original aspect ratio
      targetWidth = Math.min(1200, img.naturalWidth);
      targetHeight = Math.min(1200, img.naturalHeight);
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.save();

    // Center and rotate
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Compute cover scaling
    const scale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const previewUrl = URL.createObjectURL(blob);
          onCropComplete(blob, previewUrl);
        }
      },
      "image/webp",
      0.85
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Crop className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-white text-base">Crop &amp; Frame Image</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aspect Ratio Presets */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-semibold">Aspect Ratio:</span>
          {(["1:1", "4:5", "16:9", "free"] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => setAspect(ratio)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                aspect === ratio
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {ratio === "1:1"
                ? "Square (1:1)"
                : ratio === "4:5"
                ? "Apparel Portrait (4:5)"
                : ratio === "16:9"
                ? "Hero Banner (16:9)"
                : "Free Aspect"}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="ml-auto p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Preview Canvas */}
        <div className="bg-zinc-950 rounded-xl p-4 flex items-center justify-center min-h-[300px] max-h-[460px] overflow-hidden border border-zinc-800/80">
          <canvas
            ref={canvasRef}
            className="max-h-[420px] max-w-full rounded-lg shadow-lg object-contain"
          />
        </div>

        {/* Zoom Slider */}
        <div className="flex items-center gap-4 text-xs">
          <span className="text-zinc-400">Zoom:</span>
          <input
            type="range"
            min="1"
            max="2.5"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-orange-500"
          />
          <span className="text-zinc-500 font-mono w-10 text-right">{zoom.toFixed(1)}x</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Check className="w-4 h-4" />
            <span>Apply Crop &amp; Compress</span>
          </button>
        </div>
      </div>
    </div>
  );
}
