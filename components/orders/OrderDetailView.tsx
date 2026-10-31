"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  QrCode,
  ExternalLink,
  MessageCircle,
  Truck,
  Package,
  Check,
  AlertCircle,
  Loader2,
  Copy,
  ArrowRight,
} from "lucide-react";
import type { Order, Brand } from "@/src/db/schema";
import { submitUpiUtrAction } from "@/app/[brand_slug]/orders/[order_id]/actions";

interface OrderDetailViewProps {
  order: Order;
  brand: Brand;
  upiPaymentUrl: string | null;
  whatsAppUrl: string;
}

export function OrderDetailView({
  order: initialOrder,
  brand,
  upiPaymentUrl,
  whatsAppUrl,
}: OrderDetailViewProps) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [utrInput, setUtrInput] = useState("");
  const [utrLoading, setUtrLoading] = useState(false);
  const [utrSuccess, setUtrSuccess] = useState(false);
  const [utrError, setUtrError] = useState<string | null>(null);
  const [copiedVpa, setCopiedVpa] = useState(false);

  const isUpi = order.paymentMethod === "UPI";
  const isPaid = order.paymentStatus === "PAID";
  const totalRupees = (order.totalAmountPaise / 100).toLocaleString("en-IN");
  const subtotalRupees = (order.subtotalPaise / 100).toLocaleString("en-IN");
  const shippingRupees =
    order.shippingPaise === 0
      ? "FREE"
      : `₹${(order.shippingPaise / 100).toLocaleString("en-IN")}`;

  const address = order.deliveryAddress as {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };

  const items = Array.isArray(order.items) ? (order.items as any[]) : [];

  const handleCopyVpa = () => {
    if (brand.upiVpa) {
      navigator.clipboard.writeText(brand.upiVpa);
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2000);
    }
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrInput.trim()) return;

    setUtrLoading(true);
    setUtrError(null);

    try {
      const res = await submitUpiUtrAction(brand.slug, order.id, utrInput);
      if (res.success && res.order) {
        setOrder(res.order);
        setUtrSuccess(true);
      }
    } catch (err: any) {
      setUtrError(err.message || "Failed to submit UTR reference");
    } finally {
      setUtrLoading(false);
    }
  };

  // Tracking steps
  const steps = [
    { label: "Order Received", done: true },
    { label: "Packed", done: ["PACKED", "DISPATCHED", "DELIVERED"].includes(order.status) },
    { label: "Dispatched", done: ["DISPATCHED", "DELIVERED"].includes(order.status) },
    { label: "Delivered", done: order.status === "DELIVERED" },
  ];

  const qrCodeUrl = upiPaymentUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(upiPaymentUrl)}`
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14 space-y-8">
      {/* Top Success Banner */}
      <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 sm:p-8 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <div>
          <span className="text-xs uppercase font-mono tracking-widest text-brand-muted">
            Order Confirmed
          </span>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-brand-text mt-1">
            Thank you, {order.customerName.split(" ")[0]}!
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Order <strong className="text-brand-text font-mono">#{order.orderNumber}</strong> placed successfully with {brand.name}.
          </p>
        </div>

        {/* Fulfillment Timeline */}
        <div className="pt-6 border-t border-brand-border/60 max-w-xl mx-auto">
          <div className="grid grid-cols-4 gap-2 text-center">
            {steps.map((st, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    st.done
                      ? "bg-brand-primary text-brand-primary-foreground shadow"
                      : "bg-brand-secondary text-brand-muted border border-brand-border"
                  }`}
                >
                  {st.done ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span
                  className={`text-[11px] mt-2 font-medium ${
                    st.done ? "text-brand-text" : "text-brand-muted"
                  }`}
                >
                  {st.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* UPI Payment Instructions Card */}
      {isUpi && (
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-brand-border/60 pb-4">
            <div className="flex items-center gap-2.5">
              <QrCode className="w-5 h-5 text-brand-primary" />
              <h2 className="text-base sm:text-lg font-heading font-bold text-brand-text">
                UPI Payment Details
              </h2>
            </div>
            {isPaid ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Paid ₹{totalRupees}</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Awaiting Payment</span>
              </span>
            )}
          </div>

          {isPaid ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <p className="font-semibold text-sm">✓ Transaction Verified</p>
              <p>Your UPI payment of ₹{totalRupees} has been recorded successfully.</p>
              {order.upiUtr && (
                <p className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                  Transaction Reference (UTR): {order.upiUtr}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              {/* QR Code */}
              <div className="md:col-span-5 flex flex-col items-center text-center space-y-3">
                {qrCodeUrl && (
                  <div className="p-3 bg-white rounded-xl shadow-md border border-zinc-200 inline-block">
                    <img
                      src={qrCodeUrl}
                      alt="UPI Payment QR Code"
                      width={200}
                      height={200}
                      className="rounded"
                    />
                  </div>
                )}
                <span className="text-xs text-brand-muted">
                  Scan with any UPI App (GPay, PhonePe, Paytm, Cred)
                </span>
              </div>

              {/* Action buttons & VPA Copy */}
              <div className="md:col-span-7 space-y-5">
                <div className="p-4 rounded-xl bg-brand-secondary/30 border border-brand-border space-y-2">
                  <span className="text-xs text-brand-muted block">Merchant UPI ID (VPA):</span>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-mono font-bold text-brand-text">
                      {brand.upiVpa || "merchant@upi"}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyVpa}
                      className="tap-target-44 px-3 py-1.5 text-xs font-semibold rounded bg-brand-surface border border-brand-border text-brand-text hover:bg-brand-secondary flex items-center gap-1.5"
                    >
                      {copiedVpa ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedVpa ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                {/* Instant Deep Link button (Mobile) */}
                {upiPaymentUrl && (
                  <div>
                    <a
                      href={upiPaymentUrl}
                      className="tap-target-44 w-full py-3.5 px-4 rounded-xl bg-brand-primary text-brand-primary-foreground font-heading font-bold text-sm tracking-wide uppercase shadow hover:brightness-110 transition-all flex items-center justify-center gap-2"
                    >
                      <span>Pay ₹{totalRupees} via UPI App</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}

                {/* UTR Input Form */}
                <form onSubmit={handleSubmitUtr} className="space-y-2 pt-2 border-t border-brand-border/60">
                  <label htmlFor="upi-utr-input" className="text-xs font-semibold text-brand-text block">
                    Already paid? Enter 12-digit UPI Reference / UTR Number:
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="upi-utr-input"
                      type="text"
                      required
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="e.g. 423589201948"
                      className="flex-1 h-11 px-3.5 text-xs bg-brand-background border border-brand-border rounded-lg text-brand-text font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <button
                      type="submit"
                      disabled={utrLoading || !utrInput.trim()}
                      className="tap-target-44 px-5 h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {utrLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>Submit UTR</span>
                    </button>
                  </div>
                  {utrError && <p className="text-xs text-red-500">{utrError}</p>}
                  {utrSuccess && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ UTR submitted! Payment verified.
                    </p>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* COD Notice Card */}
      {!isUpi && (
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-brand-primary" />
            <h2 className="text-base sm:text-lg font-heading font-bold text-brand-text">
              Cash on Delivery (COD) Confirmed
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-brand-muted leading-relaxed">
            Please keep exact change of <strong>₹{totalRupees}</strong> ready at the time of delivery. Our courier delivery partner will contact you at <strong>+91 {order.customerPhone}</strong> prior to arrival.
          </p>
        </div>
      )}

      {/* Order Summary & Customer Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shipping Address */}
        <div className="bg-brand-surface rounded-xl border border-brand-border p-5 space-y-3">
          <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-brand-muted border-b border-brand-border/60 pb-2">
            Delivery Address
          </h3>
          <div className="text-xs text-brand-text space-y-1">
            <p className="font-bold text-sm">{order.customerName}</p>
            <p className="text-brand-muted">{address.street}</p>
            <p className="text-brand-muted">
              {address.city}, {address.state} - {address.pincode}
            </p>
            <p className="pt-1 text-brand-muted font-medium">Phone: +91 {order.customerPhone}</p>
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div className="bg-brand-surface rounded-xl border border-brand-border p-5 space-y-3">
          <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-brand-muted border-b border-brand-border/60 pb-2">
            Payment Summary
          </h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-brand-muted">
              <span>Subtotal</span>
              <span className="font-medium text-brand-text">₹{subtotalRupees}</span>
            </div>
            <div className="flex justify-between text-brand-muted">
              <span>Shipping</span>
              <span className="font-medium text-brand-text">{shippingRupees}</span>
            </div>
            <div className="flex justify-between text-brand-muted">
              <span>Payment Method</span>
              <span className="font-semibold text-brand-text uppercase">{order.paymentMethod}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-brand-text border-t border-brand-border/60 pt-2">
              <span>Total Paid / Payable</span>
              <span>₹{totalRupees}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-5 space-y-4">
        <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-brand-muted border-b border-brand-border/60 pb-2">
          Ordered Garments ({items.length})
        </h3>
        <div className="divide-y divide-brand-border/60">
          {items.map((item, idx) => (
            <div key={idx} className="py-3 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                {item.image && (
                  <div className="relative w-12 h-14 rounded overflow-hidden bg-brand-secondary/30 flex-shrink-0">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="50px"
                      className="object-cover object-center"
                    />
                  </div>
                )}
                <div>
                  <h4 className="font-heading font-medium text-brand-text">{item.title}</h4>
                  <p className="text-[11px] text-brand-muted mt-0.5">
                    Qty: {item.qty} {item.attributes?.size ? `• Size: ${item.attributes.size}` : ""}
                  </p>
                </div>
              </div>
              <span className="font-bold text-brand-text whitespace-nowrap">
                ₹{((item.unitPricePaise * item.qty) / 100).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Links */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target-44 w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Chat on WhatsApp</span>
        </a>

        <Link
          href={`/${brand.slug}/catalog`}
          className="tap-target-44 w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow hover:brightness-110"
        >
          <span>Continue Shopping</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
