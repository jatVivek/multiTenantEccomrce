"use client";

import React, { useState } from "react";
import { Lock, Mail, Loader2, AlertCircle, ShieldAlert } from "lucide-react";
import { loginAdminAction } from "../actions";

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await loginAdminAction(formData);
      if (res?.error) {
        setError(res.error);
        setLoading(false);
      }
    } catch (err: any) {
      // If Next.js redirect threw (normal behavior of redirect() in server actions), do not catch as error
      if (err?.message?.includes("NEXT_REDIRECT")) return;
      setError(err.message || "Failed to log in");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-white">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-orange-600/20 text-orange-500 border border-orange-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Portal</h1>
          <p className="text-xs text-zinc-400">
            Sign in to manage multi-tenant storefronts, orders, and brands
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-red-950/50 border border-red-800 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 shadow-xl">
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="text-xs font-semibold text-zinc-300 block">
              Admin Email
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="admin-email"
                name="email"
                type="email"
                required
                defaultValue="admin@ecom.local"
                placeholder="admin@ecom.local"
                className="w-full h-11 pl-9 pr-3.5 text-xs sm:text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="text-xs font-semibold text-zinc-300 block">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="admin-password"
                name="password"
                type="password"
                required
                defaultValue="Admin@123456"
                placeholder="••••••••"
                className="w-full h-11 pl-9 pr-3.5 text-xs sm:text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In to Admin</span>
            )}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
            <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
            <span>Configured Demo Accounts:</span>
          </div>
          <div className="space-y-1 pl-5">
            <p>• <strong>SUPER_ADMIN</strong>: <code>admin@ecom.local</code> / <code>Admin@123456</code> (all brands)</p>
            <p>• <strong>BRAND_ADMIN</strong>: <code>brandadmin1@ecom.local</code> / <code>BrandAdmin@123</code> (Urban Streetwear only)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
