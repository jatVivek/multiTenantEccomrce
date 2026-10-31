import { db } from "../index";
import {
  adminUsers,
  adminAuthCredentials,
  adminBrandAccess,
  brands,
  orders,
  products,
  productVariants,
  bundles,
  importBatches,
  type AdminUser,
  type Brand,
  type Order,
  type Product,
  type ProductVariant,
  type ImportBatch,
} from "../../../src/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { verifyPassword } from "../../../src/lib/auth";
import { ingestRemoteImageSafe } from "../../storage/ssrf-guard";

export async function getAdminByEmail(email: string): Promise<{
  user: AdminUser;
  passwordHash: string;
} | null> {
  if (!email) return null;

  const [row] = await db
    .select({
      user: adminUsers,
      passwordHash: adminAuthCredentials.passwordHash,
    })
    .from(adminUsers)
    .innerJoin(
      adminAuthCredentials,
      eq(adminAuthCredentials.adminUserId, adminUsers.id)
    )
    .where(eq(adminUsers.email, email.trim().toLowerCase()))
    .limit(1);

  if (!row) return null;
  return row;
}

export async function getAdminById(id: string): Promise<AdminUser | null> {
  if (!id) return null;
  const [user] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);

  return user ?? null;
}

export async function getAccessibleBrandsForAdmin(
  adminId: string,
  role: string
): Promise<Brand[]> {
  if (role === "SUPER_ADMIN") {
    return db
      .select()
      .from(brands)
      .where(eq(brands.isActive, true))
      .orderBy(brands.name);
  }

  // BRAND_ADMIN: only assigned brands
  const accessRows = await db
    .select({ brandId: adminBrandAccess.brandId })
    .from(adminBrandAccess)
    .where(eq(adminBrandAccess.adminUserId, adminId));

  const brandIds = accessRows.map((r) => r.brandId);
  if (brandIds.length === 0) return [];

  return db
    .select()
    .from(brands)
    .where(and(inArray(brands.id, brandIds), eq(brands.isActive, true)))
    .orderBy(brands.name);
}

export async function verifyAdminBrandAccess(
  adminId: string,
  role: string,
  brandId: string
): Promise<boolean> {
  if (!adminId || !brandId) return false;
  if (role === "SUPER_ADMIN") return true;

  const [access] = await db
    .select()
    .from(adminBrandAccess)
    .where(
      and(
        eq(adminBrandAccess.adminUserId, adminId),
        eq(adminBrandAccess.brandId, brandId)
      )
    )
    .limit(1);

  return Boolean(access);
}

export async function getBrandAdminStats(brandId: string): Promise<{
  totalOrders: number;
  totalRevenuePaise: number;
  pendingOrders: number;
  totalVariants: number;
  lowStockVariants: number;
}> {
  if (!brandId) throw new Error("brandId is required");

  const [orderStats] = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      totalRevenuePaise: sql<number>`coalesce(sum(case when payment_status = 'PAID' or payment_method = 'COD' then total_amount_paise else 0 end), 0)::bigint`,
      pendingOrders: sql<number>`count(case when status = 'RECEIVED' then 1 end)::int`,
    })
    .from(orders)
    .where(eq(orders.brandId, brandId));

  const [variantStats] = await db
    .select({
      totalVariants: sql<number>`count(*)::int`,
      lowStockVariants: sql<number>`count(case when stock_quantity <= 5 then 1 end)::int`,
    })
    .from(productVariants)
    .where(eq(productVariants.brandId, brandId));

  return {
    totalOrders: Number(orderStats?.totalOrders || 0),
    totalRevenuePaise: Number(orderStats?.totalRevenuePaise || 0),
    pendingOrders: Number(orderStats?.pendingOrders || 0),
    totalVariants: Number(variantStats?.totalVariants || 0),
    lowStockVariants: Number(variantStats?.lowStockVariants || 0),
  };
}

