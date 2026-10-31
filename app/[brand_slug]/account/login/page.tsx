import { redirect } from "next/navigation";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import { getCurrentCustomer } from "@/app/[brand_slug]/account/actions";
import CustomerAuthForm from "./CustomerAuthForm";

interface LoginPageProps {
  params: Promise<{ brand_slug: string }>;
  searchParams: Promise<{ mode?: string; returnUrl?: string }>;
}

export default async function CustomerLoginPage({ params, searchParams }: LoginPageProps) {
  const { brand_slug } = await params;
  const { mode = "signin", returnUrl } = await searchParams;

  const brand = await getBrandBySlug(brand_slug);
  if (!brand) {
    redirect("/");
  }

  const current = await getCurrentCustomer(brand.id);
  if (current) {
    redirect(returnUrl || `/${brand_slug}/account/orders`);
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <CustomerAuthForm
        brandSlug={brand.slug}
        brandName={brand.name}
        initialMode={mode === "signup" ? "signup" : "signin"}
        returnUrl={returnUrl}
      />
    </div>
  );
}
