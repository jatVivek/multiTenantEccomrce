/**
 * Helper to resolve links entered in the Theme Customizer into valid storefront URLs.
 * Handles root relative paths ('/catalog'), brand relative paths ('/urban-streetwear/catalog'),
 * relative strings ('catalog?category=Bottoms'), and absolute external links ('https://...').
 */
export function resolveStorefrontUrl(
  url: string | undefined | null,
  brandSlug: string
): string {
  if (!url || !url.trim()) return `/${brandSlug}`;
  const trimmed = url.trim();

  // External URLs or mailto/tel protocols
  if (/^(https?:|\/\/|mailto:|tel:|#)/i.test(trimmed)) {
    return trimmed;
  }

  // If already starts with the brand slug
  if (trimmed === `/${brandSlug}` || trimmed.startsWith(`/${brandSlug}/`)) {
    return trimmed;
  }

  // Root link
  if (trimmed === "/") {
    return `/${brandSlug}`;
  }

  // Relative link starting with slash (e.g. /catalog?category=Tops)
  if (trimmed.startsWith("/")) {
    return `/${brandSlug}${trimmed}`;
  }

  // Relative link without slash
  return `/${brandSlug}/${trimmed}`;
}
