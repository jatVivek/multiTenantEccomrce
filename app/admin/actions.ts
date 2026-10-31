"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  getAdminByEmail,
  verifyAdminBrandAccess,
  updateOrderStatusAdmin,
  createProductWithVariants,
  updateProductWithVariants,
  updateProductVariantStockAndPrice,
  deleteProductAdmin,
  importProductsCsv,
  undoImportBatch,
  updateOrderFulfillmentAdmin,
  updateBrandThemeConfig,
  type CreateProductInput,
  type UpdateProductInput,
  type CsvProductRow,
} from "@/lib/db/queries/admin";
import { verifyPassword, generateToken, verifyToken } from "@/src/lib/auth";
import { assertFeatureGate } from "@/lib/platform/feature-gate";
import { z } from "zod";

export async function loginAdminAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const record = await getAdminByEmail(email);
  if (!record) {
    return { error: "Invalid email or password" };
  }

  const isValid = await verifyPassword(password, record.passwordHash);
  if (!isValid) {
    return { error: "Invalid email or password" };
  }

  const token = generateToken(record.user);

  const cookieStore = await cookies();
  cookieStore.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  redirect("/admin");
}

export async function logoutAdminAction() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_token");
  redirect("/admin/login");
}

export async function updateOrderStatusAction(
  brandId: string,
  orderId: string,
  newStatus: "RECEIVED" | "PACKED" | "DISPATCHED" | "DELIVERED" | "CANCELLED"
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) {
    throw new Error("Authentication required");
  }

  const payload = verifyToken(token);
  if (!payload) {
    throw new Error("Invalid or expired session");
  }

  // Strict tenant isolation check inside server action
  const hasAccess = await verifyAdminBrandAccess(
    payload.userId,
    payload.role,
    brandId
  );

  if (!hasAccess) {
    throw new Error("Access Denied: You do not have permission to manage this brand");
  }

  const updatedOrder = await updateOrderStatusAdmin(brandId, orderId, newStatus);
  revalidatePath("/admin");

  return { success: true, order: updatedOrder };
}

const CreateProductSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  category: z.string().default("Apparel"),
  description: z.string().optional(),
  basePricePaise: z.number().int().positive("Price must be positive"),
  compareAtPricePaise: z.number().int().optional().nullable(),
  images: z.array(z.string()).default([]),
  videos: z
    .array(
      z.object({
        id: z.string().optional(),
        url: z.string(),
        posterUrl: z.string().optional(),
        durationSeconds: z.number().optional(),
      })
    )
    .default([]),
  featured: z.boolean().default(false),
  variants: z
    .array(
      z.object({
        sku: z.string().min(1, "SKU is required"),
        title: z.string().min(1, "Variant title is required"),
        pricePaise: z.number().int().positive(),
        stockQuantity: z.number().int().min(0),
        attributes: z.record(z.string(), z.any()).optional(),
      })
    )
    .min(1, "At least one variant is required"),
});

export async function createProductAction(brandId: string, rawInput: any) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token) return { ok: false, error: "Authentication required" };

    const payload = verifyToken(token);
    if (!payload) return { ok: false, error: "Invalid or expired session" };

    const hasAccess = await verifyAdminBrandAccess(
      payload.userId,
      payload.role,
      brandId
    );
    if (!hasAccess) {
      return { ok: false, error: "Access Denied: You do not have permission to manage this brand" };
    }

    // Enforce server-side feature gate & product quota
    await assertFeatureGate(brandId, "product_limit", 1);

    const parsed = CreateProductSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Validation failed" };
    }

    const created = await createProductWithVariants(brandId, {
      ...parsed.data,
      compareAtPricePaise: parsed.data.compareAtPricePaise ?? undefined,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    try {
      revalidateTag(`brand:${brandId}:products`, "max");
    } catch {
      // ignore in tests/non-request environments
    }
    return { ok: true, data: created };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to create product" };
  }
}

export async function updateProductAction(
  brandId: string,
  productId: string,
  data: UpdateProductInput
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token) return { ok: false, error: "Authentication required" };

    const payload = verifyToken(token);
    if (!payload) return { ok: false, error: "Invalid or expired session" };

    const hasAccess = await verifyAdminBrandAccess(
      payload.userId,
      payload.role,
      brandId
    );
    if (!hasAccess) {
      return { ok: false, error: "Access Denied: You do not have permission to manage this brand" };
    }

    const updated = await updateProductWithVariants(brandId, productId, data);

    revalidatePath("/admin");
    revalidatePath("/admin/products");
    try {
      revalidateTag(`brand:${brandId}:products`, "max");
    } catch {
      // ignore in tests/non-request environments
    }

    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update product" };
  }
}