export async function getBrandOrdersAdmin(
  brandId: string,
  limit = 50
): Promise<Order[]> {
  if (!brandId) throw new Error("brandId is required");

  return db
    .select()
    .from(orders)
    .where(eq(orders.brandId, brandId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function updateOrderStatusAdmin(
  brandId: string,
  orderId: string,
  newStatus: "RECEIVED" | "PACKED" | "DISPATCHED" | "DELIVERED" | "CANCELLED"
): Promise<Order> {
  if (!brandId) throw new Error("brandId is required");
  if (!orderId) throw new Error("orderId is required");

  const [updated] = await db
    .update(orders)
    .set({
      status: newStatus,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.brandId, brandId)))
    .returning();

  if (!updated) {
    throw new Error("Order not found or unauthorized brand modification");
  }

  return updated;
}

export interface AdminProductItem extends Product {
  variants: ProductVariant[];
  totalStock: number;
}

export interface CreateProductInput {
  title: string;
  slug: string;
  description?: string;
  category: string;
  images: string[];
  videos?: {
    id?: string;
    url: string;
    posterUrl?: string;
    durationSeconds?: number;
  }[];
  featured?: boolean;
  basePricePaise: number;
  compareAtPricePaise?: number;
  variants: {
    sku: string;
    title: string;
    pricePaise: number;
    stockQuantity: number;
    attributes?: Record<string, any>;
  }[];
}

export async function getAdminProductsWithVariants(
  brandId: string,
  limit = 200
): Promise<AdminProductItem[]> {
  if (!brandId) throw new Error("brandId is required");

  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.brandId, brandId))
    .orderBy(desc(products.createdAt))
    .limit(limit);

  if (productRows.length === 0) return [];

  const productIds = productRows.map((p) => p.id);
  const variantRows = await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.brandId, brandId),
        inArray(productVariants.productId, productIds)
      )
    );

  const variantsByProductId = new Map<string, ProductVariant[]>();
  for (const v of variantRows) {
    const list = variantsByProductId.get(v.productId) || [];
    list.push(v);
    variantsByProductId.set(v.productId, list);
  }

  return productRows.map((p) => {
    const variants = variantsByProductId.get(p.id) || [];
    const totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
    return {
      ...p,
      variants,
      totalStock,
    };
  });
}

export async function createProductWithVariants(
  brandId: string,
  data: CreateProductInput
): Promise<AdminProductItem> {
  if (!brandId) throw new Error("brandId is required");
  if (!data.title || !data.slug) throw new Error("Title and slug are required");
  if (!data.variants || data.variants.length === 0) {
    throw new Error("At least one variant is required");
  }

  return await db.transaction(async (tx) => {
    // 1. Insert product
    const [createdProduct] = await tx
      .insert(products)
      .values({
        brandId,
        title: data.title,
        slug: data.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-"),
        description: data.description || "",
        category: data.category || "Apparel",
        images: data.images || [],
        videos: data.videos || [],
        featured: Boolean(data.featured),
        basePricePaise: data.basePricePaise,
        compareAtPricePaise: data.compareAtPricePaise || null,
      })
      .returning();

    // 2. Insert variants
    const variantValues = data.variants.map((v, index) => ({
      productId: createdProduct.id,
      brandId,
      sku: v.sku.trim(),
      title: v.title.trim(),
      pricePaise: v.pricePaise || data.basePricePaise,
      stockQuantity: v.stockQuantity >= 0 ? v.stockQuantity : 0,
      attributes: v.attributes || {},
      position: index,
    }));

    const createdVariants = await tx
      .insert(productVariants)
      .values(variantValues)
      .returning();

    const totalStock = createdVariants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);

    return {
      ...createdProduct,
      variants: createdVariants,
      totalStock,
    };
  });
}

export interface UpdateProductInput {
  title?: string;
  slug?: string;
  description?: string;
  category?: string;
  basePricePaise?: number;
  compareAtPricePaise?: number | null;
  images?: string[];
  videos?: {
    id?: string;
    url: string;
    posterUrl?: string;
    durationSeconds?: number;
  }[];
  featured?: boolean;
  variants?: {
    id?: string;
    sku: string;
    title: string;
    pricePaise: number;
    stockQuantity: number;
    attributes?: Record<string, any>;
  }[];
}

