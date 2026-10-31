import { db } from "../index";
import { products, productVariants, type Product, type ProductVariant } from "../../../src/db/schema";
import { eq, and, sql, desc, asc, inArray, gte, lte, ilike } from "drizzle-orm";

export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
  minPricePaise: number;
  maxPricePaise: number;
  hasStock: boolean;
}

export interface CatalogFilterParams {
  brandId: string;
  category?: string;
  size?: string;
  minPricePaise?: number;
  maxPricePaise?: number;
  inStockOnly?: boolean;
  search?: string;
  sort?: "featured" | "price-asc" | "price-desc" | "newest";
  cursor?: string; // product id or timestamp cursor
  limit?: number;
}

export async function getCatalogProducts(params: CatalogFilterParams): Promise<{
  products: ProductWithVariants[];
  nextCursor: string | null;
  totalCount: number;
}> {
  const {
    brandId,
    category,
    size,
    minPricePaise,
    maxPricePaise,
    inStockOnly,
    search,
    sort = "featured",
    cursor,
    limit = 12,
  } = params;

  if (!brandId) {
    throw new Error("brandId is required for catalog scoping");
  }

  // Base conditions
  const conditions = [eq(products.brandId, brandId)];

  if (category && category !== "All") {
    conditions.push(eq(products.category, category));
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      sql`(${products.title} ILIKE ${term} OR ${products.description} ILIKE ${term} OR ${products.category} ILIKE ${term})`
    );
  }

  if (minPricePaise !== undefined) {
    conditions.push(gte(products.basePricePaise, minPricePaise));
  }

  if (maxPricePaise !== undefined) {
    conditions.push(lte(products.basePricePaise, maxPricePaise));
  }

  // If size filter is set, ensure the product has a variant with that size
  if (size && size.trim()) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${productVariants} pv
        WHERE pv.product_id = ${products.id}
          AND pv.brand_id = ${brandId}
          AND (pv.attributes->>'size' = ${size} OR pv.title ILIKE ${'%' + size + '%'})
      )`
    );
  }

  // If inStockOnly is set, ensure the product has a variant with stock > 0
  if (inStockOnly) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${productVariants} pv
        WHERE pv.product_id = ${products.id}
          AND pv.brand_id = ${brandId}
          AND pv.stock_quantity > 0
      )`
    );
  }

  // Cursor pagination
  if (cursor) {
    conditions.push(sql`${products.id} > ${cursor}::uuid`);
  }

  // Sort order
  let orderByClause = desc(products.featured);
  if (sort === "price-asc") {
    orderByClause = asc(products.basePricePaise);
  } else if (sort === "price-desc") {
    orderByClause = desc(products.basePricePaise);
  } else if (sort === "newest") {
    orderByClause = desc(products.createdAt);
  }

  // Execute query with limit + 1 to check for next page
  const rows = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(orderByClause, asc(products.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const productRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && productRows.length > 0 ? productRows[productRows.length - 1].id : null;

  if (productRows.length === 0) {
    return {
      products: [],
      nextCursor: null,
      totalCount: 0,
    };
  }

  // Batch fetch variants to avoid N+1 query
  const productIds = productRows.map((p) => p.id);
  const variantRows = await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.brandId, brandId),
        inArray(productVariants.productId, productIds)
      )
    )
    .orderBy(asc(productVariants.position), asc(productVariants.pricePaise));

  // Map variants to products
  const variantsByProductId = new Map<string, ProductVariant[]>();
  for (const v of variantRows) {
    const list = variantsByProductId.get(v.productId) || [];
    list.push(v);
    variantsByProductId.set(v.productId, list);
  }

  const result: ProductWithVariants[] = productRows.map((p) => {
    const variants = variantsByProductId.get(p.id) || [];
    const prices = variants.map((v) => v.pricePaise);
    const minPrice = prices.length > 0 ? Math.min(...prices) : p.basePricePaise;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : p.basePricePaise;
    const hasStock = variants.some((v) => v.stockQuantity > 0);

    return {
      ...p,
      variants,
      minPricePaise: minPrice,
      maxPricePaise: maxPrice,
      hasStock: variants.length > 0 ? hasStock : true,
    };
  });

  return {
    products: result,
    nextCursor,
    totalCount: result.length,
  };
}

export async function getFeaturedProducts(brandId: string, limit = 8): Promise<ProductWithVariants[]> {
  if (!brandId) throw new Error("brandId is required");

  const productRows = await db
    .select()
    .from(products)
    .where(and(eq(products.brandId, brandId), eq(products.featured, true)))
    .orderBy(desc(products.createdAt))
    .limit(limit);

  // If no featured products found, get recent products
  const rows = productRows.length > 0
    ? productRows
    : await db
        .select()
        .from(products)
        .where(eq(products.brandId, brandId))
        .orderBy(desc(products.createdAt))
        .limit(limit);

  if (rows.length === 0) return [];

  const productIds = rows.map((p) => p.id);
  const variantRows = await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.brandId, brandId),
        inArray(productVariants.productId, productIds)
      )
    )
    .orderBy(asc(productVariants.position));

  const variantsByProductId = new Map<string, ProductVariant[]>();
  for (const v of variantRows) {
    const list = variantsByProductId.get(v.productId) || [];
    list.push(v);
    variantsByProductId.set(v.productId, list);
  }

  return rows.map((p) => {
    const variants = variantsByProductId.get(p.id) || [];
    const prices = variants.map((v) => v.pricePaise);
    return {
      ...p,
      variants,
      minPricePaise: prices.length > 0 ? Math.min(...prices) : p.basePricePaise,
      maxPricePaise: prices.length > 0 ? Math.max(...prices) : p.basePricePaise,
      hasStock: variants.some((v) => v.stockQuantity > 0),
    };
  });
}

export async function getProductBySlug(brandId: string, slug: string): Promise<ProductWithVariants | null> {
  if (!brandId) throw new Error("brandId is required");
  if (!slug) return null;

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.brandId, brandId), eq(products.slug, slug)))
    .limit(1);

  if (!product) return null;

  const variants = await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.brandId, brandId),
        eq(productVariants.productId, product.id)
      )
    )
    .orderBy(asc(productVariants.position), asc(productVariants.pricePaise));

  const prices = variants.map((v) => v.pricePaise);

  return {
    ...product,
    variants,
    minPricePaise: prices.length > 0 ? Math.min(...prices) : product.basePricePaise,
    maxPricePaise: prices.length > 0 ? Math.max(...prices) : product.basePricePaise,
    hasStock: variants.some((v) => v.stockQuantity > 0),
  };
}

export async function getCategories(brandId: string): Promise<string[]> {
  if (!brandId) throw new Error("brandId is required");

  const rows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(eq(products.brandId, brandId));

  return rows
    .map((r) => r.category)
    .filter((c): c is string => Boolean(c && c.trim()));
}
