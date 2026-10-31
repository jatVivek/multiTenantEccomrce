import type { Context, Next } from "hono";
import { verifyToken } from "../lib/auth";
import { db } from "../db/index";
import { adminUsers, adminBrandAccess } from "../db/schema";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../types/hono";

/**
 * Middleware that authenticates an admin request via Bearer token.
 */
export async function requireAdminAuth(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization token" }, 401);
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const [user] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, payload.userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found or deactivated" }, 401);
  }

  c.set("admin", user);
  await next();
}

/**
 * Middleware that ensures an admin has access to the brand specified in context or params.
 */
export async function requireBrandAccess(c: Context<AppEnv>, next: Next) {
  const admin = c.get("admin");
  if (!admin) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // SUPER_ADMIN has access to every brand
  if (admin.role === "SUPER_ADMIN") {
    return next();
  }

  const brand = c.get("brand");
  if (!brand) {
    return c.json({ error: "Brand context missing" }, 400);
  }

  const [access] = await db
    .select()
    .from(adminBrandAccess)
    .where(
      and(
        eq(adminBrandAccess.adminUserId, admin.id),
        eq(adminBrandAccess.brandId, brand.id)
      )
    )
    .limit(1);

  if (!access) {
    return c.json({ error: "Forbidden: You do not have access to this brand" }, 403);
  }

  await next();
}
