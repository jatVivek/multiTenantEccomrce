"use client";

import React from "react";
import type { Order } from "@/src/db/schema";
import { X, Printer, PackageCheck } from "lucide-react";

interface PackingSlipModalProps {
  order: Order | null;
  brandName: string;
  onClose: () => void;
}

export function PackingSlipModal({
  order,
  brandName,
  onClose,
}: PackingSlipModalProps) {
  if (!order) return null;

  const addr = (order.deliveryAddress as any) || {};
  const items = (order.items as any[]) || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-white print:border-none print:shadow-none print:text-black print:bg-white my-8">
        {/* Top actions (hidden in print) */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 print:hidden bg-zinc-950">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold text-white">Packing Slip &amp; Order Invoice</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-8 space-y-6 bg-white text-zinc-900 print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase text-zinc-900">
                {brandName}
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">Order Packing Slip &amp; Bill</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold px-2 py-0.5 bg-zinc-100 rounded text-zinc-800 border">
                ORDER #{order.orderNumber}
              </span>
              <p className="text-[11px] text-zinc-500 mt-1">
                Date: {new Date(order.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Shipping & Payment Meta */}
          <div className="grid grid-cols-2 gap-6 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-zinc-700 uppercase text-[10px] tracking-wider block">
                Ship To:
              </span>
              <p className="font-semibold text-zinc-900">{addr.fullName || order.customerName}</p>
              <p className="text-zinc-600">{addr.addressLine1}</p>
              {addr.addressLine2 && <p className="text-zinc-600">{addr.addressLine2}</p>}
              <p className="text-zinc-600">
                {addr.city}, {addr.state} - {addr.postalCode}
              </p>
              <p className="text-zinc-600 pt-0.5">Phone: +91 {order.customerPhone}</p>
            </div>

            <div className="space-y-1 text-right">
              <span className="font-bold text-zinc-700 uppercase text-[10px] tracking-wider block">
                Fulfillment Details:
              </span>
              <p className="text-zinc-700">
                Method: <strong className="uppercase">{order.paymentMethod}</strong> (
                {order.paymentStatus})
              </p>
              <p className="text-zinc-700">
                Status: <strong className="uppercase">{order.status}</strong>
              </p>
              {order.courier && (
                <p className="text-zinc-700">
                  Courier: <strong>{order.courier}</strong>
                </p>
              )}
              {order.trackingId && (
                <p className="text-zinc-700 font-mono text-[11px]">
                  AWB: {order.trackingId}
                </p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 border-b text-[10px] uppercase font-bold text-zinc-600">
                <tr>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-center">Size / SKU</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Price</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y text-zinc-800">
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3 font-medium">{it.title}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-zinc-600">
                      {it.size || "Standard"}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">{it.quantity}</td>
                    <td className="py-2.5 px-3 text-right">
                      ₹{((it.pricePaise || 0) / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold">
                      ₹{(((it.pricePaise || 0) * it.quantity) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Totals */}
          <div className="flex justify-end text-xs">
            <div className="w-56 space-y-1.5 border-t pt-3">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal:</span>
                <span>₹{(order.subtotalPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Shipping:</span>
                <span>
                  {order.shippingPaise === 0
                    ? "FREE"
                    : `₹${(order.shippingPaise / 100).toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between font-bold text-sm text-zinc-900 border-t pt-1.5">
                <span>Total Amount:</span>
                <span>₹{(order.totalAmountPaise / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t pt-4 text-center text-[10px] text-zinc-400">
            Thank you for shopping with {brandName}. Please inspect contents upon delivery.
          </div>
        </div>
      </div>
    </div>
  );
}
