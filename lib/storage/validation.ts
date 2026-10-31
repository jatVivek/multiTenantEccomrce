/**
 * Supported MIME types and extensions
 */
export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

export interface FileSignatureValidation {
  valid: boolean;
  detectedMime?: AllowedImageMime;
  error?: string;
}

/**
 * Validates the true binary magic numbers of a buffer.
 * Rejects disguised executables, scripts, and un-sanitized SVGs.
 */
export function validateImageSignature(buffer: Buffer): FileSignatureValidation {
  if (!buffer || buffer.length < 12) {
    return { valid: false, error: "File buffer is too short to be a valid image." };
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: "image/jpeg" };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: "image/png" };
  }

  // 3. WebP: RIFF .... WEBP
  // 'RIFF' at 0..3 (0x52, 0x49, 0x46, 0x46) and 'WEBP' at 8..11 (0x57, 0x45, 0x42, 0x50)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, detectedMime: "image/webp" };
  }

  // 4. AVIF: 'ftyp' at 4..7 and 'avif' / 'avis' at 8..11
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70 &&
    (buffer.toString("ascii", 8, 12).includes("avif") ||
      buffer.toString("ascii", 8, 12).includes("avis"))
  ) {
    return { valid: true, detectedMime: "image/avif" };
  }

  // Check if someone uploaded SVG (XML/HTML script injection vector)
  const headerText = buffer.slice(0, 100).toString("utf8").toLowerCase();
  if (headerText.includes("<svg") || headerText.includes("<?xml") || headerText.includes("<html")) {
    return {
      valid: false,
      error: "SVG and XML images are disallowed due to script security vectors. Please upload WebP, JPEG, PNG, or AVIF.",
    };
  }

  return {
    valid: false,
    error: "Invalid or unsupported file format. Allowed formats: JPEG, PNG, WebP, AVIF.",
  };
}

/**
 * Validates video binary magic bytes:
 * MP4 / MOV: 'ftyp' or 'moov' at bytes 4..8
 * WebM: 1A 45 DF A3 (EBML header)
 */
export function validateVideoSignature(buffer: Buffer): { valid: boolean; error?: string } {
  if (!buffer || buffer.length < 12) {
    return { valid: false, error: "Buffer is too small to be a valid video." };
  }

  // WebM: 0x1A, 0x45, 0xDF, 0xA3
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { valid: true };
  }

  // MP4 / MOV: 'ftyp' or 'moov' at offset 4..8
  const marker = buffer.slice(4, 8).toString("ascii");
  if (marker === "ftyp" || marker === "moov") {
    return { valid: true };
  }

  return { valid: false, error: "Invalid video file signature. Supported formats: MP4, WebM, MOV." };
}

/**
 * Strips EXIF metadata from JPEG files to protect user privacy (GPS coordinates, device ID, etc.).
 * In WebP and PNG, canvas compression inherently strips EXIF on the client.
 */
export function stripExifMetadata(buffer: Buffer): Buffer {
  // If JPEG, look for APP1 marker (0xFF, 0xE1) containing EXIF and excise it
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    let offset = 2;
    while (offset < buffer.length - 4) {
      if (buffer[offset] === 0xff && buffer[offset + 1] === 0xe1) {
        // Found APP1 EXIF marker
        const length = buffer.readUInt16BE(offset + 2);
        const before = buffer.slice(0, offset);
        const after = buffer.slice(offset + 2 + length);
        return Buffer.concat([before, after]);
      }
      offset++;
    }
  }
  return buffer;
}

/**
 * Generates a lightweight, standard base64 blur Data URL for Next.js image LQIP placeholders.
 */
export function generateBlurPlaceholder(baseColorHex = "#27272a"): string {
  // Ultra-compact 10x10 WebP data URL
  return "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoKAAoAPm0wlkukKSQipCAA4CYJaQAA3b/xAA==";
}

/**
 * Extracts approximate image dimensions from binary header.
 */
export function extractImageDimensions(
  buffer: Buffer,
  mime: AllowedImageMime
): { width: number; height: number } {
  try {
    if (mime === "image/png" && buffer.length >= 24) {
      // PNG width and height are 4-byte integers at offset 16 and 20
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    if (mime === "image/jpeg") {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] === 0xff) {
          const marker = buffer[offset + 1];
          // SOF0, SOF1, SOF2 markers
          if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
          }
          const length = buffer.readUInt16BE(offset + 2);
          offset += 2 + length;
        } else {
          offset++;
        }
      }
    }
  } catch {
    // Fall back to standard defaults if extraction fails
  }

  return { width: 1200, height: 1200 };
}
