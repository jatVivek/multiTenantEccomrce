"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { verifyToken } from "@/src/lib/auth";
import { verifyAdminBrandAccess } from "@/lib/db/queries/admin";
import { createMediaAsset, checkBrandStorageQuota } from "@/lib/db/queries/media";
import { recordUsageEvent } from "@/lib/db/queries/platform";
import { getVideoProvider } from "@/lib/video/provider";
import { validateVideoSignature } from "@/lib/storage/validation";

const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_VIDEO_DURATION_SECONDS = 30; // 30 seconds reel

const ALLOWED_VIDEO_MIMES = [
  "video/mp4",
  "video/webm",
  "video/quicktime", // MOV
];

async function authenticateBrandAdmin(brandId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) throw new Error("Authentication required");

  const payload = verifyToken(token);
  if (!payload) throw new Error("Invalid or expired session");

  const hasAccess = await verifyAdminBrandAccess(payload.userId, payload.role, brandId);
  if (!hasAccess) {
    throw new Error("Access Denied: You cannot manage video for this brand");
  }

  return payload;
}

export async function uploadVideoAction(brandId: string, formData: FormData) {
  const admin = await authenticateBrandAdmin(brandId);

  const file = formData.get("file") as File | null;
  const posterFile = formData.get("poster") as File | null;
  const duration = parseInt((formData.get("duration") as string) || "15", 10);
  const altText = (formData.get("alt") as string) || "Product Reel Video";

  if (!file) {
    return { ok: false, error: "No video file provided." };
  }

  // 1. Size and duration checks
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return {
      ok: false,
      error: `Video exceeds the 25 MB size limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  if (duration > MAX_VIDEO_DURATION_SECONDS) {
    return {
      ok: false,
      error: `Video exceeds maximum allowed duration of ${MAX_VIDEO_DURATION_SECONDS} seconds (${duration}s).`,
    };
  }

  const cleanMime = file.type.toLowerCase();
  if (!ALLOWED_VIDEO_MIMES.includes(cleanMime)) {
    return {
      ok: false,
      error: "Disallowed video format. Only MP4, WebM, and MOV are supported.",
    };
  }

  // 2. Storage quota check
  const quota = await checkBrandStorageQuota(brandId, file.size);
  if (!quota.allowed) {
    return { ok: false, error: quota.message || "Storage quota exceeded." };
  }

  // 3. Binary signature check
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  const sigCheck = validateVideoSignature(fileBuffer);
  if (!sigCheck.valid) {
    return { ok: false, error: sigCheck.error };
  }

  // Read poster if provided
  let posterBuffer: Buffer | undefined;
  if (posterFile) {
    posterBuffer = Buffer.from(await posterFile.arrayBuffer());
  }

  // 4. Upload via active VideoProvider (Supabase, Bunny Stream, or Cloudflare Stream)
  const provider = getVideoProvider();
  const uploadRes = await provider.upload({
    brandId,
    filename: file.name,
    fileBuffer,
    contentType: cleanMime,
    durationSeconds: duration,
    posterBuffer,
  });

  // 5. Create media_assets record
  const asset = await createMediaAsset({
    brandId,
    type: "video",
    url: uploadRes.videoUrl,
    storagePath: uploadRes.storagePath,
    mime: cleanMime,
    sizeBytes: fileBuffer.length,
    durationSeconds: uploadRes.durationSeconds,
    posterUrl: uploadRes.posterUrl,
    alt: altText,
    createdBy: admin.userId,
  });

  // 6. Record usage event
  await recordUsageEvent(brandId, "storage", 1, 0, {
    assetId: asset.id,
    type: "video",
    bytesAdded: fileBuffer.length,
  });

  revalidatePath("/admin/products");

  return {
    ok: true,
    data: {
      id: asset.id,
      url: asset.url,
      posterUrl: asset.posterUrl,
      durationSeconds: asset.durationSeconds,
      storagePath: asset.storagePath,
    },
    warning: quota.warning ? quota.message : undefined,
  };
}
