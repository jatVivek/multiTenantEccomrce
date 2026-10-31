"use client";

import React, { useState } from "react";
import type { Brand } from "@/src/db/schema";
import { updateBrandThemeAction } from "@/app/admin/actions";
import MediaPicker from "@/components/media/MediaPicker";
import type { NavLinkItem } from "@/lib/db/queries/brands";
import {
  Palette,
  Sparkles,
  Save,
  Loader2,
  Check,
  Smartphone,
  Monitor,
  ExternalLink,
  Layers,
  ArrowRight,
  ShoppingBag,
  Plus,
  Trash2,
  Link as LinkIcon,
  RotateCcw,
} from "lucide-react";

interface ThemeCustomizerClientProps {
  brand: Brand;
}

const PRESETS = [
  {
    name: "Dark Streetwear",
    colors: {
      primary: "#ea580c",
      background: "#09090b",
      surface: "#18181b",
      text: "#fafafa",
      accent: "#f97316",
    },
    heroStyle: "bold-banner",
    layoutStyle: "compact",
    fonts: {
      heading: "'Space Grotesk', sans-serif",
      body: "'Inter', sans-serif",
    },
  },
  {
    name: "Editorial Linen",
    colors: {
      primary: "#44403c",
      background: "#fbfbf9",
      surface: "#ffffff",
      text: "#1c1917",
      accent: "#78716c",
    },
    heroStyle: "editorial-split",
    layoutStyle: "editorial",
    fonts: {
      heading: "'Cinzel', serif",
      body: "'EB Garamond', serif",
    },
  },
  {
    name: "Minimalist Monochrome",
    colors: {
      primary: "#000000",
      background: "#ffffff",
      surface: "#f4f4f5",
      text: "#18181b",
      accent: "#27272a",
    },
    heroStyle: "minimal",
    layoutStyle: "spacious",
    fonts: {
      heading: "'Inter', sans-serif",
      body: "'Inter', sans-serif",
    },
  },
];

const DEFAULT_NAV_LINKS: NavLinkItem[] = [
  { label: "Home", url: "/" },
  { label: "Catalog", url: "/catalog" },
  { label: "Tops", url: "/catalog?category=T-Shirts" },
  { label: "Bottoms", url: "/catalog?category=Bottoms" },
];

