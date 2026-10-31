"use client";

import React, { useState } from "react";
import type { Order } from "@/src/db/schema";
import { updateOrderFulfillmentAction } from "@/app/admin/actions";
import { PackingSlipModal } from "./PackingSlipModal";
import {
  Package,
  Truck,
  CheckCircle,
  FileText,
  Clock,
  Search,
  Filter,
  Check,
  Loader2,
  XCircle,
} from "lucide-react";

interface OrderDispatchDeskProps {
  brandId: string;
  brandSlug: string;
  brandName: string;
  initialOrders: Order[];
}

const COURIER_OPTIONS = [
  "Delhivery",
  "BlueDart",
  "DTDC",
  "Shiprocket",
  "IndiaPost",
  "Ekart",
  "Shadowfax",
  "Other",
];

export function OrderDispatchDesk({
  brandId,
  brandSlug,
  brandName,
  initialOrders,
}: OrderDispatchDeskProps) {
  const [ordersList, setOrdersList] = useState<Order[]>(initialOrders);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSlipOrder, setActiveSlipOrder] = useState<Order | null>(null);

  // Per-order state for updating tracking info
  const [trackingInputs, setTrackingInputs] = useState<
    Record<string, { courier: string; trackingId: string }>
  >({});
  const [loadingOrders, setLoadingOrders] = useState<Record<string, boolean>>({});

  const filteredOrders = ordersList.filter((ord) => {
    if (statusFilter !== "ALL" && ord.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = String(ord.orderNumber).includes(q);
      const matchCustomer = ord.customerName.toLowerCase().includes(q);
      const matchPhone = ord.customerPhone.includes(q);
      const matchTracking = ord.trackingId?.toLowerCase().includes(q);
      if (!matchNumber && !matchCustomer && !matchPhone && !matchTracking) return false;
    }
    return true;
  });

  const handleUpdateStatus = async (
    orderId: string,
    nextStatus: "RECEIVED" | "PACKED" | "DISPATCHED" | "DELIVERED" | "CANCELLED"
  ) => {
    setLoadingOrders((prev) => ({ ...prev, [orderId]: true }));
    try {
      const res = await updateOrderFulfillmentAction(brandId, orderId, {
        status: nextStatus,
      });
      if (res.ok && res.data) {
        setOrdersList((prev) =>
          prev.map((o) => (o.id === orderId ? (res.data as Order) : o))
        );
      } else {
        alert(res.error || "Failed to update status");
      }
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    } finally {
      setLoadingOrders((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleSaveTracking = async (orderId: string) => {
    const input = trackingInputs[orderId];
    if (!input) return;

    setLoadingOrders((prev) => ({ ...prev, [orderId]: true }));
    try {
      const res = await updateOrderFulfillmentAction(brandId, orderId, {
        courier: input.courier,
        trackingId: input.trackingId.trim(),
      });
      if (res.ok && res.data) {
        setOrdersList((prev) =>
          prev.map((o) => (o.id === orderId ? (res.data as Order) : o))
        );
      } else {
        alert(res.error || "Failed to save tracking");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save tracking");
    } finally {
      setLoadingOrders((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order #, customer, phone, or AWB..."
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "ALL", label: "All Orders" },
            { id: "RECEIVED", label: "Received", icon: Clock },
            { id: "PACKED", label: "Packed", icon: Package },
            { id: "DISPATCHED", label: "Dispatched", icon: Truck },
            { id: "DELIVERED", label: "Delivered", icon: CheckCircle },
          ].map((tab) => {
            const active = statusFilter === tab.id;
            const count =
              tab.id === "ALL"
                ? ordersList.length
                : ordersList.filter((o) => o.status === tab.id).length;

            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  active
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800/80"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    active ? "bg-orange-700 text-white" : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List / Dispatch Desk Table */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-16 text-center text-xs text-zinc-500">
            No orders found matching the filter criteria.
          </div>
        ) : (
          filteredOrders.map((ord) => {
            const items = (ord.items as any[]) || [];
            const addr = (ord.deliveryAddress as any) || {};
            const isLoading = Boolean(loadingOrders[ord.id]);
            const trackingState = trackingInputs[ord.id] || {
              courier: ord.courier || "Delhivery",
              trackingId: ord.trackingId || "",
            };

            return (
              <div
                key={ord.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 text-xs text-white space-y-4 hover:border-zinc-700 transition-colors shadow-md"
              >
                {/* Order Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-bold text-white">
                      #{ord.orderNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        ord.status === "DELIVERED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : ord.status === "DISPATCHED"
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : ord.status === "PACKED"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : ord.status === "CANCELLED"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      }`}
                    >
                      {ord.status}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {new Date(ord.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Packing Slip Button */}
                    <button
                      onClick={() => setActiveSlipOrder(ord)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-700/60"
                    >
                      <FileText className="w-3.5 h-3.5 text-orange-400" />
                      <span>Packing Slip</span>
                    </button>

                    {/* Quick Next-Status Button */}
                    {ord.status === "RECEIVED" && (
                      <button
                        onClick={() => handleUpdateStatus(ord.id, "PACKED")}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-60 shadow-sm"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                        <span>Mark Packed</span>
                      </button>
                    )}
                    {ord.status === "PACKED" && (
                      <button
                        onClick={() => handleUpdateStatus(ord.id, "DISPATCHED")}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-60 shadow-sm"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                        <span>Mark Dispatched</span>
                      </button>
                    )}
                    {ord.status === "DISPATCHED" && (
                      <button
                        onClick={() => handleUpdateStatus(ord.id, "DELIVERED")}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-60 shadow-sm"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        <span>Mark Delivered</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Customer & Address */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                      Customer &amp; Shipping Address
                    </span>
                    <p className="font-semibold text-white">{ord.customerName}</p>
                    <p className="text-zinc-400 text-[11px]">+91 {ord.customerPhone}</p>
                    <p className="text-zinc-400 text-[11px]">
                      {addr.addressLine1}, {addr.city}, {addr.state} - {addr.postalCode}
                    </p>
                  </div>

                  {/* Items Ordered */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                      Items Ordered ({items.length})
                    </span>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span className="text-zinc-300 truncate max-w-[180px]">
                            {it.title} ({it.size || "Std"}) × {it.quantity}
                          </span>
                          <span className="text-zinc-400 font-mono">
                            ₹{(((it.pricePaise || 0) * it.quantity) / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-1 text-[11px] font-bold text-white flex justify-between border-t border-zinc-800">
                      <span>Total:</span>
                      <span>₹{(ord.totalAmountPaise / 100).toFixed(2)} ({ord.paymentMethod})</span>
                    </div>
                  </div>

                  {/* Courier & Tracking Assignment */}
                  <div className="space-y-1.5 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                      Dispatch Logistics
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={trackingState.courier}
                        onChange={(e) =>
                          setTrackingInputs((prev) => ({
                            ...prev,
                            [ord.id]: {
                              courier: e.target.value,
                              trackingId: trackingState.trackingId,
                            },
                          }))
                        }
                        className="h-8 rounded bg-zinc-900 border border-zinc-800 text-[11px] px-2 text-white"
                      >
                        {COURIER_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={trackingState.trackingId}
                          onChange={(e) =>
                            setTrackingInputs((prev) => ({
                              ...prev,
                              [ord.id]: {
                                courier: trackingState.courier,
                                trackingId: e.target.value,
                              },
                            }))
                          }
                          placeholder="Tracking # / AWB"
                          className="w-full h-8 rounded bg-zinc-900 border border-zinc-800 text-[11px] px-2 text-white font-mono placeholder-zinc-500"
                        />
                        <button
                          onClick={() => handleSaveTracking(ord.id)}
                          disabled={isLoading}
                          className="h-8 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                          title="Save Tracking Info"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {ord.trackingId && (
                      <div className="text-[10px] font-mono text-emerald-400">
                        Assigned AWB: {ord.trackingId} ({ord.courier || "Delhivery"})
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Packing Slip Modal */}
      <PackingSlipModal
        order={activeSlipOrder}
        brandName={brandName}
        onClose={() => setActiveSlipOrder(null)}
      />
    </div>
  );
}
