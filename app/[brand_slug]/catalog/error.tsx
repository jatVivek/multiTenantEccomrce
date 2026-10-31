"use client";

import React, { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface CatalogErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CatalogError({ error, reset }: CatalogErrorProps) {
  useEffect(() => {
    console.error("Catalog route error:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto my-16 px-4 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-heading font-bold text-brand-text">
        Unable to load catalog
      </h2>
      <p className="text-sm text-brand-muted leading-relaxed">
        An error occurred while fetching the requested garments. Please try reloading or check back shortly.
      </p>
      <div className="pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="tap-target-44 px-6 py-2.5 rounded-lg bg-brand-primary text-brand-primary-foreground text-xs font-semibold uppercase tracking-wider hover:opacity-90 inline-flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      </div>
    </div>
  );
}
