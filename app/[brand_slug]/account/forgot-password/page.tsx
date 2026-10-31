import { redirect } from "next/navigation";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import ForgotPasswordClient from "./ForgotPasswordClient";

interface ForgotPasswordPageProps {
  params: Promise<{ brand_slug: string }>;
}

export default async function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const { brand_slug } = await params;
  const brand = await getBrandBySlug(brand_slug);

  if (!brand) {
    redirect("/");
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <ForgotPasswordClient brandSlug={brand.slug} brandName={brand.name} />
    </div>
  );
}
