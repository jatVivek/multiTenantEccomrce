import React from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyToken } from "@/src/lib/auth";
import {
  getAccessibleBrandsForAdmin,
  getAdminById,
} from "@/lib/db/queries/admin";
import { logoutAdminAction } from "./actions";
import {
  Shield,
  Layers,
  ShoppingBag,
  LogOut,
  ExternalLink,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  // Let login page render without the layout chrome
  if (!token) {
    return <>{children}</>;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return <>{children}</>;
  }

  const admin = await getAdminById(payload.userId);
  if (!admin) {
    return <>{children}</>;
  }

  const accessibleBrands = await getAccessibleBrandsForAdmin(
    admin.id,
    admin.role
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Admin Navigation Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-lg text-white">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white">
              <Shield className="w-4 h-4" />
            </div>
            <span>Admin Console</span>
          </Link>

          {/* Quick links */}
          <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-zinc-400">
            <Link href="/admin" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/admin/products" className="hover:text-white transition-colors">
              Products &amp; Inventory
            </Link>
            <Link href="/admin/orders" className="hover:text-white transition-colors">
              Order Dispatch
            </Link>
            {admin.role === "SUPER_ADMIN" && (
              <>
                <Link href="/admin/theme" className="hover:text-white transition-colors">
                  Theme Customizer
                </Link>
                <Link
                  href="/admin/platform"
                  className="text-orange-400 hover:text-orange-300 font-bold transition-colors flex items-center gap-1 bg-orange-950/40 border border-orange-800/60 px-2 py-1 rounded"
                >
                  <span>Platform &amp; Plans</span>
                </Link>
              </>
            )}
            <Link
              href="/urban-streetwear"
              target="_blank"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <span>Storefront</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:flex flex-col text-right">
            <span className="font-semibold text-white">{admin.email}</span>
            <span className="text-[10px] font-mono uppercase text-orange-400 font-bold">
              {admin.role}
            </span>
          </div>

          <form action={logoutAdminAction}>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </form>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
