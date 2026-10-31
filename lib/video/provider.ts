import { getStorageProvider, StorageProvider } from "@/lib/storage/provider";

export interface VideoUploadParams {
  brandId: string;
  filename: string;
  fileBuffer: Buffer;
  contentType: string;
  durationSeconds?: number;
  posterBuffer?: Buffer;
}

export interface VideoUploadResult {
  videoUrl: string;
  posterUrl: string;
  durationSeconds: number;
  storagePath: string;
  provider: "supabase" | "bunny" | "cloudflare" | "local";
  providerId?: string;
}

export interface VideoProvider {
  name: string;
  upload(params: VideoUploadParams): Promise<VideoUploadResult>;
  getPlaybackUrl(providerIdOrPath: string): string;
  delete(providerIdOrPath: string): Promise<boolean>;
}

/**
 * Default Video Provider: Stores videos and posters in Supabase Storage
 * (or LocalStorageProvider in development/test environments).
 */
export class SupabaseVideoProvider implements VideoProvider {
  public name = "supabase";
  private storage: StorageProvider;

  constructor(storage?: StorageProvider) {
    this.storage = storage || getStorageProvider();
  }

  async upload(params: VideoUploadParams): Promise<VideoUploadResult> {
    const ext = params.filename.split(".").pop()?.toLowerCase() || "mp4";
    const videoUuid = crypto.randomUUID();
    const videoPath = `brands/${params.brandId}/video/${videoUuid}.${ext}`;
    const posterPath = `brands/${params.brandId}/video/${videoUuid}-poster.webp`;

    // 1. Upload video file
    const videoUpload = await this.storage.upload({
      path: videoPath,
      fileBuffer: params.fileBuffer,
      contentType: params.contentType,
    });

    // 2. Upload poster frame (or fallback default poster)
    let posterUrl = videoUpload.publicUrl.replace(/\.[^/.]+$/, "-poster.webp");
    if (params.posterBuffer && params.posterBuffer.length > 0) {
      const posterUpload = await this.storage.upload({
        path: posterPath,
        fileBuffer: params.posterBuffer,
        contentType: "image/webp",
      });
      posterUrl = posterUpload.publicUrl;
    }

    return {
      videoUrl: videoUpload.publicUrl,
      posterUrl,
      durationSeconds: params.durationSeconds || 15,
      storagePath: videoUpload.storagePath,
      provider: "supabase",
    };
  }

  getPlaybackUrl(providerIdOrPath: string): string {
    if (providerIdOrPath.startsWith("http")) return providerIdOrPath;
    return this.storage.getPublicUrl(providerIdOrPath);
  }

  async delete(providerIdOrPath: string): Promise<boolean> {
    return await this.storage.delete(providerIdOrPath);
  }
}

/**
 * Bunny Stream Video Provider Stub
 * Fully typed adapter ready for Bunny Stream API.
 * Configured via BUNNY_STREAM_API_KEY and BUNNY_STREAM_LIBRARY_ID.
 */
export class BunnyStreamProvider implements VideoProvider {
  public name = "bunny";
  private apiKey: string;
  private libraryId: string;

  constructor(apiKey?: string, libraryId?: string) {
    this.apiKey = apiKey || process.env.BUNNY_STREAM_API_KEY || "";
    this.libraryId = libraryId || process.env.BUNNY_STREAM_LIBRARY_ID || "";
  }

  async upload(params: VideoUploadParams): Promise<VideoUploadResult> {
    if (!this.apiKey || !this.libraryId) {
      // Gracefully fall back to Supabase/Local if credentials missing in test environment
      const fallback = new SupabaseVideoProvider();
      return fallback.upload(params);
    }

    // Bunny Stream API: 1. Create Video -> 2. Upload Binary
    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${this.libraryId}/videos`,
      {
        method: "POST",
        headers: {
          AccessKey: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: params.filename }),
      }
    );

    if (!createRes.ok) {
      throw new Error(`Bunny Stream create failed: ${await createRes.text()}`);
    }

    const videoData: any = await createRes.json();
    const videoGuid = videoData.guid;

    // Upload video binary
    const uploadRes = await fetch(
      `https://video.bunnycdn.com/library/${this.libraryId}/videos/${videoGuid}`,
      {
        method: "PUT",
        headers: {
          AccessKey: this.apiKey,
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(params.fileBuffer),
      }
    );

    if (!uploadRes.ok) {
      throw new Error(`Bunny Stream binary upload failed: ${await uploadRes.text()}`);
    }

    const pullZone = process.env.BUNNY_STREAM_PULL_ZONE || "iframe.mediadelivery.net";
    return {
      videoUrl: `https://${pullZone}/play/${this.libraryId}/${videoGuid}`,
      posterUrl: `https://${pullZone}/${videoGuid}/thumbnail.jpg`,
      durationSeconds: params.durationSeconds || 15,
      storagePath: `bunny://${this.libraryId}/${videoGuid}`,
      provider: "bunny",
      providerId: videoGuid,
    };
  }

