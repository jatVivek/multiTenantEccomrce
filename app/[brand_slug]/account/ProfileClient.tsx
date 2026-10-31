"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Package,
  MapPin,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Save,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { updateCustomerProfileAction, logoutCustomerAction } from "./actions";

interface ProfileClientProps {
  brandSlug: string;
  brandName: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    createdAt?: string | Date;
  };
}

export default function ProfileClient({
  brandSlug,
  brandName,
  customer,
}: ProfileClientProps) {
  const router = useRouter();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone || "");
  const [isPending, startTransition] = useTransition();
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!name.trim()) {
      setMessage({ type: "error", text: "Name cannot be empty." });
      return;
    }

    startTransition(async () => {
      const res = await updateCustomerProfileAction(brandSlug, {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });

      if (!res.ok) {
        setMessage({ type: "error", text: res.error || "Failed to update profile." });
      } else {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        router.refresh();
      }
    });
  };

  const handleLogout = () => {
    startLogoutTransition(async () => {
      await logoutCustomerAction(brandSlug);
      router.push(`/${brandSlug}`);
      router.refresh();
    });
  };

  const formattedDate = customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-8">
      {/* Header Profile Banner */}
      <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-primary text-brand-primary-foreground flex items-center justify-center font-bold text-2xl uppercase shadow-sm">
            {customer.name?.charAt(0) || "U"}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-brand-text">
              {customer.name}
            </h1>
            <p className="text-sm text-brand-muted flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{customer.email}</span>
            </p>
            {formattedDate && (
              <p className="text-xs text-brand-muted mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Customer • Member since {formattedDate}</span>
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="tap-target-44 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-semibold inline-flex items-center gap-2 transition-colors self-stretch sm:self-auto justify-center"
        >
          <LogOut className="w-4 h-4" />
          <span>{isLoggingOut ? "Signing Out..." : "Sign Out"}</span>
        </button>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href={`/${brandSlug}/account/orders`}
          className="group p-5 bg-brand-surface rounded-2xl border border-brand-border hover:border-brand-primary/40 transition-all hover:shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-brand-text group-hover:text-brand-primary transition-colors">
                My Orders
              </h3>
              <p className="text-xs text-brand-muted mt-0.5">
                Track status, view receipts &amp; cancel orders
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-brand-muted group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          href={`/${brandSlug}/account/addresses`}
          className="group p-5 bg-brand-surface rounded-2xl border border-brand-border hover:border-brand-primary/40 transition-all hover:shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-brand-text group-hover:text-brand-primary transition-colors">
                Saved Addresses
              </h3>
              <p className="text-xs text-brand-muted mt-0.5">
                Manage delivery addresses for 1-click checkout
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-brand-muted group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* Personal Info Edit Form */}
      <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-heading font-semibold text-brand-text">
            Personal Information
          </h2>
          <p className="text-xs text-brand-muted mt-1">
            Update your contact details for order notifications and shipping updates.
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm ${
              message.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-sm"
                  placeholder="Your full name"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-2">
                Phone Number (for Courier &amp; Updates)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-sm"
                  placeholder="e.g. 9876543210"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-2">
              Email Address (Account Identifier)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                disabled
                value={customer.email}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-border bg-brand-secondary/40 text-brand-muted cursor-not-allowed text-sm"
              />
            </div>
            <p className="text-[11px] text-brand-muted mt-1.5">
              Email is your unique account ID across {brandName} and cannot be altered directly.
            </p>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="tap-target-44 px-6 py-2.5 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isPending ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
