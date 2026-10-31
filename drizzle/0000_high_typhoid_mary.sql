-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."admin_role" AS ENUM('SUPER_ADMIN', 'BRAND_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('RECEIVED', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('UPI', 'COD');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PAID', 'COD', 'FAILED');--> statement-breakpoint
CREATE TABLE "admin_brand_access" (
	"admin_user_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "admin_role" DEFAULT 'BRAND_ADMIN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_order_counters" (
	"brand_id" uuid NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"whatsapp_number" varchar(20),
	"upi_vpa" varchar(255),
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"custom_domain" text,
	"theme_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundles" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"title" text NOT NULL,
	"bundle_price_paise" integer NOT NULL,
	"items" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"order_number" integer NOT NULL,
	"status" "order_status" DEFAULT 'RECEIVED' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" varchar(20) NOT NULL,
	"delivery_address" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"shipping_paise" integer NOT NULL,
	"total_amount_paise" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"upi_utr" text,
	"tracking_id" text,
	"courier" text,
	"whatsapp_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"sku" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"price_paise" integer NOT NULL,
	"stock_quantity" integer NOT NULL,
	"attributes" jsonb,
	"position" integer
);

*/