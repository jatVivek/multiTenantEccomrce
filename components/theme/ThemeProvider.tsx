"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { BrandThemeConfig } from "@/lib/db/queries/brands";

interface ThemeContextType {
  theme: BrandThemeConfig;
}

const defaultTheme: BrandThemeConfig = {
  colors: {
    primary: "#111111",
    primaryForeground: "#ffffff",
    secondary: "#f3f4f6",
    secondaryForeground: "#111111",
    accent: "#e11d48",
    accentForeground: "#ffffff",
    background: "#ffffff",
    surface: "#ffffff",
    text: "#111827",
    muted: "#6b7280",
    border: "#e5e7eb",
  },
  fonts: {
    heading: "'Inter', sans-serif",
    body: "'Inter', sans-serif",
  },
  heroStyle: "bold-banner",
  layoutStyle: "compact",
};

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  themeConfig: Partial<BrandThemeConfig> | null | undefined;
  children: React.ReactNode;
}

export function ThemeProvider({ themeConfig, children }: ThemeProviderProps) {
  const mergedTheme: BrandThemeConfig = useMemo(() => {
    return {
      colors: {
        ...defaultTheme.colors,
        ...(themeConfig?.colors || {}),
      },
      fonts: {
        ...defaultTheme.fonts,
        ...(themeConfig?.fonts || {}),
      },
      heroStyle: themeConfig?.heroStyle || defaultTheme.heroStyle,
      layoutStyle: themeConfig?.layoutStyle || defaultTheme.layoutStyle,
      announcement: themeConfig?.announcement,
      heroHeadline: themeConfig?.heroHeadline,
      heroSubtitle: themeConfig?.heroSubtitle,
      heroCtaText: themeConfig?.heroCtaText,
      heroImageUrl: themeConfig?.heroImageUrl,
    };
  }, [themeConfig]);

  // Construct CSS variables string
  const cssVariables = `
    :root, [data-brand-theme] {
      --brand-primary: ${mergedTheme.colors.primary};
      --brand-primary-foreground: ${mergedTheme.colors.primaryForeground};
      --brand-secondary: ${mergedTheme.colors.secondary};
      --brand-secondary-foreground: ${mergedTheme.colors.secondaryForeground};
      --brand-accent: ${mergedTheme.colors.accent};
      --brand-accent-foreground: ${mergedTheme.colors.accentForeground};
      --brand-bg: ${mergedTheme.colors.background};
      --brand-surface: ${mergedTheme.colors.surface};
      --brand-text: ${mergedTheme.colors.text};
      --brand-muted: ${mergedTheme.colors.muted};
      --brand-border: ${mergedTheme.colors.border};
      --font-heading: ${mergedTheme.fonts.heading};
      --font-body: ${mergedTheme.fonts.body};
    }
  `;

  return (
    <ThemeContext.Provider value={{ theme: mergedTheme }}>
      <style dangerouslySetInnerHTML={{ __html: cssVariables }} />
      <div
        data-brand-theme
        className="min-h-screen bg-brand-background text-brand-text flex flex-col transition-colors duration-200"
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
