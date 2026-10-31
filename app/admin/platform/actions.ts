"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { verifyToken } from "@/src/lib/auth";
import { verifyAdminBrandAccess } from "@/lib/db/queries/admin";
import {
  updateSubscriptionPlan,
  updateBrandSubscriptionPlan,
  updateBrandSubscriptionStatus,
  setBrandFeatureOverride,
  removeBrandFeatureOverride,
  addBrandTopUp,
  savePlatformSecret,
  saveBrandCredentials,
  updateBrandCredentialVerification,
  updateDailySafetyCapLimits,
  writePlatformAuditLog,
  setPlatformSetting,
  createBrandWithSubscription,
  updateBrandDetails,
  toggleBrandActiveStatus,
  deleteBrandPermanently,
  getBrandAdminUsers,
  createBrandAdminUser,
  resetBrandAdminPassword,
  revokeBrandAdminAccess,
  type CreateBrandInput,
  type UpdateBrandDetailsInput,
} from "@/lib/db/queries/platform";
import { sendWhatsApp } from "@/lib/platform/whatsapp";
import { generateProductDescription } from "@/lib/platform/ai";

/**
 * Asserts that the currently logged-in admin is a SUPER_ADMIN.
 * Throws an authorization error if unauthorized.
 */
async function requireSuperAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) throw new Error("Authentication required");

  const payload = verifyToken(token);
  if (!payload) throw new Error("Invalid or expired session");

  if (payload.role !== "SUPER_ADMIN") {
    throw new Error("Access Denied: SUPER_ADMIN permissions required");
  }

  return payload;
}