export async function updateProductWithVariants(
  brandId: string,
  productId: string,
  data: UpdateProductInput
): Promise<AdminProductItem> {
  if (!brandId) throw new Error("brandId is required");
  if (!productId) throw new Error("productId is required");

  return await db.transaction(async (tx) => {
    // 1. Verify existence & brand isolation
    const [existing] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
      .limit(1);

    if (!existing) {
      throw new Error("Product not found or access denied");
    }

    // 2. Update product fields
    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
    };
    if (data.title !== undefined) updateFields.title = data.title;
    if (data.slug !== undefined) {
      updateFields.slug = data.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");
    }
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.category !== undefined) updateFields.category = data.category;
    if (data.basePricePaise !== undefined) updateFields.basePricePaise = data.basePricePaise;
    if (data.compareAtPricePaise !== undefined) updateFields.compareAtPricePaise = data.compareAtPricePaise;
    if (data.images !== undefined) updateFields.images = data.images;
    if (data.videos !== undefined) updateFields.videos = data.videos;
    if (data.featured !== undefined) updateFields.featured = Boolean(data.featured);

    const [updatedProduct] = await tx
      .update(products)
      .set(updateFields)
      .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
      .returning();

    // 3. Update variants if provided
    if (data.variants && data.variants.length > 0) {
      for (const v of data.variants) {
        if (v.id) {
          await tx
            .update(productVariants)
            .set({
              sku: v.sku.trim(),
              title: v.title.trim(),
              pricePaise: v.pricePaise,
              stockQuantity: v.stockQuantity >= 0 ? v.stockQuantity : 0,
              attributes: v.attributes || {},
            })
            .where(
              and(
                eq(productVariants.id, v.id),
                eq(productVariants.productId, productId),
                eq(productVariants.brandId, brandId)
              )
            );
        } else {
          await tx.insert(productVariants).values({
            productId,
            brandId,
            sku: v.sku.trim(),
            title: v.title.trim(),
            pricePaise: v.pricePaise || updatedProduct.basePricePaise,
            stockQuantity: v.stockQuantity >= 0 ? v.stockQuantity : 0,
            attributes: v.attributes || {},
          });
        }
      }
    }

    // 4. Fetch latest full variant state
    const currentVariants = await tx
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, productId),
          eq(productVariants.brandId, brandId)
        )
      );

    const totalStock = currentVariants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);

    return {
      ...updatedProduct,
      variants: currentVariants,
      totalStock,
    };
  });
}

export async function updateProductVariantStockAndPrice(
  brandId: string,
  variantId: string,
  pricePaise?: number,
  stockQuantity?: number
): Promise<ProductVariant> {
  if (!brandId) throw new Error("brandId is required");
  if (!variantId) throw new Error("variantId is required");

  const updates: Partial<{ pricePaise: number; stockQuantity: number }> = {};
  if (pricePaise !== undefined) updates.pricePaise = pricePaise;
  if (stockQuantity !== undefined) updates.stockQuantity = stockQuantity;

  const [updated] = await db
    .update(productVariants)
    .set(updates)
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.brandId, brandId)
      )
    )
    .returning();

  if (!updated) {
    throw new Error("Variant not found or unauthorized brand modification");
  }

  return updated;
}

export async function deleteProductAdmin(
  brandId: string,
  productId: string
): Promise<boolean> {
  if (!brandId) throw new Error("brandId is required");
  if (!productId) throw new Error("productId is required");

  return await db.transaction(async (tx) => {
    // Delete bundles referencing this product
    await tx
      .delete(bundles)
      .where(and(eq(bundles.productId, productId), eq(bundles.brandId, brandId)));

    // Delete variants
    await tx
      .delete(productVariants)
      .where(
        and(
          eq(productVariants.productId, productId),
          eq(productVariants.brandId, brandId)
        )
      );

    // Delete product
    const [deleted] = await tx
      .delete(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.brandId, brandId)
        )
      )
      .returning({ id: products.id });

    if (!deleted) {
      throw new Error("Product not found or unauthorized brand modification");
    }

    return true;
  });
}

