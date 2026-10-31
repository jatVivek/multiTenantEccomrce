import { redirect } from "next/navigation";
import Link from "next/link";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import { getCurrentCustomer } from "./actions";
import ProfileClient from "./ProfileClient";
import { ChevronRight, Home, User } from "lucide-react";

interface AccountPageProps {
  params: Promise<{ brand_slug: string }>;
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { brand_slug } = await params;
  const brand = await getBrandBySlug(brand_slug);

  if (!brand) {
    redirect("/");
  }

  const customer = await getCurrentCustomer(brand.id);

  if (!customer) {
    redirect(`/${brand.slug}/account/login?returnUrl=/${brand.slug}/account`);
  }

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-brand-muted mb-6">
        <Link href={`/${brand.slug}`} className="hover:text-brand-text flex items-center gap-1">
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-brand-text font-medium flex items-center gap-1">
          <User className="w-3.5 h-3.5" />
          <span>My Account</span>
        </span>
      </nav>

      <ProfileClient
        brandSlug={brand.slug}
        brandName={brand.name}
        customer={customer}
      />
    </div>
  );
}
