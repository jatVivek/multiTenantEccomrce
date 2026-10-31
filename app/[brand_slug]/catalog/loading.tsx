import React from "react";

export default function CatalogLoading() {
  return (
    <div className="w-full min-h-screen">
      {/* Header skeleton */}
      <div className="bg-brand-surface border-b border-brand-border py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="h-4 w-32 bg-brand-secondary rounded animate-pulse" />
          <div className="h-8 w-64 bg-brand-secondary rounded animate-pulse" />
          <div className="flex gap-2 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-9 w-20 bg-brand-secondary rounded-full animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="w-full bg-brand-surface border-b border-brand-border py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between gap-4">
          <div className="h-10 w-72 bg-brand-secondary rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-brand-secondary rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Products Grid Skeletons */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="flex flex-col bg-brand-surface rounded-lg border border-brand-border overflow-hidden"
            >
              <div className="aspect-[3/4] w-full bg-brand-secondary animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-3 w-16 bg-brand-secondary rounded animate-pulse" />
                <div className="h-4 w-full bg-brand-secondary rounded animate-pulse" />
                <div className="h-4 w-24 bg-brand-secondary rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
