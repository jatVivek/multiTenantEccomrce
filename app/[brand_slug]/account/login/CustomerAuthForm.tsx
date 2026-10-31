"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, User, Phone, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { loginCustomerAction, signUpCustomerAction } from "../actions";

interface CustomerAuthFormProps {
  brandSlug: string;
  brandName: string;
  initialMode: "signin" | "signup";
  returnUrl?: string;
}

export default function CustomerAuthForm({
  brandSlug,
  brandName,
  initialMode = "signin",
  returnUrl,
}: CustomerAuthFormProps) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await loginCustomerAction(brandSlug, { email, password });
      if (!res.ok) {
        setError(res.error || "Failed to sign in.");
      } else {
        router.push(returnUrl || `/${brandSlug}/account/orders`);
        router.refresh();
      }
    });
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    startTransition(async () => {
      const res = await signUpCustomerAction(brandSlug, {
        name,
        email,
        password,
        phone: phone ? phone.trim() : undefined,
      });

      if (!res.ok) {
        setError(res.error || "Failed to create account.");
      } else {
        router.push(returnUrl || `/${brandSlug}/account/orders`);
        router.refresh();
      }
    });
  };

  return (
    <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-2xl shadow-xl overflow-hidden transition-all">
      {/* Top Banner / Brand Header */}
      <div className="px-6 pt-8 pb-6 text-center border-b border-brand-border/60">
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-brand-text tracking-tight">
          {brandName}
        </h2>
        <p className="text-xs text-brand-muted mt-1">
          {mode === "signin"
            ? "Sign in to access your order history & saved addresses"
            : "Create your customer profile for faster checkout & live tracking"}
        </p>

        {/* Mode Switcher Tabs */}
        <div className="mt-6 p-1 bg-brand-secondary/60 rounded-xl grid grid-cols-2 gap-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              mode === "signin"
                ? "bg-brand-surface text-brand-text shadow-sm"
                : "text-brand-muted hover:text-brand-text"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              mode === "signup"
                ? "bg-brand-surface text-brand-text shadow-sm"
                : "text-brand-muted hover:text-brand-text"
            }`}
          >
            Create Account
          </button>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-text mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-brand-surface border border-brand-border rounded-xl pl-9 pr-3 py-2 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-brand-text">
                  Password
                </label>
                <Link
                  href={`/${brandSlug}/account/forgot-password`}
                  className="text-[11px] text-brand-primary hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-brand-surface border border-brand-border rounded-xl pl-9 pr-3 py-2 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 py-2.5 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-brand-text mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-brand-surface border border-brand-border rounded-xl pl-9 pr-3 py-2 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-text mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul@example.com"
                  className="w-full bg-brand-surface border border-brand-border rounded-xl pl-9 pr-3 py-2 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-text mb-1">
                Mobile Number (For Delivery Updates)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-brand-surface border border-brand-border rounded-xl pl-9 pr-3 py-2 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-text mb-1">
                Password (min 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-brand-surface border border-brand-border rounded-xl pl-9 pr-3 py-2 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-3 py-2.5 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
