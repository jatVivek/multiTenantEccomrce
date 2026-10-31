import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * Returns a 32-byte encryption key buffer from process.env.KEY_VAULT_ENCRYPTION_KEY.
 * Falls back to a deterministic development key if not specified.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.KEY_VAULT_ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length === 64) {
      return Buffer.from(envKey, "hex");
    }
    // If not 64-hex chars, hash it with SHA-256 to ensure exact 32-byte length
    return crypto.createHash("sha256").update(envKey).digest();
  }
  // Development fallback
  return crypto.createHash("sha256").update("ecom-multitenant-dev-vault-secret-2026").digest();
}

/**
 * Masks a secret string showing only the last 4 characters, preceded by bullet characters.
 * E.g. "rzp_live_12345678" -> "••••••••5678"
 */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  const str = String(secret).trim();
  if (str.length <= 4) {
    return "••••";
  }
  const visible = str.slice(-4);
  return "••••••••" + visible;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns the hex encrypted value, iv, auth tag, and masked preview.
 */
export function encryptSecret(plainText: string): {
  encryptedValue: string;
  iv: string;
  authTag: string;
  maskedPreview: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encryptedValue: encrypted,
    iv: iv.toString("hex"),
    authTag,
    maskedPreview: maskSecret(plainText),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 */
export function decryptSecret(payload: {
  encryptedValue: string;
  iv: string;
  authTag: string;
}): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(payload.encryptedValue, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypts a JSON object (like per-brand credentials) with AES-256-GCM.
 */
export function encryptJson(data: Record<string, any>): {
  encryptedData: string;
  iv: string;
  authTag: string;
  maskedPreview: Record<string, string>;
} {
  const plainText = JSON.stringify(data);
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  const maskedPreview: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string") {
      maskedPreview[k] = maskSecret(v);
    } else {
      maskedPreview[k] = "••••";
    }
  }

  return {
    encryptedData: encrypted,
    iv: iv.toString("hex"),
    authTag,
    maskedPreview,
  };
}

/**
 * Decrypts an encrypted JSON payload.
 */
export function decryptJson<T = Record<string, any>>(payload: {
  encryptedData: string;
  iv: string;
  authTag: string;
}): T {
  const plainText = decryptSecret({
    encryptedValue: payload.encryptedData,
    iv: payload.iv,
    authTag: payload.authTag,
  });
  return JSON.parse(plainText) as T;
}

/**
 * Recursively sanitizes audit log payloads to ensure no secrets, keys, or passwords
 * are ever persisted in logs.
 */
export function sanitizeAuditDetails(obj: any): any {
  if (!obj || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeAuditDetails);
  }

  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lowerKey = k.toLowerCase();
    if (
      lowerKey.includes("key") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("password") ||
      lowerKey.includes("auth") ||
      lowerKey.includes("credential")
    ) {
      if (typeof v === "string") {
        sanitized[k] = maskSecret(v);
      } else {
        sanitized[k] = "[REDACTED]";
      }
    } else if (typeof v === "object" && v !== null) {
      sanitized[k] = sanitizeAuditDetails(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}
