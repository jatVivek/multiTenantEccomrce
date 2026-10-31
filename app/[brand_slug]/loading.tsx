import React from "react";

export default function StorefrontLoading() {
  return (
    <div className="w-full space-y-12 pb-16 animate-fade-in">
      {/* Hero Banner Skeleton */}
      <div className="w-full h-80 sm:h-96 bg-brand-surface border-b border-brand-border flex items-center justify-center">
        <div className="max-w-xl text-center space-y-4 px-4">
          <div className="h-4 w-32 bg-brand-secondary rounded-full mx-auto animate-pulse" />
          <div className="h-10 w-72 sm:w-96 bg-brand-secondary rounded-xl mx-auto animate-pulse" />
          <div className="h-4 w-60 sm:w-80 bg-brand-secondary/70 rounded mx-auto animate-pulse" />
          <div className="h-10 w-36 bg-brand-secondary rounded-lg mx-auto animate-pulse mt-4" />
        </div>
      </div>

      {/* Category Pills Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-4">
        <div className="h-4 w-36 bg-brand-secondary rounded animate-pulse" />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 w-24 bg-brand-secondary rounded-full flex-shrink-0 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Featured Products Grid Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-6">
        <div className="h-6 w-44 bg-brand-secondary rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex flex-col bg-brand-surface rounded-xl border border-brand-border overflow-hidden"
            >
              <div className="aspect-[3/4] w-full bg-brand-secondary animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-16 bg-brand-secondary/60 rounded animate-pulse" />
                <div className="h-4 w-full bg-brand-secondary rounded animate-pulse" />
                <div className="h-4 w-20 bg-brand-secondary rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
