import { db } from "@/src/db";
import { customers, orders, type Customer, type Order } from "@/src/db/schema";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { hashCustomerPassword, verifyCustomerPassword } from "@/lib/customer-auth";
import crypto from "crypto";

export interface SavedAddress {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export async function findCustomerByEmail(
  brandId: string,
  email: string
): Promise<Customer | null> {
  const cleanEmail = email.toLowerCase().trim();
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.brandId, brandId), eq(customers.email, cleanEmail)))
    .limit(1);

  return customer || null;
}

export async function findCustomerById(
  brandId: string,
  customerId: string
): Promise<Customer | null> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.brandId, brandId), eq(customers.id, customerId)))
    .limit(1);

  return customer || null;
}

export async function createCustomer(
  brandId: string,
  input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }
): Promise<Omit<Customer, "passwordHash">> {
  const cleanEmail = input.email.toLowerCase().trim();
  const cleanName = input.name.trim();
  const cleanPhone = input.phone?.trim() || null;

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  if (!input.password || input.password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }
  if (!cleanName) {
    throw new Error("Please enter your name.");
  }

  const existing = await findCustomerByEmail(brandId, cleanEmail);
  if (existing) {
    throw new Error("An account with this email address already exists.");
  }

  const passwordHash = await hashCustomerPassword(input.password);

  const [newCustomer] = await db
    .insert(customers)
    .values({
      brandId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      savedAddresses: [],
    })
    .returning();

  const { passwordHash: _, ...safeCustomer } = newCustomer;
  return safeCustomer;
}

export async function verifyCustomerCredentials(
  brandId: string,
  email: string,
  password: string
): Promise<Omit<Customer, "passwordHash"> | null> {
  const customer = await findCustomerByEmail(brandId, email);
  if (!customer) return null;

  const valid = await verifyCustomerPassword(password, customer.passwordHash);
  if (!valid) return null;

  const { passwordHash: _, ...safeCustomer } = customer;
  return safeCustomer;
}

export async function updateCustomerProfile(
  brandId: string,
  customerId: string,
  input: {
    name?: string;
    phone?: string;
  }
): Promise<Omit<Customer, "passwordHash">> {
  const customer = await findCustomerById(brandId, customerId);
  if (!customer) throw new Error("Customer account not found.");

  const updates: Record<string, any> = {
    updatedAt: sql`now()`,
  };

  if (input.name) updates.name = input.name.trim();
  if (input.phone !== undefined) updates.phone = input.phone ? input.phone.trim() : null;

  const [updated] = await db
    .update(customers)
    .set(updates)
    .where(and(eq(customers.brandId, brandId), eq(customers.id, customerId)))
    .returning();

  const { passwordHash: _, ...safeCustomer } = updated;
  return safeCustomer;
}

export async function addCustomerSavedAddress(
  brandId: string,
  customerId: string,
  address: Omit<SavedAddress, "id">
): Promise<SavedAddress[]> {
  const customer = await findCustomerById(brandId, customerId);
  if (!customer) throw new Error("Customer account not found.");

  const existing = (customer.savedAddresses as SavedAddress[]) || [];
  const newAddress: SavedAddress = {
    ...address,
    id: crypto.randomUUID(),
    isDefault: existing.length === 0 ? true : !!address.isDefault,
  };

  const updatedAddresses = newAddress.isDefault
    ? [...existing.map((a) => ({ ...a, isDefault: false })), newAddress]
    : [...existing, newAddress];

  await db
    .update(customers)
    .set({
      savedAddresses: updatedAddresses,
      updatedAt: sql`now()`,
    })
    .where(and(eq(customers.brandId, brandId), eq(customers.id, customerId)));

  return updatedAddresses;
}