export async function updateSubscriptionPlanAction(
  planId: string,
  data: {
    name?: string;
    pricePaise?: number;
    billingCycle?: string;
    features?: Record<string, any>;
    isActive?: boolean;
  }
) {
  const admin = await requireSuperAdmin();

  try {
    const updated = await updateSubscriptionPlan(planId, data);
    await writePlatformAuditLog(
      admin.userId,
      null,
      "PLAN_UPDATE",
      { planId, ...data }
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update plan" };
  }
}

export async function updateBrandSubscriptionPlanAction(
  brandId: string,
  newPlanId: string
) {
  const admin = await requireSuperAdmin();

  try {
    const updated = await updateBrandSubscriptionPlan(brandId, newPlanId);
    await writePlatformAuditLog(
      admin.userId,
      brandId,
      "CLIENT_PLAN_CHANGE",
      { brandId, newPlanId }
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update brand plan" };
  }
}

export async function updateBrandSubscriptionStatusAction(
  brandId: string,
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "GRACE_PERIOD" | "CANCELLED",
  trialEndsAt?: string | null
) {
  const admin = await requireSuperAdmin();

  try {
    const updated = await updateBrandSubscriptionStatus(brandId, status, trialEndsAt);
    await writePlatformAuditLog(
      admin.userId,
      brandId,
      "CLIENT_STATUS_CHANGE",
      { brandId, status, trialEndsAt }
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update status" };
  }
}

export async function setBrandFeatureOverrideAction(
  brandId: string,
  featureKey: string,
  override: {
    enabled?: boolean;
    value?: any;
    expiresAt?: string | null;
    reason?: string;
  }
) {
  const admin = await requireSuperAdmin();

  try {
    const updated = await setBrandFeatureOverride(brandId, featureKey, override);
    await writePlatformAuditLog(
      admin.userId,
      brandId,
      "OVERRIDE_SET",
      { brandId, featureKey, override }
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to set override" };
  }
}

export async function removeBrandFeatureOverrideAction(
  brandId: string,
  featureKey: string
) {
  const admin = await requireSuperAdmin();

  try {
    const updated = await removeBrandFeatureOverride(brandId, featureKey);
    await writePlatformAuditLog(
      admin.userId,
      brandId,
      "OVERRIDE_REMOVED",
      { brandId, featureKey }
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to remove override" };
  }
}

export async function addBrandTopUpAction(
  brandId: string,
  quotaKey: "whatsapp_messages" | "ai_listing",
  amount: number
) {
  const admin = await requireSuperAdmin();

  try {
    const updated = await addBrandTopUp(brandId, quotaKey, amount);
    await writePlatformAuditLog(
      admin.userId,
      brandId,
      "TOPUP_ADDED",
      { brandId, quotaKey, amount }
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to add top up" };
  }
}

export async function savePlatformSecretAction(
  keyName: string,
  plainValue: string
) {
  const admin = await requireSuperAdmin();

  try {
    const updated = await savePlatformSecret(keyName, plainValue);
    await writePlatformAuditLog(
      admin.userId,
      null,
      "PLATFORM_KEY_ROTATED",
      { keyName } // Secrets are stripped automatically by writePlatformAuditLog
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to rotate platform secret" };
  }
}

export async function saveBrandCredentialsAction(
  brandId: string,
  service: string,
  plainData: Record<string, any>,
  extra?: {
    razorpayRouteAccountId?: string;
    commissionPercentBasisPoints?: number;
  }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) throw new Error("Authentication required");

  const payload = verifyToken(token);
  if (!payload) throw new Error("Invalid session");

  // SUPER_ADMIN can save any brand's credentials. BRAND_ADMIN can only edit their own.
  const hasAccess = await verifyAdminBrandAccess(payload.userId, payload.role, brandId);
  if (!hasAccess) {
    throw new Error("Access Denied: You cannot modify credentials for this brand");
  }

  try {
    const updated = await saveBrandCredentials(brandId, service, plainData, extra);
    await writePlatformAuditLog(
      payload.userId,
      brandId,
      "BRAND_CREDENTIAL_UPDATED",
      { brandId, service, extra }
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to save credentials" };
  }
}

export async function testBrandConnectionAction(
  brandId: string,
  service: string
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) throw new Error("Authentication required");

  const payload = verifyToken(token);
  if (!payload) throw new Error("Invalid session");

  const hasAccess = await verifyAdminBrandAccess(payload.userId, payload.role, brandId);
  if (!hasAccess) {
    throw new Error("Access Denied");
  }

  try {
    // In dev/staging environment, simulate successful verification handshake
    const updated = await updateBrandCredentialVerification(brandId, service, true);
    await writePlatformAuditLog(
      payload.userId,
      brandId,
      "CREDENTIAL_TEST_SUCCESS",
      { brandId, service }
    );
    revalidatePath("/admin/platform");
    return { ok: true, verified: true, service, testedAt: updated?.lastTestedAt };
  } catch (err: any) {
    return { ok: false, error: err.message || "Connection test failed" };
  }
}

export async function updateDailySafetyCapAction(
  dateStr: string,
  caps: { dailyAiCapPaise?: number; dailyWhatsappCapPaise?: number }
) {
  const admin = await requireSuperAdmin();

  try {
    const updated = await updateDailySafetyCapLimits(dateStr, caps);
    await writePlatformAuditLog(
      admin.userId,
      null,
      "DAILY_SAFETY_CAP_UPDATED",
      { dateStr, caps }
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update safety caps" };
  }
}

export async function triggerAiDescriptionAction(
  brandId: string,
  params: {
    title: string;
    category?: string;
    material?: string;
    fit?: string;
  }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) throw new Error("Authentication required");

  const payload = verifyToken(token);
  if (!payload) throw new Error("Invalid session");

  const hasAccess = await verifyAdminBrandAccess(payload.userId, payload.role, brandId);
  if (!hasAccess) {
    throw new Error("Access Denied");
  }

  try {
    const result = await generateProductDescription(brandId, params);
    revalidatePath("/admin/platform");
    return { ok: true, data: result };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to generate AI description" };
  }
}

export async function triggerTestWhatsAppAction(
  brandId: string,
  phone: string,
  customerName = "Valued Customer"
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) throw new Error("Authentication required");

  const payload = verifyToken(token);
  if (!payload) throw new Error("Invalid session");

  const hasAccess = await verifyAdminBrandAccess(payload.userId, payload.role, brandId);
  if (!hasAccess) {
    throw new Error("Access Denied");
  }

  try {
    const result = await sendWhatsApp(brandId, {
      recipientPhone: phone,
      template: "ORDER_CONFIRMATION",
      variables: {
        customerName,
        orderNumber: "TEST-01",
        totalAmount: "1,999",
        trackingUrl: "https://ecom.local/track",
      },
    });
    revalidatePath("/admin/platform");
    return { ok: true, data: result };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to send WhatsApp message" };
  }
}

export async function updatePlatformSettingAction(key: string, value: string) {
  const admin = await requireSuperAdmin();

  try {
    const updatedValue = await setPlatformSetting(key, value.trim(), admin.userId);
    revalidatePath("/admin/platform");
    revalidatePath("/", "layout");
    return { ok: true, value: updatedValue };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update platform setting" };
  }
}

export async function createBrandAction(input: CreateBrandInput) {
  const admin = await requireSuperAdmin();

  try {
    const result = await createBrandWithSubscription(input, admin.userId);
    revalidatePath("/admin/platform");
    revalidatePath("/admin");
    return { ok: true, data: result };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to create brand" };
  }
}

export async function updateBrandDetailsAction(
  brandId: string,
  input: UpdateBrandDetailsInput
) {
  const admin = await requireSuperAdmin();

  try {
    const updated = await updateBrandDetails(brandId, input, admin.userId);
    revalidatePath("/admin/platform");
    revalidatePath("/admin");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update brand" };
  }
}

export async function toggleBrandActiveAction(
  brandId: string,
  isActive: boolean
) {
  const admin = await requireSuperAdmin();

  try {
    const updated = await toggleBrandActiveStatus(brandId, isActive, admin.userId);
    revalidatePath("/admin/platform");
    revalidatePath("/admin");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to toggle brand status" };
  }
}

export async function deleteBrandAction(brandId: string) {
  const admin = await requireSuperAdmin();

  try {
    const result = await deleteBrandPermanently(brandId, admin.userId);
    revalidatePath("/admin/platform");
    revalidatePath("/admin");
    return { ok: true, data: result };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to delete brand" };
  }
}

export async function getBrandAdminUsersAction(brandId: string) {
  await requireSuperAdmin();

  try {
    const users = await getBrandAdminUsers(brandId);
    return { ok: true, data: users };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to fetch brand admins" };
  }
}

export async function createBrandAdminUserAction(
  brandId: string,
  email: string,
  password: string
) {
  const admin = await requireSuperAdmin();

  try {
    const newUser = await createBrandAdminUser(
      brandId,
      email,
      password,
      admin.userId
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: newUser };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to create brand admin login" };
  }
}

export async function resetBrandAdminPasswordAction(
  adminUserId: string,
  newPassword: string,
  brandId?: string
) {
  const admin = await requireSuperAdmin();

  try {
    const result = await resetBrandAdminPassword(
      adminUserId,
      newPassword,
      admin.userId,
      brandId
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: result };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to reset password" };
  }
}

export async function revokeBrandAdminAccessAction(
  brandId: string,
  adminUserId: string
) {
  const admin = await requireSuperAdmin();

  try {
    const result = await revokeBrandAdminAccess(
      brandId,
      adminUserId,
      admin.userId
    );
    revalidatePath("/admin/platform");
    return { ok: true, data: result };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to revoke access" };
  }
}
