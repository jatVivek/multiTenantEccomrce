import { db } from "../index";
import {
  orders,
  productVariants,
  type Order,
  type Brand,
} from "../../../src/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { nextOrderNumber } from "../../../src/lib/order-number";
import {
  generateUpiPaymentUrl,
  generateWhatsAppOrderLink,
} from "../../../src/lib/payments";

export interface OrderItemInput {
  variantId?: string;
  productId?: string;
  bundleId?: string;
  title: string;
  sku: string;
  qty: number;
  unitPricePaise: number;
  attributes?: Record<string, any>;
  image?: string;
}

export interface CreateOrderParams {
  brand: Brand;
  customerName: string;
  customerPhone: string;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    email?: string;
  };
  items: OrderItemInput[];
  shippingPaise: number;
  paymentMethod: "UPI" | "COD";
  idempotencyKey?: string;
}

export async function getOrdersByBrand(
  brandId: string,
  limit = 50
): Promise<Order[]> {
  if (!brandId) throw new Error("brandId is required");

  return db
    .select()
    .from(orders)
    .where(eq(orders.brandId, brandId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function getOrderById(
  brandId: string,
  orderId: string
): Promise<Order | null> {
  if (!brandId) throw new Error("brandId is required");
  if (!orderId) return null;

  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.brandId, brandId)))
    .limit(1);

  return row ?? null;
}

export async function getOrderByNumber(
  brandId: string,
  orderNumber: number
): Promise<Order | null> {
  if (!brandId) throw new Error("brandId is required");
  if (!orderNumber) return null;

  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), eq(orders.brandId, brandId)))
    .limit(1);

  return row ?? null;
}

export async function createOrderWithStockDecrement(
  params: CreateOrderParams
): Promise<{ order: Order; upiPaymentUrl: string | null; whatsAppUrl: string }> {
  const { brand, customerName, customerPhone, deliveryAddress, items, shippingPaise, paymentMethod } = params;

  if (!brand?.id) throw new Error("brandId is required");
  if (!items || items.length === 0) throw new Error("Order must contain at least one item");

  const subtotalPaise = items.reduce(
    (sum, item) => sum + item.unitPricePaise * item.qty,
    0
  );
  const totalAmountPaise = subtotalPaise + shippingPaise;
  const idempotencyKey = params.idempotencyKey || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Atomic stock check and decrement transaction
  const createdOrder = await db.transaction(async (tx) => {
    // 1. Verify stock and decrement for any variant-backed items
    for (const item of items) {
      if (item.variantId) {
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

        // Decrement stock
        await tx
          .update(productVariants)
          .set({
            stockQuantity: sql`${productVariants.stockQuantity} - ${item.qty}`,
          })
          .where(eq(productVariants.id, item.variantId));
      }
    }

    // 2. Generate atomic sequential order number
    const orderNumber = await nextOrderNumber(brand.id);

    // 3. Insert order record
    const [newOrder] = await tx
      .insert(orders)
      .values({
        brandId: brand.id,
        orderNumber,
        customerName,
        customerPhone,
        deliveryAddress,
        items,
        subtotalPaise,
        shippingPaise,
        totalAmountPaise,
        paymentMethod,
        paymentStatus: paymentMethod === "COD" ? "COD" : "PENDING",
        idempotencyKey,
      })
      .returning();

    return newOrder;
  });

  const upiPaymentUrl =
    createdOrder.paymentMethod === "UPI"
      ? generateUpiPaymentUrl(brand, createdOrder)
      : null;
  const whatsAppUrl = generateWhatsAppOrderLink(brand, createdOrder);

  return {
    order: createdOrder,
    upiPaymentUrl,
    whatsAppUrl,
  };
}

export async function recordUpiUtr(
  brandId: string,
  orderId: string,
  upiUtr: string
): Promise<Order> {
  if (!brandId) throw new Error("brandId is required");
  if (!orderId) throw new Error("orderId is required");
  if (!upiUtr || !upiUtr.trim()) throw new Error("UPI UTR cannot be empty");

  const [updated] = await db
    .update(orders)
    .set({
      upiUtr: upiUtr.trim(),
      paymentStatus: "PAID",
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.brandId, brandId)))
    .returning();

  if (!updated) {
    throw new Error("Order not found or brand mismatch");
  }

  return updated;
}
