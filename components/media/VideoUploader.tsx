"use client";

import React, { useState, useRef } from "react";
import { Video, Film, X, Loader2, Play, AlertCircle } from "lucide-react";
import { uploadVideoAction } from "@/app/admin/media/video-actions";

export interface VideoItem {
  id?: string;
  url: string;
  posterUrl?: string;
  durationSeconds?: number;
}

interface VideoUploaderProps {
  brandId: string;
  value: VideoItem[];
  onChange: (videos: VideoItem[]) => void;
  maxVideos?: number;
  label?: string;
}

export default function VideoUploader({
  brandId,
  value = [],
  onChange,
  maxVideos = 2,
  label = "Product Videos (Max 30s)",
}: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Generates poster frame from video file via HTML5 canvas
  const capturePosterFrame = (
    file: File
  ): Promise<{ posterBlob: Blob; duration: number }> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";

      video.onloadedmetadata = () => {
        const duration = Math.round(video.duration || 15);
        // Seek to 1 second (or 10% in) to get a representative poster
        video.currentTime = Math.min(1.0, video.duration / 2);
      };

      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(1080, video.videoWidth || 720);
        canvas.height = Math.min(1920, video.videoHeight || 1280);
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve({
            posterBlob: new Blob([], { type: "image/webp" }),
            duration: Math.round(video.duration || 15),
          });
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            resolve({
              posterBlob: blob || new Blob([], { type: "image/webp" }),
              duration: Math.round(video.duration || 15),
            });
          },
          "image/webp",
          0.85
        );
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load video for poster generation"));
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (value.length >= maxVideos) {
      setErrorMsg(`Maximum of ${maxVideos} videos reached.`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg("Video exceeds the 25 MB limit.");
      return;
    }

    setErrorMsg(null);
    setUploading(true);

    try {
      // 1. Capture poster frame & extract duration
      const { posterBlob, duration } = await capturePosterFrame(file);

      // 2. Prepare FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("duration", duration.toString());
      formData.append("alt", file.name.replace(/\.[^/.]+$/, ""));

      if (posterBlob && posterBlob.size > 0) {
        const posterFile = new File([posterBlob], "poster.webp", { type: "image/webp" });
        formData.append("poster", posterFile);
      }

      // 3. Upload via server action
      const res = await uploadVideoAction(brandId, formData);
      if (res.ok && res.data) {
        onChange([
          ...value,
          {
            id: res.data.id,
            url: res.data.url,
            posterUrl: res.data.posterUrl || undefined,
            durationSeconds: res.data.durationSeconds || undefined,
          },
        ]);
      } else {
        setErrorMsg(res.error || "Failed to upload video.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while uploading video.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-zinc-300">
          Product Videos &amp; Reels ({value.length}/{maxVideos})
        </label>
        <span className="text-[10px] text-zinc-500 font-mono">Max 30s • 25 MB • MP4/WebM/MOV</span>
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

      {/* Video Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {value.map((vid, idx) => (
          <div
            key={idx}
            className="group relative aspect-[9/16] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between"
          >
            {vid.posterUrl ? (
              <img src={vid.posterUrl} alt="Video Poster" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600">
                <Film className="w-8 h-8" />
              </div>
            )}

            {/* Duration pill */}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-sm text-[10px] font-mono text-white flex items-center gap-1">
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>0:{String(vid.durationSeconds || 15).padStart(2, "0")}</span>
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="absolute top-2 right-2 p-1 rounded-lg bg-red-950/90 hover:bg-red-900 text-red-300 shadow opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove video"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Upload Trigger Card */}
        {value.length < maxVideos && (
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`aspect-[9/16] border-2 border-dashed border-zinc-800 hover:border-orange-500/80 bg-zinc-950/50 hover:bg-zinc-900/50 rounded-2xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all group ${
              uploading ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileChange}
              className="hidden"
            />

            {uploading ? (
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                <span className="text-[11px] text-zinc-400">Processing video &amp; poster...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-orange-400 group-hover:border-orange-500/50 transition-colors">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-white group-hover:text-orange-400 block transition-colors">
                    Add Video
                  </span>
                  <span className="text-[10px] text-zinc-500">9:16 Reel format</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
