import fs from "fs";
import path from "path";

export interface StorageUploadParams {
  path: string;
  fileBuffer: Buffer;
  contentType: string;
}

export interface SignedUploadUrlParams {
  path: string;
  contentType: string;
  maxSizeBytes: number;
}

export interface StorageProvider {
  upload(params: StorageUploadParams): Promise<{ publicUrl: string; storagePath: string }>;
  delete(storagePath: string): Promise<boolean>;
  getPublicUrl(storagePath: string): string;
  createSignedUploadUrl(
    params: SignedUploadUrlParams
  ): Promise<{ uploadUrl: string; token?: string; storagePath: string; publicUrl: string }>;
}

/**
 * Local filesystem implementation for development, offline testing, and preview environments.
 * Stores files under public/uploads/...
 */
export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private baseUrl: string;

  constructor(baseDir?: string, baseUrl?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), "public", "uploads");
    this.baseUrl = baseUrl || "/uploads";
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch {
        // ignore
      }
    }
  }

  async upload(params: StorageUploadParams): Promise<{ publicUrl: string; storagePath: string }> {
    const fullPath = path.join(this.baseDir, params.path);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(fullPath, params.fileBuffer);
    return {
      publicUrl: this.getPublicUrl(params.path),
      storagePath: params.path,
    };
  }

  async delete(storagePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.baseDir, storagePath);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(storagePath: string): string {
    // If running in browser or Next.js, return /uploads/...
    const cleanPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
    return `${this.baseUrl}/${cleanPath}`;
  }

  async createSignedUploadUrl(
    params: SignedUploadUrlParams
  ): Promise<{ uploadUrl: string; token?: string; storagePath: string; publicUrl: string }> {
    // For local provider, direct upload endpoint in Next.js router
    return {
      uploadUrl: `/api/admin/media/direct-upload?path=${encodeURIComponent(params.path)}`,
      token: `local_upload_token_${Date.now()}`,
      storagePath: params.path,
      publicUrl: this.getPublicUrl(params.path),
    };
  }
}

/**
 * Supabase Storage Provider (S3-compatible REST API)
 */
export class SupabaseStorageProvider implements StorageProvider {
  private supabaseUrl: string;
  private serviceKey: string;
  private bucket: string;

  constructor(supabaseUrl: string, serviceKey: string, bucket = "media") {
    this.supabaseUrl = supabaseUrl.replace(/\/$/, "");
    this.serviceKey = serviceKey;
    this.bucket = bucket;
  }

  getPublicUrl(storagePath: string): string {
    const cleanPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${cleanPath}`;
  }

  async upload(params: StorageUploadParams): Promise<{ publicUrl: string; storagePath: string }> {
    const cleanPath = params.path.startsWith("/") ? params.path.slice(1) : params.path;
    const url = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${cleanPath}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        "Content-Type": params.contentType,
        "x-upsert": "true",
      },
      body: new Uint8Array(params.fileBuffer),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase Storage upload failed (${res.status}): ${errText}`);
    }

    return {
      publicUrl: this.getPublicUrl(cleanPath),
      storagePath: cleanPath,
    };
  }

  async delete(storagePath: string): Promise<boolean> {
    const cleanPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
    const url = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${cleanPath}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
      },
    });

    return res.ok;
  }

  async createSignedUploadUrl(
    params: SignedUploadUrlParams
  ): Promise<{ uploadUrl: string; token?: string; storagePath: string; publicUrl: string }> {
    const cleanPath = params.path.startsWith("/") ? params.path.slice(1) : params.path;
    const url = `${this.supabaseUrl}/storage/v1/object/upload/sign/${this.bucket}/${cleanPath}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 900 }), // 15 mins
    });

    if (!res.ok) {
      throw new Error(`Failed to create signed upload URL: ${await res.text()}`);
    }

    const data: any = await res.json();
    const signedUrl = `${this.supabaseUrl}/storage/v1${data.url}`;

    return {
      uploadUrl: signedUrl,
      token: data.token,
      storagePath: cleanPath,
      publicUrl: this.getPublicUrl(cleanPath),
    };
  }
}

/**
 * Returns the active storage provider. Defaults to Supabase when credentials exist,
 * otherwise LocalStorageProvider.
 */
let cachedProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cachedProvider) return cachedProvider;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "brand-assets";

  if (supabaseUrl && serviceKey) {
    cachedProvider = new SupabaseStorageProvider(supabaseUrl, serviceKey, bucket);
  } else {
    cachedProvider = new LocalStorageProvider();
  }

  return cachedProvider;
}
