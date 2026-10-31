import { notFound } from "next/navigation";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import { getOrderById } from "@/lib/db/queries/orders";
import {
  generateUpiPaymentUrl,
  generateWhatsAppOrderLink,
} from "@/src/lib/payments";
import { OrderDetailView } from "@/components/orders/OrderDetailView";

interface OrderPageProps {
  params: Promise<{
    brand_slug: string;
    order_id: string;
  }>;
}

export async function generateMetadata({ params }: OrderPageProps) {
  const { brand_slug, order_id } = await params;
  const brand = await getBrandBySlug(brand_slug);
  if (!brand) return { title: "Order Details" };

  const order = await getOrderById(brand.id, order_id);
  if (!order) return { title: "Order Not Found" };

  return {
    title: `Order #${order.orderNumber} Confirmed | ${brand.name}`,
    description: `Order #${order.orderNumber} status and payment details for ${brand.name}.`,
  };
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { brand_slug, order_id } = await params;
  const brand = await getBrandBySlug(brand_slug);

  if (!brand) {
    notFound();
  }

  const order = await getOrderById(brand.id, order_id);

  if (!order) {
    notFound();
  }

  const upiPaymentUrl =
    order.paymentMethod === "UPI" ? generateUpiPaymentUrl(brand, order) : null;
  const whatsAppUrl = generateWhatsAppOrderLink(brand, order);

  return (
    <OrderDetailView
      order={order}
      brand={brand}
      upiPaymentUrl={upiPaymentUrl}
      whatsAppUrl={whatsAppUrl}
    />
  );
}
