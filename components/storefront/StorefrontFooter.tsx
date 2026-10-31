import React from "react";
import Link from "next/link";

interface StorefrontFooterProps {
  brandName: string;
  brandSlug: string;
  footerBadgeText?: string | null;
  removePoweredBy?: boolean;
}

export function StorefrontFooter({
  brandName,
  brandSlug,
  footerBadgeText = "Multi-tenant architecture powered by Antigravity.",
  removePoweredBy = false,
}: StorefrontFooterProps) {
  const badge = React.useMemo(() => {
    if (removePoweredBy || !footerBadgeText) return null;
    const trimmed = footerBadgeText.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith(".")) {
      return ` ${trimmed}`;
    }
    return ` . ${trimmed}`;
  }, [removePoweredBy, footerBadgeText]);
  return (
    <footer className="w-full mt-auto border-t border-brand-border bg-brand-surface py-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <h3 className="font-heading font-bold text-lg text-brand-text">{brandName}</h3>
            <p className="text-xs text-brand-muted leading-relaxed">
              Curated clothing engineered for longevity, comfort, and uncompromising design.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-text">Shop</h4>
            <ul className="space-y-1.5 text-xs text-brand-muted">
              <li>
                <Link href={`/${brandSlug}/catalog`} className="hover:text-brand-text">
                  All Collections
                </Link>
              </li>
              <li>
                <Link href={`/${brandSlug}/catalog?category=T-Shirts`} className="hover:text-brand-text">
                  T-Shirts & Tops
                </Link>
              </li>
              <li>
                <Link href={`/${brandSlug}/catalog?category=Bottoms`} className="hover:text-brand-text">
                  Pants & Bottoms
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-text">Help & Care</h4>
            <ul className="space-y-1.5 text-xs text-brand-muted">
              <li>Track Order</li>
              <li>Shipping & Exchanges</li>
              <li>Fabric Care Guide</li>
              <li>Contact Support</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-text">Switch Brand Demo</h4>
            <div className="flex flex-col gap-2 pt-1 text-xs">
              <Link
                href="/urban-streetwear"
                className="text-brand-primary underline hover:opacity-80"
              >
                → Urban Streetwear (Dark Techwear)
              </Link>
              <Link
                href="/linen-and-co"
                className="text-brand-primary underline hover:opacity-80"
              >
                → Linen & Co. (Light Editorial)
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-brand-border/60 flex flex-col sm:flex-row items-center justify-between text-xs text-brand-muted gap-4">
          <p>© {new Date().getFullYear()} {brandName}{badge || "."}</p>
          <div className="flex items-center gap-4">
            <span>Privacy</span>
            <span>Terms</span>
            <span>UPI & COD Supported</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
