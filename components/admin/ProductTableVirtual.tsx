"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AdminProductItem } from "@/lib/db/queries/admin";
import type { ProductVariant } from "@/src/db/schema";
import {
  updateVariantStockAction,
  deleteProductAction,
} from "@/app/admin/actions";
import {
  Search,
  Plus,
  Trash2,
  Edit,
  ChevronRight,
  Package,
  Layers,
  Sparkles,
  Check,
  X,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { EditProductModal } from "./EditProductModal";

interface ProductTableVirtualProps {
  brandId: string;
  brandSlug: string;
  initialProducts: AdminProductItem[];
  onOpenCreateModal: () => void;
  onOpenImportModal?: () => void;
}

export function ProductTableVirtual({
  brandId,
  brandSlug,
  initialProducts,
  onOpenCreateModal,
  onOpenImportModal,
}: ProductTableVirtualProps) {
  const [data, setData] = useState<AdminProductItem[]>(initialProducts);
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [editStockVal, setEditStockVal] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // Edit Product Modal State & Cache Synchronization Guard
  const [editingProduct, setEditingProduct] = useState<AdminProductItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const lastMutationTimeRef = useRef<Record<string, number>>({});

  // Guard against stale background query/RSC re-render race condition
  useEffect(() => {
    setData((prevData) => {
      const now = Date.now();
      return initialProducts.map((serverItem) => {
        const lastMutated = lastMutationTimeRef.current[serverItem.id];
        // If mutated locally within the last 6 seconds, retain local state until confirmed
        if (lastMutated && now - lastMutated < 6000) {
          const localItem = prevData.find((p) => p.id === serverItem.id);
          return localItem || serverItem;
        }
        return serverItem;
      });
    });
  }, [initialProducts]);

  // Derive unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    initialProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [initialProducts]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false;
      }
      if (stockFilter === "IN_STOCK" && item.totalStock <= 0) return false;
      if (stockFilter === "LOW_STOCK" && (item.totalStock <= 0 || item.totalStock > 10)) return false;
      if (stockFilter === "OUT_OF_STOCK" && item.totalStock > 0) return false;
      if (globalFilter.trim()) {
        const query = globalFilter.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesCategory = item.category?.toLowerCase().includes(query);
        const matchesSku = item.variants.some((v) =>
          v.sku.toLowerCase().includes(query)
        );
        if (!matchesTitle && !matchesCategory && !matchesSku) return false;
      }
      return true;
    });
  }, [data, categoryFilter, stockFilter, globalFilter]);

  const columns = useMemo<ColumnDef<AdminProductItem>[]>(
    () => [
      {
        id: "expander",
        header: () => null,
        cell: ({ row }) => {
          const isExpanded = Boolean(expandedRows[row.original.id]);
          return (
            <button
              type="button"
              onClick={() => {
                setExpandedRows((prev) => ({
                  ...prev,
                  [row.original.id]: !prev[row.original.id],
                }));
              }}
              className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
              aria-label={isExpanded ? "Collapse product variants" : "Expand product variants"}
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 ${
                  isExpanded ? "rotate-90 text-orange-400" : "text-zinc-400"
                }`}
              />
            </button>
          );
        },
      },
      {
        accessorKey: "title",
        header: "Product Details",
        cell: ({ row }) => {
          const p = row.original;
          const images = (p.images as string[]) || [];
          const thumb = images[0] || "/placeholder-clothing.svg";
          return (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700/60 overflow-hidden flex-shrink-0 relative">
                {thumb.startsWith("http") || thumb.startsWith("/") ? (
                  <Image
                    src={thumb}
                    alt={p.title}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <Package className="w-4 h-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-white text-xs truncate max-w-[200px] sm:max-w-[280px]">
                    {p.title}
                  </span>
                  {p.featured && (
                    <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                      Featured
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-2 mt-0.5">
                  <span>/{p.slug}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">{p.category || "Apparel"}</span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "basePricePaise",
        header: "Base Price",
        cell: ({ row }) => {
          const price = row.original.basePricePaise / 100;
          const compare = row.original.compareAtPricePaise
            ? row.original.compareAtPricePaise / 100
            : null;
          return (
            <div>
              <div className="font-semibold text-white text-xs">₹{price.toFixed(2)}</div>
              {compare && compare > price && (
                <div className="text-[10px] text-zinc-500 line-through">
                  ₹{compare.toFixed(2)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "totalStock",
        header: "Inventory",
        cell: ({ row }) => {
          const totalStock = row.original.totalStock;
          const variantCount = row.original.variants.length;
          const isLow = totalStock > 0 && totalStock <= 10;
          const isOut = totalStock <= 0;

          return (
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    isOut
                      ? "bg-rose-500"
                      : isLow
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  }`}
                />
                <span className="font-semibold text-xs text-white">
                  {totalStock} in stock
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                {variantCount} {variantCount === 1 ? "variant" : "variants"}
              </div>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const p = row.original;
          const isDeleting = deleteLoading === p.id;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(p);
                  setIsEditModalOpen(true);
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                title="Edit product details"
              >
                <Edit className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (
                    !confirm(
                      `Are you sure you want to delete "${p.title}" and its variants?`
                    )
                  )
                    return;
                  setDeleteLoading(p.id);
                  try {
                    const res = await deleteProductAction(brandId, p.id);
                    if (res.ok) {
                      setData((prev) => prev.filter((item) => item.id !== p.id));
                    } else {
                      alert(res.error || "Failed to delete product");
                    }
                  } catch (err: any) {
                    alert(err.message || "Failed to delete product");
                  } finally {
                    setDeleteLoading(null);
                  }
                }}
                disabled={isDeleting}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                title="Delete product"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          );
        },
      },
    ],
    [expandedRows, deleteLoading, brandId]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  // If data has more than 100 items, virtualization keeps rendering ultra-performant.
  const isVirtualized = rows.length > 100;

  const rowVirtualizer = useVirtualizer({
    count: isVirtualized ? rows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = rows[index];
      if (row && expandedRows[row.original.id]) {
        const variantCount = row.original.variants?.length || 0;
        return 72 + 50 + Math.ceil(variantCount / 2) * 65;
      }
      return 68;
    },
    overscan: 5,
  });

  useEffect(() => {
    if (isVirtualized && rowVirtualizer) {
      rowVirtualizer.measure();
    }
  }, [expandedRows, isVirtualized, rowVirtualizer]);

  const handleUpdateStock = async (variantId: string, currentPricePaise: number) => {
    setIsUpdating(true);
    try {
      const res = await updateVariantStockAction(
        brandId,
        variantId,
        editStockVal,
        currentPricePaise
      );
      if (res.ok && res.data) {
        setData((prev) =>
          prev.map((prod) => {
            const hasVar = prod.variants.some((v) => v.id === variantId);
            if (!hasVar) return prod;
            lastMutationTimeRef.current[prod.id] = Date.now();
            const updatedVariants = prod.variants.map((v) =>
              v.id === variantId ? { ...v, stockQuantity: editStockVal } : v
            );
            const totalStock = updatedVariants.reduce(
              (sum, v) => sum + (v.stockQuantity || 0),
              0
            );
            return {
              ...prod,
              variants: updatedVariants,
              totalStock,
            };
          })
        );
        setEditingVariant(null);
      } else {
        alert(res.error || "Failed to update stock");
      }
    } catch (err: any) {
      alert(err.message || "Failed to update stock");
    } finally {
      setIsUpdating(false);
    }
  };

  // Reusable renderer for a product row + its expanded variant cards
  const renderProductRow = (row: any) => {
    const p: AdminProductItem = row.original;
    const isExpanded = Boolean(expandedRows[p.id]);

    return (
      <div
        key={row.id}
        className={`flex flex-col border-b border-zinc-800/60 transition-colors ${
          isExpanded ? "bg-zinc-900/90 border-l-2 border-l-orange-500" : "bg-transparent hover:bg-zinc-800/30"
        }`}
      >
        {/* Primary Row Header */}
        <div className="grid grid-cols-[36px_1fr_120px_130px_70px] items-center px-4 py-3.5">
          <div>
            <button
              type="button"
              onClick={() => {
                setExpandedRows((prev) => ({
                  ...prev,
                  [p.id]: !prev[p.id],
                }));
              }}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 ${
                  isExpanded ? "rotate-90 text-orange-400" : "text-zinc-400"
                }`}
              />
            </button>
          </div>
          <div>{columns[1].cell && (columns[1].cell as any)({ row })}</div>
          <div>{columns[2].cell && (columns[2].cell as any)({ row })}</div>
          <div>{columns[3].cell && (columns[3].cell as any)({ row })}</div>
          <div className="text-right">
            {columns[4].cell && (columns[4].cell as any)({ row })}
          </div>
        </div>

        {/* Expandable Variant Breakdown Panel */}
        {isExpanded && (
          <div className="bg-zinc-950/90 border-t border-zinc-800/80 px-6 py-4 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 pb-1 border-b border-zinc-850">
              <span className="flex items-center gap-2 text-zinc-200">
                <Layers className="w-4 h-4 text-orange-400" />
                <span>Variants &amp; SKU Inventory for <strong className="text-white">{p.title}</strong></span>
              </span>
              <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                {p.variants.length} Total SKUs
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
              {p.variants.map((v: ProductVariant) => {
                const isEditing = editingVariant === v.id;
                const isLow = v.stockQuantity > 0 && v.stockQuantity <= 5;
                const isOut = v.stockQuantity === 0;

                return (
                  <div
                    key={v.id}
                    className="rounded-xl bg-zinc-900/90 border border-zinc-800 p-3.5 flex flex-col justify-between text-xs space-y-3 shadow-sm hover:border-zinc-700 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="font-semibold text-white truncate text-xs flex items-center justify-between gap-1">
                        <span className="truncate">{v.title}</span>
                        <span className="text-orange-400 font-mono font-medium text-[11px] flex-shrink-0">
                          ₹{(v.pricePaise / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        SKU: <span className="text-zinc-300">{v.sku}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="number"
                            min="0"
                            value={editStockVal}
                            onChange={(e) =>
                              setEditStockVal(parseInt(e.target.value) || 0)
                            }
                            className="w-16 h-7 text-xs bg-zinc-950 border border-orange-500 rounded px-2 text-white font-mono"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateStock(v.id, v.pricePaise)}
                            disabled={isUpdating}
                            className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                            title="Save stock"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingVariant(null)}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                              isOut
                                ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                : isLow
                                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOut ? "bg-rose-400" : isLow ? "bg-amber-400" : "bg-emerald-400"
                              }`}
                            />
                            <span>{v.stockQuantity} in stock</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingVariant(v.id);
                              setEditStockVal(v.stockQuantity);
                            }}
                            className="text-[11px] text-zinc-400 hover:text-orange-400 font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800"
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search by title, SKU, or category..."
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
          />
        </div>

        {/* Filter Pills & Add Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="h-9 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="ALL">All Stock Levels</option>
            <option value="IN_STOCK">In Stock (&gt;0)</option>
            <option value="LOW_STOCK">Low Stock (≤10)</option>
            <option value="OUT_OF_STOCK">Out of Stock (0)</option>
          </select>

          {/* Import CSV Button */}
          {onOpenImportModal && (
            <button
              onClick={onOpenImportModal}
              className="h-9 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-colors border border-zinc-700"
              title="Bulk import products from CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-orange-400" />
              <span>Import CSV</span>
            </button>
          )}

          {/* Create Product Button */}
          <button
            onClick={onOpenCreateModal}
            className="h-9 px-3.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm ml-auto sm:ml-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-lg">
        {/* Table Header */}
        <div className="grid grid-cols-[36px_1fr_120px_130px_70px] px-4 py-3 bg-zinc-900 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          <div />
          <div>Product Details</div>
          <div>Base Price</div>
          <div>Inventory</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Rows Viewport */}
        <div
          ref={parentRef}
          className="max-h-[640px] overflow-auto divide-y divide-zinc-800/60"
        >
          {rows.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 text-xs">
              No products found matching the selected filters.
            </div>
          ) : isVirtualized ? (
            // Virtualized for large datasets (> 100 products)
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <div
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {renderProductRow(row)}
                  </div>
                );
              })}
            </div>
          ) : (
            // Clean standard document flow: 100% immune to overlap bugs on standard catalog sizes
            <div className="divide-y divide-zinc-800/60">
              {rows.map((row) => renderProductRow(row))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Product Modal */}
      <EditProductModal
        brandId={brandId}
        brandSlug={brandSlug}
        product={editingProduct}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={(updatedProduct) => {
          lastMutationTimeRef.current[updatedProduct.id] = Date.now();
          setData((prev) =>
            prev.map((item) =>
              item.id === updatedProduct.id ? updatedProduct : item
            )
          );
        }}
      />
    </div>
  );
}
