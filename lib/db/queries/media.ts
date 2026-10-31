import { db } from "@/src/db";
import { mediaAssets, MediaAsset, NewMediaAsset, brandSubscriptions, subscriptionPlans } from "@/src/db/schema";
import { eq, and, desc, sql, like } from "drizzle-orm";

export async function createMediaAsset(data: NewMediaAsset): Promise<MediaAsset> {
  const [asset] = await db
    .insert(mediaAssets)
    .values(data)
    .returning();
  return asset;
}

export async function getMediaAssetById(
  brandId: string,
  assetId: string
): Promise<MediaAsset | null> {
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.brandId, brandId), eq(mediaAssets.id, assetId)))
    .limit(1);
  return asset || null;
}

export async function listBrandMediaAssets(
  brandId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: "image" | "video";
    search?: string;
  } = {}
): Promise<{ assets: MediaAsset[]; total: number }> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const conditions = [eq(mediaAssets.brandId, brandId)];

  if (options.type) {
    conditions.push(eq(mediaAssets.type, options.type));
  }

  if (options.search) {
    conditions.push(like(mediaAssets.alt, `%${options.search}%`));
  }

  const whereClause = and(...conditions);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mediaAssets)
    .where(whereClause);

  const assets = await db
    .select()
    .from(mediaAssets)
    .where(whereClause)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    assets,
    total: Number(totalRow?.count || 0),
  };
}

export async function deleteMediaAsset(
  brandId: string,
  assetId: string
): Promise<MediaAsset | null> {
  const [deleted] = await db
    .delete(mediaAssets)
    .where(and(eq(mediaAssets.brandId, brandId), eq(mediaAssets.id, assetId)))
    .returning();
  return deleted || null;
}

export async function getBrandStorageUsageBytes(brandId: string): Promise<number> {
  const [row] = await db
    .select({ totalBytes: sql<number>`sum(${mediaAssets.sizeBytes})` })
    .from(mediaAssets)
    .where(eq(mediaAssets.brandId, brandId));

  return Number(row?.totalBytes || 0);
}

export interface StorageQuotaCheckResult {
  allowed: boolean;
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
  warning: boolean;
  message?: string;
}

/**
 * Checks a brand's storage consumption against their subscription plan's storage_gb limit.
 * Issues warning at 80% and blocks at 100%.
 */
export async function checkBrandStorageQuota(
  brandId: string,
  additionalBytes = 0
): Promise<StorageQuotaCheckResult> {
  // 1. Fetch current usage
  const usedBytes = await getBrandStorageUsageBytes(brandId);

  // 2. Fetch subscription plan
  const [sub] = await db
    .select()
    .from(brandSubscriptions)
    .where(eq(brandSubscriptions.brandId, brandId))
    .limit(1);

  let storageGb = 1; // Default 1 GB for starter
  if (sub) {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, sub.planId))
      .limit(1);

    if (plan?.features && typeof (plan.features as any).storage_gb === "number") {
      storageGb = (plan.features as any).storage_gb;
    }

    // Check if client has override
    const overrides = (sub.featureOverrides as Record<string, any>) || {};
    if (overrides.storage_gb && typeof overrides.storage_gb.value === "number") {
      storageGb = overrides.storage_gb.value;
    }
  }

  const quotaBytes = storageGb * 1024 * 1024 * 1024;
  const newTotal = usedBytes + additionalBytes;
  const percentUsed = (newTotal / quotaBytes) * 100;

  if (newTotal > quotaBytes) {
    return {
      allowed: false,
      usedBytes,
      quotaBytes,
      percentUsed,
      warning: true,
      message: `Storage quota exceeded (${(usedBytes / (1024 * 1024)).toFixed(1)} MB / ${storageGb} GB). Upgrade your plan for more storage space.`,
    };
  }

  return {
    allowed: true,
    usedBytes,
    quotaBytes,
    percentUsed,
    warning: percentUsed >= 80,
    message:
      percentUsed >= 80
        ? `Warning: Your storage is at ${percentUsed.toFixed(0)}% (${(newTotal / (1024 * 1024)).toFixed(1)} MB / ${storageGb} GB).`
        : undefined,
  };
}
