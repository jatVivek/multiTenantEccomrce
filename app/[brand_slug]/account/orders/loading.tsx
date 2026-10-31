import React from "react";

export default function CustomerOrdersLoading() {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 space-y-6 animate-fade-in">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-brand-secondary rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-brand-secondary/60 rounded animate-pulse" />
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex gap-2 border-b border-brand-border/60 pb-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 bg-brand-secondary rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Order Cards Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-5 sm:p-6 rounded-2xl border border-brand-border bg-brand-surface space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-brand-border/40">
              <div className="space-y-1">
                <div className="h-4 w-28 bg-brand-secondary rounded animate-pulse" />
                <div className="h-3 w-36 bg-brand-secondary/60 rounded animate-pulse" />
              </div>
              <div className="h-6 w-24 bg-brand-secondary rounded-full animate-pulse" />
            </div>

            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-xl bg-brand-secondary animate-pulse flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-44 bg-brand-secondary rounded animate-pulse" />
                <div className="h-3 w-28 bg-brand-secondary/60 rounded animate-pulse" />
                <div className="h-4 w-20 bg-brand-secondary rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
