import { redirect } from "next/navigation";
import Link from "next/link";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import { getCustomerOrderHistory } from "@/lib/db/queries/customers";
import { getCurrentCustomer } from "@/app/[brand_slug]/account/actions";
import CustomerOrdersClient from "./CustomerOrdersClient";
import { Package, User, ArrowRight } from "lucide-react";

interface OrdersPageProps {
  params: Promise<{ brand_slug: string }>;
}

export default async function CustomerOrdersPage({ params }: OrdersPageProps) {
  const { brand_slug } = await params;
  const brand = await getBrandBySlug(brand_slug);

  if (!brand) {
    redirect("/");
  }

  const customer = await getCurrentCustomer(brand.id);

  if (!customer) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-brand-secondary flex items-center justify-center text-brand-text">
          <Package className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-bold text-brand-text">
            Track &amp; View Your Orders
          </h1>
          <p className="text-sm text-brand-muted max-w-md mx-auto">
            Please sign in to your {brand.name} account to view your complete order history, track shipments, and manage cancellations.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/${brand.slug}/account/login?returnUrl=/${brand.slug}/account/orders`}
            className="tap-target-44 px-6 py-2.5 rounded-xl bg-brand-primary text-brand-primary-foreground text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
          >
            <User className="w-4 h-4" />
            <span>Sign In to Your Account</span>
          </Link>
          <Link
            href={`/${brand.slug}/catalog`}
            className="tap-target-44 px-6 py-2.5 rounded-xl border border-brand-border text-brand-text text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-brand-secondary"
          >
            <span>Explore Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const orders = await getCustomerOrderHistory(brand.id, customer.phone, customer.email);

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      <CustomerOrdersClient
        brandSlug={brand.slug}
        brandName={brand.name}
        customer={customer}
        initialOrders={orders}
      />
    </div>
  );
}
