"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function BrandError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[BrandError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold text-brand-text mb-2">
        Something went wrong
      </h1>
      <p className="text-sm text-brand-muted mb-8 max-w-sm">
        We ran into an issue loading this page. Please try again — if the
        problem persists, the store may be temporarily unavailable.
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-brand-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg border border-brand-border bg-brand-surface text-brand-text text-sm font-semibold hover:bg-brand-secondary transition-colors"
        >
          Go home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-[11px] text-brand-muted font-mono">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
