"use client";

import React, { useState } from "react";
import type { AdminProductItem } from "@/lib/db/queries/admin";
import type { ImportBatch } from "@/src/db/schema";
import { ProductTableVirtual } from "./ProductTableVirtual";
import { CreateProductModal } from "./CreateProductModal";
import { BulkCsvImporterModal } from "./BulkCsvImporterModal";
import { useRouter } from "next/navigation";

interface ProductManagerClientProps {
  brandId: string;
  brandSlug: string;
  initialProducts: AdminProductItem[];
  recentBatches?: ImportBatch[];
}

export function ProductManagerClient({
  brandId,
  brandSlug,
  initialProducts,
  recentBatches = [],
}: ProductManagerClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const router = useRouter();

  return (
    <div>
      <ProductTableVirtual
        brandId={brandId}
        brandSlug={brandSlug}
        initialProducts={initialProducts}
        onOpenCreateModal={() => setIsModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
      />

      <CreateProductModal
        brandId={brandId}
        brandSlug={brandSlug}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />

      <BulkCsvImporterModal
        brandId={brandId}
        brandSlug={brandSlug}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        recentBatches={recentBatches}
        onBatchChange={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