export function ThemeCustomizerClient({ brand }: ThemeCustomizerClientProps) {
  const initialConfig = (brand.themeConfig as any) || {};

  const [primaryColor, setPrimaryColor] = useState(
    initialConfig.colors?.primary || "#ea580c"
  );
  const [bgColor, setBgColor] = useState(
    initialConfig.colors?.background || "#09090b"
  );
  const [textColor, setTextColor] = useState(
    initialConfig.colors?.text || "#ffffff"
  );
  const [heroStyle, setHeroStyle] = useState<string>(
    initialConfig.heroStyle || "bold-banner"
  );
  const [layoutStyle, setLayoutStyle] = useState<string>(
    initialConfig.layoutStyle || "compact"
  );
  const [announcement, setAnnouncement] = useState(
    initialConfig.announcement || "⚡ FREE EXPRESS SHIPPING ACROSS INDIA OVER ₹2,499"
  );
  const [announcementLink, setAnnouncementLink] = useState(
    initialConfig.announcementLink || "/catalog"
  );
  const [heroBadge, setHeroBadge] = useState<string>(
    initialConfig.heroBadge !== undefined
      ? initialConfig.heroBadge
      : initialConfig.heroStyle === "editorial-split"
      ? "Handcrafted Pure Linen Collection"
      : "TECHWEAR / DROP 04"
  );
  const [headline, setHeadline] = useState(
    initialConfig.heroHeadline || "HEAVYWEIGHT APPAREL & ARCHIVAL CUTS"
  );
  const [subtitle, setSubtitle] = useState(
    initialConfig.heroSubtitle || "Curated seasonal capsules crafted with premium 280 GSM cotton."
  );
  const [ctaText, setCtaText] = useState(
    initialConfig.heroCtaText || "Shop Collection"
  );
  const [ctaLink, setCtaLink] = useState(
    initialConfig.heroCtaLink || "/catalog"
  );
  const [secondaryCtaText, setSecondaryCtaText] = useState(
    initialConfig.heroSecondaryCtaText !== undefined
      ? initialConfig.heroSecondaryCtaText
      : initialConfig.heroStyle === "editorial-split"
      ? "Linen Shirts"
      : "Shop Cargo Pants"
  );
  const [secondaryCtaLink, setSecondaryCtaLink] = useState(
    initialConfig.heroSecondaryCtaLink ||
      (initialConfig.heroStyle === "editorial-split"
        ? "/catalog?category=Shirts"
        : "/catalog?category=Bottoms")
  );
  const [heroImage, setHeroImage] = useState(
    initialConfig.heroImageUrl ||
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1200&auto=format&fit=crop&q=80"
  );

  const [navLinks, setNavLinks] = useState<NavLinkItem[]>(
    Array.isArray(initialConfig.navLinks) && initialConfig.navLinks.length > 0
      ? initialConfig.navLinks
      : DEFAULT_NAV_LINKS
  );

  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setPrimaryColor(preset.colors.primary);
    setBgColor(preset.colors.background);
    setTextColor(preset.colors.text);
    setHeroStyle(preset.heroStyle);
    setLayoutStyle(preset.layoutStyle);
  };

  const handleAddNavLink = () => {
    setNavLinks([...navLinks, { label: "New Link", url: "/catalog" }]);
  };

  const handleUpdateNavLink = (index: number, field: "label" | "url", value: string) => {
    const updated = [...navLinks];
    updated[index] = { ...updated[index], [field]: value };
    setNavLinks(updated);
  };

  const handleRemoveNavLink = (index: number) => {
    setNavLinks(navLinks.filter((_, i) => i !== index));
  };

  const handleResetNavLinks = () => {
    setNavLinks(DEFAULT_NAV_LINKS);
  };

  const handleSave = async () => {
    setLoading(true);
    setSavedSuccess(false);
    try {
      const res = await updateBrandThemeAction(brand.id, {
        colors: {
          primary: primaryColor,
          primaryForeground: "#ffffff",
          background: bgColor,
          surface: bgColor === "#ffffff" ? "#f4f4f5" : "#18181b",
          text: textColor,
          accent: primaryColor,
        },
        heroStyle: heroStyle as any,
        layoutStyle: layoutStyle as any,
        announcement,
        announcementLink,
        heroBadge,
        heroHeadline: headline,
        heroSubtitle: subtitle,
        heroCtaText: ctaText,
        heroCtaLink: ctaLink,
        heroSecondaryCtaText: secondaryCtaText,
        heroSecondaryCtaLink: secondaryCtaLink,
        heroImageUrl: heroImage,
        navLinks,
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        alert(res.error || "Failed to save theme");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save theme");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Controls Column (5 cols) */}
      <div className="lg:col-span-5 space-y-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-sm font-bold">Theme &amp; Branding Editor</h2>
              <p className="text-[11px] text-zinc-400">
                Customizing storefront for {brand.name}
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : savedSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{savedSuccess ? "Saved!" : "Save Changes"}</span>
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Style Presets
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/60 text-left transition-colors text-xs space-y-1.5"
              >
                <div className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: p.colors.primary }}
                  />
                  <span
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: p.colors.background }}
                  />
                </div>
                <div className="font-semibold text-zinc-200 text-[11px] truncate">
                  {p.name}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Brand Colors */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Colors &amp; Contrast
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-400 block">Primary Accent</span>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-1.5">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                />
                <span className="text-[10px] font-mono text-zinc-300 uppercase truncate">
                  {primaryColor}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-zinc-400 block">Background</span>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-1.5">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                />
                <span className="text-[10px] font-mono text-zinc-300 uppercase truncate">
                  {bgColor}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-zinc-400 block">Body Text</span>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-1.5">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                />
                <span className="text-[10px] font-mono text-zinc-300 uppercase truncate">
                  {textColor}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Header Navigation Links Builder */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Header Navigation Links
              </label>
              <p className="text-[10px] text-zinc-500">
                Configure buttons like Tops, Bottoms, Catalog &amp; their destinations
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetNavLinks}
              className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
              title="Reset to default links"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Defaults</span>
            </button>
          </div>

          <div className="space-y-2">
            {navLinks.map((link, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-zinc-950 border border-zinc-800/80 rounded-lg p-2"
              >
                <div className="flex-1 space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-mono">
                        Button Label
                      </span>
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => handleUpdateNavLink(idx, "label", e.target.value)}
                        placeholder="e.g. Tops"
                        className="w-full h-7 px-2 rounded bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-mono">
                        Landing Destination (URL)
                      </span>
                      <input
                        type="text"
                        value={link.url}
                        onChange={(e) => handleUpdateNavLink(idx, "url", e.target.value)}
                        placeholder="e.g. /catalog?category=Tops"
                        className="w-full h-7 px-2 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveNavLink(idx)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors rounded"
                  title="Remove Link"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddNavLink}
            className="w-full py-2 border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900 rounded-lg text-xs text-zinc-300 font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-orange-500" />
            <span>Add Navigation Button</span>
          </button>
        </div>

        {/* Announcement Bar Settings */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
            Announcement Bar
          </label>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-zinc-400 block mb-1">
                Announcement Message Text
              </span>
              <input
                type="text"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="e.g. ⚡ FREE EXPRESS SHIPPING OVER ₹2,499"
                className="w-full h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block mb-1">
                Click Landing Destination (URL)
              </span>
              <input
                type="text"
                value={announcementLink}
                onChange={(e) => setAnnouncementLink(e.target.value)}
                placeholder="e.g. /catalog or /catalog?category=Sale"
                className="w-full h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Hero Section & Action Buttons */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
            Hero Section &amp; Action Buttons
          </label>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-zinc-300">
              Badge / Pill Text
            </span>
            <input
              type="text"
              value={heroBadge}
              onChange={(e) => setHeroBadge(e.target.value)}
              placeholder="e.g. TECHWEAR / DROP 04"
              className="w-full h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-zinc-300">
              Hero Headline
            </span>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-zinc-300">
              Hero Subtitle
            </span>
            <textarea
              rows={2}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white resize-none"
            />
          </div>

          {/* Primary CTA (Button 1) */}
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
            <span className="text-[10px] font-mono font-bold text-orange-400 uppercase block">
              Primary Button (e.g. Shop Collection)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-zinc-400 block mb-0.5">Button Label</span>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="e.g. Shop Collection"
                  className="w-full h-8 px-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                />
              </div>
              <div>
                <span className="text-[9px] text-zinc-400 block mb-0.5">Landing URL</span>
                <input
                  type="text"
                  value={ctaLink}
                  onChange={(e) => setCtaLink(e.target.value)}
                  placeholder="e.g. /catalog"
                  className="w-full h-8 px-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Secondary CTA (Button 2) */}
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase block">
              Secondary Button (e.g. Shop Cargo Pants)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-zinc-400 block mb-0.5">Button Label (blank to hide)</span>
                <input
                  type="text"
                  value={secondaryCtaText}
                  onChange={(e) => setSecondaryCtaText(e.target.value)}
                  placeholder="e.g. Shop Cargo Pants"
                  className="w-full h-8 px-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                />
              </div>
              <div>
                <span className="text-[9px] text-zinc-400 block mb-0.5">Landing URL</span>
                <input
                  type="text"
                  value={secondaryCtaLink}
                  onChange={(e) => setSecondaryCtaLink(e.target.value)}
                  placeholder="e.g. /catalog?category=Bottoms"
                  className="w-full h-8 px-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="pt-1">
            <MediaPicker
              brandId={brand.id}
              value={heroImage}
              onChange={setHeroImage}
              label="Hero Background Image"
              recommendedSize="1920x1080 (16:9)"
            />
          </div>
        </div>
      </div>

      {/* Live Interactive Preview Column (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-xl text-xs text-white">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-xs">Live Interactive Preview</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewDevice("desktop")}
              className={`p-1.5 rounded-lg transition-colors ${
                previewDevice === "desktop"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
              title="Desktop Preview"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewDevice("mobile")}
              className={`p-1.5 rounded-lg transition-colors ${
                previewDevice === "mobile"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
              title="Mobile Preview"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mock Storefront Canvas */}
        <div
          className={`mx-auto transition-all rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl ${
            previewDevice === "mobile" ? "max-w-sm" : "w-full"
          }`}
          style={{ backgroundColor: bgColor, color: textColor }}
        >
          {/* Mock Announcement Bar */}
          {announcement && (
            <div
              className="px-3 py-1.5 text-center text-[10px] font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor: primaryColor,
                color: "#ffffff",
              }}
            >
              <span>{announcement}</span>
              {announcementLink && <ArrowRight className="w-3 h-3 opacity-80" />}
            </div>
          )}

          {/* Mock Storefront Navbar */}
          <div
            className="px-5 py-3.5 flex items-center justify-between border-b transition-colors"
            style={{ borderColor: bgColor === "#ffffff" ? "#e5e7eb" : "#27272a" }}
          >
            <div className="font-black tracking-tight text-sm uppercase">
              {brand.name}
            </div>
            <div className="flex items-center gap-3 text-xs">
              {navLinks.map((l, i) => (
                <span
                  key={i}
                  className="font-semibold cursor-pointer opacity-90 hover:opacity-100 hidden sm:inline"
                >
                  {l.label}
                </span>
              ))}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Mock Hero Section */}
          <div className="relative p-6 sm:p-10 flex flex-col justify-end min-h-[280px] overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center transition-all opacity-30"
              style={{ backgroundImage: `url(${heroImage})` }}
            />
            <div className="relative z-10 space-y-2.5 max-w-md">
              {heroBadge && (
                <span
                  className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white inline-block shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  {heroBadge}
                </span>
              )}
              <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-tight uppercase">
                {headline}
              </h3>
              <p className="text-xs opacity-80 line-clamp-2 leading-relaxed">
                {subtitle}
              </p>
              <div className="pt-3 flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 text-white shadow-md transition-all"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span>{ctaText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                {secondaryCtaText && secondaryCtaText.trim().length > 0 && (
                  <button
                    type="button"
                    className="px-3.5 py-2 rounded-lg font-medium text-xs border transition-all"
                    style={{
                      borderColor: bgColor === "#ffffff" ? "#d1d5db" : "#3f3f46",
                      backgroundColor: bgColor === "#ffffff" ? "rgba(255,255,255,0.7)" : "rgba(24,24,27,0.7)",
                    }}
                  >
                    <span>{secondaryCtaText}</span>
                  </button>
                )}
              </div>
              {/* Destination hints */}
              <div className="pt-1 flex flex-wrap gap-2 text-[10px] text-zinc-400 font-mono">
                <span className="px-1.5 py-0.5 rounded bg-zinc-950/80 border border-zinc-800">
                  Primary → {ctaLink}
                </span>
                {secondaryCtaText && (
                  <span className="px-1.5 py-0.5 rounded bg-zinc-950/80 border border-zinc-800">
                    Secondary → {secondaryCtaLink}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sample Product Grid Cards */}
          <div className="p-5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider block opacity-70">
              Featured Items
            </span>
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: "Boxy Heavyweight Tee", price: "₹1,899" },
                { title: "Pleated Relaxed Trouser", price: "₹2,499" },
              ].map((p, i) => (
                <div
                  key={i}
                  className="rounded-xl border p-3 space-y-2 transition-colors"
                  style={{
                    borderColor: bgColor === "#ffffff" ? "#e5e7eb" : "#27272a",
                    backgroundColor: bgColor === "#ffffff" ? "#f9fafb" : "#18181b",
                  }}
                >
                  <div className="w-full h-24 rounded-lg bg-zinc-800/40 flex items-center justify-center text-zinc-500">
                    <Layers className="w-5 h-5 opacity-40" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-xs truncate">{p.title}</p>
                    <p className="font-semibold text-xs" style={{ color: primaryColor }}>
                      {p.price}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
