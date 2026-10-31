import { Hono } from "hono";
import { db } from "../db/index";
import { orders, productVariants } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  submitUpiPaymentSchema,
} from "../types/validators";
import { nextOrderNumber } from "../lib/order-number";
import { generateUpiPaymentUrl, generateWhatsAppOrderLink } from "../lib/payments";
import type { AppEnv } from "../types/hono";

export const ordersRouter = new Hono<AppEnv>();

// List orders for a brand (newest first)
ordersRouter.get("/", async (c) => {
  const brand = c.get("brand");

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.brandId, brand.id))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  return c.json(rows);
});

// Get a single order
ordersRouter.get("/:orderId", async (c) => {
  const brand = c.get("brand");
  const orderId = c.req.param("orderId");

  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.brandId, brand.id)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Order not found" }, 404);
  }

  return c.json(row);
});

// Place a new order
ordersRouter.post("/", async (c) => {
  const brand = c.get("brand");
  const body = await c.req.json();
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;

  // Calculate totals
  const subtotalPaise = data.items.reduce(
    (sum, item) => sum + item.unitPricePaise * item.qty,
    0
  );
  const totalAmountPaise = subtotalPaise + data.shippingPaise;

  // Check and decrement stock atomically using a transaction
  let created;
  try {
    created = await db.transaction(async (tx) => {
      // 1. Verify stock for all ordered variants
      for (const item of data.items) {
        const [variant] = await tx
          .select({
            id: productVariants.id,
            stockQuantity: productVariants.stockQuantity,
            title: productVariants.title,
          })
          .from(productVariants)
          .where(
            and(
              eq(productVariants.id, item.variantId),
              eq(productVariants.brandId, brand.id)
            )
          )
          .limit(1);

        if (!variant) {
          throw new Error(`Variant "${item.title || item.variantId}" not found`);
        }

        if (variant.stockQuantity < item.qty) {
          throw new Error(
            `Insufficient stock for "${variant.title}". Available: ${variant.stockQuantity}, Requested: ${item.qty}`
          );
        }

        // 2. Decrement stock
        await tx
          .update(productVariants)
          .set({
            stockQuantity: sql`${productVariants.stockQuantity} - ${item.qty}`,
          })
          .where(eq(productVariants.id, item.variantId));
      }

      // 3. Get atomic order number
      const orderNumber = await nextOrderNumber(brand.id);

      // 4. Insert order
      const [newOrder] = await tx
        .insert(orders)
        .values({
          brandId: brand.id,
          orderNumber,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          deliveryAddress: data.deliveryAddress,
          items: data.items,
          subtotalPaise,
          shippingPaise: data.shippingPaise,
          totalAmountPaise,
          paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentMethod === "COD" ? "COD" : "PENDING",
          idempotencyKey: data.idempotencyKey,
        })
        .returning();

      return newOrder;
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to process order" }, 400);
  }

  const upiUrl = created.paymentMethod === "UPI" ? generateUpiPaymentUrl(brand, created) : null;
  const whatsAppUrl = generateWhatsAppOrderLink(brand, created);

  return c.json(
    {
      ...created,
      paymentLinks: {
        upi: upiUrl,
        whatsapp: whatsAppUrl,
      },
    },
    201
  );
});

// Update order status
ordersRouter.patch("/:orderId/status", async (c) => {
  const brand = c.get("brand");
  const orderId = c.req.param("orderId");
  const body = await c.req.json();
  const parsed = updateOrderStatusSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(orders)
    .set({
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.brandId, brand.id)))
    .returning();

  if (!updated) {
    return c.json({ error: "Order not found" }, 404);
  }

  return c.json(updated);
});

// Submit UPI UTR / Transaction Reference Number
ordersRouter.post("/:orderId/upi-utr", async (c) => {
  const brand = c.get("brand");
  const orderId = c.req.param("orderId");
  const body = await c.req.json();
  const parsed = submitUpiPaymentSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(orders)
    .set({
      upiUtr: parsed.data.upiUtr,
      paymentStatus: "PAID",
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.brandId, brand.id)))
    .returning();

  if (!updated) {
    return c.json({ error: "Order not found" }, 404);
  }

  return c.json({
    message: "UPI transaction reference recorded successfully",
    order: updated,
  });
});

