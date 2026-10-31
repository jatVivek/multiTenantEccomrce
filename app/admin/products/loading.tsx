import React from "react";

export default function AdminProductsLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Brand Switcher Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-40 bg-zinc-800 rounded animate-pulse" />
            <div className="h-3 w-28 bg-zinc-850 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-48 bg-zinc-800 rounded-lg animate-pulse" />
      </div>

      {/* Controls Bar Skeleton */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
        <div className="h-9 w-64 bg-zinc-950 rounded-lg animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 bg-zinc-950 rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-zinc-950 rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-zinc-800 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Table Container Skeleton */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-lg">
        {/* Table Header */}
        <div className="grid grid-cols-[36px_1fr_120px_130px_70px] px-4 py-3 bg-zinc-900 border-b border-zinc-800">
          <div />
          <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse" />
          <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse" />
          <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse" />
          <div className="h-3 w-12 bg-zinc-800 rounded animate-pulse ml-auto" />
        </div>

        {/* Rows Skeletons */}
        <div className="divide-y divide-zinc-800/60">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="grid grid-cols-[36px_1fr_120px_130px_70px] items-center px-4 py-3.5"
            >
              <div className="w-4 h-4 bg-zinc-800 rounded animate-pulse" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 animate-pulse flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-48 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-2.5 w-24 bg-zinc-850 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-3.5 w-16 bg-zinc-800 rounded animate-pulse" />
              <div className="space-y-1">
                <div className="h-3.5 w-20 bg-zinc-800 rounded animate-pulse" />
                <div className="h-2 w-12 bg-zinc-850 rounded animate-pulse" />
              </div>
              <div className="h-6 w-12 bg-zinc-800 rounded ml-auto animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