export async function updateVariantStockAction(
  brandId: string,
  variantId: string,
  stockQuantity: number,
  pricePaise?: number
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token) return { ok: false, error: "Authentication required" };

    const payload = verifyToken(token);
    if (!payload) return { ok: false, error: "Invalid or expired session" };

    const hasAccess = await verifyAdminBrandAccess(
      payload.userId,
      payload.role,
      brandId
    );
    if (!hasAccess) {
      return { ok: false, error: "Access Denied: You do not have permission to manage this brand" };
    }

    const updated = await updateProductVariantStockAndPrice(
      brandId,
      variantId,
      pricePaise,
      stockQuantity
    );
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    try {
      revalidateTag(`brand:${brandId}:products`, "max");
    } catch {
      // ignore
    }
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update variant" };
  }
}

export async function deleteProductAction(brandId: string, productId: string) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token) return { ok: false, error: "Authentication required" };

    const payload = verifyToken(token);
    if (!payload) return { ok: false, error: "Invalid or expired session" };

    const hasAccess = await verifyAdminBrandAccess(
      payload.userId,
      payload.role,
      brandId
    );
    if (!hasAccess) {
      return { ok: false, error: "Access Denied: You do not have permission to manage this brand" };
    }

    await deleteProductAdmin(brandId, productId);
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    try {
      revalidateTag(`brand:${brandId}:products`, "max");
    } catch {
      // ignore
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to delete product" };
  }
}

export async function importProductsCsvAction(
  brandId: string,
  rows: CsvProductRow[],
  options: { dryRun?: boolean; filename?: string; rehostImages?: boolean } = {}
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token) return { ok: false, error: "Authentication required" };

    const payload = verifyToken(token);
    if (!payload) return { ok: false, error: "Invalid or expired session" };

    const hasAccess = await verifyAdminBrandAccess(
      payload.userId,
      payload.role,
      brandId
    );
    if (!hasAccess) {
      return { ok: false, error: "Access Denied: You do not have permission to manage this brand" };
    }

    // Enforce server-side feature gate for bulk importer & product quotas
    await assertFeatureGate(brandId, "bulk_importer", 1);
    if (!options.dryRun && rows.length > 0) {
      await assertFeatureGate(brandId, "product_limit", rows.length);
    }

    const result = await importProductsCsv(brandId, rows, options);
    if (!options.dryRun) {
      revalidatePath("/admin");
      revalidatePath("/admin/products");
      try {
        revalidateTag(`brand:${brandId}:products`, "max");
      } catch {
        // ignore
      }
    }
    return { ok: true, data: result };
  } catch (err: any) {
    return { ok: false, error: err.message || "Import failed" };
  }
}

export async function undoImportBatchAction(brandId: string, batchId: string) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token) return { ok: false, error: "Authentication required" };

    const payload = verifyToken(token);
    if (!payload) return { ok: false, error: "Invalid or expired session" };

    const hasAccess = await verifyAdminBrandAccess(
      payload.userId,
      payload.role,
      brandId
    );
    if (!hasAccess) {
      return { ok: false, error: "Access Denied: You do not have permission to manage this brand" };
    }

    const result = await undoImportBatch(brandId, batchId);
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    try {
      revalidateTag(`brand:${brandId}:products`, "max");
    } catch {
      // ignore
    }
    return { ok: true, data: result };
  } catch (err: any) {
    return { ok: false, error: err.message || "Undo import failed" };
  }
}

export async function updateOrderFulfillmentAction(
  brandId: string,
  orderId: string,
  updates: {
    status?: "RECEIVED" | "PACKED" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
    courier?: string;
    trackingId?: string;
  }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token) return { ok: false, error: "Authentication required" };

    const payload = verifyToken(token);
    if (!payload) return { ok: false, error: "Invalid or expired session" };

    const hasAccess = await verifyAdminBrandAccess(
      payload.userId,
      payload.role,
      brandId
    );
    if (!hasAccess) {
      return { ok: false, error: "Access Denied: You do not have permission to manage this brand" };
    }

    const updated = await updateOrderFulfillmentAdmin(brandId, orderId, updates);
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update fulfillment" };
  }
}

export async function updateBrandThemeAction(
  brandId: string,
  themeConfig: Record<string, any>
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token) return { ok: false, error: "Authentication required" };

    const payload = verifyToken(token);
    if (!payload) return { ok: false, error: "Invalid or expired session" };

    // Strict role isolation: Live Theme Customizer is restricted to SUPER_ADMIN only
    if (payload.role !== "SUPER_ADMIN") {
      return { ok: false, error: "Access Denied: Theme customization is restricted to SUPER_ADMIN only" };
    }

    const hasAccess = await verifyAdminBrandAccess(
      payload.userId,
      payload.role,
      brandId
    );
    if (!hasAccess) {
      return { ok: false, error: "Access Denied: You do not have permission to manage this brand" };
    }

    const updated = await updateBrandThemeConfig(brandId, themeConfig);
    revalidatePath("/admin");
    revalidatePath("/admin/theme");
    try {
      revalidateTag(`brand:${brandId}`, "max");
      revalidateTag(`brand:${updated.slug}`, "max");
    } catch {
      // ignore
    }
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update theme" };
  }
}
