"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Truck,
  CreditCard,
  QrCode,
  Banknote,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Check,
  Tag,
  User,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { useCart } from "@/components/cart/CartContext";
import { placeOrderAction } from "@/app/[brand_slug]/checkout/actions";
import type { SavedAddress } from "@/lib/db/queries/customers";

interface CustomerCheckoutData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  savedAddresses?: SavedAddress[];
}

interface CheckoutFormProps {
  brandSlug: string;
  brandName: string;
  customer?: CustomerCheckoutData | null;
}

export function CheckoutForm({ brandSlug, brandName, customer }: CheckoutFormProps) {
  const router = useRouter();
  const {
    items,
    subtotalPaise,
    shippingPaise,
    totalAmountPaise,
    appliedCoupon,
    clearCart,
  } = useCart();

  // Pick initial default address if customer has any
  const defaultAddr = customer?.savedAddresses?.find((a) => a.isDefault) || customer?.savedAddresses?.[0];

  // Form states
  const [customerName, setCustomerName] = useState(customer?.name || "");
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || "");
  const [street, setStreet] = useState(defaultAddr ? `${defaultAddr.line1}${defaultAddr.line2 ? `, ${defaultAddr.line2}` : ""}` : "");
  const [city, setCity] = useState(defaultAddr?.city || "");
  const [state, setState] = useState(defaultAddr?.state || "");
  const [pincode, setPincode] = useState(defaultAddr?.pincode || "");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(defaultAddr?.id || null);
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "COD">("UPI");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // When customer selects a saved address
  const handleSelectSavedAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    setStreet(`${addr.line1}${addr.line2 ? `, ${addr.line2}` : ""}`);
    setCity(addr.city);
    setState(addr.state);
    setPincode(addr.pincode);
    if (addr.phone && !customerPhone) {
      setCustomerPhone(addr.phone);
    }
  };

  const handleCustomAddressToggle = () => {
    setSelectedAddressId("custom");
    setStreet("");
    setCity("");
    setState("");
    setPincode("");
  };

  // If cart is empty
  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <h2 className="text-2xl font-heading font-bold text-brand-text">Your Bag is Empty</h2>
        <p className="text-sm text-brand-muted">
          Add items to your cart before proceeding to checkout.
        </p>
        <div className="pt-4">
          <Link
            href={`/${brandSlug}/catalog`}
            className="tap-target-44 px-6 py-2.5 rounded-lg bg-brand-primary text-brand-primary-foreground text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Browse Catalog</span>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerName.trim()) {
      setErrorMessage("Please enter your full name");
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setErrorMessage("Please enter a valid 10-digit mobile number");
      return;
    }

    if (!street.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setErrorMessage("Please fill in complete delivery address details");
      return;
    }

    if (pincode.replace(/\D/g, "").length !== 6) {
      setErrorMessage("Please enter a valid 6-digit postal pincode");
      return;
    }

    setLoading(true);

    try {
      const orderPayloadItems = items.map((i) => ({
        variantId: i.variantId,
        productId: i.productId,
        bundleId: i.bundleId,
        title: i.title,
        sku: i.sku,
        qty: i.qty,
        unitPricePaise: i.pricePaise,
        attributes: i.attributes,
        image: i.image,
      }));

      const res = await placeOrderAction({
        brandSlug,
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        customerEmail: customer?.email,
        street,
        city,
        state,
        pincode,
        paymentMethod,
        items: orderPayloadItems,
        shippingPaise,
      });

      if (res.success && res.orderId) {
        clearCart();
        router.push(`/${brandSlug}/orders/${res.orderId}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to place order. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Back button */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/${brandSlug}/catalog`}
          className="text-xs font-semibold text-brand-muted hover:text-brand-text inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Continue Shopping</span>
        </Link>

        {customer ? (
          <div className="text-xs text-brand-muted flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              Signed in as <strong className="text-brand-text">{customer.name}</strong> ({customer.email})
            </span>
          </div>
        ) : (
          <Link
            href={`/${brandSlug}/account/login?returnUrl=/${brandSlug}/checkout`}
            className="text-xs font-semibold text-brand-primary hover:underline inline-flex items-center gap-1"
          >
            <User className="w-3.5 h-3.5" />
            <span>Sign in for faster checkout</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Form Details & Payment Selector */}
        <div className="lg:col-span-7 space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-brand-text">
              Express Checkout
            </h1>
            <p className="text-xs text-brand-muted mt-1">
              Complete your order for {brandName}
            </p>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form id="checkout-form" onSubmit={handleSubmit} className="space-y-8">
            {/* 1. Customer Information */}
            <div className="bg-brand-surface rounded-xl border border-brand-border p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-brand-text border-b border-brand-border/60 pb-3 flex items-center justify-between">
                <span>1. Contact Details</span>
                {customer && (
                  <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Auto-filled
                  </span>
                )}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="customer-name" className="text-xs font-semibold text-brand-text block">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Aditya Sharma"
                    className="w-full h-11 px-3.5 text-xs sm:text-sm bg-brand-background border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="customer-phone" className="text-xs font-semibold text-brand-text block">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-brand-muted font-medium pointer-events-none">
                      +91
                    </span>
                    <input
                      id="customer-phone"
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="9876543210"
                      maxLength={10}
                      className="w-full h-11 pl-11 pr-3.5 text-xs sm:text-sm bg-brand-background border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                  </div>
                  <span className="text-[11px] text-brand-muted">
                    Order confirmation &amp; dispatch tracking sent via SMS / WhatsApp
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Delivery Address */}
            <div className="bg-brand-surface rounded-xl border border-brand-border p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-brand-text border-b border-brand-border/60 pb-3">
                2. Shipping Address
              </h2>

              {/* Saved addresses selector if signed in */}
              {customer?.savedAddresses && customer.savedAddresses.length > 0 && (
                <div className="space-y-3 pb-2">
                  <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
                    Select a Saved Address:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customer.savedAddresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      return (
                        <div
                          key={addr.id}
                          onClick={() => handleSelectSavedAddress(addr)}
                          className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? "border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary"
                              : "border-brand-border hover:border-brand-muted bg-brand-background"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between font-semibold text-brand-text mb-1">
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-brand-primary" />
                                <span>{addr.name}</span>
                              </span>
                              {addr.isDefault && (
                                <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded font-bold uppercase">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-brand-muted line-clamp-2">
                              {addr.line1}
                              {addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} - {addr.pincode}
                            </p>
                          </div>
                          <span className="text-[11px] text-brand-primary font-medium mt-2">
                            {isSelected ? "✓ Selected" : "Deliver here"}
                          </span>
                        </div>
                      );
                    })}

                    {/* Deliver to a new / different address option */}
                    <div
                      onClick={handleCustomAddressToggle}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-center text-center ${
                        selectedAddressId === "custom"
                          ? "border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary font-semibold text-brand-primary"
                          : "border-dashed border-brand-border hover:border-brand-primary/50 text-brand-muted hover:text-brand-text"
                      }`}
                    >
                      <span>+ Enter a different address</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Address input fields */}
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label htmlFor="address-street" className="text-xs font-semibold text-brand-text block">
                    Street / Flat / Door Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="address-street"
                    type="text"
                    required
                    value={street}
                    onChange={(e) => {
                      setStreet(e.target.value);
                      setSelectedAddressId("custom");
                    }}
                    placeholder="Flat 402, Skyline Residency, 12th Main Road"
                    className="w-full h-11 px-3.5 text-xs sm:text-sm bg-brand-background border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="address-city" className="text-xs font-semibold text-brand-text block">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="address-city"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setSelectedAddressId("custom");
                      }}
                      placeholder="Bengaluru"
                      className="w-full h-11 px-3.5 text-xs sm:text-sm bg-brand-background border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="address-state" className="text-xs font-semibold text-brand-text block">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="address-state"
                      type="text"
                      required
                      value={state}
                      onChange={(e) => {
                        setState(e.target.value);
                        setSelectedAddressId("custom");
                      }}
                      placeholder="Karnataka"
                      className="w-full h-11 px-3.5 text-xs sm:text-sm bg-brand-background border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="address-pincode" className="text-xs font-semibold text-brand-text block">
                      Pincode <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="address-pincode"
                      type="text"
                      required
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => {
                        setPincode(e.target.value.replace(/\D/g, ""));
                        setSelectedAddressId("custom");
                      }}
                      placeholder="560001"
                      className="w-full h-11 px-3.5 text-xs sm:text-sm bg-brand-background border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Payment Method */}
            <div className="bg-brand-surface rounded-xl border border-brand-border p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-brand-text border-b border-brand-border/60 pb-3">
                3. Payment Method
              </h2>
              <div className="space-y-3" role="radiogroup" aria-label="Select payment method">
                {/* UPI Card */}
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === "UPI"
                      ? "border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary"
                      : "border-brand-border hover:border-brand-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === "UPI"}
                    onChange={() => setPaymentMethod("UPI")}
                    className="mt-1 text-brand-primary focus:ring-brand-primary w-4 h-4"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-heading font-bold text-brand-text flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-brand-primary" />
                        <span>UPI (Google Pay, PhonePe, Paytm, BHIM)</span>
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white rounded">
                        Fastest
                      </span>
                    </div>
                    <p className="text-xs text-brand-muted">
                      Direct scan-to-pay via dynamic UPI QR code or instant mobile deep link.
                    </p>
                  </div>
                </label>

                {/* COD Card */}
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === "COD"
                      ? "border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary"
                      : "border-brand-border hover:border-brand-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === "COD"}
                    onChange={() => setPaymentMethod("COD")}
                    className="mt-1 text-brand-primary focus:ring-brand-primary w-4 h-4"
                  />
                  <div className="flex-1 space-y-1">
                    <span className="text-sm font-heading font-bold text-brand-text flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-brand-primary" />
                      <span>Cash on Delivery (COD)</span>
                    </span>
                    <p className="text-xs text-brand-muted">
                      Pay cash to the courier agent upon arrival at your doorstep.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Order Summary & Place Order */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-brand-surface rounded-xl border border-brand-border p-5 sm:p-6 space-y-5 sticky top-24">
            <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-brand-text border-b border-brand-border/60 pb-3">
              Order Summary ({items.reduce((acc, i) => acc + i.qty, 0)} items)
            </h2>

            {/* Line items list */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 text-xs">
                  <div className="relative w-14 h-16 rounded overflow-hidden bg-brand-secondary/30 flex-shrink-0">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="60px"
                      className="object-cover object-center"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-heading font-medium text-brand-text truncate">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-brand-muted mt-0.5">
                      Qty: {item.qty} {item.attributes?.size ? `• Size: ${item.attributes.size}` : ""}
                    </p>
                    <p className="font-bold text-brand-text mt-1">
                      ₹{((item.pricePaise * item.qty) / 100).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="space-y-2 border-t border-brand-border/60 pt-4 text-xs">
              <div className="flex justify-between text-brand-muted">
                <span>Subtotal</span>
                <span className="font-medium text-brand-text">
                  ₹{(subtotalPaise / 100).toLocaleString("en-IN")}
                </span>
              </div>

              {appliedCoupon && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    <span>Coupon ({appliedCoupon.code})</span>
                  </span>
                  <span>-₹{(appliedCoupon.discountPaise / 100).toLocaleString("en-IN")}</span>
                </div>
              )}

              <div className="flex justify-between text-brand-muted">
                <span>Shipping</span>
                <span className="font-medium text-brand-text">
                  {shippingPaise === 0 ? "FREE" : `₹${(shippingPaise / 100).toLocaleString("en-IN")}`}
                </span>
              </div>

              <div className="flex justify-between text-base font-bold text-brand-text border-t border-brand-border/60 pt-3">
                <span>Grand Total</span>
                <span className="text-lg">₹{(totalAmountPaise / 100).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Place Order CTA Button */}
            <div className="pt-2">
              <button
                type="submit"
                form="checkout-form"
                disabled={loading}
                className="tap-target-44 w-full py-4 px-6 rounded-xl bg-brand-primary text-brand-primary-foreground font-heading font-bold text-sm tracking-wide uppercase shadow-lg hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Place Order • ₹{(totalAmountPaise / 100).toLocaleString("en-IN")}</span>
                  </>
                )}
              </button>
            </div>

            {/* Reassurances */}
            <div className="space-y-2 pt-2 text-[11px] text-brand-muted border-t border-brand-border/60">
              <div className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-brand-primary flex-shrink-0" />
                <span>Pan-India Express Dispatch within 24-48 hours</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-primary flex-shrink-0" />
                <span>Safe &amp; Secure UPI Encryption • Direct to Merchant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
