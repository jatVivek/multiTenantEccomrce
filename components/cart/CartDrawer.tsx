"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Truck,
  Sparkles,
  Tag,
  Check,
} from "lucide-react";
import { useCart } from "./CartContext";

interface CartDrawerProps {
  brandSlug: string;
}

export function CartDrawer({ brandSlug }: CartDrawerProps) {
  const {
    items,
    cartCount,
    subtotalPaise,
    shippingPaise,
    freeShippingThresholdPaise,
    amountNeededForFreeShippingPaise,
    hasFreeShipping,
    totalAmountPaise,
    isOpen,
    closeCart,
    removeItem,
    updateQty,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  if (!isOpen) return null;

  const progressPercent = Math.min(
    100,
    Math.round((subtotalPaise / freeShippingThresholdPaise) * 100)
  );

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;

    setCouponLoading(true);
    setCouponError(null);

    try {
      const res = await fetch(`/api/brands/${brandSlug}/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCodeInput.trim(),
          subtotalPaise,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        setCouponError(data.error || "Invalid coupon code");
        return;
      }

      applyCoupon({
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        discountPaise: data.discountPaise,
      });
      setCouponCodeInput("");
    } catch (err: any) {
      setCouponError(err.message || "Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping bag"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={closeCart}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-brand-surface border-l border-brand-border flex flex-col shadow-2xl transition-all">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-brand-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-brand-primary" />
              <h2 className="text-lg font-heading font-bold text-brand-text">
                Your Bag ({cartCount})
              </h2>
            </div>
            <button
              type="button"
              onClick={closeCart}
              className="tap-target-44 p-2 text-brand-muted hover:text-brand-text rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              aria-label="Close shopping bag"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress */}
          <div className="px-4 sm:px-6 py-3 bg-brand-secondary/40 border-b border-brand-border/60">
            <div className="flex items-center justify-between text-xs font-medium text-brand-text mb-1.5">
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-brand-primary" />
                {hasFreeShipping ? (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    You unlocked Free Express Shipping!
                  </span>
                ) : (
                  <span>
                    Add ₹{(amountNeededForFreeShippingPaise / 100).toLocaleString("en-IN")} more for Free Shipping
                  </span>
                )}
              </div>
              <span className="text-brand-muted">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-brand-border rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-full bg-brand-secondary flex items-center justify-center mx-auto text-brand-muted">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-heading font-bold text-brand-text">
                  Your bag is empty
                </h3>
                <p className="text-xs text-brand-muted max-w-xs mx-auto">
                  Explore our engineered pieces and add items to begin checkout.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={closeCart}
                    className="tap-target-44 px-6 py-2.5 rounded-lg bg-brand-primary text-brand-primary-foreground text-xs font-semibold uppercase tracking-wider"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-3 rounded-lg border border-brand-border bg-brand-surface/70"
                >
                  {/* Thumbnail */}
                  <div className="relative w-20 h-24 rounded overflow-hidden bg-brand-secondary/30 flex-shrink-0">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="80px"
                      className="object-cover object-center"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-heading font-medium text-brand-text line-clamp-1">
                          {item.title}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="tap-target-44 p-1 text-brand-muted hover:text-red-500 rounded"
                          aria-label={`Remove ${item.title} from cart`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Variant options */}
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-brand-muted">
                        {item.attributes?.color && (
                          <span className="inline-flex items-center gap-1">
                            <span>Color:</span>
                            <span className="font-medium text-brand-text">{item.attributes.color}</span>
                          </span>
                        )}
                        {item.attributes?.size && (
                          <span>• Size: <strong className="text-brand-text">{item.attributes.size}</strong></span>
                        )}
                        {item.attributes?.waist && item.attributes?.inseam && (
                          <span>• {item.attributes.waist}W x {item.attributes.inseam}L</span>
                        )}
                      </div>

                      {/* Bundle items breakdown */}
                      {item.bundleItems && item.bundleItems.length > 0 && (
                        <div className="mt-1 space-y-0.5 text-[10px] text-brand-muted">
                          {item.bundleItems.map((b, idx) => (
                            <div key={idx}>+ {b.title}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quantity Stepper & Price */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center border border-brand-border rounded-md bg-brand-surface">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, item.qty - 1)}
                          className="tap-target-44 p-1.5 text-brand-text hover:bg-brand-secondary rounded-l focus:outline-none"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-xs font-semibold text-brand-text select-none">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, item.qty + 1)}
                          className="tap-target-44 p-1.5 text-brand-text hover:bg-brand-secondary rounded-r focus:outline-none"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-brand-text">
                          ₹{((item.pricePaise * item.qty) / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Area */}
          {items.length > 0 && (
            <div className="p-4 sm:p-6 border-t border-brand-border bg-brand-surface space-y-4">
              {/* Promo code form */}
              <div className="space-y-1.5">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                      <Tag className="w-3.5 h-3.5" />
                      <span>{appliedCoupon.code} applied (-₹{(appliedCoupon.discountPaise / 100).toLocaleString("en-IN")})</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-xs text-red-500 hover:underline font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                      placeholder="Promo code (e.g. STREET10)"
                      className="flex-1 h-10 px-3 text-xs bg-brand-background border border-brand-border rounded-lg text-brand-text uppercase placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <button
                      type="submit"
                      disabled={couponLoading || !couponCodeInput.trim()}
                      className="tap-target-44 px-4 h-10 rounded-lg bg-brand-secondary text-brand-secondary-foreground text-xs font-semibold hover:bg-brand-primary hover:text-brand-primary-foreground transition-colors disabled:opacity-50"
                    >
                      {couponLoading ? "..." : "Apply"}
                    </button>
                  </form>
                )}
                {couponError && (
                  <p className="text-[11px] text-red-500">{couponError}</p>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 text-xs border-t border-brand-border/60 pt-3">
                <div className="flex justify-between text-brand-muted">
                  <span>Subtotal</span>
                  <span className="font-medium text-brand-text">
                    ₹{(subtotalPaise / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount ({appliedCoupon.code})</span>
                    <span>-₹{(appliedCoupon.discountPaise / 100).toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between text-brand-muted">
                  <span>Shipping</span>
                  <span className="font-medium text-brand-text">
                    {shippingPaise === 0 ? "FREE" : `₹${(shippingPaise / 100).toLocaleString("en-IN")}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-brand-text border-t border-brand-border/60 pt-2">
                  <span>Total Amount</span>
                  <span>₹{(totalAmountPaise / 100).toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Link
                href={`/${brandSlug}/checkout`}
                onClick={closeCart}
                className="tap-target-44 w-full py-3.5 px-4 rounded-xl bg-brand-primary text-brand-primary-foreground font-heading font-bold text-sm tracking-wide uppercase shadow-md hover:brightness-110 flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
