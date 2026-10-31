"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Play,
  Film,
} from "lucide-react";

export interface GalleryMediaItem {
  id?: string;
  type: "image" | "video";
  url: string;
  posterUrl?: string;
  alt?: string;
  blurDataUrl?: string;
}

interface ProductGalleryProps {
  media: GalleryMediaItem[];
  productTitle: string;
  activeVariantAttributes?: Record<string, any> | null;
  children?: React.ReactNode;
}

export default function ProductGallery({
  media = [],
  productTitle,
  activeVariantAttributes,
  children,
}: ProductGalleryProps) {
  // If active variant has specific images, filter or prioritize them
  const variantImages: string[] = activeVariantAttributes?.images || [];

  const displayMedia: GalleryMediaItem[] = React.useMemo(() => {
    if (variantImages.length > 0) {
      const variantItems = variantImages.map((url, i) => ({
        type: "image" as const,
        url,
        alt: `${productTitle} - Variant image ${i + 1}`,
      }));
      // Put variant images first, then any videos
      const videos = media.filter((m) => m.type === "video");
      return [...variantItems, ...videos];
    }
    return media.length > 0
      ? media
      : [
          {
            type: "image" as const,
            url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800",
            alt: productTitle,
          },
        ];
  }, [media, variantImages, productTitle]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const galleryRef = useRef<HTMLDivElement | null>(null);

  // IntersectionObserver to pause/play video when entering/leaving viewport
  useEffect(() => {
    // Check reduced motion or data saver
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    const isSaveData = nav?.connection?.saveData === true;

    const currentVideo = videoRefs.current[activeIndex];
    if (!currentVideo || displayMedia[activeIndex]?.type !== "video") return;

    if (prefersReducedMotion || isSaveData) {
      currentVideo.pause();
      setIsPlaying(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            currentVideo.play().then(() => setIsPlaying(true)).catch(() => {});
          } else {
            currentVideo.pause();
            setIsPlaying(false);
          }
        }
      },
      { threshold: 0.5 }
    );

    if (galleryRef.current) {
      observer.observe(galleryRef.current);
    }

    return () => {
      observer.disconnect();
      if (currentVideo) currentVideo.pause();
    };
  }, [activeIndex, displayMedia]);

  const activeItem = displayMedia[activeIndex] || displayMedia[0];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % displayMedia.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + displayMedia.length) % displayMedia.length);
  };

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentVideo = videoRefs.current[activeIndex];
    if (currentVideo) {
      currentVideo.muted = !currentVideo.muted;
      setIsMuted(currentVideo.muted);
    }
  };

  return (
    <div ref={galleryRef} className="space-y-3">
      {/* Main Viewport Card */}
      <div className="relative aspect-[4/5] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl group">
        {activeItem.type === "video" ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video
              ref={(el) => {
                videoRefs.current[activeIndex] = el;
              }}
              src={activeItem.url}
              poster={activeItem.posterUrl}
              playsInline
              muted={isMuted}
              loop
              preload="none"
              className="w-full h-full object-cover"
              onClick={() => {
                const vid = videoRefs.current[activeIndex];
                if (vid) {
                  if (vid.paused) {
                    vid.play();
                    setIsPlaying(true);
                  } else {
                    vid.pause();
                    setIsPlaying(false);
                  }
                }
              }}
            />

            {/* Sound Toggle Button */}
            <button
              type="button"
              onClick={toggleSound}
              className="absolute bottom-4 right-4 p-2.5 rounded-full bg-black/75 hover:bg-black text-white backdrop-blur-md transition-all shadow-lg z-10"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Video Indicator Pill */}
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1.5 uppercase tracking-wider z-10">
              <Film className="w-3 h-3 text-orange-400" />
              <span>Video Reel</span>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full">
            <Image
              src={activeItem.url}
              alt={activeItem.alt || productTitle}
              fill
              priority={activeIndex === 0}
              sizes="(max-width: 768px) 100vw, 50vw"
              placeholder={activeItem.blurDataUrl ? "blur" : "empty"}
              blurDataURL={activeItem.blurDataUrl}
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        )}

        {/* Carousel Prev/Next Buttons */}
        {displayMedia.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-sm transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 z-10"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-sm transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 z-10"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Dots Counter */}
        {displayMedia.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
            {displayMedia.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  activeIndex === idx ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {children}
      </div>

      {/* Thumbnails Strip */}
      {displayMedia.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {displayMedia.map((m, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative w-16 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                activeIndex === idx
                  ? "border-orange-500 ring-2 ring-orange-500/20"
                  : "border-zinc-800 opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={m.type === "video" ? m.posterUrl || m.url : m.url}
                alt={m.alt || "Thumbnail"}
                className="w-full h-full object-cover"
              />
              {m.type === "video" && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                  <Play className="w-4 h-4 fill-current text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
