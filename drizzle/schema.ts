import { pgTable, uuid, text, timestamp, integer, varchar, jsonb, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const adminRole = pgEnum("admin_role", ['SUPER_ADMIN', 'BRAND_ADMIN'])
export const orderStatus = pgEnum("order_status", ['RECEIVED', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'])
export const paymentMethod = pgEnum("payment_method", ['UPI', 'COD'])
export const paymentStatus = pgEnum("payment_status", ['PENDING', 'PAID', 'COD', 'FAILED'])


export const adminBrandAccess = pgTable("admin_brand_access", {
	adminUserId: uuid("admin_user_id").notNull(),
	brandId: uuid("brand_id").notNull(),
});

export const adminUsers = pgTable("admin_users", {
	id: uuid().notNull(),
	email: text().notNull(),
	role: adminRole().default('BRAND_ADMIN').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const brandOrderCounters = pgTable("brand_order_counters", {
	brandId: uuid("brand_id").notNull(),
	lastNumber: integer("last_number").default(0).notNull(),
});

export const brands = pgTable("brands", {
	id: uuid().defaultRandom().notNull(),
	slug: varchar({ length: 255 }).notNull(),
	name: text().notNull(),
	logoUrl: text("logo_url"),
	whatsappNumber: varchar("whatsapp_number", { length: 20 }),
	upiVpa: varchar("upi_vpa", { length: 255 }),
	currency: varchar({ length: 3 }).default('INR').notNull(),
	customDomain: text("custom_domain"),
	themeConfig: jsonb("theme_config").default({}).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const bundles = pgTable("bundles", {
	id: uuid().defaultRandom().notNull(),
	brandId: uuid("brand_id").notNull(),
	productId: uuid("product_id").notNull(),
	title: text().notNull(),
	bundlePricePaise: integer("bundle_price_paise").notNull(),
	items: jsonb().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
	id: uuid().defaultRandom().notNull(),
	brandId: uuid("brand_id").notNull(),
	orderNumber: integer("order_number").notNull(),
	status: orderStatus().default('RECEIVED').notNull(),
	customerName: text("customer_name").notNull(),
	customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
	deliveryAddress: jsonb("delivery_address").notNull(),
	items: jsonb().notNull(),
	subtotalPaise: integer("subtotal_paise").notNull(),
	shippingPaise: integer("shipping_paise").notNull(),
	totalAmountPaise: integer("total_amount_paise").notNull(),
	paymentMethod: paymentMethod("payment_method").notNull(),
	paymentStatus: paymentStatus("payment_status").default('PENDING').notNull(),
	upiUtr: text("upi_utr"),
	trackingId: text("tracking_id"),
	courier: text(),
	whatsappLog: jsonb("whatsapp_log").default([]).notNull(),
	idempotencyKey: text("idempotency_key").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const productVariants = pgTable("product_variants", {
	id: uuid().defaultRandom().notNull(),
	productId: uuid("product_id").notNull(),
	brandId: uuid("brand_id").notNull(),
	sku: varchar({ length: 255 }).notNull(),
	title: text().notNull(),
	pricePaise: integer("price_paise").notNull(),
	stockQuantity: integer("stock_quantity").notNull(),
	attributes: jsonb(),
	position: integer(),
});
