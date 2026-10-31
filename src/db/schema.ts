import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  varchar,
  jsonb,
  boolean,
  pgEnum,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────────────
export const adminRole = pgEnum("admin_role", ["SUPER_ADMIN", "BRAND_ADMIN"]);
export const orderStatus = pgEnum("order_status", [
  "RECEIVED",
  "PACKED",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
]);
export const paymentMethod = pgEnum("payment_method", ["UPI", "COD"]);
export const paymentStatus = pgEnum("payment_status", [
  "PENDING",
  "PAID",
  "COD",
  "FAILED",
]);

// ── Tables ─────────────────────────────────────────────────────────────

export const brands = pgTable("brands", {
  id: uuid().defaultRandom().primaryKey(),
  slug: varchar({ length: 255 }).notNull().unique(),
  name: text().notNull(),
  logoUrl: text("logo_url"),
  whatsappNumber: varchar("whatsapp_number", { length: 20 }),
  upiVpa: varchar("upi_vpa", { length: 255 }),
  currency: varchar({ length: 3 }).default("INR").notNull(),
  customDomain: text("custom_domain").unique(),
  themeConfig: jsonb("theme_config").default({}).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const products = pgTable("products", {
  id: uuid().defaultRandom().primaryKey(),
  brandId: uuid("brand_id").notNull(),
  title: text().notNull(),
  slug: text().notNull(),
  description: text(),
  category: text(),
  images: jsonb().default([]).notNull(),
  videos: jsonb().default([]).notNull(),
  mediaOrder: jsonb("media_order").default([]).notNull(),
  featured: boolean().default(false).notNull(),
  basePricePaise: integer("base_price_paise").default(199900).notNull(),
  compareAtPricePaise: integer("compare_at_price_paise"),
  importBatchId: uuid("import_batch_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const productVariants = pgTable("product_variants", {
  id: uuid().defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  sku: varchar({ length: 255 }).notNull().unique(),
  title: text().notNull(),
  pricePaise: integer("price_paise").notNull(),
  stockQuantity: integer("stock_quantity").notNull(),
  attributes: jsonb(),
  position: integer(),
});

export const bundles = pgTable("bundles", {
  id: uuid().defaultRandom().primaryKey(),
  brandId: uuid("brand_id").notNull(),
  productId: uuid("product_id").notNull(),
  title: text().notNull(),
  bundlePricePaise: integer("bundle_price_paise").notNull(),
  items: jsonb().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const customers = pgTable(
  "customers",
  {
    id: uuid().defaultRandom().primaryKey(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    name: text().notNull(),
    email: varchar({ length: 255 }).notNull(),
    phone: varchar({ length: 20 }),
    passwordHash: text("password_hash").notNull(),
    savedAddresses: jsonb("saved_addresses").default([]).notNull(),
    resetToken: text("reset_token"),
    resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("customers_brand_email_idx").on(t.brandId, t.email),
  ]
);

export const orders = pgTable("orders", {
  id: uuid().defaultRandom().primaryKey(),
  brandId: uuid("brand_id").notNull(),
  orderNumber: integer("order_number").notNull(),
  status: orderStatus().default("RECEIVED").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
  deliveryAddress: jsonb("delivery_address").notNull(),
  items: jsonb().notNull(),
  subtotalPaise: integer("subtotal_paise").notNull(),
  shippingPaise: integer("shipping_paise").notNull(),
  totalAmountPaise: integer("total_amount_paise").notNull(),
  paymentMethod: paymentMethod("payment_method").notNull(),
  paymentStatus: paymentStatus("payment_status").default("PENDING").notNull(),
  upiUtr: text("upi_utr"),
  trackingId: text("tracking_id"),
  courier: text(),
  whatsappLog: jsonb("whatsapp_log").default([]).notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const brandOrderCounters = pgTable("brand_order_counters", {
  brandId: uuid("brand_id").primaryKey(),
  lastNumber: integer("last_number").default(0).notNull(),
});

export const adminUsers = pgTable("admin_users", {
  id: uuid().defaultRandom().primaryKey(),
  email: text().notNull().unique(),
  role: adminRole().default("BRAND_ADMIN").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const adminAuthCredentials = pgTable("admin_auth_credentials", {
  adminUserId: uuid("admin_user_id")
    .primaryKey()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const adminBrandAccess = pgTable(
  "admin_brand_access",
  {
    adminUserId: uuid("admin_user_id").notNull(),
    brandId: uuid("brand_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.adminUserId, t.brandId] })]
);

export const discountCoupons = pgTable("discount_coupons", {
  id: uuid().defaultRandom().primaryKey(),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  code: varchar({ length: 50 }).notNull(),
  discountType: varchar("discount_type", { length: 20 }).notNull(), // 'PERCENTAGE' or 'FLAT'
  discountValue: integer("discount_value").notNull(), // e.g. 10 (%) or 10000 (paise)
  minOrderPaise: integer("min_order_paise").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const importBatches = pgTable("import_batches", {
  id: uuid().defaultRandom().primaryKey(),
  brandId: uuid("brand_id").notNull(),
  filename: text(),
  totalRows: integer("total_rows").default(0).notNull(),
  importedCount: integer("imported_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  errors: jsonb().default([]).notNull(),
  status: text().default("COMPLETED").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

// ── Phase P3: Platform, Plans, Vault & Metering Tables ─────────────────

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid().defaultRandom().primaryKey(),
  slug: varchar({ length: 50 }).notNull().unique(), // 'starter', 'growth', 'pro', 'custom'
  name: text().notNull(),
  pricePaise: integer("price_paise").notNull(), // Monthly price in paise
  billingCycle: varchar("billing_cycle", { length: 20 }).default("MONTHLY").notNull(),
  features: jsonb().notNull(), // Matrix of boolean feature flags and numeric limits
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const brandSubscriptions = pgTable("brand_subscriptions", {
  id: uuid().defaultRandom().primaryKey(),
  brandId: uuid("brand_id")
    .notNull()
    .unique()
    .references(() => brands.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => subscriptionPlans.id),
  status: varchar({ length: 50 }).default("ACTIVE").notNull(), // 'TRIAL', 'ACTIVE', 'SUSPENDED', 'GRACE_PERIOD', 'CANCELLED'
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: "string" }),
  currentPeriodStartsAt: timestamp("current_period_starts_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  currentPeriodEndsAt: timestamp("current_period_ends_at", { withTimezone: true, mode: "string" }),
  featureOverrides: jsonb("feature_overrides").default({}).notNull(),
  topUpQuotas: jsonb("top_up_quotas").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const platformSettings = pgTable("platform_settings", {
  id: uuid().defaultRandom().primaryKey(),
  key: varchar({ length: 100 }).notNull().unique(),
  value: text().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const platformSecrets = pgTable("platform_secrets", {
  id: uuid().defaultRandom().primaryKey(),
  keyName: varchar("key_name", { length: 100 }).notNull().unique(),
  encryptedValue: text("encrypted_value").notNull(),
  iv: text().notNull(),
  authTag: text("auth_tag").notNull(),
  maskedPreview: text("masked_preview").notNull(),
  lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "string" }),
});

export const brandCredentials = pgTable("brand_credentials", {
  id: uuid().defaultRandom().primaryKey(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  service: varchar({ length: 50 }).notNull(), // 'RAZORPAY', 'WHATSAPP_CUSTOM', 'SHIPROCKET'
  encryptedData: text("encrypted_data").notNull(),
  iv: text().notNull(),
  authTag: text("auth_tag").notNull(),
  maskedPreview: jsonb("masked_preview").default({}).notNull(),
  razorpayRouteAccountId: text("razorpay_route_account_id"),
  commissionPercentBasisPoints: integer("commission_percent_basis_points").default(0).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const usageEvents = pgTable("usage_events", {
  id: uuid().defaultRandom().primaryKey(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  type: varchar({ length: 50 }).notNull(), // 'whatsapp_message', 'ai_call', 'storage', 'email'
  quantity: integer().default(1).notNull(),
  costEstimatePaise: integer("cost_estimate_paise").default(0).notNull(),
  metadata: jsonb().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const platformAuditLogs = pgTable("platform_audit_logs", {
  id: uuid().defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
  brandId: uuid("brand_id"),
  action: text().notNull(),
  details: jsonb().default({}).notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const platformDailyCaps = pgTable("platform_daily_caps", {
  date: varchar({ length: 10 }).primaryKey(), // 'YYYY-MM-DD'
  aiCostPaise: integer("ai_cost_paise").default(0).notNull(),
  whatsappCostPaise: integer("whatsapp_cost_paise").default(0).notNull(),
  dailyAiCapPaise: integer("daily_ai_cap_paise").default(500000).notNull(), // default ₹5,000 / day
  dailyWhatsappCapPaise: integer("daily_whatsapp_cap_paise").default(1000000).notNull(), // default ₹10,000 / day
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid().defaultRandom().primaryKey(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  type: varchar({ length: 20 }).default("image").notNull(), // 'image' | 'video'
  url: text().notNull(),
  storagePath: text("storage_path").notNull(),
  mime: varchar({ length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer(),
  height: integer(),
  durationSeconds: integer("duration_seconds"),
  alt: text(),
  blurDataUrl: text("blur_data_url"),
  posterUrl: text("poster_url"),
  createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

// ── Type Exports ───────────────────────────────────────────────────────
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type Bundle = typeof bundles.$inferSelect;
export type NewBundle = typeof bundles.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type AdminAuthCredential = typeof adminAuthCredentials.$inferSelect;
export type DiscountCoupon = typeof discountCoupons.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type NewImportBatch = typeof importBatches.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type BrandSubscription = typeof brandSubscriptions.$inferSelect;
export type NewBrandSubscription = typeof brandSubscriptions.$inferInsert;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type NewPlatformSetting = typeof platformSettings.$inferInsert;
export type PlatformSecret = typeof platformSecrets.$inferSelect;
export type BrandCredential = typeof brandCredentials.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type PlatformAuditLog = typeof platformAuditLogs.$inferSelect;
export type PlatformDailyCap = typeof platformDailyCaps.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
