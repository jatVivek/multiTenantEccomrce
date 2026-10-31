"use client";

import React, { useState } from "react";
import { updateOrderStatusAction } from "@/app/admin/actions";
import { Loader2 } from "lucide-react";

interface OrderStatusSelectProps {
  brandId: string;
  orderId: string;
  initialStatus: "RECEIVED" | "PACKED" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
}

export function OrderStatusSelect({
  brandId,
  orderId,
  initialStatus,
}: OrderStatusSelectProps) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as any;
    setStatus(newStatus);
    setLoading(true);
    setError(null);

    try {
      const res = await updateOrderStatusAction(brandId, orderId, newStatus);
      if (!res.success) {
        setError("Failed to update status");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update status");
      setStatus(initialStatus); // revert
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (st: string) => {
    switch (st) {
      case "RECEIVED":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "PACKED":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "DISPATCHED":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "DELIVERED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "CANCELLED":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <select
          value={status}
          onChange={handleChange}
          disabled={loading}
          className={`h-8 px-2.5 text-xs font-semibold rounded border appearance-none pr-7 bg-zinc-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500 ${getStatusBadgeColor(
            status
          )}`}
        >
          <option value="RECEIVED">RECEIVED</option>
          <option value="PACKED">PACKED</option>
          <option value="DISPATCHED">DISPATCHED</option>
          <option value="DELIVERED">DELIVERED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        {loading && (
          <Loader2 className="w-3 h-3 animate-spin absolute right-2 top-2.5 text-zinc-400 pointer-events-none" />
        )}
      </div>
      {error && <span className="text-[10px] text-red-400 font-medium">{error}</span>}
    </div>
  );
}
