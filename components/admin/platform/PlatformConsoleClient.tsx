"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Shield,
  Layers,
  Key,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Plus,
  Trash2,
  Sparkles,
  Send,
  Sliders,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  CreditCard,
  FileText,
  Palette,
  Pencil,
  Power,
  Globe,
} from "lucide-react";
import {
  updateSubscriptionPlanAction,
  updateBrandSubscriptionPlanAction,
  updateBrandSubscriptionStatusAction,
  setBrandFeatureOverrideAction,
  removeBrandFeatureOverrideAction,
  addBrandTopUpAction,
  savePlatformSecretAction,
  saveBrandCredentialsAction,
  testBrandConnectionAction,
  triggerAiDescriptionAction,
  triggerTestWhatsAppAction,
  updateDailySafetyCapAction,
  updatePlatformSettingAction,
  createBrandAction,
  updateBrandDetailsAction,
  toggleBrandActiveAction,
  deleteBrandAction,
  getBrandAdminUsersAction,
  createBrandAdminUserAction,
  resetBrandAdminPasswordAction,
  revokeBrandAdminAccessAction,
} from "@/app/admin/platform/actions";

interface PlatformConsoleClientProps {
  plans: any[];
  clients: any[];
  platformSecrets: any[];
  dailySafetyCap: any;
  auditLogs: any[];
  platformSettings?: Record<string, string>;
}

