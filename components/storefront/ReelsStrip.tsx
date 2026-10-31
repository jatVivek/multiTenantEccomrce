"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Play, Volume2, VolumeX, ArrowRight, Sparkles } from "lucide-react";

export interface ReelProduct {
  id: string;
  slug: string;
  title: string;
  basePricePaise: number;
  videoUrl: string;
  posterUrl?: string;
  brandSlug: string;
}

interface ReelsStripProps {
  reels: ReelProduct[];
  title?: string;
  subtitle?: string;
}

export default function ReelsStrip({
  reels = [],
  title = "Trending Reels & Looks",
  subtitle = "Swipe through short styling reels and tap to shop directly",
}: ReelsStripProps) {
  const [activeMutedMap, setActiveMutedMap] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  if (reels.length === 0) return null;

  const toggleSound = (reelId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const vid = videoRefs.current[reelId];
    if (vid) {
      vid.muted = !vid.muted;
      setActiveMutedMap((prev) => ({ ...prev, [reelId]: vid.muted }));
    }
  };

  return (
    <section className="py-8 space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between px-4 sm:px-6">
        <div>
          <div className="flex items-center gap-1.5 text-orange-500 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Shorts &amp; Reels</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* 9:16 Swipeable Horizontal Track */}
      <div className="flex items-center gap-4 overflow-x-auto px-4 sm:px-6 pb-4 scrollbar-none snap-x snap-mandatory">
        {reels.map((reel) => {
          const isMuted = activeMutedMap[reel.id] !== false; // Default true (muted)

          return (
            <div
              key={reel.id}
              className="relative aspect-[9/16] w-[200px] sm:w-[240px] shrink-0 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-xl snap-start group"
            >
              <Link
                href={`/${reel.brandSlug}/products/${reel.slug}`}
                className="block w-full h-full relative"
              >
                {/* Background Video */}
                <video
                  ref={(el) => {
                    videoRefs.current[reel.id] = el;
                  }}
                  src={reel.videoUrl}
                  poster={reel.posterUrl}
                  playsInline
                  muted={isMuted}
                  loop
                  autoPlay
                  preload="none"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Sound Toggle Overlay Button */}
                <button
                  type="button"
                  onClick={(e) => toggleSound(reel.id, e)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all shadow z-10"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                {/* Bottom Product Info & CTA Gradient Overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent p-4 flex flex-col justify-end space-y-1.5 z-10">
                  <span className="text-xs font-bold text-white line-clamp-1">{reel.title}</span>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-orange-400">
                      ₹{(reel.basePricePaise / 100).toLocaleString("en-IN")}
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white text-white hover:text-black backdrop-blur-md text-[10px] font-bold flex items-center gap-1 transition-all">
                      <span>Shop</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
