"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, Lock, ArrowLeft, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { requestPasswordResetAction, submitPasswordResetAction } from "../actions";

interface ForgotPasswordClientProps {
  brandSlug: string;
  brandName: string;
}

export default function ForgotPasswordClient({ brandSlug, brandName }: ForgotPasswordClientProps) {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const res = await requestPasswordResetAction(brandSlug, email);
      if (!res.ok) {
        setError(res.error || "Failed to send reset code.");
      } else {
        setMessage(res.message || "A reset code has been generated.");
        if (res.devCode) {
          setToken(res.devCode);
        }
        setStep("reset");
      }
    });
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    startTransition(async () => {
      const res = await submitPasswordResetAction(brandSlug, {
        email,
        token,
        newPassword,
      });

      if (!res.ok) {
        setError(res.error || "Failed to reset password.");
      } else {
        setMessage(res.message || "Password reset successful!");
        setTimeout(() => {
          router.push(`/${brandSlug}/account/login`);
        }, 1500);
      }
    });
  };

  return (
    <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-2xl shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
      <div className="text-center">
        <Link
          href={`/${brandSlug}/account/login`}
          className="inline-flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>
        <h2 className="text-xl font-heading font-bold text-brand-text">Reset Password</h2>
        <p className="text-xs text-brand-muted mt-1">
          {step === "request"
            ? "Enter your registered email address to receive a verification code."
            : "Enter the verification code and set your new password."}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {step === "request" ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-brand-text mb-1">
              Account Email
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

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending Code...</span>
              </>
            ) : (
              <>
                <span>Get Reset Code</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-brand-text mb-1">
              6-Digit Reset Code
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456"
                className="w-full bg-brand-surface border border-brand-border rounded-xl pl-9 pr-3 py-2 text-xs text-brand-text font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-text mb-1">
              New Password (min 6 chars)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-brand-surface border border-brand-border rounded-xl pl-9 pr-3 py-2 text-xs text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Resetting Password...</span>
              </>
            ) : (
              <>
                <span>Save New Password</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
