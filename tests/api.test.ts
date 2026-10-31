import { describe, it, expect } from "vitest";
import app from "../src/api/index";

describe("API Health & Routes", () => {
  it("GET / returns service health status", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      service: "ecom-multitenant",
      version: "0.1.0",
      status: "ok",
    });
  });

  it("GET /api/brands returns active brands array", async () => {
    const res = await app.request("/api/brands");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json[0]).toHaveProperty("slug");
    expect(json[0]).toHaveProperty("name");
  });

  it("GET /api/brands/:slug/products returns products for valid brand", async () => {
    const res = await app.request("/api/brands/demo-brand/products");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });

  it("GET /api/brands/:slug returns 404 for nonexistent brand", async () => {
    const res = await app.request("/api/brands/nonexistent-brand-slug-999");
    expect(res.status).toBe(404);
  });
});
