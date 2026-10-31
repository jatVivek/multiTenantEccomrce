import dns from "dns/promises";
import net from "net";
import { validateImageSignature, stripExifMetadata, generateBlurPlaceholder } from "./validation";
import { getStorageProvider } from "./provider";

/**
 * Checks if an IP address falls in private, loopback, or cloud-metadata ranges.
 */
export function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "localhost") return true;

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link-local & AWS/Cloud Metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0
    if (parts[0] === 0) return true;
  }

  return false;
}

/**
 * Asserts that a URL is safe from SSRF attacks before any network request is made.
 */
export async function assertSsrfSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  // 1. Only allow http and https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Forbidden protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.`);
  }

  // 2. Reject obvious localhost / internal hostnames
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    throw new Error(`Forbidden target host: ${hostname}`);
  }

  // 3. Resolve DNS and verify IP address
  try {
    const lookup = await dns.lookup(hostname);
    if (isPrivateIp(lookup.address)) {
      throw new Error(`Target resolved to a private or loopback IP address (${lookup.address}). Blocked for security.`);
    }
  } catch (err: any) {
    if (err.message.includes("Target resolved")) throw err;
    // If DNS fails to resolve, abort
    throw new Error(`Failed to resolve host for image URL: ${hostname}`);
  }

  return parsed;
}

/**
 * Safely downloads a remote image, validates its binary signature,
 * strips EXIF metadata, and re-hosts it into the brand's isolated storage bucket.
 */
export async function ingestRemoteImageSafe(
  brandId: string,
  remoteUrl: string
): Promise<{ rehostedUrl: string; storagePath: string; sizeBytes: number; mime: string }> {
  // 1. SSRF Guard verification
  const validatedUrl = await assertSsrfSafeUrl(remoteUrl);

  // 2. Fetch remote image with timeout and 8 MB cap
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  let res: Response;
  try {
    res = await fetch(validatedUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "EcomBoutiquePlatform/1.0 (MediaIngestionBot)",
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch remote image: HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  let buffer = Buffer.from(arrayBuffer);

  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error(`Remote image exceeds 8 MB size limit (${(buffer.length / (1024 * 1024)).toFixed(1)} MB)`);
  }

  // 3. Binary magic number check
  const validation = validateImageSignature(buffer);
  if (!validation.valid || !validation.detectedMime) {
    throw new Error(validation.error || "Remote file is not a valid supported image");
  }

  // 4. Strip EXIF metadata
  const cleanBuffer: Buffer = stripExifMetadata(buffer);

  // 5. Re-host to brand storage
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  const ext = extMap[validation.detectedMime] || "webp";
  const storagePath = `brands/${brandId}/image/${crypto.randomUUID()}.${ext}`;

  const provider = getStorageProvider();
  const uploadRes = await provider.upload({
    path: storagePath,
    fileBuffer: cleanBuffer,
    contentType: validation.detectedMime,
  });

  return {
    rehostedUrl: uploadRes.publicUrl,
    storagePath: uploadRes.storagePath,
    sizeBytes: cleanBuffer.length,
    mime: validation.detectedMime,
  };
}
