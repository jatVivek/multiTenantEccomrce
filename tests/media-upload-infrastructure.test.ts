import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/db";
import {
  brands,
  adminUsers,
  mediaAssets,
  brandSubscriptions,
  subscriptionPlans,
} from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import {
  validateImageSignature,
  stripExifMetadata,
  generateBlurPlaceholder,
} from "../lib/storage/validation";
import { LocalStorageProvider } from "../lib/storage/provider";
import {
  createMediaAsset,
  getMediaAssetById,
  listBrandMediaAssets,
  deleteMediaAsset,
  getBrandStorageUsageBytes,
  checkBrandStorageQuota,
} from "../lib/db/queries/media";
import {
  requestSignedUploadAction,
  deleteMediaAssetAction,
} from "../app/admin/media/actions";
import { generateToken } from "../src/lib/auth";
import fs from "fs";
import path from "path";

describe("Phase M1: Media & Upload Infrastructure", () => {
  let brandAId: string;
  let brandBId: string;
  let starterPlanId: string;
  let brandAdminA: any;
  let brandAdminB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    // 1. Create two test brands
    const [bA] = await db
      .insert(brands)
      .values({
        id: crypto.randomUUID(),
        name: "Media Test Brand A",
        slug: `media-test-brand-a-${Date.now()}`,
        currency: "INR",
        themeConfig: {},
      })
      .returning();
    brandAId = bA.id;

    const [bB] = await db
      .insert(brands)
      .values({
        id: crypto.randomUUID(),
        name: "Media Test Brand B",
        slug: `media-test-brand-b-${Date.now()}`,
        currency: "INR",
        themeConfig: {},
      })
      .returning();
    brandBId = bB.id;

    // 2. Fetch starter plan
    const [starter] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.slug, "starter"))
      .limit(1);
    starterPlanId = starter!.id;

    // 3. Attach subscriptions
    await db.insert(brandSubscriptions).values([
      {
        id: crypto.randomUUID(),
        brandId: brandAId,
        planId: starterPlanId,
        status: "ACTIVE",
        featureOverrides: {},
        topUpQuotas: {},
      },
      {
        id: crypto.randomUUID(),
        brandId: brandBId,
        planId: starterPlanId,
        status: "ACTIVE",
        featureOverrides: {},
        topUpQuotas: {},
      },
    ]);

    // 4. Create admin users
    const [adminA] = await db
      .insert(adminUsers)
      .values({
        id: crypto.randomUUID(),
        email: `admin-a-${Date.now()}@ecom.local`,
        role: "BRAND_ADMIN",
      })
      .returning();
    brandAdminA = adminA;
    tokenA = generateToken(adminA);

    const [adminB] = await db
      .insert(adminUsers)
      .values({
        id: crypto.randomUUID(),
        email: `admin-b-${Date.now()}@ecom.local`,
        role: "BRAND_ADMIN",
      })
      .returning();
    brandAdminB = adminB;
    tokenB = generateToken(adminB);
  });

  afterAll(async () => {
    if (brandAId) {
      await db.delete(mediaAssets).where(eq(mediaAssets.brandId, brandAId));
      await db.delete(brandSubscriptions).where(eq(brandSubscriptions.brandId, brandAId));
      await db.delete(brands).where(eq(brands.id, brandAId));
    }
    if (brandBId) {
      await db.delete(mediaAssets).where(eq(mediaAssets.brandId, brandBId));
      await db.delete(brandSubscriptions).where(eq(brandSubscriptions.brandId, brandBId));
      await db.delete(brands).where(eq(brands.id, brandBId));
    }
    if (brandAdminA?.id) {
      await db.delete(adminUsers).where(eq(adminUsers.id, brandAdminA.id));
    }
    if (brandAdminB?.id) {
      await db.delete(adminUsers).where(eq(adminUsers.id, brandAdminB.id));
    }
  });

  // ── 1. Binary Magic Number Signature Validation ──────────────────────

  describe("1. Binary Magic Number Signature Validation", () => {
    it("accepts valid JPEG binary header (FF D8 FF)", () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const res = validateImageSignature(validJpeg);
      expect(res.valid).toBe(true);
      expect(res.detectedMime).toBe("image/jpeg");
    });

    it("accepts valid PNG binary header (89 50 4E 47 0D 0A 1A 0A)", () => {
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const res = validateImageSignature(validPng);
      expect(res.valid).toBe(true);
      expect(res.detectedMime).toBe("image/png");
    });

    it("accepts valid WebP binary header (RIFF .... WEBP)", () => {
      const validWebP = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x20, 0x00, 0x00, 0x00, // length
        0x57, 0x45, 0x42, 0x50, // WEBP
        0x56, 0x50, 0x38, 0x20, // VP8
      ]);
      const res = validateImageSignature(validWebP);
      expect(res.valid).toBe(true);
      expect(res.detectedMime).toBe("image/webp");
    });

    it("strictly rejects executable or shell script disguised as image (.jpg)", () => {
      const maliciousScript = Buffer.from("#!/bin/bash\necho 'malicious payload'\nexit 0");
      const res = validateImageSignature(maliciousScript);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Invalid or unsupported file format");
    });

    it("strictly rejects SVG with embedded script tags", () => {
      const maliciousSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const res = validateImageSignature(maliciousSvg);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("SVG and XML images are disallowed");
    });
  });

  // ── 2. EXIF Metadata Stripping & Blur Placeholder ────────────────────

  describe("2. EXIF Metadata Stripping & Blur Placeholder", () => {
    it("strips APP1 EXIF segment from JPEG buffer", () => {
      // Mock JPEG with APP1 marker (FF E1, length 8)
      const bufferWithExif = Buffer.from([
        0xff, 0xd8, 0xff, // SOI
        0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1 EXIF
        0xff, 0xda, 0x00, 0x08, // SOS
      ]);

      const stripped = stripExifMetadata(bufferWithExif);
      // The APP1 marker (0xFF, 0xE1) must be eliminated
      let hasApp1 = false;
      for (let i = 0; i < stripped.length - 1; i++) {
        if (stripped[i] === 0xff && stripped[i + 1] === 0xe1) {
          hasApp1 = true;
          break;
        }
      }
      expect(hasApp1).toBe(false);
    });

    it("generates lightweight Base64 blur placeholder data URI", () => {
      const placeholder = generateBlurPlaceholder();
      expect(placeholder.startsWith("data:image/webp;base64,")).toBe(true);
      expect(placeholder.length).toBeLessThan(120); // Ultra compact
    });
  });

  // ── 3. Storage Provider Isolation & CRUD ─────────────────────────────

  describe("3. Storage Provider & Path Isolation", () => {
    it("uploads and serves files at brands/{brandId}/{type}/{uuid}.{ext}", async () => {
      const provider = new LocalStorageProvider();
      const testBuffer = Buffer.from("test image content bytes");
      const storagePath = `brands/${brandAId}/image/test-asset.webp`;

      const uploadResult = await provider.upload({
        path: storagePath,
        fileBuffer: testBuffer,
        contentType: "image/webp",
      });

      expect(uploadResult.storagePath).toBe(storagePath);
      expect(uploadResult.publicUrl).toContain(`/uploads/${storagePath}`);

      // Delete file
      const deleted = await provider.delete(storagePath);
      expect(deleted).toBe(true);
    });
  });

  // ── 4. Scoped Media Assets Query Layer & Storage Metering ────────────

  describe("4. Scoped Media Asset Queries & Storage Quotas", () => {
    let createdAssetId: string;

    it("creates a media_assets record for brand A", async () => {
      const asset = await createMediaAsset({
        brandId: brandAId,
        type: "image",
        url: "https://example.com/assets/tee-front.webp",
        storagePath: `brands/${brandAId}/image/tee-front.webp`,
        mime: "image/webp",
        sizeBytes: 500 * 1024, // 500 KB
        width: 1200,
        height: 1500,
        alt: "Heavyweight Boxy Tee Front View",
        blurDataUrl: generateBlurPlaceholder(),
      });

      expect(asset.id).toBeDefined();
      expect(asset.brandId).toBe(brandAId);
      createdAssetId = asset.id;
    });

    it("calculates accurate storage usage in bytes for brand A", async () => {
      const totalBytes = await getBrandStorageUsageBytes(brandAId);
      expect(totalBytes).toBe(500 * 1024);
    });

    it("enforces storage quota: blocks when exceeding brand storage_gb limit", async () => {
      // Starter plan limit is 1 GB (1024 * 1024 * 1024 bytes)
      // Check adding 1.5 GB
      const HUGE_FILE_BYTES = 1.5 * 1024 * 1024 * 1024;
      const quotaCheck = await checkBrandStorageQuota(brandAId, HUGE_FILE_BYTES);

      expect(quotaCheck.allowed).toBe(false);
      expect(quotaCheck.warning).toBe(true);
      expect(quotaCheck.message).toContain("Storage quota exceeded");
    });

    it("warns when storage reaches 80% of quota", async () => {
      // 850 MB on 1 GB plan = 83%
      const EIGHTY_PCT_BYTES = 850 * 1024 * 1024;
      const quotaCheck = await checkBrandStorageQuota(brandAId, EIGHTY_PCT_BYTES);

      expect(quotaCheck.allowed).toBe(true);
      expect(quotaCheck.warning).toBe(true);
      expect(quotaCheck.percentUsed).toBeGreaterThanOrEqual(80);
      expect(quotaCheck.message).toContain("Warning: Your storage is at");
    });

    it("lists brand A's media assets and supports alt-text keyword search", async () => {
      const list = await listBrandMediaAssets(brandAId, { search: "Boxy Tee" });
      expect(list.total).toBe(1);
      expect(list.assets[0].alt).toContain("Boxy Tee");
    });

    it("deletes media asset for brand A atomically", async () => {
      const deleted = await deleteMediaAsset(brandAId, createdAssetId);
      expect(deleted?.id).toBe(createdAssetId);

      const verify = await getMediaAssetById(brandAId, createdAssetId);
      expect(verify).toBeNull();
    });
  });

  // ── 5. Multi-Tenant Isolation ────────────────────────────────────────

  describe("5. Multi-Tenant Media Isolation", () => {
    it("prevents brand B from listing or querying brand A's media assets", async () => {
      // Create asset for brand A
      const assetA = await createMediaAsset({
        brandId: brandAId,
        type: "image",
        url: "https://example.com/assets/exclusive-a.webp",
        storagePath: `brands/${brandAId}/image/exclusive-a.webp`,
        mime: "image/webp",
        sizeBytes: 100000,
        alt: "Brand A Exclusive",
      });

      // Query from brand B's perspective
      const queryB = await getMediaAssetById(brandBId, assetA.id);
      expect(queryB).toBeNull();

      // Brand B's list should not include brand A's asset
      const listB = await listBrandMediaAssets(brandBId);
      const foundInB = listB.assets.some((a) => a.id === assetA.id);
      expect(foundInB).toBe(false);

      // Attempting to delete Brand A's asset with Brand B ID fails
      const deleteAttempt = await deleteMediaAsset(brandBId, assetA.id);
      expect(deleteAttempt).toBeNull();

      // Clean up
      await deleteMediaAsset(brandAId, assetA.id);
    });
  });

  // ── 6. Migration & Backfill Integrity ────────────────────────────────

  describe("6. Migration Backfill Integrity", () => {
    it("confirms backfilled legacy product images exist in media_assets without breaking product links", async () => {
      const brand = await db.query.brands.findFirst({
        where: eq(brands.slug, "urban-streetwear"),
      });

      if (brand) {
        const assets = await listBrandMediaAssets(brand.id);
        expect(assets.total).toBeGreaterThan(0);
        expect(assets.assets[0].type).toBe("image");
        expect(assets.assets[0].blurDataUrl).toBeDefined();
      }
    });
  });
});
