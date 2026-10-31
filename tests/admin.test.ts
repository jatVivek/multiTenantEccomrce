import { describe, it, expect } from "vitest";
import app from "../src/api/index";

describe("Admin & Auth API", () => {
  const testAdminEmail = `admin-${Date.now()}@example.com`;
  const testPassword = "securePassword123!";
  let adminToken = "";
  let adminId = "";

  it("POST /api/admin/register creates a new admin user", async () => {
    const res = await app.request("/api/admin/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testAdminEmail,
        password: testPassword,
        role: "SUPER_ADMIN",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty("token");
    expect(json.user.email).toBe(testAdminEmail);
    expect(json.user.role).toBe("SUPER_ADMIN");

    adminToken = json.token;
    adminId = json.user.id;
  });

  it("POST /api/admin/login logs in with valid credentials", async () => {
    const res = await app.request("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testAdminEmail,
        password: testPassword,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("token");
  });

  it("GET /api/admin/me returns profile for authenticated admin", async () => {
    const res = await app.request("/api/admin/me", {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.email).toBe(testAdminEmail);
    expect(json.user.role).toBe("SUPER_ADMIN");
    expect(Array.isArray(json.brands)).toBe(true);
  });

  it("GET /api/admin/dashboard-stats returns aggregated metrics", async () => {
    const res = await app.request("/api/admin/dashboard-stats", {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("totalOrders");
    expect(json).toHaveProperty("totalRevenuePaise");
  });

  it("GET /api/admin/me returns 401 with missing/invalid token", async () => {
    const res = await app.request("/api/admin/me", {
      headers: {
        Authorization: "Bearer invalid_token_123",
      },
    });

    expect(res.status).toBe(401);
  });
});
