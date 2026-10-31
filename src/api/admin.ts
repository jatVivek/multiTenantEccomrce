import { Hono } from "hono";
import { db } from "../db/index";
import {
  adminUsers,
  adminAuthCredentials,
  adminBrandAccess,
  brands,
  orders,
} from "../db/schema";
import { eq, sql, inArray, desc, and } from "drizzle-orm";
import {
  adminLoginSchema,
  adminRegisterSchema,
  grantBrandAccessSchema,
  updateOrderStatusSchema,
} from "../types/validators";
import { hashPassword, verifyPassword, generateToken } from "../lib/auth";
import { requireAdminAuth } from "../middleware/auth";
import type { AppEnv } from "../types/hono";

export const adminRouter = new Hono<AppEnv>();

// Register new admin account
adminRouter.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = adminRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { email, password, role, brandIds } = parsed.data;

  // Check if admin already exists
  const [existing] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (existing) {
    return c.json({ error: "Admin with this email already exists" }, 409);
  }

  const hashedPassword = await hashPassword(password);

  const [newUser] = await db
    .insert(adminUsers)
    .values({
      id: crypto.randomUUID(),
      email,
      role,
    })
    .returning();

  await db.insert(adminAuthCredentials).values({
    adminUserId: newUser.id,
    passwordHash: hashedPassword,
  });

  if (brandIds && brandIds.length > 0) {
    await db.insert(adminBrandAccess).values(
      brandIds.map((bId) => ({
        adminUserId: newUser.id,
        brandId: bId,
      }))
    );
  }

  const token = generateToken(newUser);

  return c.json(
    {
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
      token,
    },
    201
  );
});

// Login
adminRouter.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const [cred] = await db
    .select()
    .from(adminAuthCredentials)
    .where(eq(adminAuthCredentials.adminUserId, user.id))
    .limit(1);

  if (!cred) {
    return c.json({ error: "Authentication credentials not configured" }, 401);
  }

  const matches = await verifyPassword(password, cred.passwordHash);
  if (!matches) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const token = generateToken(user);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    token,
  });
});

// Admin Profile
adminRouter.get("/me", requireAdminAuth, async (c) => {
  const admin = c.get("admin")!;

  let accessibleBrands: { id: string; name: string; slug: string }[] = [];

  if (admin.role === "SUPER_ADMIN") {
    accessibleBrands = await db
      .select({ id: brands.id, name: brands.name, slug: brands.slug })
      .from(brands);
  } else {
    const accessList = await db
      .select({ brandId: adminBrandAccess.brandId })
      .from(adminBrandAccess)
      .where(eq(adminBrandAccess.adminUserId, admin.id));

    const brandIds = accessList.map((a) => a.brandId);
    if (brandIds.length > 0) {
      accessibleBrands = await db
        .select({ id: brands.id, name: brands.name, slug: brands.slug })
        .from(brands)
        .where(inArray(brands.id, brandIds));
    }
  }

  return c.json({
    user: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    brands: accessibleBrands,
  });
});

// Assign brand to admin
adminRouter.post("/brand-access", requireAdminAuth, async (c) => {
  const currentAdmin = c.get("admin")!;
  if (currentAdmin.role !== "SUPER_ADMIN") {
    return c.json({ error: "Only SUPER_ADMIN can assign brand access" }, 403);
  }

  const body = await c.req.json();
  const parsed = grantBrandAccessSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [granted] = await db
    .insert(adminBrandAccess)
    .values(parsed.data)
    .onConflictDoNothing()
    .returning();

  return c.json({ message: "Brand access granted", access: granted }, 201);
});

// Overall stats dashboard
adminRouter.get("/dashboard-stats", requireAdminAuth, async (c) => {
  const admin = c.get("admin")!;

  let brandFilterClause = sql`1=1`;

  if (admin.role !== "SUPER_ADMIN") {
    const accessList = await db
      .select({ brandId: adminBrandAccess.brandId })
      .from(adminBrandAccess)
      .where(eq(adminBrandAccess.adminUserId, admin.id));

    const brandIds = accessList.map((a) => a.brandId);
    if (brandIds.length === 0) {
      return c.json({
        totalOrders: 0,
        totalRevenuePaise: 0,
        recentOrders: [],
      });
    }
    brandFilterClause = sql`${inArray(orders.brandId, brandIds)}`;
  }

  const statsResult = await db.execute(sql`
    SELECT
      COUNT(*)::int as total_orders,
      COALESCE(SUM(total_amount_paise), 0)::bigint as total_revenue_paise
    FROM orders
    WHERE ${brandFilterClause};
  `);

  return c.json({
    totalOrders: statsResult.rows[0].total_orders,
    totalRevenuePaise: statsResult.rows[0].total_revenue_paise,
  });
});

// List orders for accessible brands
adminRouter.get("/orders", requireAdminAuth, async (c) => {
  const admin = c.get("admin")!;

  let accessibleBrandIds: string[] = [];
  if (admin.role !== "SUPER_ADMIN") {
    const accessList = await db
      .select({ brandId: adminBrandAccess.brandId })
      .from(adminBrandAccess)
      .where(eq(adminBrandAccess.adminUserId, admin.id));
    accessibleBrandIds = accessList.map((a) => a.brandId);
    if (accessibleBrandIds.length === 0) {
      return c.json([]);
    }
  }

  const query = db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      brandId: orders.brandId,
      brandName: brands.name,
      status: orders.status,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      items: orders.items,
      totalAmountPaise: orders.totalAmountPaise,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      trackingId: orders.trackingId,
      courier: orders.courier,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(brands, eq(orders.brandId, brands.id))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  if (admin.role !== "SUPER_ADMIN") {
    query.where(inArray(orders.brandId, accessibleBrandIds));
  }

  const rows = await query;
  return c.json(rows);
});

// Update order status, tracking ID and courier
adminRouter.patch("/orders/:orderId/fulfillment", requireAdminAuth, async (c) => {
  const admin = c.get("admin")!;
  const orderId = c.req.param("orderId");
  if (!orderId) {
    return c.json({ error: "Order ID is required" }, 400);
  }
  const body = await c.req.json();
  const parsed = updateOrderStatusSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Check order existence and permission
  const [order] = await db
    .select({ id: orders.id, brandId: orders.brandId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  if (admin.role !== "SUPER_ADMIN") {
    const [access] = await db
      .select()
      .from(adminBrandAccess)
      .where(
        and(
          eq(adminBrandAccess.adminUserId, admin.id),
          eq(adminBrandAccess.brandId, order.brandId)
        )
      )
      .limit(1);

    if (!access) {
      return c.json({ error: "Forbidden: You do not manage this order's brand" }, 403);
    }
  }

  const [updated] = await db
    .update(orders)
    .set({
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return c.json({ message: "Order fulfillment updated", order: updated });
});
