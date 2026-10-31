"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import {
  createCustomer,
  verifyCustomerCredentials,
  findCustomerById,
  updateCustomerProfile,
  addCustomerSavedAddress,
  deleteCustomerSavedAddress,
  getCustomerOrderHistory,
  cancelCustomerOrder,
  createPasswordResetToken,
  resetCustomerPasswordWithToken,
  type SavedAddress,
} from "@/lib/db/queries/customers";
import { generateCustomerToken, verifyCustomerToken, type CustomerTokenPayload } from "@/lib/customer-auth";

function getCookieName(brandId: string) {
  return `customer_token_${brandId}`;
}

export async function getCurrentCustomer(brandId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName(brandId))?.value;
  if (!token) return null;

  const payload = verifyCustomerToken(token);
  if (!payload || payload.brandId !== brandId) return null;

  const customer = await findCustomerById(brandId, payload.customerId);
  if (!customer) return null;

  const { passwordHash: _, ...safeCustomer } = customer;
  return safeCustomer;
}

export async function signUpCustomerAction(
  brandSlug: string,
  data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }
) {
  try {
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) return { ok: false, error: "Brand not found." };

    const customer = await createCustomer(brand.id, data);
    const token = generateCustomerToken({
      id: customer.id,
      brandId: brand.id,
      email: customer.email,
      name: customer.name,
    });

    const cookieStore = await cookies();
    cookieStore.set(getCookieName(brand.id), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    revalidatePath(`/${brandSlug}`);
    revalidatePath(`/${brandSlug}/account`);
    revalidatePath(`/${brandSlug}/account/orders`);
    return { ok: true, customer };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to create account." };
  }
}

export async function loginCustomerAction(
  brandSlug: string,
  data: {
    email: string;
    password: string;
  }
) {
  try {
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) return { ok: false, error: "Brand not found." };

    const customer = await verifyCustomerCredentials(brand.id, data.email, data.password);
    if (!customer) {
      return { ok: false, error: "Invalid email or password. Please try again." };
    }

    const token = generateCustomerToken({
      id: customer.id,
      brandId: brand.id,
      email: customer.email,
      name: customer.name,
    });

    const cookieStore = await cookies();
    cookieStore.set(getCookieName(brand.id), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    revalidatePath(`/${brandSlug}`);
    revalidatePath(`/${brandSlug}/account`);
    revalidatePath(`/${brandSlug}/account/orders`);
    return { ok: true, customer };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to sign in." };
  }
}

export async function logoutCustomerAction(brandSlug: string) {
  try {
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) return { ok: false, error: "Brand not found." };

    const cookieStore = await cookies();
    cookieStore.delete(getCookieName(brand.id));

    revalidatePath(`/${brandSlug}`);
    revalidatePath(`/${brandSlug}/account`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to sign out." };
  }
}

export async function updateCustomerProfileAction(
  brandSlug: string,
  data: {
    name?: string;
    phone?: string;
  }
) {
  try {
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) return { ok: false, error: "Brand not found." };

    const current = await getCurrentCustomer(brand.id);
    if (!current) return { ok: false, error: "Please sign in to update profile." };

    const updated = await updateCustomerProfile(brand.id, current.id, data);
    revalidatePath(`/${brandSlug}/account`);
    return { ok: true, customer: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update profile." };
  }
}

export async function addCustomerAddressAction(
  brandSlug: string,
  address: Omit<SavedAddress, "id">
) {
  try {
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) return { ok: false, error: "Brand not found." };

    const current = await getCurrentCustomer(brand.id);
    if (!current) return { ok: false, error: "Please sign in to save address." };

    const addresses = await addCustomerSavedAddress(brand.id, current.id, address);
    revalidatePath(`/${brandSlug}/account`);
    revalidatePath(`/${brandSlug}/checkout`);
    return { ok: true, addresses };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to save address." };
  }
}

export async function deleteCustomerAddressAction(
  brandSlug: string,
  addressId: string
) {
  try {
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) return { ok: false, error: "Brand not found." };

    const current = await getCurrentCustomer(brand.id);
    if (!current) return { ok: false, error: "Please sign in to delete address." };

    const addresses = await deleteCustomerSavedAddress(brand.id, current.id, addressId);
    revalidatePath(`/${brandSlug}/account`);
    revalidatePath(`/${brandSlug}/checkout`);
    return { ok: true, addresses };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to delete address." };
  }
}

export async function cancelCustomerOrderAction(
  brandSlug: string,
  orderId: string
) {
  try {
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) return { ok: false, error: "Brand not found." };

    const current = await getCurrentCustomer(brand.id);
    if (!current) return { ok: false, error: "Please sign in to manage orders." };

    const cancelledOrder = await cancelCustomerOrder(
      brand.id,
      orderId,
      current.phone,
      current.email
    );

    revalidatePath(`/${brandSlug}/account/orders`);
    revalidatePath(`/${brandSlug}/orders/${orderId}`);
    return { ok: true, order: cancelledOrder };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to cancel order." };
  }
}

export async function requestPasswordResetAction(
  brandSlug: string,
  email: string
) {
  try {
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) return { ok: false, error: "Brand not found." };

    const result = await createPasswordResetToken(brand.id, email);
    // In production, send via email or WhatsApp. In dev / demo, return the token for convenience:
    return {
      ok: true,
      message: `Password reset code sent. (Dev preview code: ${result.token})`,
      devCode: result.token,
    };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to request password reset." };
  }
}

export async function submitPasswordResetAction(
  brandSlug: string,
  data: {
    email: string;
    token: string;
    newPassword: string;
  }
) {
  try {
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) return { ok: false, error: "Brand not found." };

    await resetCustomerPasswordWithToken(brand.id, data.email, data.token, data.newPassword);
    return { ok: true, message: "Password reset successful! You can now sign in with your new password." };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to reset password." };
  }
}
