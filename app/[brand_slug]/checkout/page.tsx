import { notFound } from "next/navigation";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import { getCurrentCustomer } from "@/app/[brand_slug]/account/actions";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import type { SavedAddress } from "@/lib/db/queries/customers";

interface CheckoutPageProps {
  params: Promise<{ brand_slug: string }>;
}

export async function generateMetadata({ params }: CheckoutPageProps) {
  const { brand_slug } = await params;
  const brand = await getBrandBySlug(brand_slug);
  if (!brand) return { title: "Checkout" };

  return {
    title: `Secure Checkout | ${brand.name}`,
    description: `Complete your order safely with UPI or Cash on Delivery at ${brand.name}.`,
  };
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { brand_slug } = await params;
  const brand = await getBrandBySlug(brand_slug);

  if (!brand) {
    notFound();
  }

  const customer = await getCurrentCustomer(brand.id);

  return (
    <CheckoutForm
      brandSlug={brand.slug}
      brandName={brand.name}
      customer={
        customer
          ? {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              savedAddresses: (customer.savedAddresses as unknown as SavedAddress[]) || [],
            }
          : null
      }
    />
  );
}