  getPlaybackUrl(providerIdOrPath: string): string {
    const pullZone = process.env.BUNNY_STREAM_PULL_ZONE || "iframe.mediadelivery.net";
    return `https://${pullZone}/play/${this.libraryId}/${providerIdOrPath}`;
  }

  async delete(providerIdOrPath: string): Promise<boolean> {
    if (!this.apiKey || !this.libraryId) return true;
    const res = await fetch(
      `https://video.bunnycdn.com/library/${this.libraryId}/videos/${providerIdOrPath}`,
      {
        method: "DELETE",
        headers: { AccessKey: this.apiKey },
      }
    );
    return res.ok;
  }
}

/**
 * Cloudflare Stream Video Provider Stub
 * Fully typed adapter ready for Cloudflare Stream API.
 * Configured via CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN.
 */
export class CloudflareStreamProvider implements VideoProvider {
  public name = "cloudflare";
  private accountId: string;
  private apiToken: string;

  constructor(accountId?: string, apiToken?: string) {
    this.accountId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID || "";
    this.apiToken = apiToken || process.env.CLOUDFLARE_STREAM_API_TOKEN || "";
  }

  async upload(params: VideoUploadParams): Promise<VideoUploadResult> {
    if (!this.accountId || !this.apiToken) {
      // Fallback
      const fallback = new SupabaseVideoProvider();
      return fallback.upload(params);
    }

    const form = new FormData();
    const blob = new Blob([new Uint8Array(params.fileBuffer)], { type: params.contentType });
    form.append("file", blob, params.filename);

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: form,
      }
    );

    if (!res.ok) {
      throw new Error(`Cloudflare Stream upload failed: ${await res.text()}`);
    }

    const data: any = await res.json();
    const uid = data.result?.uid;

    return {
      videoUrl: `https://customer-${this.accountId}.cloudflarestream.com/${uid}/manifest/video.m3u8`,
      posterUrl: `https://customer-${this.accountId}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`,
      durationSeconds: params.durationSeconds || Math.round(data.result?.duration || 15),
      storagePath: `cloudflare://${this.accountId}/${uid}`,
      provider: "cloudflare",
      providerId: uid,
    };
  }

  getPlaybackUrl(providerIdOrPath: string): string {
    return `https://customer-${this.accountId}.cloudflarestream.com/${providerIdOrPath}/manifest/video.m3u8`;
  }

  async delete(providerIdOrPath: string): Promise<boolean> {
    if (!this.accountId || !this.apiToken) return true;
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/${providerIdOrPath}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.apiToken}` },
      }
    );
    return res.ok;
  }
}

/**
 * Factory to get the active VideoProvider based on environment variable VIDEO_PROVIDER.
 * Defaults to SupabaseVideoProvider.
 */
let cachedVideoProvider: VideoProvider | null = null;

export function resetVideoProviderCache() {
  cachedVideoProvider = null;
}

export function getVideoProvider(): VideoProvider {
  if (cachedVideoProvider) return cachedVideoProvider;

  const providerType = (process.env.VIDEO_PROVIDER || "supabase").toLowerCase();

  if (providerType === "bunny") {
    cachedVideoProvider = new BunnyStreamProvider();
  } else if (providerType === "cloudflare") {
    cachedVideoProvider = new CloudflareStreamProvider();
  } else {
    cachedVideoProvider = new SupabaseVideoProvider();
  }

  return cachedVideoProvider;
}
