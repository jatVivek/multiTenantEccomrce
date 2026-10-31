"use server";

import { getBrandBySlug } from "@/lib/db/queries/brands";
import { recordUpiUtr } from "@/lib/db/queries/orders";

export async function submitUpiUtrAction(
  brandSlug: string,
  orderId: string,
  upiUtr: string
) {
  if (!brandSlug) throw new Error("brandSlug is required");
  if (!orderId) throw new Error("orderId is required");
  if (!upiUtr || !upiUtr.trim()) throw new Error("Please enter a valid UPI reference number (UTR)");

  const brand = await getBrandBySlug(brandSlug);
  if (!brand) throw new Error("Brand not found");

  const updatedOrder = await recordUpiUtr(brand.id, orderId, upiUtr.trim());

  return {
    success: true,
    order: updatedOrder,
  };
}
