"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Package,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  ShoppingBag,
  ArrowLeft,
  X,
} from "lucide-react";
import { cancelCustomerOrderAction } from "../actions";
import { useCart } from "@/components/cart/CartContext";

interface OrderItem {
  variantId: string;
  productId?: string;
  title: string;
  sku: string;
  pricePaise: number;
  quantity: number;
  size?: string;
  image?: string;
}

interface Order {
  id: string;
  brandId: string;
  orderNumber: number;
  status: "RECEIVED" | "PACKED" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  customerName: string;
  customerPhone: string;
  deliveryAddress: any;
  items: any;
  subtotalPaise: number;
  shippingPaise: number;
  totalAmountPaise: number;
  paymentMethod: "UPI" | "COD";
  paymentStatus: "PENDING" | "PAID" | "COD" | "FAILED";
  upiUtr?: string | null;
  trackingId?: string | null;
  courier?: string | null;
  createdAt: string;
}

interface CustomerOrdersClientProps {
  brandSlug: string;
  brandName: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  initialOrders: Order[];
}

export default function CustomerOrdersClient({
  brandSlug,
  brandName,
  customer,
  initialOrders,
}: CustomerOrdersClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "DELIVERED" | "CANCELLED">("ALL");
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("Changed mind / ordered by mistake");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const { addItem, openCart } = useCart();

  const filteredOrders = orders.filter((o) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return ["RECEIVED", "PACKED", "DISPATCHED"].includes(o.status);
    if (filter === "DELIVERED") return o.status === "DELIVERED";
    if (filter === "CANCELLED") return o.status === "CANCELLED";
    return true;
  });

  const handleCancelConfirm = () => {
    if (!cancellingOrder) return;

    startTransition(async () => {
      const res = await cancelCustomerOrderAction(brandSlug, cancellingOrder.id);
      if (!res.ok) {
        setFeedback({ type: "error", message: res.error || "Failed to cancel order." });
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === cancellingOrder.id ? { ...o, status: "CANCELLED" } : o))
        );
        setFeedback({
          type: "success",
          message: `Order #${cancellingOrder.orderNumber} has been successfully cancelled.`,
        });
      }
      setCancellingOrder(null);
    });
  };

  const handleReorder = (order: Order) => {
    const rawItems: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    for (const item of rawItems) {
      addItem({
        id: item.variantId || `${item.productId}-${item.sku}`,
        variantId: item.variantId,
        productId: item.productId || item.variantId || "",
        title: item.title,
        sku: item.sku,
        pricePaise: item.pricePaise,
        qty: item.quantity || 1,
        attributes: item.size ? { size: item.size } : undefined,
        image: item.image || "",
      });
    }
    openCart();
  };

  const getStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "RECEIVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Clock className="w-3.5 h-3.5" />
            <span>Order Received</span>
          </span>
        );
      case "PACKED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Package className="w-3.5 h-3.5" />
            <span>Packed &amp; Ready</span>
          </span>
        );
      case "DISPATCHED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20">
            <Truck className="w-3.5 h-3.5" />
            <span>Out for Delivery</span>
          </span>
        );
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Delivered</span>
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and User Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
        <div>
          <h1 className="text-2xl font-heading font-bold text-brand-text">My Orders</h1>
          <p className="text-xs text-brand-muted mt-0.5">
            Welcome back, <span className="font-semibold text-brand-text">{customer.name}</span> ({customer.email})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${brandSlug}/account/addresses`}
            className="px-3.5 py-1.5 rounded-xl border border-brand-border text-xs font-semibold text-brand-text hover:bg-brand-secondary transition-colors"
          >
            Saved Addresses
          </Link>
          <Link
            href={`/${brandSlug}/catalog`}
            className="px-3.5 py-1.5 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Continue Shopping
          </Link>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-500"
              : "bg-red-500/10 border border-red-500/30 text-red-500"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-80"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {(["ALL", "ACTIVE", "DELIVERED", "CANCELLED"] as const).map((tab) => {
          const count = orders.filter((o) => {
            if (tab === "ALL") return true;
            if (tab === "ACTIVE") return ["RECEIVED", "PACKED", "DISPATCHED"].includes(o.status);
            if (tab === "DELIVERED") return o.status === "DELIVERED";
            if (tab === "CANCELLED") return o.status === "CANCELLED";
            return true;
          }).length;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition-colors shrink-0 ${
                filter === tab
                  ? "bg-brand-primary text-brand-primary-foreground shadow-sm"
                  : "bg-brand-secondary/60 text-brand-muted hover:text-brand-text"
              }`}
            >
              {tab === "ALL" && "All Orders"}
              {tab === "ACTIVE" && "Active Orders"}
              {tab === "DELIVERED" && "Delivered"}
              {tab === "CANCELLED" && "Cancelled"}{" "}
              <span className="opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-brand-border rounded-2xl p-8 space-y-4">
          <Package className="w-10 h-10 text-brand-muted mx-auto" />
          <div>
            <h3 className="font-heading font-bold text-brand-text">No orders found</h3>
            <p className="text-xs text-brand-muted mt-1">
              {filter === "ALL"
                ? "You haven't placed any orders yet."
                : `No ${filter.toLowerCase()} orders right now.`}
            </p>
          </div>
          <Link
            href={`/${brandSlug}/catalog`}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-semibold"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Discover Products</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const rawItems: OrderItem[] = Array.isArray(order.items) ? order.items : [];
            const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={order.id}
                className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden shadow-sm hover:border-brand-primary/40 transition-colors"
              >
                {/* Order Top Bar */}
                <div className="p-4 sm:p-5 border-b border-brand-border/60 bg-brand-secondary/30 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-xs font-mono font-bold text-brand-text">
                        Order #{order.orderNumber}
                      </div>
                      <div className="text-[11px] text-brand-muted mt-0.5">
                        Placed on {formattedDate}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(order.status)}
                    <div className="text-right">
                      <div className="text-sm font-bold text-brand-text font-mono">
                        ₹{(order.totalAmountPaise / 100).toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] text-brand-muted uppercase tracking-wider font-semibold">
                        {order.paymentMethod} • {order.paymentStatus}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tracking Bar (if available) */}
                {order.trackingId && (
                  <div className="px-5 py-2.5 bg-brand-primary/5 border-b border-brand-border/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-brand-primary font-medium">
                      <Truck className="w-4 h-4" />
                      <span>
                        Shipped via {order.courier || "Express Partner"} (Tracking #{order.trackingId})
                      </span>
                    </div>
                    <Link
                      href={`/${brandSlug}/orders/${order.id}`}
                      className="font-semibold text-brand-primary hover:underline flex items-center gap-1"
                    >
                      <span>Track</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {/* Items List */}
                <div className="p-4 sm:p-5 divide-y divide-brand-border/40">
                  {rawItems.map((item, idx) => (
                    <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-xl bg-brand-secondary border border-brand-border/80 overflow-hidden shrink-0 flex items-center justify-center">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-brand-muted" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs sm:text-sm font-semibold text-brand-text truncate">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-brand-muted">
                          {item.size && <span>Size: {item.size}</span>}
                          <span>•</span>
                          <span>Qty: {item.quantity}</span>
                          <span>•</span>
                          <span className="font-mono text-brand-text font-semibold">
                            ₹{((item.pricePaise * item.quantity) / 100).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Footer Actions */}
                <div className="px-4 sm:px-5 py-3 border-t border-brand-border/60 bg-brand-surface flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-[11px] text-brand-muted truncate max-w-sm">
                    Ship to: <span className="text-brand-text font-medium">{order.deliveryAddress?.city}, {order.deliveryAddress?.state || order.deliveryAddress?.pincode}</span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {/* Can cancel if order is in RECEIVED state */}
                    {order.status === "RECEIVED" && (
                      <button
                        type="button"
                        onClick={() => setCancellingOrder(order)}
                        className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 font-semibold transition-colors"
                      >
                        Cancel Order
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleReorder(order)}
                      className="px-3 py-1.5 rounded-lg border border-brand-border text-brand-text hover:bg-brand-secondary font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Buy Again</span>
                    </button>

                    <Link
                      href={`/${brandSlug}/orders/${order.id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-brand-primary text-brand-primary-foreground font-semibold hover:opacity-90 transition-opacity flex items-center gap-1"
                    >
                      <span>Order Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CANCEL ORDER CONFIRMATION */}
      {cancellingOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-surface border border-brand-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <div>
                <h3 className="font-bold text-brand-text text-base">Cancel Order</h3>
                <p className="text-xs text-brand-muted">Order #{cancellingOrder.orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="text-brand-muted hover:text-brand-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs space-y-1">
              <p className="font-semibold">Are you sure you want to cancel this order?</p>
              <p className="text-brand-muted text-[11px]">
                Once cancelled, this order cannot be resumed. If you paid via UPI, customer care will initiate your refund.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-brand-text font-semibold">Reason for Cancellation</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="Changed mind / ordered by mistake">Changed mind / ordered by mistake</option>
                <option value="Need to change shipping address or size">Need to change shipping address or size</option>
                <option value="Found a better price elsewhere">Found a better price elsewhere</option>
                <option value="Delivery time is too long">Delivery time is too long</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="px-4 py-2 bg-brand-secondary text-brand-text rounded-xl font-semibold text-xs"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors"
              >
                {isPending ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
