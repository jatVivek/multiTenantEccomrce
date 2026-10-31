import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import { getProductBySlug } from "@/lib/db/queries/products";
import { getBundlesForProduct } from "@/lib/db/queries/bundles";
import { ProductDetailView } from "@/components/storefront/ProductDetailView";

interface ProductPageProps {
  params: Promise<{
    brand_slug: string;
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { brand_slug, slug } = await params;
  const brand = await getBrandBySlug(brand_slug);
  if (!brand) return { title: "Product Not Found" };

  const product = await getProductBySlug(brand.id, slug);
  if (!product) return { title: "Product Not Found" };

  const images = Array.isArray(product.images) && product.images.length > 0
    ? (product.images as string[])
    : [];

  return {
    title: `${product.title} | ${brand.name}`,
    description:
      product.description ||
      `Shop ${product.title} from ${brand.name}. Premium clothing crafted for comfort and durability.`,
    openGraph: {
      title: `${product.title} | ${brand.name}`,
      description: product.description || undefined,
      images: images.length > 0 ? [{ url: images[0] }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { brand_slug, slug } = await params;
  const brand = await getBrandBySlug(brand_slug);

  if (!brand) {
    notFound();
  }

  const product = await getProductBySlug(brand.id, slug);

  if (!product) {
    notFound();
  }

  const bundles = await getBundlesForProduct(brand.id, product.id);

  const productVideos = Array.isArray((product as any).videos)
    ? ((product as any).videos as { url: string; posterUrl?: string }[])
    : [];

  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || undefined,
    image: Array.isArray(product.images) ? product.images : [],
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: (product.basePricePaise / 100).toFixed(2),
      availability: "https://schema.org/InStock",
    },
  };

  if (productVideos.length > 0) {
    jsonLd.video = productVideos.map((v) => ({
      "@type": "VideoObject",
      name: `${product.title} - Video Showcase`,
      description: product.description || `${product.title} product showcase video`,
      thumbnailUrl:
        v.posterUrl ||
        (Array.isArray(product.images) && product.images[0]) ||
        "",
      contentUrl: v.url,
      uploadDate: new Date().toISOString(),
    }));
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailView
        product={product}
        bundles={bundles}
        brandSlug={brand.slug}
        brandName={brand.name}
      />
    </>
  );
}
