import type { Brand, Order } from "../db/schema";

/**
 * Generates an instant UPI Deep Link compatible with GPay, PhonePe, Paytm, BHIM, Cred, etc.
 * Spec: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<note>
 */
export function generateUpiPaymentUrl(brand: Brand, order: Order): string {
  const vpa = brand.upiVpa || "merchant@upi";
  const payeeName = encodeURIComponent(brand.name);
  const amount = (order.totalAmountPaise / 100).toFixed(2);
  const transactionNote = encodeURIComponent(`Order #${order.orderNumber} ${brand.name}`);

  return `upi://pay?pa=${vpa}&pn=${payeeName}&am=${amount}&cu=INR&tn=${transactionNote}`;
}

/**
 * Builds standard WhatsApp direct chat link with prefilled order notification.
 * https://wa.me/<number>?text=<encoded_text>
 */
export function generateWhatsAppOrderLink(brand: Brand, order: Order): string {
  const phone = (brand.whatsappNumber || "").replace(/[^0-9]/g, "");
  const amountStr = (order.totalAmountPaise / 100).toFixed(2);

  const message = [
    `*New Order #${order.orderNumber}* for ${brand.name}!`,
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    `Payment Method: ${order.paymentMethod}`,
    `Total: ₹${amountStr}`,
    `Status: ${order.status}`,
    order.upiUtr ? `UPI UTR: ${order.upiUtr}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
