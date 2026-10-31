import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { rateLimiter } from "../src/middleware/rate-limiter";

describe("Rate Limiting Middleware", () => {
  it("blocks requests once the threshold is exceeded within the window", async () => {
    const testApp = new Hono();
    testApp.use(
      "/limited",
      rateLimiter({ windowMs: 1000, max: 2, message: "Exceeded limit" })
    );
    testApp.get("/limited", (c) => c.text("OK"));

    // 1st request -> 200
    const res1 = await testApp.request("/limited");
    expect(res1.status).toBe(200);
    expect(res1.headers.get("X-RateLimit-Remaining")).toBe("1");

    // 2nd request -> 200
    const res2 = await testApp.request("/limited");
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-RateLimit-Remaining")).toBe("0");

    // 3rd request -> 429
    const res3 = await testApp.request("/limited");
    expect(res3.status).toBe(429);
    const body = await res3.json();
    expect(body.error).toBe("Exceeded limit");
  });
});
