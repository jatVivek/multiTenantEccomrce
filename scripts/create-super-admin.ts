import { db } from "../lib/db/index";
import { adminUsers, adminAuthCredentials, adminBrandAccess, brands } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL || "admin@ecom.local";
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || "Admin@123456";

  console.log(`🔐 Creating Super Admin account for: ${email}`);

  const hashedPassword = await hashPassword(password);

  const [existing] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  let userId: string;

  if (existing) {
    userId = existing.id;
    await db
      .update(adminUsers)
      .set({ role: "SUPER_ADMIN" })
      .where(eq(adminUsers.id, userId));

    await db
      .insert(adminAuthCredentials)
      .values({
        adminUserId: userId,
        passwordHash: hashedPassword,
      })
      .onConflictDoUpdate({
        target: adminAuthCredentials.adminUserId,
        set: { passwordHash: hashedPassword, updatedAt: new Date().toISOString() },
      });

    console.log(`✅ Existing user updated to SUPER_ADMIN`);
  } else {
    userId = crypto.randomUUID();
    const [newUser] = await db
      .insert(adminUsers)
      .values({
        id: userId,
        email,
        role: "SUPER_ADMIN",
      })
      .returning();

    await db.insert(adminAuthCredentials).values({
      adminUserId: newUser.id,
      passwordHash: hashedPassword,
    });

    console.log(`✅ Created new SUPER_ADMIN user`);
  }

  // Also create a demo BRAND_ADMIN assigned strictly to Brand 1 (urban-streetwear) for isolation tests
  const brand1 = await db
    .select()
    .from(brands)
    .where(eq(brands.slug, "urban-streetwear"))
    .limit(1);

  if (brand1.length > 0) {
    const brandAdminEmail = "brandadmin1@ecom.local";
    const brandAdminPassword = await hashPassword("BrandAdmin@123");
    let [brandAdmin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, brandAdminEmail))
      .limit(1);

    if (!brandAdmin) {
      [brandAdmin] = await db
        .insert(adminUsers)
        .values({
          id: crypto.randomUUID(),
          email: brandAdminEmail,
          role: "BRAND_ADMIN",
        })
        .returning();

      await db.insert(adminAuthCredentials).values({
        adminUserId: brandAdmin.id,
        passwordHash: brandAdminPassword,
      });
    }

    // Assign strictly to brand 1
    await db
      .insert(adminBrandAccess)
      .values({
        adminUserId: brandAdmin.id,
        brandId: brand1[0].id,
      })
      .onConflictDoNothing();

    console.log(`✅ BRAND_ADMIN ready: ${brandAdminEmail} (assigned exclusively to ${brand1[0].name})`);
  }

  console.log("\n========================================================");
  console.log(`🎉 SUPER_ADMIN Credentials:`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Portal:   /admin/login`);
  console.log("========================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed to create super admin:", err);
  process.exit(1);
});
