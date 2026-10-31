import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_multitenant_development";
const SALT_ROUNDS = 10;

export interface CustomerTokenPayload {
  customerId: string;
  brandId: string;
  email: string;
  name: string;
  role: "CUSTOMER";
}

export async function hashCustomerPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyCustomerPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function generateCustomerToken(customer: {
  id: string;
  brandId: string;
  email: string;
  name: string;
}): string {
  const payload: CustomerTokenPayload = {
    customerId: customer.id,
    brandId: customer.brandId,
    email: customer.email,
    name: customer.name,
    role: "CUSTOMER",
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyCustomerToken(token: string): CustomerTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as CustomerTokenPayload;
    if (payload.role !== "CUSTOMER") return null;
    return payload;
  } catch {
    return null;
  }
}
