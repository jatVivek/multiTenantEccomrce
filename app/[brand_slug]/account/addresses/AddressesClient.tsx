"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Home,
  ChevronRight,
  ArrowLeft,
  X,
  Phone,
  User,
} from "lucide-react";
import { addCustomerAddressAction, deleteCustomerAddressAction } from "../actions";
import type { SavedAddress } from "@/lib/db/queries/customers";

interface AddressesClientProps {
  brandSlug: string;
  brandName: string;
  initialAddresses: SavedAddress[];
}

export default function AddressesClient({
  brandSlug,
  brandName,
  initialAddresses,
}: AddressesClientProps) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<SavedAddress[]>(initialAddresses);
  const [isAdding, setIsAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Address Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    isDefault: false,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!formData.name.trim() || !formData.phone.trim() || !formData.line1.trim() || !formData.city.trim() || !formData.state.trim() || !formData.pincode.trim()) {
      setMessage({ type: "error", text: "Please fill in all required address fields." });
      return;
    }

    startTransition(async () => {
      const res = await addCustomerAddressAction(brandSlug, {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        line1: formData.line1.trim(),
        line2: formData.line2.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        isDefault: formData.isDefault || addresses.length === 0,
      });

      if (!res.ok) {
        setMessage({ type: "error", text: res.error || "Failed to add address." });
      } else {
        setAddresses(res.addresses || []);
        setIsAdding(false);
        setFormData({
          name: "",
          phone: "",
          line1: "",
          line2: "",
          city: "",
          state: "",
          pincode: "",
          isDefault: false,
        });
        setMessage({ type: "success", text: "Address saved successfully!" });
        router.refresh();
      }
    });
  };

  const handleDeleteAddress = (id: string) => {
    if (!confirm("Are you sure you want to delete this saved address?")) return;
    setMessage(null);

    startTransition(async () => {
      const res = await deleteCustomerAddressAction(brandSlug, id);
      if (!res.ok) {
        setMessage({ type: "error", text: res.error || "Failed to remove address." });
      } else {
        setAddresses(res.addresses || []);
        setMessage({ type: "success", text: "Address removed." });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-brand-text">
            Saved Delivery Addresses
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Store and manage addresses for quick 1-click checkout.
          </p>
        </div>

        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="tap-target-44 px-4 py-2.5 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 hover:opacity-95 transition-opacity self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Address</span>
          </button>
        )}
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
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

      {/* Add New Address Form Modal/Card */}
      {isAdding && (
        <div className="bg-brand-surface rounded-2xl border border-brand-primary/30 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-heading font-semibold text-brand-text">
              Add New Delivery Address
            </h2>
            <button
              onClick={() => setIsAdding(false)}
              className="p-1 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleAddAddress} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Recipient's Name"
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-brand-border bg-brand-surface text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="10-digit mobile number"
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-brand-border bg-brand-surface text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                Flat / House / Building *
              </label>
              <input
                type="text"
                required
                name="line1"
                value={formData.line1}
                onChange={handleInputChange}
                placeholder="e.g. Flat 402, Sunshine Heights"
                className="w-full px-4 py-2 rounded-xl border border-brand-border bg-brand-surface text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                Street / Area / Landmark
              </label>
              <input
                type="text"
                name="line2"
                value={formData.line2}
                onChange={handleInputChange}
                placeholder="e.g. 10th Main, Near City Park"
                className="w-full px-4 py-2 rounded-xl border border-brand-border bg-brand-surface text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                  City *
                </label>
                <input
                  type="text"
                  required
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="e.g. Bengaluru"
                  className="w-full px-4 py-2 rounded-xl border border-brand-border bg-brand-surface text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                  State *
                </label>
                <input
                  type="text"
                  required
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  placeholder="e.g. Karnataka"
                  className="w-full px-4 py-2 rounded-xl border border-brand-border bg-brand-surface text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                  PIN Code *
                </label>
                <input
                  type="text"
                  required
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleInputChange}
                  placeholder="6-digit PIN"
                  className="w-full px-4 py-2 rounded-xl border border-brand-border bg-brand-surface text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                name="isDefault"
                checked={formData.isDefault}
                onChange={handleInputChange}
                className="w-4 h-4 rounded border-brand-border text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-xs text-brand-text font-medium">
                Make this my default delivery address
              </span>
            </label>

            <div className="pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="tap-target-44 px-4 py-2 rounded-xl border border-brand-border text-xs font-semibold text-brand-muted hover:text-brand-text hover:bg-brand-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="tap-target-44 px-6 py-2 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-bold uppercase tracking-wider hover:opacity-95 transition-opacity disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Address"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Addresses List */}
      {addresses.length === 0 ? (
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-brand-secondary flex items-center justify-center text-brand-text">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-brand-text text-base">
              No saved addresses found
            </h3>
            <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
              Save your home or work address for seamless, 1-click checkout whenever you shop at {brandName}.
            </p>
          </div>
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="tap-target-44 px-5 py-2.5 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 hover:opacity-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Address</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`p-5 rounded-2xl border bg-brand-surface flex flex-col justify-between transition-all ${
                addr.isDefault
                  ? "border-brand-primary/60 shadow-sm"
                  : "border-brand-border hover:border-brand-muted/40"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-brand-text text-sm">
                    {addr.name}
                  </span>
                  {addr.isDefault && (
                    <span className="px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-wider">
                      Default
                    </span>
                  )}
                </div>

                <p className="text-xs text-brand-muted flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  <span>{addr.phone}</span>
                </p>

                <p className="text-xs text-brand-text/90 leading-relaxed pt-1">
                  {addr.line1}
                  {addr.line2 && <>, {addr.line2}</>}
                  <br />
                  {addr.city}, {addr.state} - <span className="font-mono font-medium">{addr.pincode}</span>
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-brand-border/60 flex items-center justify-end">
                <button
                  onClick={() => handleDeleteAddress(addr.id)}
                  disabled={isPending}
                  className="tap-target-44 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
