import React from "react";
import Link from "next/link";

interface CategoryPillsProps {
  brandSlug: string;
  categories: string[];
  activeCategory?: string;
}

export function CategoryPills({
  brandSlug,
  categories,
  activeCategory = "All",
}: CategoryPillsProps) {
  const allCategories = ["All", ...categories];

  return (
    <nav
      aria-label="Product categories"
      className="w-full overflow-x-auto no-scrollbar py-2"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-max px-1">
        {allCategories.map((cat) => {
          const isActive = activeCategory.toLowerCase() === cat.toLowerCase();
          const href =
            cat === "All"
              ? `/${brandSlug}/catalog`
              : `/${brandSlug}/catalog?category=${encodeURIComponent(cat)}`;

          return (
            <Link
              key={cat}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`tap-target-44 px-4 py-2 text-xs sm:text-sm font-medium rounded-full border transition-all ${
                isActive
                  ? "bg-brand-primary text-brand-primary-foreground border-brand-primary shadow-sm"
                  : "bg-brand-surface text-brand-text border-brand-border hover:border-brand-primary/60 hover:bg-brand-secondary"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
            >
              {cat}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
