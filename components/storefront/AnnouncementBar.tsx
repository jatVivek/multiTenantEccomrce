import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { resolveStorefrontUrl } from "@/lib/storefront-url";

interface AnnouncementBarProps {
  message?: string;
  link?: string;
  brandSlug?: string;
}

export function AnnouncementBar({
  message,
  link,
  brandSlug = "",
}: AnnouncementBarProps) {
  if (!message) return null;

  const content = (
    <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
      <span>{message}</span>
      {link && <ArrowRight className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-0.5 transition-transform" />}
    </div>
  );

  if (link && link.trim().length > 0) {
    const resolvedLink = resolveStorefrontUrl(link, brandSlug);
    return (
      <Link
        href={resolvedLink}
        role="region"
        aria-label="Announcement"
        className="group block w-full bg-brand-primary text-brand-primary-foreground text-xs md:text-sm font-medium py-2 px-4 text-center tracking-wide uppercase transition-colors hover:brightness-105 cursor-pointer"
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      role="region"
      aria-label="Announcement"
      className="w-full bg-brand-primary text-brand-primary-foreground text-xs md:text-sm font-medium py-2.5 px-4 text-center tracking-wide uppercase transition-colors"
    >
      {content}
    </div>
  );
}