export async function deleteCustomerSavedAddress(
  brandId: string,
  customerId: string,
  addressId: string
): Promise<SavedAddress[]> {
  const customer = await findCustomerById(brandId, customerId);
  if (!customer) throw new Error("Customer account not found.");

  const existing = (customer.savedAddresses as SavedAddress[]) || [];
  const updatedAddresses = existing.filter((a) => a.id !== addressId);

  // If we deleted default, set first remaining as default
  if (updatedAddresses.length > 0 && !updatedAddresses.some((a) => a.isDefault)) {
    updatedAddresses[0].isDefault = true;
  }

  await db
    .update(customers)
    .set({
      savedAddresses: updatedAddresses,
      updatedAt: sql`now()`,
    })
    .where(and(eq(customers.brandId, brandId), eq(customers.id, customerId)));

  return updatedAddresses;
}

export async function getCustomerOrderHistory(
  brandId: string,
  customerPhone?: string | null,
  customerEmail?: string | null
): Promise<Order[]> {
  const conditions = [];

  if (customerPhone && customerPhone.trim()) {
    conditions.push(eq(orders.customerPhone, customerPhone.trim()));
  }

  if (customerEmail && customerEmail.trim()) {
    conditions.push(sql`${orders.deliveryAddress}->>'email' = ${customerEmail.toLowerCase().trim()}`);
  }

  if (conditions.length === 0) {
    return [];
  }

  return await db
    .select()
    .from(orders)
    .where(and(eq(orders.brandId, brandId), or(...conditions)))
    .orderBy(desc(orders.createdAt));
}

export async function cancelCustomerOrder(
  brandId: string,
  orderId: string,
  customerPhone?: string | null,
  customerEmail?: string | null
): Promise<Order> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.brandId, brandId), eq(orders.id, orderId)))
    .limit(1);

  if (!order) {
    throw new Error("Order not found.");
  }

  // Verify that the order belongs to this customer
  const phoneMatch = customerPhone && order.customerPhone === customerPhone.trim();
  const emailInAddress = (order.deliveryAddress as any)?.email;
  const emailMatch =
    customerEmail && emailInAddress && emailInAddress.toLowerCase() === customerEmail.toLowerCase().trim();

  if (!phoneMatch && !emailMatch) {
    throw new Error("Access Denied: You cannot cancel an order that belongs to another customer.");
  }

  // Only allow cancellation if order has not yet been packed or dispatched
  if (order.status !== "RECEIVED") {
    throw new Error(
      `Order #${order.orderNumber} cannot be cancelled because it is already ${order.status.toLowerCase()}. Please contact customer support.`
    );
  }

  const [updated] = await db
    .update(orders)
    .set({
      status: "CANCELLED",
      updatedAt: sql`now()`,
    })
    .where(and(eq(orders.brandId, brandId), eq(orders.id, orderId)))
    .returning();

  return updated;
}

export async function createPasswordResetToken(
  brandId: string,
  email: string
): Promise<{ token: string; expiresAt: Date }> {
  const customer = await findCustomerByEmail(brandId, email);
  if (!customer) {
    throw new Error("No account found with this email address.");
  }

  // 6-digit numeric reset code for easy manual entry or verification
  const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .update(customers)
    .set({
      resetToken,
      resetTokenExpiresAt: expiresAt.toISOString(),
      updatedAt: sql`now()`,
    })
    .where(and(eq(customers.brandId, brandId), eq(customers.id, customer.id)));

  return { token: resetToken, expiresAt };
}

export async function resetCustomerPasswordWithToken(
  brandId: string,
  email: string,
  token: string,
  newPassword: string
): Promise<boolean> {
  const cleanEmail = email.toLowerCase().trim();
  const cleanToken = token.trim();

  if (!newPassword || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }

  const customer = await findCustomerByEmail(brandId, cleanEmail);
  if (!customer) {
    throw new Error("Invalid request or customer not found.");
  }

  if (!customer.resetToken || customer.resetToken !== cleanToken) {
    throw new Error("Invalid reset code. Please check your email or request a new code.");
  }

  if (!customer.resetTokenExpiresAt || new Date(customer.resetTokenExpiresAt) < new Date()) {
    throw new Error("Reset code has expired. Please request a new one.");
  }

  const passwordHash = await hashCustomerPassword(newPassword);

  await db
    .update(customers)
    .set({
      passwordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(customers.brandId, brandId), eq(customers.id, customer.id)));

  return true;
}
