import { z } from "zod";

// ── Brands ─────────────────────────────────────────────────────────────

export const createBrandSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase-hyphenated"),
  logoUrl: z.string().url().optional(),
  whatsappNumber: z.string().max(20).optional(),
  upiVpa: z.string().max(255).optional(),
  currency: z.string().length(3).default("INR"),
  customDomain: z.string().optional(),
  themeConfig: z.record(z.string(), z.unknown()).default({}),
});

export const updateBrandSchema = createBrandSchema.partial();

// ── Product Variants ───────────────────────────────────────────────────

export const createProductVariantSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().min(1).max(255),
  title: z.string().min(1),
  pricePaise: z.number().int().min(0),
  stockQuantity: z.number().int().min(0),
  attributes: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().optional(),
});

export const updateProductVariantSchema = createProductVariantSchema
  .omit({ productId: true })
  .partial();

// ── Orders ─────────────────────────────────────────────────────────────

const deliveryAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(5).max(10),
});

const orderItemSchema = z.object({
  variantId: z.string().uuid(),
  title: z.string(),
  sku: z.string(),
  qty: z.number().int().min(1),
  unitPricePaise: z.number().int().min(0),
});

export const createOrderSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(10).max(20),
  deliveryAddress: deliveryAddressSchema,
  items: z.array(orderItemSchema).min(1),
  shippingPaise: z.number().int().min(0).default(0),
  paymentMethod: z.enum(["UPI", "COD"]),
  idempotencyKey: z.string().min(1),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["RECEIVED", "PACKED", "DISPATCHED", "DELIVERED", "CANCELLED"]),
  trackingId: z.string().optional(),
  courier: z.string().optional(),
});

export const submitUpiPaymentSchema = z.object({
  upiUtr: z.string().min(6).max(64),
});

// ── Bundles ────────────────────────────────────────────────────────────

const bundleItemSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().min(1),
});

export const createBundleSchema = z.object({
  productId: z.string().uuid(),
  title: z.string().min(1),
  bundlePricePaise: z.number().int().min(0),
  items: z.array(bundleItemSchema).min(1),
});

export const updateBundleSchema = createBundleSchema.partial();

// ── Admin & Auth ───────────────────────────────────────────────────────

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const adminRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["SUPER_ADMIN", "BRAND_ADMIN"]).default("BRAND_ADMIN"),
  brandIds: z.array(z.string().uuid()).optional(),
});

export const grantBrandAccessSchema = z.object({
  adminUserId: z.string().uuid(),
  brandId: z.string().uuid(),
});

