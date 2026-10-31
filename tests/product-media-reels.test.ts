import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/db";
import {
  brands,
  adminUsers,
  products,
  productVariants,
  type Brand,
} from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { validateVideoSignature } from "../lib/storage/validation";
import {
  getVideoProvider,
  resetVideoProviderCache,
  SupabaseVideoProvider,
  BunnyStreamProvider,
  CloudflareStreamProvider,
} from "../lib/video/provider";
import {
  assertSsrfSafeUrl,
  isPrivateIp,
} from "../lib/storage/ssrf-guard";
import {
  createProductWithVariants,
  getAdminProductsWithVariants,
  importProductsCsv,
} from "../lib/db/queries/admin";

describe("Phase M2: Product Media, Videos, Reels & SSRF Guard", () => {
  let testBrand: Brand;

  beforeAll(async () => {
    // 1. Create a dedicated test brand
    const [b] = await db
      .insert(brands)
      .values({
        id: crypto.randomUUID(),
        name: "Reels Test Apparel",
        slug: `reels-test-${Date.now()}`,
        currency: "INR",
        themeConfig: {},
      })
      .returning();
    testBrand = b;
  });

  afterAll(async () => {
    if (testBrand) {
      await db.delete(productVariants).where(eq(productVariants.brandId, testBrand.id));
      await db.delete(products).where(eq(products.brandId, testBrand.id));
      await db.delete(brands).where(eq(brands.id, testBrand.id));
    }
  });

  describe("1. Video Binary Signature & Format Validation", () => {
    it("validates MP4 binary magic header (ftyp at offset 4)", () => {
      // 4 bytes length + 'ftyp' + 4 bytes minor version
      const mp4Buffer = Buffer.from([
        0x00, 0x00, 0x00, 0x20, // box length 32
        0x66, 0x74, 0x79, 0x70, // 'ftyp'
        0x69, 0x73, 0x6f, 0x6d, // 'isom'
      ]);
      const res = validateVideoSignature(mp4Buffer);
      expect(res.valid).toBe(true);
    });

    it("validates MOV binary magic header (moov at offset 4)", () => {
      const movBuffer = Buffer.from([
        0x00, 0x00, 0x00, 0x20,
        0x6d, 0x6f, 0x6f, 0x76, // 'moov'
        0x00, 0x00, 0x00, 0x00,
      ]);
      const res = validateVideoSignature(movBuffer);
      expect(res.valid).toBe(true);
    });

    it("validates WebM binary magic header (EBML header 1A 45 DF A3)", () => {
      const webmBuffer = Buffer.from([
        0x1a, 0x45, 0xdf, 0xa3, // EBML
        0x9f, 0x42, 0x86, 0x81,
        0x01, 0x42, 0xf7, 0x81,
      ]);
      const res = validateVideoSignature(webmBuffer);
      expect(res.valid).toBe(true);
    });

    it("rejects non-video and corrupt buffers", () => {
      const textBuffer = Buffer.from("This is a plain text file pretending to be video");
      const res = validateVideoSignature(textBuffer);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Invalid video file signature");

      const tinyBuffer = Buffer.from([0x01, 0x02]);
      const resTiny = validateVideoSignature(tinyBuffer);
      expect(resTiny.valid).toBe(false);
      expect(resTiny.error).toContain("too small");
    });
  });

  describe("2. SSRF Guard & IP Validation", () => {
    it("identifies private and loopback IPv4 ranges", () => {
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("127.0.0.5")).toBe(true);
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("10.254.0.1")).toBe(true);
      expect(isPrivateIp("172.16.0.1")).toBe(true);
      expect(isPrivateIp("172.31.255.255")).toBe(true);
      expect(isPrivateIp("192.168.1.1")).toBe(true);
      expect(isPrivateIp("192.168.0.254")).toBe(true);
      expect(isPrivateIp("169.254.169.254")).toBe(true); // AWS/Cloud Metadata IP
      expect(isPrivateIp("0.0.0.0")).toBe(true);
      expect(isPrivateIp("::1")).toBe(true);
      expect(isPrivateIp("localhost")).toBe(true);

      // Public IP
      expect(isPrivateIp("8.8.8.8")).toBe(false);
      expect(isPrivateIp("1.1.1.1")).toBe(false);
      expect(isPrivateIp("104.26.10.1")).toBe(false);
    });

    it("rejects non-http(s) protocols", async () => {
      await expect(assertSsrfSafeUrl("file:///etc/passwd")).rejects.toThrow(
        /Forbidden protocol/
      );
      await expect(assertSsrfSafeUrl("ftp://files.example.com/test.jpg")).rejects.toThrow(
        /Forbidden protocol/
      );
      await expect(assertSsrfSafeUrl("javascript:alert(1)")).rejects.toThrow(
        /Forbidden protocol/
      );
    });

    it("rejects localhost and cloud metadata internal hostnames", async () => {
      await expect(assertSsrfSafeUrl("http://localhost:3000/image.jpg")).rejects.toThrow(
        /Forbidden target host/
      );
      await expect(assertSsrfSafeUrl("http://metadata.google.internal/computeMetadata/v1/")).rejects.toThrow(
        /Forbidden target host/
      );
      await expect(assertSsrfSafeUrl("http://internal-service.local/image.png")).rejects.toThrow(
        /Forbidden target host/
      );
    });

    it("allows valid public HTTPS URLs", async () => {
      const parsed = await assertSsrfSafeUrl("https://images.unsplash.com/photo-1521572267360");
      expect(parsed.hostname).toBe("images.unsplash.com");
      expect(parsed.protocol).toBe("https:");
    });
  });

  describe("3. Video Provider Factory & Adapter Switching", () => {
    const originalEnv = process.env.VIDEO_PROVIDER;

    afterAll(() => {
      process.env.VIDEO_PROVIDER = originalEnv;
      resetVideoProviderCache();
    });

    it("defaults to SupabaseVideoProvider", () => {
      delete process.env.VIDEO_PROVIDER;
      resetVideoProviderCache();
      const provider = getVideoProvider();
      expect(provider).toBeInstanceOf(SupabaseVideoProvider);
      expect(provider.name).toBe("supabase");
    });

    it("switches to BunnyStreamProvider via VIDEO_PROVIDER=bunny", () => {
      process.env.VIDEO_PROVIDER = "bunny";
      resetVideoProviderCache();
      const provider = getVideoProvider();
      expect(provider).toBeInstanceOf(BunnyStreamProvider);
      expect(provider.name).toBe("bunny");

      const playback = provider.getPlaybackUrl("test-guid-123");
      expect(playback).toContain("iframe.mediadelivery.net/play//test-guid-123");
    });

    it("switches to CloudflareStreamProvider via VIDEO_PROVIDER=cloudflare", () => {
      process.env.VIDEO_PROVIDER = "cloudflare";
      resetVideoProviderCache();
      const provider = getVideoProvider();
      expect(provider).toBeInstanceOf(CloudflareStreamProvider);
      expect(provider.name).toBe("cloudflare");

      const playback = provider.getPlaybackUrl("cf-video-guid-456");
      expect(playback).toContain("/cf-video-guid-456/manifest/video.m3u8");
    });
  });

  describe("4. Product Creation with Videos & Variant-Specific Images", () => {
    it("creates a product with mixed media (images + video reels) and per-variant image mapping", async () => {
      const productSlug = `reels-oversized-tee-${Date.now()}`;
      const productImages = [
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800",
        "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800",
      ];
      const productVideos = [
        {
          id: crypto.randomUUID(),
          url: "https://example.com/videos/oversized-tee-reel.mp4",
          posterUrl: "https://example.com/videos/oversized-tee-poster.webp",
          durationSeconds: 15,
        },
      ];

      const created = await createProductWithVariants(testBrand.id, {
        title: "Reels Oversized Heavyweight Tee",
        slug: productSlug,
        category: "T-Shirts",
        description: "Premium oversized tee showcased in high-definition video reel.",
        basePricePaise: 249900,
        compareAtPricePaise: 299900,
        images: productImages,
        videos: productVideos,
        featured: true,
        variants: [
          {
            sku: `ROHT-${Date.now()}-BLACK-M`,
            title: "Reels Oversized Tee - Black / M",
            pricePaise: 249900,
            stockQuantity: 40,
            attributes: {
              size: "M",
              color: "Black",
              images: [productImages[0]], // Variant-specific image
            },
          },
          {
            sku: `ROHT-${Date.now()}-WHITE-L`,
            title: "Reels Oversized Tee - White / L",
            pricePaise: 249900,
            stockQuantity: 25,
            attributes: {
              size: "L",
              color: "White",
              images: [productImages[1]], // Variant-specific image
            },
          },
        ],
      });

      expect(created.id).toBeDefined();
      expect(created.title).toBe("Reels Oversized Heavyweight Tee");

      // Verify videos column was persisted
      const savedVideos = (created as any).videos;
      expect(Array.isArray(savedVideos)).toBe(true);
      expect(savedVideos.length).toBe(1);
      expect(savedVideos[0].url).toBe("https://example.com/videos/oversized-tee-reel.mp4");
      expect(savedVideos[0].durationSeconds).toBe(15);

      // Verify variants persisted their respective variant images
      const productsWithVariants = await getAdminProductsWithVariants(testBrand.id);
      const match = productsWithVariants.find((p) => p.id === created.id);
      expect(match).toBeDefined();
      expect(match!.variants.length).toBe(2);

      const blackVar = match!.variants.find((v) => (v.attributes as any)?.color === "Black");
      expect(blackVar).toBeDefined();
      expect((blackVar!.attributes as any).images).toEqual([productImages[0]]);

      const whiteVar = match!.variants.find((v) => (v.attributes as any)?.color === "White");
      expect(whiteVar).toBeDefined();
      expect((whiteVar!.attributes as any).images).toEqual([productImages[1]]);
    });
  });

  describe("5. Bulk CSV Importer with Image URLs", () => {
    it("successfully parses product rows with image URLs", async () => {
      const csvRows = [
        {
          title: "Imported Graphic Reel Tee",
          slug: `imported-reel-tee-${Date.now()}`,
          category: "T-Shirts",
          description: "Bulk imported tee with images",
          base_price: "1899",
          sku: `IMP-TEE-${Date.now()}-S`,
          size: "S",
          stock_quantity: "50",
          images: "https://images.unsplash.com/photo-1521572267360, https://images.unsplash.com/photo-1503342217505",
        },
      ];

      const res = await importProductsCsv(testBrand.id, csvRows, {
        dryRun: false,
        filename: "test-reels-import.csv",
        rehostImages: false, // tests fast parse path
      });

      expect(res.importedCount).toBe(1);
      expect(res.failedCount).toBe(0);

      const items = await getAdminProductsWithVariants(testBrand.id);
      const imported = items.find((p) => p.title === "Imported Graphic Reel Tee");
      expect(imported).toBeDefined();
      expect((imported!.images as string[]).length).toBe(2);
    });
  });
});
