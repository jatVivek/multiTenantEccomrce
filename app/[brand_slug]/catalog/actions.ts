"use server";

import { getCatalogProducts, type CatalogFilterParams } from "@/lib/db/queries/products";

export async function loadMoreProductsAction(params: CatalogFilterParams) {
  if (!params.brandId) {
    throw new Error("brandId is required");
  }

  const result = await getCatalogProducts(params);
  return result;
}
