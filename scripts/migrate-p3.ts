import "dotenv/config";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Creating Phase P3 tables if not exist...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "subscription_plans" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "slug" varchar(50) NOT NULL UNIQUE,
      "name" text NOT NULL,
      "price_paise" integer NOT NULL,
      "billing_cycle" varchar(20) DEFAULT 'MONTHLY' NOT NULL,
      "features" jsonb NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "brand_subscriptions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "brand_id" uuid NOT NULL UNIQUE REFERENCES "brands"("id") ON DELETE CASCADE,
      "plan_id" uuid NOT NULL REFERENCES "subscription_plans"("id"),
      "status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
      "trial_ends_at" timestamp with time zone,
      "current_period_starts_at" timestamp with time zone DEFAULT now() NOT NULL,
      "current_period_ends_at" timestamp with time zone,
      "feature_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "top_up_quotas" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "platform_secrets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "key_name" varchar(100) NOT NULL UNIQUE,
      "encrypted_value" text NOT NULL,
      "iv" text NOT NULL,
      "auth_tag" text NOT NULL,
      "masked_preview" text NOT NULL,
      "last_rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "last_used_at" timestamp with time zone
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "brand_credentials" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "brand_id" uuid NOT NULL REFERENCES "brands"("id") ON DELETE CASCADE,
      "service" varchar(50) NOT NULL,
      "encrypted_data" text NOT NULL,
      "iv" text NOT NULL,
      "auth_tag" text NOT NULL,
      "masked_preview" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "razorpay_route_account_id" text,
      "commission_percent_basis_points" integer DEFAULT 0 NOT NULL,
      "is_verified" boolean DEFAULT false NOT NULL,
      "last_tested_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "usage_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "brand_id" uuid NOT NULL REFERENCES "brands"("id") ON DELETE CASCADE,
      "type" varchar(50) NOT NULL,
      "quantity" integer DEFAULT 1 NOT NULL,
      "cost_estimate_paise" integer DEFAULT 0 NOT NULL,
      "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "platform_audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "admin_user_id" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
      "brand_id" uuid,
      "action" text NOT NULL,
      "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "ip_address" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "platform_daily_caps" (
      "date" varchar(10) PRIMARY KEY,
      "ai_cost_paise" integer DEFAULT 0 NOT NULL,
      "whatsapp_cost_paise" integer DEFAULT 0 NOT NULL,
      "daily_ai_cap_paise" integer DEFAULT 500000 NOT NULL,
      "daily_whatsapp_cap_paise" integer DEFAULT 1000000 NOT NULL
    );
  `);

  console.log("Phase P3 tables created successfully!");

  // Seed standard plans if not present
  console.log("Seeding default subscription plans...");

  const defaultPlans = [
    {
      slug: "starter",
      name: "Starter",
      pricePaise: 99900, // ₹999/mo
      billingCycle: "MONTHLY",
      features: {
        product_limit: 50,
        staff_seats: 1,
        storage_gb: 1,
        custom_domain: false,
        bulk_importer: false,
        discount_codes: false,
        abandoned_cart_whatsapp: false,
        cod_confirmation: true,
        reviews: false,
        shipping_integration: false,
        gst_invoices: false,
        ai_listing_monthly_quota: 10,
        whatsapp_monthly_quota: 100,
        custom_whatsapp_number: false,
        razorpay_gateway: false,
        hindi_admin: false,
        remove_powered_by: false,
        priority_support: false,
      },
    },
    {
      slug: "growth",
      name: "Growth",
      pricePaise: 249900, // ₹2,499/mo
      billingCycle: "MONTHLY",
      features: {
        product_limit: 300,
        staff_seats: 3,
        storage_gb: 5,
        custom_domain: true,
        bulk_importer: true,
        discount_codes: true,
        abandoned_cart_whatsapp: true,
        cod_confirmation: true,
        reviews: true,
        shipping_integration: true,
        gst_invoices: true,
        ai_listing_monthly_quota: 50,
        whatsapp_monthly_quota: 500,
        custom_whatsapp_number: false,
        razorpay_gateway: true,
        hindi_admin: true,
        remove_powered_by: false,
        priority_support: false,
      },
    },
    {
      slug: "pro",
      name: "Pro",
      pricePaise: 499900, // ₹4,999/mo
      billingCycle: "MONTHLY",
      features: {
        product_limit: 1500,
        staff_seats: 10,
        storage_gb: 25,
        custom_domain: true,
        bulk_importer: true,
        discount_codes: true,
        abandoned_cart_whatsapp: true,
        cod_confirmation: true,
        reviews: true,
        shipping_integration: true,
        gst_invoices: true,
        ai_listing_monthly_quota: 250,
        whatsapp_monthly_quota: 2500,
        custom_whatsapp_number: true,
        razorpay_gateway: true,
        hindi_admin: true,
        remove_powered_by: true,
        priority_support: true,
      },
    },
    {
      slug: "custom",
      name: "Enterprise Custom",
      pricePaise: 999900, // ₹9,999/mo
      billingCycle: "MONTHLY",
      features: {
        product_limit: -1, // Unlimited
        staff_seats: 50,
        storage_gb: 100,
        custom_domain: true,
        bulk_importer: true,
        discount_codes: true,
        abandoned_cart_whatsapp: true,
        cod_confirmation: true,
        reviews: true,
        shipping_integration: true,
        gst_invoices: true,
        ai_listing_monthly_quota: 1000,
        whatsapp_monthly_quota: 10000,
        custom_whatsapp_number: true,
        razorpay_gateway: true,
        hindi_admin: true,
        remove_powered_by: true,
        priority_support: true,
      },
    },
  ];

  for (const plan of defaultPlans) {
    await db.execute(sql`
      INSERT INTO "subscription_plans" ("slug", "name", "price_paise", "billing_cycle", "features", "is_active")
      VALUES (${plan.slug}, ${plan.name}, ${plan.pricePaise}, ${plan.billingCycle}, ${JSON.stringify(plan.features)}::jsonb, true)
      ON CONFLICT ("slug") DO UPDATE SET
        "name" = EXCLUDED."name",
        "price_paise" = EXCLUDED."price_paise",
        "features" = EXCLUDED."features",
        "updated_at" = now();
    `);
  }

  // Seed default brand subscriptions for existing brands (urban-streetwear -> Starter, linen-and-co -> Growth)
  const brandsRes: any = await db.execute(sql`SELECT id, slug FROM "brands"`);
  const starterPlanRes: any = await db.execute(sql`SELECT id FROM "subscription_plans" WHERE slug = 'starter' LIMIT 1`);
  const growthPlanRes: any = await db.execute(sql`SELECT id FROM "subscription_plans" WHERE slug = 'growth' LIMIT 1`);

  const starterPlanId = starterPlanRes.rows?.[0]?.id;
  const growthPlanId = growthPlanRes.rows?.[0]?.id;

  if (starterPlanId && brandsRes.rows) {
    for (const b of brandsRes.rows) {
      const planToUse = b.slug === "linen-and-co" ? growthPlanId : starterPlanId;
      await db.execute(sql`
        INSERT INTO "brand_subscriptions" ("brand_id", "plan_id", "status", "feature_overrides", "top_up_quotas")
        VALUES (${b.id}, ${planToUse}, 'ACTIVE', '{}'::jsonb, '{}'::jsonb)
        ON CONFLICT ("brand_id") DO NOTHING;
      `);
    }
  }

  console.log("Seeding completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