export default function PlatformConsoleClient({
  plans: initialPlans,
  clients: initialClients,
  platformSecrets: initialSecrets,
  dailySafetyCap: initialDailyCap,
  auditLogs,
  platformSettings = {},
}: PlatformConsoleClientProps) {
  const [activeTab, setActiveTab] = useState<
    "plans" | "clients" | "keys" | "usage" | "audit" | "branding"
  >("clients");

  const [clients, setClients] = useState(initialClients);
  const [plans, setPlans] = useState(initialPlans);
  const [secrets, setSecrets] = useState(initialSecrets);
  const [dailyCap, setDailyCap] = useState(initialDailyCap);
  const [footerText, setFooterText] = useState(
    platformSettings?.footer_badge_text || "Multi-tenant architecture powered by Antigravity."
  );

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // Modal states
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideFeature, setOverrideFeature] = useState("bulk_importer");
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [overrideLimitValue, setOverrideLimitValue] = useState<number>(100);
  const [overrideExpiry, setOverrideExpiry] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [topUpQuotaType, setTopUpQuotaType] = useState<"whatsapp_messages" | "ai_listing">(
    "whatsapp_messages"
  );
  const [topUpAmount, setTopUpAmount] = useState(500);

  const [planChangeModalOpen, setPlanChangeModalOpen] = useState(false);
  const [selectedNewPlanId, setSelectedNewPlanId] = useState("");

  // Test tool results
  const [testResult, setTestResult] = useState<{ title: string; content: any } | null>(null);

  // Key rotation modal
  const [rotateKeyModalOpen, setRotateKeyModalOpen] = useState(false);
  const [selectedKeyName, setSelectedKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");

  // Brand credentials state
  const [credBrandId, setCredBrandId] = useState(clients[0]?.brandId || "");
  const [credService, setCredService] = useState("RAZORPAY");
  const [credKeyId, setCredKeyId] = useState("");
  const [credKeySecret, setCredKeySecret] = useState("");
  const [credRouteAccountId, setCredRouteAccountId] = useState("");
  const [credCommissionBps, setCredCommissionBps] = useState(200);

  // Brand CRUD modal states
  const [createBrandModalOpen, setCreateBrandModalOpen] = useState(false);
  const [newBrandForm, setNewBrandForm] = useState({
    name: "",
    slug: "",
    currency: "INR",
    planId: initialPlans[0]?.id || "",
    whatsappNumber: "",
    upiVpa: "",
    customDomain: "",
    adminEmail: "",
    adminPassword: "",
  });

  // Brand Logins management states
  const [brandLoginsModalOpen, setBrandLoginsModalOpen] = useState(false);
  const [selectedBrandForLogins, setSelectedBrandForLogins] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [brandAdminsList, setBrandAdminsList] = useState<
    Array<{ id: string; email: string; role: string; createdAt: string }>
  >([]);
  const [loadingBrandAdmins, setLoadingBrandAdmins] = useState(false);
  const [newAdminLoginEmail, setNewAdminLoginEmail] = useState("");
  const [newAdminLoginPassword, setNewAdminLoginPassword] = useState("");
  const [creatingAdminLogin, setCreatingAdminLogin] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  const [editBrandModalOpen, setEditBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<{
    brandId: string;
    name: string;
    slug: string;
    currency: string;
    whatsappNumber: string;
    upiVpa: string;
    customDomain: string;
  } | null>(null);

  const [deleteBrandModalOpen, setDeleteBrandModalOpen] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState<any | null>(null);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState("");

  // Helper for alert auto-dismiss
  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 6000);
  };

  // Actions
  const handleSetOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    startTransition(async () => {
      const isLimitFeature = ["product_limit", "staff_seats", "storage_gb", "ai_listing_monthly_quota", "whatsapp_monthly_quota"].includes(
        overrideFeature
      );

      const overridePayload = isLimitFeature
        ? {
            value: Number(overrideLimitValue),
            expiresAt: overrideExpiry ? new Date(overrideExpiry).toISOString() : null,
            reason: overrideReason || "Admin override",
          }
        : {
            enabled: overrideEnabled,
            expiresAt: overrideExpiry ? new Date(overrideExpiry).toISOString() : null,
            reason: overrideReason || "Admin override",
          };

      const res = await setBrandFeatureOverrideAction(
        selectedClient.brandId,
        overrideFeature,
        overridePayload
      );

      if (res.ok) {
        showFeedback("success", `Feature override for '${overrideFeature}' saved successfully!`);
        setOverrideModalOpen(false);
        // Refresh local client view
        setClients((prev) =>
          prev.map((c) =>
            c.brandId === selectedClient.brandId
              ? {
                  ...c,
                  featureOverrides: {
                    ...c.featureOverrides,
                    [overrideFeature]: overridePayload,
                  },
                }
              : c
          )
        );
      } else {
        showFeedback("error", res.error || "Failed to set override");
      }
    });
  };

  const handleRemoveOverride = async (brandId: string, featureKey: string) => {
    startTransition(async () => {
      const res = await removeBrandFeatureOverrideAction(brandId, featureKey);
      if (res.ok) {
        showFeedback("success", `Override for '${featureKey}' removed.`);
        setClients((prev) =>
          prev.map((c) => {
            if (c.brandId === brandId) {
              const updated = { ...c.featureOverrides };
              delete updated[featureKey];
              return { ...c, featureOverrides: updated };
            }
            return c;
          })
        );
      } else {
        showFeedback("error", res.error || "Failed to remove override");
      }
    });
  };

  const handleApplyTopUp = async () => {
    if (!selectedClient) return;
    startTransition(async () => {
      const res = await addBrandTopUpAction(
        selectedClient.brandId,
        topUpQuotaType,
        Number(topUpAmount)
      );
      if (res.ok) {
        showFeedback(
          "success",
          `Added +${topUpAmount} ${topUpQuotaType.replace("_", " ")} to ${selectedClient.brandName}!`
        );
        setTopUpModalOpen(false);
        setClients((prev) =>
          prev.map((c) =>
            c.brandId === selectedClient.brandId
              ? {
                  ...c,
                  topUpQuotas: {
                    ...c.topUpQuotas,
                    [topUpQuotaType]: (c.topUpQuotas[topUpQuotaType] || 0) + Number(topUpAmount),
                  },
                }
              : c
          )
        );
      } else {
        showFeedback("error", res.error || "Failed to add top up");
      }
    });
  };

  const handleChangePlan = async () => {
    if (!selectedClient || !selectedNewPlanId) return;
    startTransition(async () => {
      const res = await updateBrandSubscriptionPlanAction(
        selectedClient.brandId,
        selectedNewPlanId
      );
      if (res.ok) {
        const targetPlan = plans.find((p) => p.id === selectedNewPlanId);
        showFeedback(
          "success",
          `Upgraded plan for ${selectedClient.brandName} to ${targetPlan?.name || "new plan"}!`
        );
        setPlanChangeModalOpen(false);
        setClients((prev) =>
          prev.map((c) =>
            c.brandId === selectedClient.brandId
              ? {
                  ...c,
                  planId: selectedNewPlanId,
                  planName: targetPlan?.name || c.planName,
                  planSlug: targetPlan?.slug || c.planSlug,
                  planPricePaise: targetPlan?.pricePaise || c.planPricePaise,
                }
              : c
          )
        );
      } else {
        showFeedback("error", res.error || "Failed to change plan");
      }
    });
  };

  const handleToggleStatus = async (
    brandId: string,
    currentStatus: string,
    brandName: string
  ) => {
    const nextStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    startTransition(async () => {
      const res = await updateBrandSubscriptionStatusAction(brandId, nextStatus as any);
      if (res.ok) {
        showFeedback("success", `Brand ${brandName} is now ${nextStatus}.`);
        setClients((prev) =>
          prev.map((c) => (c.brandId === brandId ? { ...c, status: nextStatus } : c))
        );
      } else {
        showFeedback("error", res.error || "Failed to toggle status");
      }
    });
  };

  const handleCreateBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandForm.name || !newBrandForm.slug) {
      showFeedback("error", "Name and slug are required");
      return;
    }

    startTransition(async () => {
      const res = await createBrandAction(newBrandForm);
      if (!res.ok || !res.data) {
        showFeedback("error", res.error || "Failed to create brand");
        return;
      }

      const created = res.data.brand;
      const sub = res.data.subscription;
      const chosenPlan = plans.find((p) => p.id === (newBrandForm.planId || sub.planId)) || plans[0];

      setClients((prev) => [
        ...prev,
        {
          brandId: created.id,
          brandName: created.name,
          brandSlug: created.slug,
          currency: created.currency,
          isActive: created.isActive ?? true,
          whatsappNumber: created.whatsappNumber || null,
          upiVpa: created.upiVpa || null,
          customDomain: created.customDomain || null,
          status: sub.status,
          trialEndsAt: null,
          planId: chosenPlan?.id || "",
          planName: chosenPlan?.name || "Starter",
          planSlug: chosenPlan?.slug || "starter",
          planPricePaise: chosenPlan?.pricePaise || 99900,
          featureOverrides: {},
          topUpQuotas: {},
          usageMonth: { aiCalls: 0, whatsappMessages: 0, productCount: 0, costPaise: 0 },
        },
      ]);

      setCreateBrandModalOpen(false);
      setNewBrandForm({
        name: "",
        slug: "",
        currency: "INR",
        planId: plans[0]?.id || "",
        whatsappNumber: "",
        upiVpa: "",
        customDomain: "",
        adminEmail: "",
        adminPassword: "",
      });
      showFeedback("success", `Brand '${created.name}' created successfully with ${chosenPlan?.name || "Starter"} plan!`);
    });
  };

  const openBrandLoginsModal = async (brandId: string, brandName: string) => {
    setSelectedBrandForLogins({ id: brandId, name: brandName });
    setBrandLoginsModalOpen(true);
    setLoadingBrandAdmins(true);
    setNewAdminLoginEmail("");
    setNewAdminLoginPassword("");
    setResetPasswordUserId(null);
    setResetPasswordValue("");
    try {
      const res = await getBrandAdminUsersAction(brandId);
      if (res.ok && res.data) {
        setBrandAdminsList(res.data);
      } else {
        setBrandAdminsList([]);
      }
    } catch (err: any) {
      showFeedback("error", err.message || "Failed to load brand admins");
    } finally {
      setLoadingBrandAdmins(false);
    }
  };

  const handleCreateBrandAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrandForLogins) return;
    if (!newAdminLoginEmail || !newAdminLoginPassword) {
      showFeedback("error", "Email and password are required");
      return;
    }
    setCreatingAdminLogin(true);
    try {
      const res = await createBrandAdminUserAction(
        selectedBrandForLogins.id,
        newAdminLoginEmail,
        newAdminLoginPassword
      );
      if (!res.ok) {
        showFeedback("error", res.error || "Failed to create brand admin login");
        return;
      }
      showFeedback("success", `Created login credentials for ${newAdminLoginEmail}`);
      setNewAdminLoginEmail("");
      setNewAdminLoginPassword("");
      const updated = await getBrandAdminUsersAction(selectedBrandForLogins.id);
      if (updated.ok && updated.data) {
        setBrandAdminsList(updated.data);
      }
    } catch (err: any) {
      showFeedback("error", err.message || "Failed to create brand admin login");
    } finally {
      setCreatingAdminLogin(false);
    }
  };

  const handleResetBrandAdminPassword = async (adminUserId: string) => {
    if (!resetPasswordValue || resetPasswordValue.length < 6) {
      showFeedback("error", "New password must be at least 6 characters");
      return;
    }
    setResettingPassword(true);
    try {
      const res = await resetBrandAdminPasswordAction(
        adminUserId,
        resetPasswordValue,
        selectedBrandForLogins?.id
      );
      if (!res.ok) {
        showFeedback("error", res.error || "Failed to reset password");
        return;
      }
      showFeedback("success", "Password updated successfully");
      setResetPasswordUserId(null);
      setResetPasswordValue("");
    } catch (err: any) {
      showFeedback("error", err.message || "Failed to reset password");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleRevokeBrandAdminAccess = async (adminUserId: string) => {
    if (!selectedBrandForLogins) return;
    if (!confirm("Revoke admin access for this user from this brand?")) return;
    try {
      const res = await revokeBrandAdminAccessAction(
        selectedBrandForLogins.id,
        adminUserId
      );
      if (!res.ok) {
        showFeedback("error", res.error || "Failed to revoke access");
        return;
      }
      showFeedback("success", "Brand access revoked");
      const updated = await getBrandAdminUsersAction(selectedBrandForLogins.id);
      if (updated.ok && updated.data) {
        setBrandAdminsList(updated.data);
      }
    } catch (err: any) {
      showFeedback("error", err.message || "Failed to revoke access");
    }
  };

  const handleUpdateBrandDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand) return;

    startTransition(async () => {
      const res = await updateBrandDetailsAction(editingBrand.brandId, {
        name: editingBrand.name,
        slug: editingBrand.slug,
        currency: editingBrand.currency,
        whatsappNumber: editingBrand.whatsappNumber,
        upiVpa: editingBrand.upiVpa,
        customDomain: editingBrand.customDomain,
      });

      if (!res.ok || !res.data) {
        showFeedback("error", res.error || "Failed to update brand");
        return;
      }

      const updated = res.data;
      setClients((prev) =>
        prev.map((c) =>
          c.brandId === editingBrand.brandId
            ? {
                ...c,
                brandName: updated.name,
                brandSlug: updated.slug,
                currency: updated.currency,
                whatsappNumber: updated.whatsappNumber,
                upiVpa: updated.upiVpa,
                customDomain: updated.customDomain,
              }
            : c
        )
      );

      setEditBrandModalOpen(false);
      setEditingBrand(null);
      showFeedback("success", `Brand '${updated.name}' updated successfully!`);
    });
  };

  const handleToggleBrandActive = (brandId: string, currentActive: boolean, brandName: string) => {
    const nextActive = !currentActive;
    startTransition(async () => {
      const res = await toggleBrandActiveAction(brandId, nextActive);
      if (!res.ok) {
        showFeedback("error", res.error || "Failed to update brand status");
        return;
      }

      setClients((prev) =>
        prev.map((c) => (c.brandId === brandId ? { ...c, isActive: nextActive } : c))
      );
      showFeedback(
        "success",
        `Brand '${brandName}' is now ${nextActive ? "ACTIVE (Storefront Online)" : "INACTIVE (Storefront Offline)"}.`
      );
    });
  };

  const handleDeleteBrand = () => {
    if (!deletingBrand) return;

    startTransition(async () => {
      const res = await deleteBrandAction(deletingBrand.brandId);
      if (!res.ok) {
        showFeedback("error", res.error || "Failed to delete brand");
        return;
      }

      setClients((prev) => prev.filter((c) => c.brandId !== deletingBrand.brandId));
      setDeleteBrandModalOpen(false);
      setDeletingBrand(null);
      setDeleteConfirmSlug("");
      showFeedback("success", `Brand '${res.data?.brandName || deletingBrand.brandName}' permanently deleted.`);
    });
  };

  const handleTestAi = async (brandId: string, brandName: string) => {
    startTransition(async () => {
      const res = await triggerAiDescriptionAction(brandId, {
        title: "Vintage Washed Oversized T-Shirt",
        category: "T-Shirts",
        material: "240 GSM Terry Cotton",
        fit: "Boxy Drop-Shoulder Fit",
      });

      if (res.ok) {
        setTestResult({
          title: `AI Description Generated for ${brandName}`,
          content: res.data,
        });
        showFeedback("success", `Generated AI listing (+1 count, 15 paise logged).`);
        // Increment local usage count
        setClients((prev) =>
          prev.map((c) =>
            c.brandId === brandId
              ? {
                  ...c,
                  usageMonth: {
                    ...c.usageMonth,
                    aiCalls: c.usageMonth.aiCalls + 1,
                    costPaise: c.usageMonth.costPaise + 15,
                  },
                }
              : c
          )
        );
      } else {
        showFeedback("error", res.error || "AI generation failed");
      }
    });
  };

  const handleTestWhatsApp = async (brandId: string, brandName: string) => {
    startTransition(async () => {
      const res = await triggerTestWhatsAppAction(brandId, "+919876543210", brandName);

      if (res.ok) {
        setTestResult({
          title: `WhatsApp Dispatched for ${brandName}`,
          content: res.data,
        });
        showFeedback("success", `WhatsApp message logged (+1 count, 40 paise logged).`);
        setClients((prev) =>
          prev.map((c) =>
            c.brandId === brandId
              ? {
                  ...c,
                  usageMonth: {
                    ...c.usageMonth,
                    whatsappMessages: c.usageMonth.whatsappMessages + 1,
                    costPaise: c.usageMonth.costPaise + 40,
                  },
                }
              : c
          )
        );
      } else {
        showFeedback("error", res.error || "WhatsApp test failed");
      }
    });
  };

  const handleRotateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKeyName || !newKeyValue) return;

    startTransition(async () => {
      const res = await savePlatformSecretAction(selectedKeyName, newKeyValue);
      if (res.ok) {
        showFeedback("success", `Platform key '${selectedKeyName}' rotated and encrypted with AES-256-GCM.`);
        setRotateKeyModalOpen(false);
        setNewKeyValue("");
        setSecrets((prev) =>
          prev.map((s) =>
            s.keyName === selectedKeyName
              ? { ...s, maskedPreview: res.data?.maskedPreview || "••••••••" }
              : s
          )
        );
      } else {
        showFeedback("error", res.error || "Failed to rotate key");
      }
    });
  };

  const handleSaveBrandCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credBrandId || !credService) return;

    startTransition(async () => {
      const plainData: Record<string, any> = {};
      if (credService === "RAZORPAY") {
        plainData.keyId = credKeyId;
        plainData.keySecret = credKeySecret;
      } else if (credService === "WHATSAPP_CUSTOM") {
        plainData.phoneNumberId = credKeyId;
        plainData.accessToken = credKeySecret;
      } else {
        plainData.apiKey = credKeyId;
        plainData.apiSecret = credKeySecret;
      }

      const res = await saveBrandCredentialsAction(credBrandId, credService, plainData, {
        razorpayRouteAccountId: credRouteAccountId || undefined,
        commissionPercentBasisPoints: Number(credCommissionBps || 0),
      });

      if (res.ok) {
        showFeedback("success", `Credentials for ${credService} saved with AES-256-GCM encryption.`);
        setCredKeySecret("");
      } else {
        showFeedback("error", res.error || "Failed to save credentials");
      }
    });
  };

  const handleTestBrandConnection = async () => {
    if (!credBrandId || !credService) return;
    startTransition(async () => {
      const res = await testBrandConnectionAction(credBrandId, credService);
      if (res.ok) {
        showFeedback("success", `Connection test passed! Handshake verified for ${credService}.`);
      } else {
        showFeedback("error", res.error || "Connection test failed");
      }
    });
  };

  const handleSaveFooterText = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updatePlatformSettingAction("footer_badge_text", footerText);
      if (res.ok) {
        showFeedback("success", "Platform attribution text updated dynamically across all storefronts!");
      } else {
        showFeedback("error", res.error || "Failed to update platform attribution text");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-950/80 border-emerald-700/60 text-emerald-200"
              : "bg-red-950/80 border-red-700/60 text-red-200"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-500" />
            <span>Platform Governance &amp; Plan Builder</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            SUPER_ADMIN control center: plans, feature matrices, AES-256 key vault, and real-time cost metering.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("clients")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "clients"
                ? "bg-orange-600 text-white shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Clients &amp; Overrides</span>
          </button>

          <button
            onClick={() => setActiveTab("plans")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "plans"
                ? "bg-orange-600 text-white shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Plan Builder</span>
          </button>

          <button
            onClick={() => setActiveTab("keys")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "keys"
                ? "bg-orange-600 text-white shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Key Vault</span>
          </button>

          <button
            onClick={() => setActiveTab("usage")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "usage"
                ? "bg-orange-600 text-white shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Usage &amp; Margins</span>
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "audit"
                ? "bg-orange-600 text-white shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setActiveTab("branding")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "branding"
                ? "bg-orange-600 text-white shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Platform Branding</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CLIENTS & OVERRIDES */}
      {activeTab === "clients" && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-base">Client Roster &amp; Active Plans</h3>
                <p className="text-xs text-zinc-400">
                  Provision new tenant brands, manage subscriptions, apply granular overrides, or toggle storefront status.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setCreateBrandModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Brand</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950/70 border-b border-zinc-800 text-zinc-400">
                    <th className="py-3 px-4 font-semibold">Client Brand</th>
                    <th className="py-3 px-4 font-semibold">Active Plan</th>
                    <th className="py-3 px-4 font-semibold">Status (Sub &amp; Store)</th>
                    <th className="py-3 px-4 font-semibold">Product Catalog</th>
                    <th className="py-3 px-4 font-semibold">Month Usage (AI / WA)</th>
                    <th className="py-3 px-4 font-semibold">Est. Platform Cost</th>
                    <th className="py-3 px-4 font-semibold">Overrides Active</th>
                    <th className="py-3 px-4 font-semibold text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
                  {clients.map((c) => {
                    const overrideCount = Object.keys(c.featureOverrides || {}).length;
                    const topUpCount = Object.keys(c.topUpQuotas || {}).length;
                    const isStoreActive = c.isActive ?? true;

                    return (
                      <tr key={c.brandId} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white">{c.brandName}</span>
                            <a
                              href={`/${c.brandSlug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-zinc-500 hover:text-white transition-colors"
                              title="Visit storefront in new tab"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                            <span className="text-zinc-500 font-mono">/{c.brandSlug}</span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-400 font-mono">{c.currency || "INR"}</span>
                            {c.customDomain && (
                              <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-zinc-400 flex items-center gap-0.5">
                                  <Globe className="w-2.5 h-2.5" />
                                  {c.customDomain}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-orange-400">{c.planName}</span>
                          <div className="text-[10px] text-zinc-500">
                            ₹{(c.planPricePaise / 100).toLocaleString("en-IN")}/mo
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.status === "ACTIVE"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : c.status === "TRIAL"
                                  ? "bg-blue-950 text-blue-400 border border-blue-800"
                                  : "bg-red-950 text-red-400 border border-red-800"
                              }`}
                            >
                              Sub: {c.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleBrandActive(c.brandId, isStoreActive, c.brandName)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border transition-colors ${
                                isStoreActive
                                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60"
                                  : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750"
                              }`}
                              title={isStoreActive ? "Click to disable storefront (set Inactive)" : "Click to enable storefront (set Active)"}
                            >
                              <Power className="w-2.5 h-2.5" />
                              <span>{isStoreActive ? "Store: Active" : "Store: Inactive"}</span>
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-zinc-300">
                            {c.usageMonth?.productCount ?? 0} products
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-purple-400">
                              {c.usageMonth?.aiCalls ?? 0} AI
                            </span>
                            <span className="text-zinc-600">/</span>
                            <span className="text-emerald-400">
                              {c.usageMonth?.whatsappMessages ?? 0} WA
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-zinc-300">
                          ₹{((c.usageMonth?.costPaise ?? 0) / 100).toFixed(2)}
                        </td>

                        <td className="py-3.5 px-4">
                          {overrideCount > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                              {overrideCount} Override{overrideCount > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-zinc-600">None (Plan defaults)</span>
                          )}
                          {topUpCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[9px]">
                              +{topUpCount} Top-up
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Brand Details */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBrand({
                                  brandId: c.brandId,
                                  name: c.brandName,
                                  slug: c.brandSlug,
                                  currency: c.currency || "INR",
                                  whatsappNumber: c.whatsappNumber || "",
                                  upiVpa: c.upiVpa || "",
                                  customDomain: c.customDomain || "",
                                });
                                setEditBrandModalOpen(true);
                              }}
                              className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                              title="Edit Brand details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Live Theme Customizer Link (Super Admin only) */}
                            <Link
                              href={`/admin/theme?brand=${c.brandSlug}`}
                              className="px-2 py-1 rounded bg-amber-950/60 border border-amber-800/80 hover:bg-amber-900/80 text-amber-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                              title="Live Theme Customizer (Super Admin)"
                            >
                              <Palette className="w-3 h-3" />
                              <span>Theme</span>
                            </Link>

                            {/* Brand Admin Logins (Super Admin only) */}
                            <button
                              type="button"
                              onClick={() => openBrandLoginsModal(c.brandId, c.brandName)}
                              className="px-2 py-1 rounded bg-purple-950/60 border border-purple-800/80 hover:bg-purple-900/80 text-purple-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                              title="Manage Brand Admin Logins"
                            >
                              <Key className="w-3 h-3" />
                              <span>Logins</span>
                            </button>

                            {/* Override Button */}
                            <button
                              onClick={() => {
                                setSelectedClient(c);
                                setOverrideModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors"
                              title="Customize features for this client alone"
                            >
                              Overrides
                            </button>

                            {/* Top-up Button */}
                            <button
                              onClick={() => {
                                setSelectedClient(c);
                                setTopUpModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-blue-950/70 border border-blue-800 hover:bg-blue-900 text-blue-200 text-[11px] font-medium transition-colors"
                              title="Add quota top-up"
                            >
                              Top-Up
                            </button>

                            {/* Change Plan Button */}
                            <button
                              onClick={() => {
                                setSelectedClient(c);
                                setSelectedNewPlanId(c.planId);
                                setPlanChangeModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-orange-950/70 border border-orange-800 hover:bg-orange-900 text-orange-200 text-[11px] font-medium transition-colors"
                              title="Switch Plan"
                            >
                              Plan
                            </button>

                            {/* Suspend / Reactivate */}
                            <button
                              onClick={() => handleToggleStatus(c.brandId, c.status, c.brandName)}
                              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                c.status === "ACTIVE"
                                  ? "bg-zinc-800 hover:bg-red-950 hover:text-red-300 text-zinc-400"
                                  : "bg-emerald-950 hover:bg-emerald-900 text-emerald-300"
                              }`}
                            >
                              {c.status === "ACTIVE" ? "Suspend" : "Activate"}
                            </button>

                            {/* Delete Brand Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingBrand(c);
                                setDeleteConfirmSlug("");
                                setDeleteBrandModalOpen(true);
                              }}
                              className="p-1.5 rounded bg-zinc-800 hover:bg-red-950/80 hover:text-red-400 text-zinc-400 transition-colors"
                              title="Permanently Delete Brand"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Test AI trigger */}
                            <button
                              onClick={() => handleTestAi(c.brandId, c.brandName)}
                              disabled={isPending}
                              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-purple-400"
                              title="Run test AI Listing generation"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>

                            {/* Test WA trigger */}
                            <button
                              onClick={() => handleTestWhatsApp(c.brandId, c.brandName)}
                              disabled={isPending}
                              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400"
                              title="Run test WhatsApp dispatch"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Test Action Output Viewer */}
          {testResult && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {testResult.title}
                </span>
                <button
                  onClick={() => setTestResult(null)}
                  className="text-xs text-zinc-500 hover:text-white"
                >
                  Close
                </button>
              </div>
              <pre className="p-3 bg-zinc-950 rounded-xl text-xs font-mono text-zinc-300 overflow-x-auto">
                {JSON.stringify(testResult.content, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PLAN BUILDER */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p) => {
              const features = p.features || {};

              return (
                <div
                  key={p.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg text-white">{p.name}</span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {p.slug}
                      </span>
                    </div>

                    <div className="mt-2 text-2xl font-black text-orange-400">
                      ₹{(p.pricePaise / 100).toLocaleString("en-IN")}
                      <span className="text-xs text-zinc-500 font-normal"> /mo</span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-zinc-800/40">
                        <span className="text-zinc-400">Products</span>
                        <span className="font-semibold text-white">
                          {features.product_limit === -1 ? "Unlimited" : features.product_limit}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-zinc-800/40">
                        <span className="text-zinc-400">Staff Seats</span>
                        <span className="font-semibold text-white">{features.staff_seats ?? 1}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-zinc-800/40">
                        <span className="text-zinc-400">Bulk Importer</span>
                        <span
                          className={
                            features.bulk_importer ? "text-emerald-400 font-bold" : "text-zinc-600"
                          }
                        >
                          {features.bulk_importer ? "Included" : "Restricted"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-zinc-800/40">
                        <span className="text-zinc-400">Coupons</span>
                        <span
                          className={
                            features.discount_codes ? "text-emerald-400 font-bold" : "text-zinc-600"
                          }
                        >
                          {features.discount_codes ? "Included" : "Restricted"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-zinc-800/40">
                        <span className="text-zinc-400">AI Listing/mo</span>
                        <span className="font-semibold text-purple-400">
                          {features.ai_listing_monthly_quota ?? 10} calls
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-zinc-800/40">
                        <span className="text-zinc-400">WhatsApp/mo</span>
                        <span className="font-semibold text-emerald-400">
                          {features.whatsapp_monthly_quota ?? 100} msgs
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-zinc-800/40">
                        <span className="text-zinc-400">Razorpay Auto</span>
                        <span
                          className={
                            features.razorpay_gateway
                              ? "text-emerald-400 font-bold"
                              : "text-zinc-600"
                          }
                        >
                          {features.razorpay_gateway ? "Active" : "Manual UPI"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-zinc-400">Custom Domain</span>
                        <span
                          className={
                            features.custom_domain ? "text-emerald-400 font-bold" : "text-zinc-600"
                          }
                        >
                          {features.custom_domain ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      showFeedback("success", `Editing ${p.name} feature matrix.`);
                    }}
                    className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Configure Plan Limits
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: KEY VAULT */}
      {activeTab === "keys" && (
        <div className="space-y-6">
          {/* Isolation banner */}
          <div className="bg-amber-950/40 border border-amber-800/70 p-4 rounded-2xl flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <strong className="text-white block font-semibold mb-1">
                Zero Platform Fallback for Payments (Strict Invariant)
              </strong>
              Platform keys are strictly isolated. If a client brand does not configure its own verified Razorpay API keys,
              the store runs in <span className="font-mono text-amber-300">Payments: manual</span> mode (Manual UPI + QR).
              Customer payments never flow into a shared platform account.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Platform Secrets */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="font-bold text-white text-sm">Platform Secrets (AES-256-GCM)</h3>
                  <p className="text-xs text-zinc-400">Encrypted at rest, never returned in plaintext.</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { name: "AI_PROVIDER", label: "Gemini / OpenAI API Key" },
                  { name: "WHATSAPP_SHARED", label: "Shared WhatsApp Meta Cloud Token" },
                  { name: "EMAIL_PROVIDER", label: "Transactional Email Key (Resend/SMTP)" },
                  { name: "VERCEL_TOKEN", label: "Vercel Deployment API Token" },
                  { name: "SENTRY_DSN", label: "Sentry Crash Reporting DSN" },
                  { name: "UPSTASH_REDIS", label: "Upstash Distributed Redis URL" },
                ].map((item) => {
                  const sec = secrets.find((s) => s.keyName === item.name);

                  return (
                    <div
                      key={item.name}
                      className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-white text-xs">{item.label}</div>
                        <div className="font-mono text-[11px] text-zinc-500">
                          {sec ? sec.maskedPreview : "•••••••• (env fallback)"}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedKeyName(item.name);
                          setRotateKeyModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                      >
                        Rotate
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Per-Brand Credentials */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-white text-sm">Per-Brand Integration Credentials</h3>
                <p className="text-xs text-zinc-400">Manage client-specific gateways &amp; custom numbers.</p>
              </div>

              <form onSubmit={handleSaveBrandCredentials} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1">Select Client Brand</label>
                  <select
                    value={credBrandId}
                    onChange={(e) => setCredBrandId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  >
                    {clients.map((c) => (
                      <option key={c.brandId} value={c.brandId}>
                        {c.brandName} (/{c.brandSlug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Service</label>
                  <select
                    value={credService}
                    onChange={(e) => setCredService(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="RAZORPAY">Razorpay Payment Gateway</option>
                    <option value="WHATSAPP_CUSTOM">Custom Brand WhatsApp Number</option>
                    <option value="SHIPROCKET">Shiprocket Logistics Integration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">
                    {credService === "RAZORPAY"
                      ? "Razorpay Key ID"
                      : credService === "WHATSAPP_CUSTOM"
                      ? "Meta Phone Number ID"
                      : "API Key"}
                  </label>
                  <input
                    type="text"
                    required
                    value={credKeyId}
                    onChange={(e) => setCredKeyId(e.target.value)}
                    placeholder="e.g. rzp_live_xxxxxxxxxxxx"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">
                    {credService === "RAZORPAY"
                      ? "Razorpay Key Secret"
                      : credService === "WHATSAPP_CUSTOM"
                      ? "Permanent Access Token"
                      : "API Secret"}
                  </label>
                  <input
                    type="password"
                    required
                    value={credKeySecret}
                    onChange={(e) => setCredKeySecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                {credService === "RAZORPAY" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-zinc-400 mb-1">Route Account ID (Optional)</label>
                      <input
                        type="text"
                        value={credRouteAccountId}
                        onChange={(e) => setCredRouteAccountId(e.target.value)}
                        placeholder="acc_xxxxxxxx"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Commission (Basis Points)</label>
                      <input
                        type="number"
                        value={credCommissionBps}
                        onChange={(e) => setCredCommissionBps(Number(e.target.value))}
                        placeholder="200 = 2%"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-colors"
                  >
                    Save Encrypted Credentials
                  </button>

                  <button
                    type="button"
                    onClick={handleTestBrandConnection}
                    disabled={isPending}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-xl transition-colors"
                  >
                    Test Connection
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: USAGE & MARGINS */}
      {activeTab === "usage" && (
        <div className="space-y-6">
          {/* Daily Safety Caps */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span>Platform Daily Safety Circuit Breakers</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Global spend limits per day. Automatically locks out APIs at 100% to prevent denial-of-wallet bills.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-500">Date: {dailyCap?.date}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AI cap */}
              <div className="p-4 bg-zinc-950 rounded-xl space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">AI Daily Spend</span>
                  <span className="font-mono text-white">
                    ₹{((dailyCap?.aiCostPaise || 0) / 100).toFixed(2)} / ₹
                    {((dailyCap?.dailyAiCapPaise || 500000) / 100).toFixed(0)}
                  </span>
                </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        ((dailyCap?.aiCostPaise || 0) / (dailyCap?.dailyAiCapPaise || 500000)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* WhatsApp cap */}
              <div className="p-4 bg-zinc-950 rounded-xl space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">WhatsApp Daily Spend</span>
                  <span className="font-mono text-white">
                    ₹{((dailyCap?.whatsappCostPaise || 0) / 100).toFixed(2)} / ₹
                    {((dailyCap?.dailyWhatsappCapPaise || 1000000) / 100).toFixed(0)}
                  </span>
                </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        ((dailyCap?.whatsappCostPaise || 0) /
                          (dailyCap?.dailyWhatsappCapPaise || 1000000)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Unit Economics & Margin Matrix */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h3 className="font-bold text-white text-base">Monthly Platform Margin &amp; Cost Analysis</h3>
              <p className="text-xs text-zinc-400">
                Gross profit per client: Subscription fee billed vs our underlying infrastructure cost.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950/70 border-b border-zinc-800 text-zinc-400">
                    <th className="py-3 px-4 font-semibold">Client Brand</th>
                    <th className="py-3 px-4 font-semibold">Monthly Plan Fee</th>
                    <th className="py-3 px-4 font-semibold">AI Spend</th>
                    <th className="py-3 px-4 font-semibold">WhatsApp Spend</th>
                    <th className="py-3 px-4 font-semibold">Total Cost</th>
                    <th className="py-3 px-4 font-semibold">Gross Profit</th>
                    <th className="py-3 px-4 font-semibold text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
                  {clients.map((c) => {
                    const rev = c.planPricePaise / 100;
                    const cost = (c.usageMonth?.costPaise || 0) / 100;
                    const profit = rev - cost;
                    const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : "0.0";

                    return (
                      <tr key={c.brandId} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">{c.brandName}</td>
                        <td className="py-3.5 px-4 font-mono">₹{rev.toLocaleString("en-IN")}</td>
                        <td className="py-3.5 px-4 font-mono text-purple-400">
                          ₹{(((c.usageMonth?.aiCalls || 0) * 15) / 100).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-emerald-400">
                          ₹{(((c.usageMonth?.whatsappMessages || 0) * 40) / 100).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-zinc-400">₹{cost.toFixed(2)}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          ₹{profit.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-right text-emerald-400">
                          {margin}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL */}
      {activeTab === "audit" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h3 className="font-bold text-white text-base">Platform Security &amp; Change Audit Logs</h3>
            <p className="text-xs text-zinc-400">
              Immutable log of plan modifications, overrides, and credential testing. Keys and secrets are strictly redacted.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-950/70 border-b border-zinc-800 text-zinc-400">
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Affected Brand</th>
                  <th className="py-3 px-4 font-semibold">Sanitized Payload Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-orange-400 font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{log.brandId ? log.brandId.slice(0, 8) + "..." : "Global"}</td>
                    <td className="py-3 px-4 text-[11px] text-zinc-400 max-w-md truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BRANDING TAB */}
      {activeTab === "branding" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="border-b border-zinc-800 pb-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <span>Platform Branding &amp; Storefront Footer Attribution</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Configure dynamic platform attribution text displayed across tenant storefront footers.
              Brands with the <span className="text-orange-400 font-semibold font-mono">remove_powered_by</span> plan feature or client override will automatically have this badge suppressed.
            </p>
          </div>

          <form onSubmit={handleSaveFooterText} className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300">
                Footer Powered-By / Attribution Text
              </label>
              <input
                type="text"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Multi-tenant architecture powered by Antigravity."
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
              />
              <p className="text-[11px] text-zinc-500">
                Default: <span className="font-mono text-zinc-400">Multi-tenant architecture powered by Antigravity.</span>
              </p>
            </div>

            {/* Live Storefront Preview */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Storefront Footer Preview
              </div>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
                <span>
                  © {new Date().getFullYear()} NOVA STREETWEAR{footerText.trim().startsWith(".") ? ` ${footerText.trim()}` : ` . ${footerText.trim()}`}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono">
                  (UPI &amp; COD Supported)
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs tracking-wide transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save Platform Attribution Text"}
            </button>
          </form>
        </div>
      )}

      {/* MODAL: CLIENT FEATURE OVERRIDE */}
      {overrideModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Client Feature Override</h3>
                <p className="text-xs text-zinc-400">
                  Override plan defaults for <span className="text-orange-400 font-semibold">{selectedClient.brandName}</span>
                </p>
              </div>
              <button
                onClick={() => setOverrideModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Current Active Overrides */}
            {Object.keys(selectedClient.featureOverrides || {}).length > 0 && (
              <div className="p-3 bg-zinc-950 rounded-xl space-y-2">
                <span className="text-xs font-semibold text-zinc-400 block">Existing Overrides:</span>
                <div className="space-y-1">
                  {Object.entries(selectedClient.featureOverrides).map(([k, v]: any) => (
                    <div
                      key={k}
                      className="flex items-center justify-between text-xs bg-zinc-900 p-2 rounded border border-zinc-800"
                    >
                      <div>
                        <span className="font-semibold text-white">{k}: </span>
                        <span className="text-orange-400">
                          {typeof v.enabled === "boolean" ? (v.enabled ? "Enabled" : "Disabled") : v.value}
                        </span>
                        {v.reason && <span className="text-zinc-500 text-[10px] ml-1">({v.reason})</span>}
                      </div>
                      <button
                        onClick={() => handleRemoveOverride(selectedClient.brandId, k)}
                        className="text-red-400 hover:text-red-300 text-[10px]"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSetOverride} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Feature to Override</label>
                <select
                  value={overrideFeature}
                  onChange={(e) => setOverrideFeature(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="bulk_importer">Bulk CSV Product Importer</option>
                  <option value="discount_codes">Discount &amp; Promo Codes Engine</option>
                  <option value="custom_domain">Custom Domain Mapping</option>
                  <option value="abandoned_cart_whatsapp">Abandoned Cart WhatsApp Automations</option>
                  <option value="reviews">Customer Reviews</option>
                  <option value="shipping_integration">Shiprocket Shipping Integration</option>
                  <option value="gst_invoices">Automated GST Invoices</option>
                  <option value="custom_whatsapp_number">Dedicated WhatsApp Number</option>
                  <option value="product_limit">Product Catalog Limit (Numeric)</option>
                  <option value="ai_listing_monthly_quota">AI Listing Monthly Quota (Numeric)</option>
                  <option value="whatsapp_monthly_quota">WhatsApp Monthly Quota (Numeric)</option>
                </select>
              </div>

              {["product_limit", "ai_listing_monthly_quota", "whatsapp_monthly_quota"].includes(
                overrideFeature
              ) ? (
                <div>
                  <label className="block text-zinc-400 mb-1">New Quota Limit</label>
                  <input
                    type="number"
                    value={overrideLimitValue}
                    onChange={(e) => setOverrideLimitValue(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="overrideEnabledCheck"
                    checked={overrideEnabled}
                    onChange={(e) => setOverrideEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 bg-zinc-950 border-zinc-800"
                  />
                  <label htmlFor="overrideEnabledCheck" className="text-white font-medium">
                    Enable this feature for this client
                  </label>
                </div>
              )}

              <div>
                <label className="block text-zinc-400 mb-1">Expiration Date (Optional)</label>
                <input
                  type="datetime-local"
                  value={overrideExpiry}
                  onChange={(e) => setOverrideExpiry(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Reason / Audit Note</label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Founder onboarding gift or festival promo"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl"
                >
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD TOP-UP */}
      {topUpModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Add Quota Top-Up</h3>
                <p className="text-xs text-zinc-400">{selectedClient.brandName}</p>
              </div>
              <button
                onClick={() => setTopUpModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Quota Type</label>
                <select
                  value={topUpQuotaType}
                  onChange={(e) => setTopUpQuotaType(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="whatsapp_messages">WhatsApp Messages (+500 / pack)</option>
                  <option value="ai_listing">AI Listing Calls (+50 / pack)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Additional Quota Quantity</label>
                <input
                  type="number"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTopUpModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyTopUp}
                  disabled={isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  Inject Top-Up
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE PLAN */}
      {planChangeModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Change Client Plan</h3>
                <p className="text-xs text-zinc-400">{selectedClient.brandName}</p>
              </div>
              <button
                onClick={() => setPlanChangeModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Select Target Plan</label>
                <select
                  value={selectedNewPlanId}
                  onChange={(e) => setSelectedNewPlanId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{(p.pricePaise / 100).toLocaleString("en-IN")}/mo
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPlanChangeModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleChangePlan}
                  disabled={isPending}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl"
                >
                  Apply Plan Switch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW BRAND */}
      {createBrandModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Provision New Brand</h3>
                <p className="text-xs text-zinc-400">Add a new tenant storefront to the platform</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateBrandModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBrand} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">
                  Brand Name <span className="text-orange-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBrandForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const autoSlug = name
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-+|-+$/g, "");
                    setNewBrandForm((prev) => ({
                      ...prev,
                      name,
                      slug: prev.slug === "" || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") ? autoSlug : prev.slug,
                    }));
                  }}
                  placeholder="e.g. Urban Threads"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">
                  Storefront Slug (URL) <span className="text-orange-500">*</span>
                </label>
                <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 focus-within:border-orange-500">
                  <span className="text-zinc-500 font-mono text-xs">/</span>
                  <input
                    type="text"
                    required
                    value={newBrandForm.slug}
                    onChange={(e) =>
                      setNewBrandForm((prev) => ({
                        ...prev,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                      }))
                    }
                    placeholder="urban-threads"
                    className="w-full bg-transparent border-0 px-1 py-0.5 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-semibold">Initial Plan</label>
                  <select
                    value={newBrandForm.planId}
                    onChange={(e) => setNewBrandForm((prev) => ({ ...prev, planId: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{(p.pricePaise / 100).toLocaleString("en-IN")})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-semibold">Currency</label>
                  <input
                    type="text"
                    value={newBrandForm.currency}
                    onChange={(e) =>
                      setNewBrandForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))
                    }
                    placeholder="INR"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-semibold">WhatsApp Number</label>
                  <input
                    type="text"
                    value={newBrandForm.whatsappNumber}
                    onChange={(e) =>
                      setNewBrandForm((prev) => ({ ...prev, whatsappNumber: e.target.value }))
                    }
                    placeholder="+919876543210"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-semibold">UPI VPA</label>
                  <input
                    type="text"
                    value={newBrandForm.upiVpa}
                    onChange={(e) => setNewBrandForm((prev) => ({ ...prev, upiVpa: e.target.value }))}
                    placeholder="brand@upi"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Custom Domain (Optional)</label>
                <input
                  type="text"
                  value={newBrandForm.customDomain}
                  onChange={(e) =>
                    setNewBrandForm((prev) => ({ ...prev, customDomain: e.target.value }))
                  }
                  placeholder="e.g. shop.urbanthreads.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* Optional Initial Brand Admin Login */}
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-3">
                <div className="flex items-center gap-1.5 text-purple-300">
                  <Key className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Brand Admin Login Credentials (Optional)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Create the primary admin email and password now so the brand manager can immediately log in to the admin portal.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold text-[11px]">
                      Admin Email
                    </label>
                    <input
                      type="email"
                      value={newBrandForm.adminEmail}
                      onChange={(e) =>
                        setNewBrandForm((prev) => ({ ...prev, adminEmail: e.target.value }))
                      }
                      placeholder="admin@brand.com"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold text-[11px]">
                      Initial Password
                    </label>
                    <input
                      type="password"
                      value={newBrandForm.adminPassword}
                      onChange={(e) =>
                        setNewBrandForm((prev) => ({ ...prev, adminPassword: e.target.value }))
                      }
                      placeholder="Min 6 characters"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCreateBrandModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl flex items-center gap-1.5"
                >
                  {isPending ? "Creating..." : "Create Brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT BRAND DETAILS */}
      {editBrandModalOpen && editingBrand && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Edit Brand Metadata</h3>
                <p className="text-xs text-zinc-400 font-mono">/{editingBrand.slug}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditBrandModalOpen(false);
                  setEditingBrand(null);
                }}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateBrandDetails} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">
                  Brand Name <span className="text-orange-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingBrand.name}
                  onChange={(e) =>
                    setEditingBrand((prev) => (prev ? { ...prev, name: e.target.value } : null))
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">
                  Storefront Slug <span className="text-orange-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingBrand.slug}
                  onChange={(e) =>
                    setEditingBrand((prev) =>
                      prev
                        ? {
                            ...prev,
                            slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                          }
                        : null
                    )
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-semibold">Currency</label>
                  <input
                    type="text"
                    value={editingBrand.currency}
                    onChange={(e) =>
                      setEditingBrand((prev) =>
                        prev ? { ...prev, currency: e.target.value.toUpperCase() } : null
                      )
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-semibold">WhatsApp Number</label>
                  <input
                    type="text"
                    value={editingBrand.whatsappNumber}
                    onChange={(e) =>
                      setEditingBrand((prev) =>
                        prev ? { ...prev, whatsappNumber: e.target.value } : null
                      )
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-semibold">UPI VPA</label>
                  <input
                    type="text"
                    value={editingBrand.upiVpa}
                    onChange={(e) =>
                      setEditingBrand((prev) => (prev ? { ...prev, upiVpa: e.target.value } : null))
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-semibold">Custom Domain</label>
                  <input
                    type="text"
                    value={editingBrand.customDomain}
                    onChange={(e) =>
                      setEditingBrand((prev) =>
                        prev ? { ...prev, customDomain: e.target.value } : null
                      )
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditBrandModalOpen(false);
                    setEditingBrand(null);
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PERMANENTLY DELETE BRAND */}
      {deleteBrandModalOpen && deletingBrand && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-900/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
              <div className="p-2.5 rounded-xl bg-red-950 text-red-400 border border-red-800">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Permanently Delete Brand</h3>
                <p className="text-xs text-red-400 font-semibold">{deletingBrand.brandName}</p>
              </div>
            </div>

            <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-3.5 space-y-2 text-xs text-red-200">
              <p className="font-semibold text-red-300">
                DANGER: This action cannot be undone.
              </p>
              <p className="text-zinc-300">
                This will atomically and permanently remove:
              </p>
              <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
                <li>All products, variants, bundles &amp; counters</li>
                <li>All customer orders &amp; order history</li>
                <li>All media assets &amp; discount coupons</li>
                <li>All subscription, credentials &amp; usage event records</li>
              </ul>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-zinc-300 font-medium">
                To confirm, type the brand slug{" "}
                <span className="font-mono font-bold text-orange-400">
                  {deletingBrand.brandSlug}
                </span>{" "}
                below:
              </label>
              <input
                type="text"
                value={deleteConfirmSlug}
                onChange={(e) => setDeleteConfirmSlug(e.target.value.trim())}
                placeholder={deletingBrand.brandSlug}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setDeleteBrandModalOpen(false);
                  setDeletingBrand(null);
                  setDeleteConfirmSlug("");
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBrand}
                disabled={isPending || deleteConfirmSlug !== deletingBrand.brandSlug}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isPending ? "Deleting..." : "Permanently Delete Brand"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BRAND ADMIN LOGINS (EMAIL & PASSWORD MANAGEMENT) */}
      {brandLoginsModalOpen && selectedBrandForLogins && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-950/80 text-purple-400 border border-purple-800/80 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Brand Admin Logins</h3>
                  <p className="text-xs text-purple-300/80 font-medium">
                    {selectedBrandForLogins.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBrandLoginsModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* List of Existing Logins */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Active Brand Admins
              </label>

              {loadingBrandAdmins ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  Loading credentials...
                </div>
              ) : brandAdminsList.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-zinc-800 text-center text-xs text-zinc-400">
                  No brand-specific logins assigned yet. Create one below.
                </div>
              ) : (
                <div className="space-y-2">
                  {brandAdminsList.map((admin) => (
                    <div
                      key={admin.id}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-white font-mono">
                            {admin.email}
                          </p>
                          <span className="text-[10px] text-zinc-500">
                            Role: {admin.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (resetPasswordUserId === admin.id) {
                                setResetPasswordUserId(null);
                                setResetPasswordValue("");
                              } else {
                                setResetPasswordUserId(admin.id);
                                setResetPasswordValue("");
                              }
                            }}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors"
                          >
                            {resetPasswordUserId === admin.id ? "Cancel" : "Reset Password"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeBrandAdminAccess(admin.id)}
                            className="p-1 rounded bg-zinc-800 hover:bg-red-950 hover:text-red-300 text-zinc-400 text-[11px] transition-colors"
                            title="Revoke brand access"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Reset Password Input Box */}
                      {resetPasswordUserId === admin.id && (
                        <div className="pt-2 border-t border-zinc-800 flex items-center gap-2">
                          <input
                            type="password"
                            value={resetPasswordValue}
                            onChange={(e) => setResetPasswordValue(e.target.value)}
                            placeholder="Enter new password (min 6 chars)"
                            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                          />
                          <button
                            type="button"
                            disabled={resettingPassword}
                            onClick={() => handleResetBrandAdminPassword(admin.id)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                          >
                            {resettingPassword ? "Saving..." : "Save"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create New Admin Login Form */}
            <form
              onSubmit={handleCreateBrandAdmin}
              className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-3"
            >
              <div className="flex items-center gap-1.5 text-purple-300">
                <Plus className="w-3.5 h-3.5" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Create New Brand Admin Login
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Provide an email and password for this brand's administrator to log into the admin portal.
              </p>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Login Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newAdminLoginEmail}
                    onChange={(e) => setNewAdminLoginEmail(e.target.value)}
                    placeholder="e.g. manager@brand.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newAdminLoginPassword}
                    onChange={(e) => setNewAdminLoginPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={creatingAdminLogin}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{creatingAdminLogin ? "Creating..." : "Create Brand Login"}</span>
                </button>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setBrandLoginsModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