// ── Bulk CSV Importer & Undo ─────────────────────────────────────────────

export interface CsvProductRow {
  title?: string;
  slug?: string;
  category?: string;
  description?: string;
  base_price?: string | number;
  compare_at_price?: string | number;
  sku?: string;
  variant_title?: string;
  size?: string;
  variant_price?: string | number;
  stock_quantity?: string | number;
  images?: string;
}

export interface ImportErrorItem {
  row: number;
  sku?: string;
  reason: string;
}

export interface ImportResult {
  dryRun: boolean;
  batchId?: string;
  totalRows: number;
  importedCount: number;
  failedCount: number;
  errors: ImportErrorItem[];
}

export async function importProductsCsv(
  brandId: string,
  rows: CsvProductRow[],
  options: { dryRun?: boolean; filename?: string; rehostImages?: boolean } = {}
): Promise<ImportResult> {
  if (!brandId) throw new Error("brandId is required");
  const { dryRun = false, filename = "import.csv", rehostImages = false } = options;

  const errors: ImportErrorItem[] = [];
  const validRows: {
    rowNumber: number;
    title: string;
    slug: string;
    category: string;
    description: string;
    basePricePaise: number;
    compareAtPricePaise: number | null;
    sku: string;
    variantTitle: string;
    size: string;
    variantPricePaise: number;
    stockQuantity: number;
    images: string[];
  }[] = [];

  // Step 1: Validate each row row-by-row
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;

    // Check title
    if (!r.title || !String(r.title).trim()) {
      errors.push({ row: rowNum, sku: r.sku, reason: "Missing product title" });
      continue;
    }

    // Check SKU
    if (!r.sku || !String(r.sku).trim()) {
      errors.push({ row: rowNum, sku: "", reason: "Missing variant SKU" });
      continue;
    }

    // Check base price
    const basePriceNum = parseFloat(String(r.base_price || "0"));
    if (isNaN(basePriceNum) || basePriceNum <= 0) {
      errors.push({
        row: rowNum,
        sku: r.sku,
        reason: `Invalid base price "${r.base_price}"`,
      });
      continue;
    }

    // Check stock quantity
    const stockNum = parseInt(String(r.stock_quantity ?? "0"), 10);
    if (isNaN(stockNum) || stockNum < 0) {
      errors.push({
        row: rowNum,
        sku: r.sku,
        reason: `Invalid stock quantity "${r.stock_quantity}"`,
      });
      continue;
    }

    // Check variant price
    const varPriceNum = r.variant_price ? parseFloat(String(r.variant_price)) : basePriceNum;
    if (isNaN(varPriceNum) || varPriceNum <= 0) {
      errors.push({
        row: rowNum,
        sku: r.sku,
        reason: `Invalid variant price "${r.variant_price}"`,
      });
      continue;
    }

    const title = String(r.title).trim();
    const slug = r.slug && String(r.slug).trim()
      ? String(r.slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const category = r.category ? String(r.category).trim() : "Apparel";
    const description = r.description ? String(r.description).trim() : "";
    const basePricePaise = Math.round(basePriceNum * 100);
    const compareAtPricePaise = r.compare_at_price
      ? Math.round(parseFloat(String(r.compare_at_price)) * 100)
      : null;

    const sku = String(r.sku).trim();
    const size = r.size ? String(r.size).trim() : "Standard";
    const variantTitle = r.variant_title ? String(r.variant_title).trim() : `${title} - ${size}`;
    const variantPricePaise = Math.round(varPriceNum * 100);

    let images = r.images
      ? String(r.images)
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (!dryRun && rehostImages && images.length > 0) {
      const rehosted: string[] = [];
      for (const imgUrl of images) {
        if (imgUrl.startsWith("http://") || imgUrl.startsWith("https://")) {
          try {
            const ingested = await ingestRemoteImageSafe(brandId, imgUrl);
            rehosted.push(ingested.rehostedUrl);
          } catch {
            rehosted.push(imgUrl);
          }
        } else {
          rehosted.push(imgUrl);
        }
      }
      images = rehosted;
    }

    validRows.push({
      rowNumber: rowNum,
      title,
      slug,
      category,
      description,
      basePricePaise,
      compareAtPricePaise,
      sku,
      variantTitle,
      size,
      variantPricePaise,
      stockQuantity: stockNum,
      images,
    });
  }

  // If dry-run, stop here and report validation metrics
  if (dryRun) {
    return {
      dryRun: true,
      totalRows: rows.length,
      importedCount: validRows.length,
      failedCount: errors.length,
      errors,
    };
  }

  // Step 2: Group valid rows by slug
  const productsBySlug = new Map<string, typeof validRows>();
  for (const row of validRows) {
    const list = productsBySlug.get(row.slug) || [];
    list.push(row);
    productsBySlug.set(row.slug, list);
  }

  const batchId = crypto.randomUUID();

  // Step 3: Insert products and variants inside transaction with chunking
  await db.transaction(async (tx) => {
    // Record batch
    await tx.insert(importBatches).values({
      id: batchId,
      brandId,
      filename,
      totalRows: rows.length,
      importedCount: validRows.length,
      failedCount: errors.length,
      errors: errors as any,
      status: "COMPLETED",
    });

    const entries = Array.from(productsBySlug.entries());
    const CHUNK_SIZE = 250;

    for (let c = 0; c < entries.length; c += CHUNK_SIZE) {
      const chunk = entries.slice(c, c + CHUNK_SIZE);

      const productsToInsert = chunk.map(([slug, group]) => {
        const first = group[0];
        return {
          brandId,
          title: first.title,
          slug,
          description: first.description,
          category: first.category,
          images: first.images,
          featured: false,
          basePricePaise: first.basePricePaise,
          compareAtPricePaise: first.compareAtPricePaise,
          importBatchId: batchId,
        };
      });

      const insertedProducts = await tx
        .insert(products)
        .values(productsToInsert)
        .onConflictDoUpdate({
          target: [products.brandId, products.slug],
          set: {
            title: sql`excluded.title`,
            basePricePaise: sql`excluded.base_price_paise`,
            importBatchId: batchId,
          },
        })
        .returning({ id: products.id, slug: products.slug });

      const prodIdMap = new Map<string, string>();
      for (const p of insertedProducts) {
        prodIdMap.set(p.slug, p.id);
      }

      const allVariants: any[] = [];
      for (const [slug, group] of chunk) {
        const prodId = prodIdMap.get(slug);
        if (!prodId) continue;
        for (let idx = 0; idx < group.length; idx++) {
          const v = group[idx];
          allVariants.push({
            productId: prodId,
            brandId,
            sku: v.sku,
            title: v.variantTitle,
            pricePaise: v.variantPricePaise,
            stockQuantity: v.stockQuantity,
            attributes: { size: v.size },
            position: idx,
          });
        }
      }

      if (allVariants.length > 0) {
        await tx
          .insert(productVariants)
          .values(allVariants)
          .onConflictDoUpdate({
            target: productVariants.sku,
            set: {
              stockQuantity: sql`excluded.stock_quantity`,
              pricePaise: sql`excluded.price_paise`,
            },
          });
      }
    }
  });

  return {
    dryRun: false,
    batchId,
    totalRows: rows.length,
    importedCount: validRows.length,
    failedCount: errors.length,
    errors,
  };
}

