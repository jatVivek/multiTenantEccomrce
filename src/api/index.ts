import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { brandsRouter } from "./brands";
import { productsRouter } from "./products";
import { ordersRouter } from "./orders";
import { bundlesRouter } from "./bundles";
import { adminRouter } from "./admin";
import { brandResolver } from "../middleware/brand-resolver";
import { rateLimiter } from "../middleware/rate-limiter";
import type { AppEnv } from "../types/hono";

const app = new Hono();

// ── Global Middleware ──────────────────────────────────────────────────
app.use("*", logger());
app.use("*", cors());

// Rate limit authentication attempts (20 attempts per 15 minutes)
app.use("/api/admin/login", rateLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: "Too many login attempts. Please wait 15 minutes." }));

// Rate limit order placement to prevent checkout spam (30 orders per 5 minutes per IP)
app.use("/api/brands/*/orders", rateLimiter({ windowMs: 5 * 60 * 1000, max: 30, message: "Rate limit exceeded. Please wait before placing more orders." }));
app.use("/api/tenant/orders", rateLimiter({ windowMs: 5 * 60 * 1000, max: 30, message: "Rate limit exceeded. Please wait before placing more orders." }));

// ── Static Asset Serving ───────────────────────────────────────────────
app.use("/css/*", serveStatic({ root: "./public" }));
app.use("/js/*", serveStatic({ root: "./public" }));

// ── Frontend HTML Views ────────────────────────────────────────────────
app.get("/store/:slug", serveStatic({ path: "./public/store.html" }));
app.get("/admin", serveStatic({ path: "./public/admin.html" }));

// ── Health Check ───────────────────────────────────────────────────────
app.get("/", (c) =>
  c.json({
    service: "ecom-multitenant",
    version: "0.1.0",
    status: "ok",
  })
);

// ── Admin & Auth Routes ───────────────────────────────────────────────
app.route("/api/admin", adminRouter);

// ── Brand CRUD (no brand context needed) ───────────────────────────────
app.route("/api/brands", brandsRouter);

// ── Brand-scoped routes (brand resolved from :slug or Host header) ─────
const brandScoped = new Hono<AppEnv>();
brandScoped.use("*", brandResolver);
brandScoped.route("/products", productsRouter);
brandScoped.route("/orders", ordersRouter);
brandScoped.route("/bundles", bundlesRouter);

// Support both path-based routing (/api/brands/:slug/...) and domain-based routing (/api/v1/...)
app.route("/api/brands/:slug", brandScoped);
app.route("/api/tenant", brandScoped);

export default app;
