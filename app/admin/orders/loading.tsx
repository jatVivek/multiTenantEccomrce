import React from "react";

export default function AdminOrdersLoading() {
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
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
        <div className="h-9 w-64 bg-zinc-950 rounded-lg animate-pulse" />
        <div className="h-9 w-36 bg-zinc-950 rounded-lg animate-pulse" />
      </div>

      {/* Orders List Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4"
          >
            <div className="flex justify-between items-center">
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 w-48 bg-zinc-850 rounded animate-pulse" />
              </div>
              <div className="h-6 w-24 bg-zinc-800 rounded-full animate-pulse" />
            </div>
            <div className="h-10 w-full bg-zinc-950 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
