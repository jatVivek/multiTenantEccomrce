import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import type { AdminUser } from "../db/schema";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_multitenant_development";
const SALT_ROUNDS = 10;

export interface TokenPayload {
  userId: string;
  email: string;
  role: "SUPER_ADMIN" | "BRAND_ADMIN";
}

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function generateToken(user: AdminUser): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
