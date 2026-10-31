"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Search,
  Menu,
  X,
  ArrowRight,
  User,
  Package,
  MapPin,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useCart } from "../cart/CartContext";
import { logoutCustomerAction } from "@/app/[brand_slug]/account/actions";
import type { NavLinkItem } from "@/lib/db/queries/brands";
import { resolveStorefrontUrl } from "@/lib/storefront-url";

export interface CustomerHeaderInfo {
  id?: string;
  name: string;
  email: string;
  phone?: string | null;
}

interface StorefrontHeaderProps {
  brandSlug: string;
  brandName: string;
  customer?: CustomerHeaderInfo | null;
  navLinks?: NavLinkItem[];
}

const DEFAULT_NAV_LINKS: NavLinkItem[] = [
  { label: "Home", url: "/" },
  { label: "Catalog", url: "/catalog" },
  { label: "Tops", url: "/catalog?category=T-Shirts" },
  { label: "Bottoms", url: "/catalog?category=Bottoms" },
];

export function StorefrontHeader({
  brandSlug,
  brandName,
  customer,
  navLinks,
}: StorefrontHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { cartCount, openCart } = useCart();
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logoutCustomerAction(brandSlug);
    router.refresh();
  };

  const firstName = customer?.name ? customer.name.split(" ")[0] : "";
  const activeNavLinks =
    navLinks && navLinks.length > 0 ? navLinks : DEFAULT_NAV_LINKS;

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-brand-border bg-brand-surface/90 backdrop-blur-md transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Mobile menu trigger */}
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="tap-target-44 text-brand-text hover:text-brand-primary p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-md"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Brand Logo / Name */}
          <div className="flex items-center">
            <Link
              href={`/${brandSlug}`}
              className="tap-target-44 flex items-center font-heading text-xl sm:text-2xl font-bold tracking-tight text-brand-text hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
            >
              {brandName}
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-6 text-sm font-medium">
            {activeNavLinks.map((item, idx) => (
              <Link
                key={`${item.label}-${idx}`}
                href={resolveStorefrontUrl(item.url, brandSlug)}
                className="tap-target-44 text-brand-text hover:text-brand-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={`/${brandSlug}/account/orders`}
              className="tap-target-44 text-brand-muted hover:text-brand-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded flex items-center gap-1.5"
            >
              <Package className="w-4 h-4" />
              <span>Orders</span>
            </Link>
          </nav>

          {/* Right actions: Search, Customer Auth & Shopping Bag */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link
              href={`/${brandSlug}/catalog`}
              className="tap-target-44 text-brand-text hover:text-brand-primary p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-md"
              aria-label="Search catalog"
            >
              <Search className="w-5 h-5" />
            </Link>

            {/* Customer Account / Sign In Dropdown */}
            {customer ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="tap-target-44 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-brand-border bg-brand-surface hover:bg-brand-secondary text-brand-text text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  aria-expanded={userDropdownOpen}
                >
                  <div className="w-5 h-5 rounded-full bg-brand-primary text-brand-primary-foreground flex items-center justify-center text-[10px] font-bold">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline-block max-w-[90px] truncate">{firstName}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-brand-muted" />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-brand-surface border border-brand-border shadow-xl py-1 z-50 animate-scale-in text-xs">
                    <div className="px-4 py-2.5 border-b border-brand-border/60">
                      <p className="font-bold text-brand-text truncate">{customer.name}</p>
                      <p className="text-[11px] text-brand-muted truncate">{customer.email}</p>
                    </div>

                    <Link
                      href={`/${brandSlug}/account/orders`}
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-brand-text hover:bg-brand-secondary transition-colors"
                    >
                      <Package className="w-4 h-4 text-brand-muted" />
                      <span>My Orders</span>
                    </Link>

                    <Link
                      href={`/${brandSlug}/account/addresses`}
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-brand-text hover:bg-brand-secondary transition-colors"
                    >
                      <MapPin className="w-4 h-4 text-brand-muted" />
                      <span>Saved Addresses</span>
                    </Link>

                    <Link
                      href={`/${brandSlug}/account`}
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-brand-text hover:bg-brand-secondary transition-colors"
                    >
                      <User className="w-4 h-4 text-brand-muted" />
                      <span>Profile Settings</span>
                    </Link>

                    <div className="border-t border-brand-border/60 mt-1 pt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-red-500 hover:bg-red-500/10 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={`/${brandSlug}/account/login`}
                className="tap-target-44 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-brand-border hover:bg-brand-secondary text-brand-text text-xs font-semibold transition-colors"
                title="Customer Sign In & Account"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline-block">Sign In</span>
              </Link>
            )}

            {/* Shopping Bag Button */}
            <button
              type="button"
              onClick={openCart}
              className="tap-target-44 relative text-brand-text hover:text-brand-primary p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-md"
              aria-label={`Shopping Bag with ${cartCount} items`}
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-brand-primary-foreground bg-brand-primary rounded-full flex items-center justify-center ring-2 ring-brand-surface animate-scale-in">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-brand-border bg-brand-surface px-4 pt-2 pb-6 space-y-3">
            {activeNavLinks.map((item, idx) => (
              <Link
                key={`mobile-${item.label}-${idx}`}
                href={resolveStorefrontUrl(item.url, brandSlug)}
                onClick={() => setMobileMenuOpen(false)}
                className="tap-target-44 w-full justify-start text-base font-medium text-brand-text hover:text-brand-primary border-b border-brand-border/40 py-2 flex items-center"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={`/${brandSlug}/account/orders`}
              onClick={() => setMobileMenuOpen(false)}
              className="tap-target-44 w-full justify-start text-base font-medium text-brand-text hover:text-brand-primary border-b border-brand-border/40 py-2 flex items-center gap-2"
            >
              <Package className="w-4 h-4 text-brand-muted" />
              <span>My Orders</span>
            </Link>

            {customer ? (
              <>
                <Link
                  href={`/${brandSlug}/account`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="tap-target-44 w-full justify-start text-base font-medium text-brand-text hover:text-brand-primary border-b border-brand-border/40 py-2 flex items-center gap-2"
                >
                  <User className="w-4 h-4 text-brand-muted" />
                  <span>Account ({customer.name})</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="tap-target-44 w-full justify-start text-base font-medium text-red-500 py-2 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <Link
                href={`/${brandSlug}/account/login`}
                onClick={() => setMobileMenuOpen(false)}
                className="tap-target-44 w-full justify-start text-base font-medium text-brand-primary py-2 flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                <span>Customer Sign In / Register</span>
              </Link>
            )}

            <div className="pt-2">
              <span className="text-xs uppercase font-semibold text-brand-muted tracking-wider block mb-2">
                Switch Brand View
              </span>
              <div className="flex flex-col gap-2">
                <Link
                  href="/urban-streetwear"
                  onClick={() => setMobileMenuOpen(false)}
                  className="tap-target-44 justify-between px-3 py-2 text-sm rounded bg-brand-secondary text-brand-secondary-foreground flex items-center"
                >
                  <span>Urban Streetwear (Dark Techwear)</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/linen-and-co"
                  onClick={() => setMobileMenuOpen(false)}
                  className="tap-target-44 justify-between px-3 py-2 text-sm rounded bg-brand-secondary text-brand-secondary-foreground flex items-center"
                >
                  <span>Linen &amp; Co (Minimal Editorial)</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
