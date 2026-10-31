"use server";

import { getBrandBySlug } from "@/lib/db/queries/brands";
import {
  createOrderWithStockDecrement,
  type OrderItemInput,
} from "@/lib/db/queries/orders";

export interface CheckoutFormInput {
  brandSlug: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: "UPI" | "COD";
  items: OrderItemInput[];
  shippingPaise: number;
}

export async function placeOrderAction(data: CheckoutFormInput) {
  if (!data.brandSlug) throw new Error("brandSlug is required");

  const brand = await getBrandBySlug(data.brandSlug);
  if (!brand) throw new Error("Brand not found");

  if (!data.customerName || !data.customerName.trim()) {
    throw new Error("Full name is required");
  }

  const phoneDigits = data.customerPhone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    throw new Error("Valid 10-digit phone number is required");
  }

  if (!data.street || !data.city || !data.state || !data.pincode) {
    throw new Error("Complete delivery address (street, city, state, pincode) is required");
  }

  if (!data.items || data.items.length === 0) {
    throw new Error("Your cart is empty");
  }

  const result = await createOrderWithStockDecrement({
    brand,
    customerName: data.customerName.trim(),
    customerPhone: phoneDigits,
    deliveryAddress: {
      street: data.street.trim(),
      city: data.city.trim(),
      state: data.state.trim(),
      pincode: data.pincode.trim(),
      ...(data.customerEmail ? { email: data.customerEmail.trim() } : {}),
    },
    items: data.items,
    shippingPaise: data.shippingPaise,
    paymentMethod: data.paymentMethod,
  });

  return {
    success: true,
    orderId: result.order.id,
    orderNumber: result.order.orderNumber,
    upiPaymentUrl: result.upiPaymentUrl,
    whatsAppUrl: result.whatsAppUrl,
  };
}
