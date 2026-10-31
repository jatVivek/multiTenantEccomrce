import React from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyToken } from "@/src/lib/auth";
import {
  getAdminById,
  getAccessibleBrandsForAdmin,
  verifyAdminBrandAccess,
  getBrandAdminStats,
  getBrandOrdersAdmin,
} from "@/lib/db/queries/admin";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import {
  ShieldAlert,
  ShoppingBag,
  TrendingUp,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  AlertOctagon,
  Package,
  Truck,
  Palette,
} from "lucide-react";

interface AdminPageProps {
  searchParams: Promise<{
    brand?: string;
  }>;
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminPageProps) {
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

  // 1. Invalid Slug Handling (returns clean error, not a crash)
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
            href="/admin"
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold"
          >
            Return to Default Brand
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
          not authorized to access or manage <strong>{activeBrand.name}</strong>.
        </p>
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg max-w-md mx-auto text-xs text-zinc-400 text-left">
          <span className="font-semibold text-white block mb-1">Your Authorized Brands:</span>
          {accessibleBrands.map((b) => (
            <Link
              key={b.id}
              href={`/admin?brand=${b.slug}`}
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

  // Fetch dashboard stats & orders for the active authorized brand
  const [stats, recentOrders] = await Promise.all([
    getBrandAdminStats(activeBrand.id),
    getBrandOrdersAdmin(activeBrand.id, 25),
  ]);

  return (
    <div className="space-y-8">
      {/* Brand Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <span className="text-xs uppercase tracking-widest font-mono text-zinc-400">
            Active Tenant
          </span>
          <h1 className="text-2xl font-bold text-white mt-0.5">{activeBrand.name}</h1>
        </div>

        {/* Brand Switcher Tabs / Dropdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-400 mr-1 font-medium">Switch Brand:</span>
          {accessibleBrands.map((b) => {
            const isSelected = b.id === activeBrand!.id;
            return (
              <Link
                key={b.id}
                href={`/admin?brand=${b.slug}`}
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

      {/* Sub-navigation tabs: Dashboard vs Products */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <Link
          href={`/admin?brand=${activeBrand.slug}`}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center gap-1.5 shadow-sm"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Dashboard &amp; Orders</span>
        </Link>
        <Link
          href={`/admin/products?brand=${activeBrand.slug}`}
          className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center gap-1.5 transition-colors"
        >
          <Package className="w-3.5 h-3.5" />
          <span>Products &amp; Inventory</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] font-mono text-zinc-300">
            {stats.totalVariants}
          </span>
        </Link>
        <Link
          href={`/admin/orders?brand=${activeBrand.slug}`}
          className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center gap-1.5 transition-colors"
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Order Dispatch Desk</span>
        </Link>
        {admin.role === "SUPER_ADMIN" && (
          <Link
            href={`/admin/theme?brand=${activeBrand.slug}`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center gap-1.5 transition-colors"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Theme Customizer</span>
          </Link>
        )}
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            ₹{(stats.totalRevenuePaise / 100).toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-zinc-400">Settled via UPI & COD</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalOrders}</div>
          <p className="text-[11px] text-zinc-400">Lifetime brand volume</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Pending Orders</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.pendingOrders}</div>
          <p className="text-[11px] text-zinc-400">Needs packing & dispatch</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Catalog Inventory</span>
            <Package className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalVariants}</div>
          <p className="text-[11px] text-zinc-400">
            {stats.lowStockVariants} variants low in stock
          </p>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Recent Customer Orders</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live orders for {activeBrand.name}
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {recentOrders.length} orders
          </span>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-500">
            No orders placed yet for this brand.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/60 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Fulfillment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {recentOrders.map((ord) => {
                  const itemsCount = Array.isArray(ord.items) ? (ord.items as any[]).length : 0;
                  return (
                    <tr key={ord.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        #{ord.orderNumber}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">
                        {new Date(ord.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{ord.customerName}</div>
                        <div className="text-[11px] text-zinc-400">+91 {ord.customerPhone}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white uppercase">
                            {ord.paymentMethod}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              ord.paymentStatus === "PAID"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : ord.paymentStatus === "COD"
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {ord.paymentStatus}
                          </span>
                        </div>
                        {ord.upiUtr && (
                          <div className="text-[10px] font-mono text-zinc-500 truncate max-w-[120px]">
                            UTR: {ord.upiUtr}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        ₹{(ord.totalAmountPaise / 100).toLocaleString("en-IN")}
                        <span className="block text-[10px] font-normal text-zinc-400">
                          {itemsCount} {itemsCount === 1 ? "item" : "items"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <OrderStatusSelect
                          brandId={activeBrand!.id}
                          orderId={ord.id}
                          initialStatus={ord.status as any}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
