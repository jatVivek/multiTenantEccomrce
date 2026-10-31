"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { verifyToken } from "@/src/lib/auth";
import { verifyAdminBrandAccess } from "@/lib/db/queries/admin";
import {
  createMediaAsset,
  deleteMediaAsset,
  listBrandMediaAssets,
  checkBrandStorageQuota,
} from "@/lib/db/queries/media";
import { recordUsageEvent } from "@/lib/db/queries/platform";
import { assertFeatureGate } from "@/lib/platform/feature-gate";
import { getStorageProvider } from "@/lib/storage/provider";
import {
  validateImageSignature,
  stripExifMetadata,
  generateBlurPlaceholder,
  extractImageDimensions,
  ALLOWED_IMAGE_MIMES,
} from "@/lib/storage/validation";
import crypto from "crypto";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

async function authenticateBrandAdmin(brandId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) throw new Error("Authentication required");

  const payload = verifyToken(token);
  if (!payload) throw new Error("Invalid or expired session");

  const hasAccess = await verifyAdminBrandAccess(payload.userId, payload.role, brandId);
  if (!hasAccess) {
    throw new Error("Access Denied: You cannot manage media for this brand");
  }

  return payload;
}

/**
 * Server action to request a signed upload URL.
 * Checks permissions, file format rules, and brand storage quota.
 */
export async function requestSignedUploadAction(
  brandId: string,
  meta: {
    filename: string;
    mime: string;
    sizeBytes: number;
    type?: "image" | "video";
  }
) {
  await authenticateBrandAdmin(brandId);

  // 1. Feature Gate check
  await assertFeatureGate(brandId, "custom_domain"); // Check active status

  // 2. Validate size & format
  if (meta.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, error: `File exceeds maximum limit of 8 MB (${(meta.sizeBytes / (1024 * 1024)).toFixed(1)} MB).` };
  }

  const cleanMime = meta.mime.toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.includes(cleanMime as any) && !cleanMime.startsWith("video/")) {
    return { ok: false, error: "Disallowed format. Only JPEG, PNG, WebP, and AVIF images are permitted." };
  }

  // 3. Storage Quota check
  const quota = await checkBrandStorageQuota(brandId, meta.sizeBytes);
  if (!quota.allowed) {
    return { ok: false, error: quota.message || "Brand storage quota exceeded." };
  }

  // 4. Generate isolated path: brands/{brandId}/{type}/{uuid}.{ext}
  const fileExt = meta.filename.split(".").pop()?.toLowerCase() || "webp";
  const safeExt = fileExt === "jpeg" ? "jpg" : fileExt;
  const storagePath = `brands/${brandId}/${meta.type || "image"}/${crypto.randomUUID()}.${safeExt}`;

  const provider = getStorageProvider();
  const signed = await provider.createSignedUploadUrl({
    path: storagePath,
    contentType: meta.mime,
    maxSizeBytes: meta.sizeBytes,
  });

  return {
    ok: true,
    data: {
      uploadUrl: signed.uploadUrl,
      storagePath: signed.storagePath,
      publicUrl: signed.publicUrl,
      warning: quota.warning ? quota.message : undefined,
    },
  };
}

/**
 * Server action for direct file uploads.
 * Validates binary magic bytes, strips EXIF, generates blur placeholder,
 * persists to storage and records the asset in database.
 */
export async function uploadMediaDirectAction(brandId: string, formData: FormData) {
  const admin = await authenticateBrandAdmin(brandId);

  const file = formData.get("file") as File | null;
  const altText = (formData.get("alt") as string) || "";

  if (!file) {
    return { ok: false, error: "No file provided in upload request." };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, error: "File exceeds 8 MB size limit." };
  }

  // 1. Storage quota check
  const quota = await checkBrandStorageQuota(brandId, file.size);
  if (!quota.allowed) {
    return { ok: false, error: quota.message || "Storage quota exceeded." };
  }

  // 2. Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);

  // 3. Binary magic number verification (Reject disguised executables & SVGs)
  const validation = validateImageSignature(rawBuffer);
  if (!validation.valid || !validation.detectedMime) {
    return { ok: false, error: validation.error || "File signature validation failed." };
  }

  const detectedMime = validation.detectedMime;

  // 4. Strip EXIF metadata
  const finalBuffer: Buffer = stripExifMetadata(rawBuffer);

  // 5. Extract dimensions & generate blur placeholder
  const dimensions = extractImageDimensions(finalBuffer, detectedMime);
  const blurPlaceholder = generateBlurPlaceholder();

  // 6. Build storage path
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  const ext = extMap[detectedMime] || "webp";
  const storagePath = `brands/${brandId}/image/${crypto.randomUUID()}.${ext}`;

  // 7. Upload to active storage provider
  const provider = getStorageProvider();
  const uploadRes = await provider.upload({
    path: storagePath,
    fileBuffer: finalBuffer,
    contentType: detectedMime,
  });

  // 8. Persist asset in media_assets table
  const asset = await createMediaAsset({
    brandId,
    type: "image",
    url: uploadRes.publicUrl,
    storagePath: uploadRes.storagePath,
    mime: detectedMime,
    sizeBytes: finalBuffer.length,
    width: dimensions.width,
    height: dimensions.height,
    alt: altText || file.name.replace(/\.[^/.]+$/, ""),
    blurDataUrl: blurPlaceholder,
    createdBy: admin.userId,
  });

  // 9. Record storage event
  await recordUsageEvent(brandId, "storage", 1, 0, {
    assetId: asset.id,
    bytesAdded: finalBuffer.length,
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin/theme");

  return {
    ok: true,
    data: asset,
    warning: quota.warning ? quota.message : undefined,
  };
}

/**
 * Lists media library assets for a specific brand.
 */
export async function listBrandMediaAssetsAction(
  brandId: string,
  options?: { limit?: number; offset?: number; type?: "image" | "video"; search?: string }
) {
  await authenticateBrandAdmin(brandId);

  try {
    const result = await listBrandMediaAssets(brandId, options);
    return { ok: true, data: result };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to list media assets" };
  }
}

/**
 * Deletes a media asset from storage and database.
 */
export async function deleteMediaAssetAction(brandId: string, assetId: string) {
  await authenticateBrandAdmin(brandId);

  try {
    const deleted = await deleteMediaAsset(brandId, assetId);
    if (!deleted) {
      return { ok: false, error: "Asset not found or access denied" };
    }

    // Delete from storage provider
    const provider = getStorageProvider();
    await provider.delete(deleted.storagePath);

    revalidatePath("/admin/products");
    revalidatePath("/admin/theme");

    return { ok: true, data: deleted };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to delete asset" };
  }
}
