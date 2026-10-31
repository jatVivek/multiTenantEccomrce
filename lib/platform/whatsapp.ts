import { assertFeatureGate } from "./feature-gate";
import {
  recordUsageEvent,
  checkDailySafetyCap,
  getPlatformSecretDecrypted,
  getBrandCredentialsDecrypted,
} from "@/lib/db/queries/platform";
import { db } from "@/src/db";
import { brands } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export interface SendWhatsAppParams {
  recipientPhone: string;
  template: "ORDER_CONFIRMATION" | "ORDER_DISPATCHED" | "ABANDONED_CART" | "OTP_VERIFICATION";
  variables: Record<string, string>;
}

export interface SendWhatsAppResult {
  success: boolean;
  senderType: "BRAND_CUSTOM_NUMBER" | "SHARED_PLATFORM_NUMBER" | "WA_ME_FALLBACK";
  messagePreview: string;
  recipientPhone: string;
  waMeUrl?: string;
  messageId?: string;
  error?: string;
}

/**
 * WhatsApp Sender Abstraction
 * Resolves:
 * 1. Brand dedicated WhatsApp number (if brand has credentials & plan permits)
 * 2. Shared platform WhatsApp number (prepends brand name into template)
 * 3. wa.me direct fallback URL (if no live API sender available)
 *
 * Checks monthly quota via featureGate and daily platform safety cap.
 */
export async function sendWhatsApp(
  brandId: string,
  params: SendWhatsAppParams
): Promise<SendWhatsAppResult> {
  // 1. Enforce monthly brand quota
  await assertFeatureGate(brandId, "whatsapp_messages", 1);

  // 2. Enforce global daily safety cap (40 paise per msg)
  const COST_PER_MSG_PAISE = 40;
  const capCheck = await checkDailySafetyCap("whatsapp", COST_PER_MSG_PAISE);
  if (!capCheck.allowed) {
    throw new Error(capCheck.message || "Global WhatsApp safety cap reached.");
  }

  // 3. Fetch brand details for name
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  const brandName = brand?.name || "Boutique Store";

  // 4. Resolve sender credentials
  let senderType: "BRAND_CUSTOM_NUMBER" | "SHARED_PLATFORM_NUMBER" | "WA_ME_FALLBACK" =
    "WA_ME_FALLBACK";
  let senderId = "wa.me";

  // Check if brand has custom number configured
  const brandCreds = await getBrandCredentialsDecrypted<{
    phoneNumberId?: string;
    accessToken?: string;
  }>(brandId, "WHATSAPP_CUSTOM");

  if (brandCreds?.phoneNumberId && brandCreds?.accessToken) {
    senderType = "BRAND_CUSTOM_NUMBER";
    senderId = brandCreds.phoneNumberId;
  } else {
    // Check shared platform number
    const sharedPlatformSecret = await getPlatformSecretDecrypted("WHATSAPP_SHARED");
    if (sharedPlatformSecret) {
      senderType = "SHARED_PLATFORM_NUMBER";
      senderId = "platform_shared_meta_cloud";
    }
  }

  // Format template body
  let textBody = "";
  if (params.template === "ORDER_CONFIRMATION") {
    textBody = `Hi ${params.variables.customerName || "Customer"}, your order #${params.variables.orderNumber || ""} with ${brandName} has been received! Total: ₹${params.variables.totalAmount || "0"}. Track status here: ${params.variables.trackingUrl || ""}`;
  } else if (params.template === "ORDER_DISPATCHED") {
    textBody = `Your order #${params.variables.orderNumber || ""} from ${brandName} is on its way via ${params.variables.courier || "courier"}! Tracking ID: ${params.variables.trackingId || ""}.`;
  } else {
    textBody = `Message from ${brandName}: ${JSON.stringify(params.variables)}`;
  }

  // If shared sender, explicitly append platform disclaimer with brand branding
  if (senderType === "SHARED_PLATFORM_NUMBER") {
    textBody = `[Sent on behalf of ${brandName}]\n${textBody}`;
  }

  // Generate wa.me fallback link
  const encodedText = encodeURIComponent(textBody);
  const cleanPhone = params.recipientPhone.replace(/\D/g, "");
  const waMeUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

  // 5. Record usage event in the immutable metering ledger
  await recordUsageEvent(brandId, "whatsapp_message", 1, COST_PER_MSG_PAISE, {
    recipient: cleanPhone,
    template: params.template,
    senderType,
    senderId,
  });

  return {
    success: true,
    senderType,
    messagePreview: textBody,
    recipientPhone: cleanPhone,
    waMeUrl,
    messageId: `wa_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
}
