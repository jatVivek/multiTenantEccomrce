"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

export interface CartItem {
  id: string; // unique item id: variantId-size-color or productId-bundleId
  productId: string;
  variantId?: string;
  bundleId?: string;
  title: string;
  sku: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  image: string;
  qty: number;
  attributes?: {
    size?: string;
    color?: string;
    waist?: number;
    inseam?: number;
    [key: string]: any;
  };
  bundleItems?: Array<{ title: string; value: string }>;
}

export interface AppliedCoupon {
  code: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  discountPaise: number;
}

interface CartContextType {
  items: CartItem[];
  cartCount: number;
  subtotalPaise: number;
  shippingPaise: number;
  freeShippingThresholdPaise: number;
  amountNeededForFreeShippingPaise: number;
  hasFreeShipping: boolean;
  totalAmountPaise: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "qty"> & { qty?: number }) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  appliedCoupon: AppliedCoupon | null;
  applyCoupon: (coupon: AppliedCoupon) => void;
  removeCoupon: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

interface CartProviderProps {
  brandSlug: string;
  freeShippingThresholdPaise?: number; // default 149900 (₹1,499)
  standardShippingPaise?: number; // default 9900 (₹99)
  children: React.ReactNode;
}

export function CartProvider({
  brandSlug,
  freeShippingThresholdPaise = 149900,
  standardShippingPaise = 9900,
  children,
}: CartProviderProps) {
  const storageKey = `clothing_cart_${brandSlug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from LocalStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to read cart from localStorage:", e);
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey]);

  // Sync to LocalStorage on changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to save cart to localStorage:", e);
    }
  }, [items, isLoaded, storageKey]);

  const cartCount = useMemo(() => {
    return items.reduce((acc, item) => acc + item.qty, 0);
  }, [items]);

  const subtotalPaise = useMemo(() => {
    return items.reduce((acc, item) => acc + item.pricePaise * item.qty, 0);
  }, [items]);

  // Recalculate coupon discount if subtotal changes
  const discountPaise = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discountType === "PERCENTAGE") {
      return Math.round((subtotalPaise * appliedCoupon.discountValue) / 100);
    }
    return Math.min(appliedCoupon.discountValue, subtotalPaise);
  }, [appliedCoupon, subtotalPaise]);

  const hasFreeShipping = subtotalPaise >= freeShippingThresholdPaise;
  const shippingPaise = items.length === 0 || hasFreeShipping ? 0 : standardShippingPaise;
  const amountNeededForFreeShippingPaise = Math.max(
    0,
    freeShippingThresholdPaise - subtotalPaise
  );

  const totalAmountPaise = Math.max(0, subtotalPaise - discountPaise) + shippingPaise;

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  const addItem = (newItem: Omit<CartItem, "qty"> & { qty?: number }) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === newItem.id);
      const qtyToAdd = newItem.qty || 1;

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: updated[existingIndex].qty + qtyToAdd,
        };
        return updated;
      }
      return [...prev, { ...newItem, qty: qtyToAdd }];
    });
    setIsOpen(true);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qty } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
  };

  const applyCoupon = (coupon: AppliedCoupon) => {
    setAppliedCoupon(coupon);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        cartCount,
        subtotalPaise,
        shippingPaise,
        freeShippingThresholdPaise,
        amountNeededForFreeShippingPaise,
        hasFreeShipping,
        totalAmountPaise,
        isOpen,
        openCart,
        closeCart,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
