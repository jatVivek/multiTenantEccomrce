import React from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyToken } from "@/src/lib/auth";
import {
  getAdminById,
  getAccessibleBrandsForAdmin,
  verifyAdminBrandAccess,
} from "@/lib/db/queries/admin";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import { ThemeCustomizerClient } from "@/components/admin/ThemeCustomizerClient";
import {
  ShieldAlert,
  AlertOctagon,
  ExternalLink,
  LayoutDashboard,
  Package,
  Truck,
  Palette,
} from "lucide-react";

interface AdminThemePageProps {
  searchParams: Promise<{
    brand?: string;
  }>;
}

export default async function AdminThemePage({
  searchParams,
}: AdminThemePageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) {
    redirect("/admin/login");
  }

  const payload = verifyToken(token);
  if (!payload) {
    redirect("/admin/login");
  }

  const admin = await getAdminById(payload.userId);
  if (!admin) {
    redirect("/admin/login");
  }

  // Strict role isolation: Live Theme Customizer is restricted to SUPER_ADMIN only
  if (admin.role !== "SUPER_ADMIN") {
    redirect("/admin?error=unauthorized_theme_customizer");
  }

  const accessibleBrands = await getAccessibleBrandsForAdmin(
    admin.id,
    admin.role
  );

  const query = await searchParams;
  const targetSlug = query.brand;

  let activeBrand = null;
  let accessDenied = false;
  let brandNotFound = false;

  if (targetSlug) {
    activeBrand = await getBrandBySlug(targetSlug);
    if (!activeBrand) {
      brandNotFound = true;
    } else {
      // Isolation Check: verify admin has access to this brand
      const hasAccess = await verifyAdminBrandAccess(
        admin.id,
        admin.role,
        activeBrand.id
      );
      if (!hasAccess) {
        accessDenied = true;
      }
    }
  } else if (accessibleBrands.length > 0) {
    activeBrand = accessibleBrands[0];
  }

  // 1. Invalid Slug Handling
  if (brandNotFound) {
    return (
      <div className="py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto">
          <AlertOctagon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Brand Not Found</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          No brand exists with slug <code className="text-amber-400 font-mono">{targetSlug}</code>.
        </p>
        <div className="pt-2">
          <Link
            href="/admin/theme"
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold"
          >
            Return to Theme Editor
          </Link>
        </div>
      </div>
    );
  }

  // 2. Strict Tenant Isolation Denied State (403)
  if (accessDenied && activeBrand) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-red-400">Access Denied (403 Forbidden)</h2>
        <p className="text-sm text-zinc-300 max-w-md mx-auto leading-relaxed">
          Your account (<code className="text-zinc-200 font-semibold">{admin.email}</code>, role:{" "}
          <span className="font-mono text-orange-400 uppercase font-bold">{admin.role}</span>) is
          not authorized to customize theme for <strong>{activeBrand.name}</strong>.
        </p>
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg max-w-md mx-auto text-xs text-zinc-400 text-left">
          <span className="font-semibold text-white block mb-1">Your Authorized Brands:</span>
          {accessibleBrands.map((b) => (
            <Link
              key={b.id}
              href={`/admin/theme?brand=${b.slug}`}
              className="text-orange-400 underline block hover:opacity-80"
            >
              → {b.name} ({b.slug})
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (!activeBrand) {
    return (
      <div className="py-12 text-center text-zinc-400">
        <p>No active brands found in the system.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <span className="text-xs uppercase tracking-widest font-mono text-zinc-400">
            Active Tenant
          </span>
          <h1 className="text-2xl font-bold text-white mt-0.5">{activeBrand.name}</h1>
        </div>

        {/* Brand Switcher Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-400 mr-1 font-medium">Switch Brand:</span>
          {accessibleBrands.map((b) => {
            const isSelected = b.id === activeBrand!.id;
            return (
              <Link
                key={b.id}
                href={`/admin/theme?brand=${b.slug}`}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  isSelected
                    ? "bg-orange-600 text-white border-orange-500 shadow"
                    : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800"
                }`}
              >
                {b.name}
              </Link>
            );
          })}
          <Link
            href={`/${activeBrand.slug}`}
            target="_blank"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1.5 ml-2"
          >
            <span>Live Store</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <Link
          href={`/admin?brand=${activeBrand.slug}`}
          className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center gap-1.5 transition-colors"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Overview</span>
        </Link>
        <Link
          href={`/admin/products?brand=${activeBrand.slug}`}
          className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center gap-1.5 transition-colors"
        >
          <Package className="w-3.5 h-3.5" />
          <span>Products &amp; Inventory</span>
        </Link>
        <Link
          href={`/admin/orders?brand=${activeBrand.slug}`}
          className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center gap-1.5 transition-colors"
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Order Dispatch Desk</span>
        </Link>
        <Link
          href={`/admin/theme?brand=${activeBrand.slug}`}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center gap-1.5 shadow-sm"
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Live Theme Customizer</span>
        </Link>
      </div>

      {/* Theme Customizer Client */}
      <ThemeCustomizerClient brand={activeBrand} />
    </div>
  );
}