export async function undoImportBatch(
  brandId: string,
  batchId: string
): Promise<{ success: boolean; deletedCount: number }> {
  if (!brandId) throw new Error("brandId is required");
  if (!batchId) throw new Error("batchId is required");

  return await db.transaction(async (tx) => {
    // 1. Verify batch
    const [batch] = await tx
      .select()
      .from(importBatches)
      .where(
        and(eq(importBatches.id, batchId), eq(importBatches.brandId, brandId))
      )
      .limit(1);

    if (!batch) {
      throw new Error("Import batch not found or unauthorized");
    }

    if (batch.status === "REVERTED") {
      throw new Error("This import batch has already been reverted");
    }

    // 2. Find all products belonging to this import batch
    const batchProducts = await tx
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.importBatchId, batchId),
          eq(products.brandId, brandId)
        )
      );

    const productIds = batchProducts.map((p) => p.id);

    if (productIds.length > 0) {
      // Delete variants
      await tx
        .delete(productVariants)
        .where(
          and(
            inArray(productVariants.productId, productIds),
            eq(productVariants.brandId, brandId)
          )
        );

      // Delete bundles
      await tx
        .delete(bundles)
        .where(
          and(
            inArray(bundles.productId, productIds),
            eq(bundles.brandId, brandId)
          )
        );

      // Delete products
      await tx
        .delete(products)
        .where(
          and(
            inArray(products.id, productIds),
            eq(products.brandId, brandId)
          )
        );
    }

    // 3. Mark batch as REVERTED
    await tx
      .update(importBatches)
      .set({ status: "REVERTED" })
      .where(
        and(eq(importBatches.id, batchId), eq(importBatches.brandId, brandId))
      );

    return {
      success: true,
      deletedCount: productIds.length,
    };
  });
}

