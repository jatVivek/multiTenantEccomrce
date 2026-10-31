import type { Context, Next } from "hono";

interface RateLimitStore {
  [ip: string]: {
    count: number;
    resetTime: number;
  };
}

/**
 * Creates an in-memory sliding window rate limiter middleware.
 *
 * @param windowMs Time window in milliseconds
 * @param max Max allowed requests within windowMs
 */
export function rateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const store: RateLimitStore = {};

  // Periodically clean up expired entries
  setInterval(() => {
    const now = Date.now();
    for (const key in store) {
      if (store[key].resetTime <= now) {
        delete store[key];
      }
    }
  }, options.windowMs).unref();

  return async (c: Context, next: Next) => {
    const forwarded = c.req.header("x-forwarded-for");
    const ip = (forwarded ? forwarded.split(",")[0] : "127.0.0.1").trim();
    const now = Date.now();

    if (!store[ip] || store[ip].resetTime <= now) {
      store[ip] = {
        count: 1,
        resetTime: now + options.windowMs,
      };
    } else {
      store[ip].count += 1;
    }

    c.header("X-RateLimit-Limit", String(options.max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, options.max - store[ip].count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(store[ip].resetTime / 1000)));

    if (store[ip].count > options.max) {
      return c.json(
        {
          error: options.message || "Too many requests, please try again later.",
        },
        429
      );
    }

    await next();
  };
}
