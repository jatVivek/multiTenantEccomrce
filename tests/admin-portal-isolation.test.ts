import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../lib/db";
import { brands, adminUsers, adminBrandAccess, orders } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getAdminByEmail,
  getAccessibleBrandsForAdmin,
  verifyAdminBrandAccess,
  updateOrderStatusAdmin,
} from "../lib/db/queries/admin";
import { verifyPassword, generateToken, verifyToken } from "../src/lib/auth";

describe("Admin Multi-Tenant Isolation & Security Suite", () => {
  let brand1: any;
  let brand2: any;
  let superAdmin: any;
  let brandAdmin: any;
  let brand1Order: any;

  beforeAll(async () => {
    // 1. Fetch the two seeded test brands
    const [b1] = await db.select().from(brands).where(eq(brands.slug, "urban-streetwear"));
    const [b2] = await db.select().from(brands).where(eq(brands.slug, "linen-and-co"));
    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    brand1 = b1;
    brand2 = b2;

    // 2. Fetch or verify Super Admin
    const superAdminRecord = await getAdminByEmail("admin@ecom.local");
    expect(superAdminRecord).not.toBeNull();
    superAdmin = superAdminRecord!.user;
    expect(superAdmin.role).toBe("SUPER_ADMIN");

    // 3. Fetch or verify Brand Admin (assigned ONLY to brand1)
    const brandAdminRecord = await getAdminByEmail("brandadmin1@ecom.local");
    expect(brandAdminRecord).not.toBeNull();
    brandAdmin = brandAdminRecord!.user;
    expect(brandAdmin.role).toBe("BRAND_ADMIN");

    // Ensure access mapping is strictly set for brand1 only
    const existingAccess = await db
      .select()
      .from(adminBrandAccess)
      .where(eq(adminBrandAccess.adminUserId, brandAdmin.id));

    const brandIds = existingAccess.map((a) => a.brandId);
    expect(brandIds).toContain(brand1.id);
    expect(brandIds).not.toContain(brand2.id);

    // 4. Find or create an order for brand1 to test isolation in updates
    const [existingOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.brandId, brand1.id))
      .limit(1);

    if (existingOrder) {
      brand1Order = existingOrder;
    } else {
      const [newOrder] = await db
        .insert(orders)
        .values({
          brandId: brand1.id,
          orderNumber: Math.floor(Date.now() / 1000),
          customerName: "Tester",
          customerPhone: "9876543210",
          deliveryAddress: {
            fullName: "Tester",
            addressLine1: "123 Street",
            city: "Mumbai",
            state: "MH",
            postalCode: "400001",
          },
          items: [],
          subtotalPaise: 100000,
          shippingPaise: 0,
          totalAmountPaise: 100000,
          paymentMethod: "COD",
          paymentStatus: "PENDING",
          status: "RECEIVED",
          idempotencyKey: `test-${Date.now()}`,
        })
        .returning();
      brand1Order = newOrder;
    }
  });

  it("SUPER_ADMIN has universal access to all active brands", async () => {
    const accessible = await getAccessibleBrandsForAdmin(
      superAdmin.id,
      superAdmin.role
    );
    const accessibleIds = accessible.map((b) => b.id);
    expect(accessibleIds).toContain(brand1.id);
    expect(accessibleIds).toContain(brand2.id);

    const hasAccessBrand1 = await verifyAdminBrandAccess(
      superAdmin.id,
      superAdmin.role,
      brand1.id
    );
    const hasAccessBrand2 = await verifyAdminBrandAccess(
      superAdmin.id,
      superAdmin.role,
      brand2.id
    );
    expect(hasAccessBrand1).toBe(true);
    expect(hasAccessBrand2).toBe(true);
  });

  it("BRAND_ADMIN is granted access ONLY to their assigned brand", async () => {
    const accessible = await getAccessibleBrandsForAdmin(
      brandAdmin.id,
      brandAdmin.role
    );
    const accessibleIds = accessible.map((b) => b.id);

    expect(accessibleIds).toContain(brand1.id);
    expect(accessibleIds).not.toContain(brand2.id);

    const hasAccessBrand1 = await verifyAdminBrandAccess(
      brandAdmin.id,
      brandAdmin.role,
      brand1.id
    );
    expect(hasAccessBrand1).toBe(true);
  });

  it("BRAND_ADMIN is strictly DENIED access to unassigned brand (tenant isolation)", async () => {
    const hasAccessBrand2 = await verifyAdminBrandAccess(
      brandAdmin.id,
      brandAdmin.role,
      brand2.id
    );
    expect(hasAccessBrand2).toBe(false);
  });

  it("Server-side token verification preserves role and userId", () => {
    const token = generateToken(brandAdmin);
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(brandAdmin.id);
    expect(payload?.role).toBe("BRAND_ADMIN");
  });

  it("Cross-tenant order update attempt is rejected by query layer scoping", async () => {
    // Attempting to modify brand1's order while passing brand2.id must fail
    await expect(
      updateOrderStatusAdmin(brand2.id, brand1Order.id, "DISPATCHED")
    ).rejects.toThrow(/Order not found or unauthorized brand modification/);
  });

  it("Legitimate order update within assigned brand succeeds", async () => {
    const updated = await updateOrderStatusAdmin(
      brand1.id,
      brand1Order.id,
      "PACKED"
    );
    expect(updated.id).toBe(brand1Order.id);
    expect(updated.status).toBe("PACKED");
    expect(updated.brandId).toBe(brand1.id);
  });
});
