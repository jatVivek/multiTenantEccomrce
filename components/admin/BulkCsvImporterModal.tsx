"use client";

import React, { useState } from "react";
import type { ImportBatch } from "@/src/db/schema";
import type { CsvProductRow, ImportResult } from "@/lib/db/queries/admin";
import {
  importProductsCsvAction,
  undoImportBatchAction,
} from "@/app/admin/actions";
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Sparkles,
  Layers,
} from "lucide-react";

interface BulkCsvImporterModalProps {
  brandId: string;
  brandSlug: string;
  isOpen: boolean;
  onClose: () => void;
  recentBatches: ImportBatch[];
  onBatchChange: () => void;
}

export function BulkCsvImporterModal({
  brandId,
  brandSlug,
  isOpen,
  onClose,
  recentBatches,
  onBatchChange,
}: BulkCsvImporterModalProps) {
  const [csvText, setCsvText] = useState("");
  const [filename, setFilename] = useState("products.csv");
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [undoLoading, setUndoLoading] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Simple CSV parser for client
  const parseCsv = (text: string): CsvProductRow[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length <= 1) return [];

    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

    const rows: CsvProductRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Split on commas while handling basic quotes
      const values: string[] = [];
      let inQuote = false;
      let curr = "";

      for (let ch = 0; ch < lines[i].length; ch++) {
        const char = lines[i][ch];
        if (char === '"' || char === "'") {
          inQuote = !inQuote;
        } else if (char === "," && !inQuote) {
          values.push(curr.trim());
          curr = "";
        } else {
          curr += char;
        }
      }
      values.push(curr.trim());

      const rowObj: any = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] || "";
      });

      rows.push(rowObj);
    }

    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content || "");
    };
    reader.readAsText(file);
  };

  const handleRun = async (isDry: boolean) => {
    setErrorMsg(null);
    setImportResult(null);

    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      setErrorMsg("No valid rows detected. Please upload or paste a CSV with a header row.");
      return;
    }

    setLoading(true);
    try {
      const res = await importProductsCsvAction(brandId, rows, {
        dryRun: isDry,
        filename,
      });

      if (!res.ok) {
        setErrorMsg(res.error || "Import operation failed");
      } else {
        setImportResult(res.data as ImportResult);
        if (!isDry) {
          onBatchChange();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (batchId: string) => {
    if (!confirm("Are you sure you want to undo this import? All created products and variants will be deleted.")) {
      return;
    }

    setUndoLoading(batchId);
    try {
      const res = await undoImportBatchAction(brandId, batchId);
      if (res.ok) {
        onBatchChange();
        if (importResult?.batchId === batchId) {
          setImportResult(null);
        }
      } else {
        alert(res.error || "Failed to undo import");
      }
    } catch (err: any) {
      alert(err.message || "Failed to undo import");
    } finally {
      setUndoLoading(null);
    }
  };

  const loadSampleCsv = () => {
    const sample = `title,slug,category,description,base_price,compare_at_price,sku,variant_title,size,variant_price,stock_quantity,images
"Heavyweight Vintage Tee","heavyweight-vintage-tee","T-Shirts","100% cotton",1899,2499,"HVY-VINT-S","Heavyweight Vintage Tee - S","S",1899,30,"https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800"
"Heavyweight Vintage Tee","heavyweight-vintage-tee","T-Shirts","100% cotton",1899,2499,"HVY-VINT-M","Heavyweight Vintage Tee - M","M",1899,40,"https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800"
"Heavyweight Vintage Tee","heavyweight-vintage-tee","T-Shirts","100% cotton",1899,2499,"HVY-VINT-L","Heavyweight Vintage Tee - L","L",1899,25,"https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800"
"Invalid Price Tee","invalid-price-tee","T-Shirts","Sample error",-100,0,"ERR-SKU-1","Bad Price Tee","M",-100,10,""`;
    setCsvText(sample);
    setFilename("sample_products.csv");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-white my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Bulk CSV Product Importer</h2>
              <p className="text-xs text-zinc-400">
                Import large catalog datasets with dry-run validation &amp; rollback support
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Upload and Paste Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-zinc-300">
                Upload CSV File or Paste Raw Text
              </label>
              <button
                type="button"
                onClick={loadSampleCsv}
                className="text-[11px] text-orange-400 hover:text-orange-300 underline underline-offset-2 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Load Sample Template (with 1 deliberate error)</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold cursor-pointer flex items-center gap-2 border border-zinc-700 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Choose .CSV File</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-zinc-400 font-mono">
                {filename}
              </span>
            </div>

            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="title,slug,category,description,base_price,compare_at_price,sku,variant_title,size,variant_price,stock_quantity,images"
              className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => handleRun(true)}
              disabled={loading || !csvText.trim()}
              className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs flex items-center gap-2 border border-zinc-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading && dryRun ? (
                <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              <span>Run Dry-Run (Validate Only)</span>
            </button>

            <button
              onClick={() => handleRun(false)}
              disabled={loading || !csvText.trim()}
              className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs flex items-center gap-2 disabled:opacity-50 transition-colors shadow-md"
            >
              {loading && !dryRun ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>Execute Bulk Import</span>
            </button>
          </div>

          {/* Import Result Panel */}
          {importResult && (
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs flex items-center gap-2">
                  {importResult.dryRun ? (
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px]">
                      DRY-RUN VALIDATION REPORT
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
                      IMPORT COMPLETED
                    </span>
                  )}
                </span>

                {!importResult.dryRun && importResult.batchId && (
                  <button
                    onClick={() => handleUndo(importResult.batchId!)}
                    disabled={undoLoading === importResult.batchId}
                    className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Undo This Import</span>
                  </button>
                )}
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase block">Total Rows</span>
                  <span className="text-sm font-bold text-white">{importResult.totalRows}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase block">Valid / Imported</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {importResult.importedCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase block">Failed Rows</span>
                  <span className="text-sm font-bold text-rose-400">
                    {importResult.failedCount}
                  </span>
                </div>
              </div>

              {/* Error Breakdown Table */}
              {importResult.errors.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="font-semibold text-rose-300 text-[11px] block">
                    Validation Errors ({importResult.errors.length}):
                  </span>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-rose-900/60 bg-rose-950/20 divide-y divide-rose-900/40">
                    {importResult.errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="p-2 text-[11px] flex items-center justify-between"
                      >
                        <span className="text-zinc-300">
                          Row <strong className="text-white">#{err.row}</strong>: {err.reason}
                        </span>
                        {err.sku && (
                          <span className="font-mono text-[10px] text-zinc-400">
                            SKU: {err.sku}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Previous Import Batches (Undo History) */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <span className="font-bold text-white text-xs block">
              Recent Import Batches &amp; Rollback History
            </span>

            {recentBatches.length === 0 ? (
              <p className="text-[11px] text-zinc-500">No import batches recorded yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {recentBatches.map((b) => {
                  const isUndoing = undoLoading === b.id;
                  const isReverted = b.status === "REVERTED";

                  return (
                    <div
                      key={b.id}
                      className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {b.filename || "import.csv"}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              isReverted
                                ? "bg-zinc-800 text-zinc-400"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {b.importedCount} items • {new Date(b.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      {!isReverted && (
                        <button
                          onClick={() => handleUndo(b.id)}
                          disabled={isUndoing}
                          className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-[10px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          {isUndoing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>Undo</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