export async function getImportBatches(
  brandId: string,
  limit = 20
): Promise<ImportBatch[]> {
  if (!brandId) throw new Error("brandId is required");

  return db
    .select()
    .from(importBatches)
    .where(eq(importBatches.brandId, brandId))
    .orderBy(desc(importBatches.createdAt))
    .limit(limit);
}

// ── Order Dispatch Desk & Fulfillment ────────────────────────────────────

export async function getBrandOrdersFulfillmentAdmin(
  brandId: string,
  status?: string,
  limit = 100
): Promise<Order[]> {
  if (!brandId) throw new Error("brandId is required");

  const conditions = [eq(orders.brandId, brandId)];
  if (status && status !== "ALL") {
    conditions.push(eq(orders.status, status as any));
  }

  return db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function updateOrderFulfillmentAdmin(
  brandId: string,
  orderId: string,
  updates: {
    status?: "RECEIVED" | "PACKED" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
    courier?: string;
    trackingId?: string;
  }
): Promise<Order> {
  if (!brandId) throw new Error("brandId is required");
  if (!orderId) throw new Error("orderId is required");

  const updateFields: Partial<Order> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.status) updateFields.status = updates.status;
  if (updates.courier !== undefined) updateFields.courier = updates.courier;
  if (updates.trackingId !== undefined) updateFields.trackingId = updates.trackingId;

  const [updated] = await db
    .update(orders)
    .set(updateFields)
    .where(and(eq(orders.id, orderId), eq(orders.brandId, brandId)))
    .returning();

  if (!updated) {
    throw new Error("Order not found or unauthorized brand modification");
  }

  return updated;
}

// ── Theme Customizer ─────────────────────────────────────────────────────

export async function updateBrandThemeConfig(
  brandId: string,
  themeConfig: Record<string, any>
): Promise<Brand> {
  if (!brandId) throw new Error("brandId is required");

  const [current] = await db
    .select({ themeConfig: brands.themeConfig })
    .from(brands)
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!current) {
    throw new Error("Brand not found");
  }

  const existingConfig = (current.themeConfig as any) || {};
  const mergedConfig = {
    ...existingConfig,
    ...themeConfig,
    colors: {
      ...(existingConfig.colors || {}),
      ...(themeConfig.colors || {}),
    },
    fonts: {
      ...(existingConfig.fonts || {}),
      ...(themeConfig.fonts || {}),
    },
  };

  const [updated] = await db
    .update(brands)
    .set({
      themeConfig: mergedConfig,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(brands.id, brandId))
    .returning();

  return updated;
}

