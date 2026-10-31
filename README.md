# Multi-Tenant Headless E-Commerce Platform

A production-ready, ultra-fast headless e-commerce engine with a centralized multi-tenant admin portal serving boutique clothing brands from a single codebase and database.

Built with **Next.js 16 (App Router + React 19)**, **PostgreSQL**, **Drizzle ORM**, **Tailwind CSS**, and **TanStack Table + Virtual**.

---

## 🌟 Key Architecture & Capabilities

### 1. Multi-Tenant Architecture
* **Single Database, Strict Brand Scoping**: Every tenant-owned table (`products`, `product_variants`, `orders`, `bundles`, `import_batches`) is partitioned by `brand_id` (UUID foreign key, indexed).
* **Two-Tier Tenant Resolution**:
  1. **Custom Domain**: Request hostname matched against `brands.custom_domain` in edge-safe [`middleware.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/middleware.ts).
  2. **Path Segment**: Slug path routing via `/[brand_slug]` (e.g. `/urban-streetwear` or `/linen-and-co`).
* **Scoped Data Access Layer**: All database queries are strictly confined to [`lib/db/queries/`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/lib/db/queries/). Zero leak risk across tenants.

### 2. Storefront Dynamic Theme Engine
* Injects CSS variables directly from `brands.theme_config` without hardcoded brand colors.
* Seamlessly renders drastically different brands from the exact same codebase:
  * **Urban Streetwear**: Dark brutalist mode (`#0A0A0E`), neon accents (`#FF5500`), bold hero banners, modern typography.
  * **Linen & Co.**: Light editorial mode (`#F9F7F2`), warm earth tones (`#44403C`), serif typography, spacious grid.
* Server-rendered with ISR and on-demand cache revalidation (`brand:${brandId}:products`).
* Sticky quick filters (size, price, in-stock), debounced search, sort, cursor-based pagination, dynamic size chips, waist/inseam toggles, and combo bundles selector.

### 3. Cart, Atomic Inventory & Sequential Orders
* **Per-Tenant LocalStorage Cart**: Cart items are isolated by `brandId`.
* **Atomic Sequential Order Numbers**: Gapless per-brand order numbering via atomic counter row increments (`brand_order_counters`).
* **Oversell Protection**: Atomic stock decrement inside transactional order creation. Concurrent checkouts for the last stock unit guarantee exactly one succeeds.
* **Instant Payments**: UPI QR generation with dynamic intent links (`upi://pay?pa=...`), manual UTR reference submission, and COD.

### 4. Admin Management Console
* **Edge-Safe Authentication**: Cookie-based authentication (`admin_token`) protecting `/admin`.
* **Role-Based Tenant Access**:
  * `SUPER_ADMIN`: Universal access across all active brand tenants.
  * `BRAND_ADMIN`: Restricted to assigned brands mapped in `admin_brand_access`. Multi-tenant isolation verified at both UI route and Server Action mutation level.
* **Virtualized Product Manager**: Built using `@tanstack/react-table` and `@tanstack/react-virtual` for 60 FPS scrolling through thousands of SKUs. Quick stock/price inline editing and cascading delete.
* **Multi-Variant Product Creator**: Create products with auto-generated SKUs across multiple sizes (`XS`, `S`, `M`, `L`, `XL`, `XXL`).
* **Bulk CSV Importer & Rollback Engine**:
  * **Dry-Run Mode**: Inspect errors and row validation without touching database records.
  * **Chunked Batch Ingestion**: High-throughput atomic multi-row insertions.
  * **1-Click Undo Import**: Revert and remove imported product batches cleanly.
* **Order Dispatch Desk**:
  * Filter orders by status (`RECEIVED`, `PACKED`, `DISPATCHED`, `DELIVERED`, `CANCELLED`).
  * Assign carriers (*Delhivery, BlueDart, DTDC, Shiprocket, IndiaPost*) and AWB tracking numbers.
  * Printable packing slips & invoice generator (`@media print`).
* **Live Theme Customizer**:
  * Visual editor for primary colors, backgrounds, hero headlines, CTA buttons, and announcements with a real-time side-by-side interactive preview.

---

## 🚀 Quick Start (Local Development)

### 1. Requirements
* Node.js >= 20.x
* PostgreSQL database

### 2. Environment Setup
Create a `.env` file in the project root:
```env
DATABASE_URL=postgresql://dev_user:dev_pass@localhost:5432/clothing_setup
JWT_SECRET=your_super_secret_jwt_key_2026_change_in_prod
PORT=3000
NODE_ENV=development
```

### 3. Install Dependencies & Build
```bash
npm install
npm run build
```

### 4. Seed Database & Create Admins
```bash
npm run seed              # Seeds demo brands, products, and variants
npm run create-super-admin # Generates admin users
```

**Default Admin Credentials:**
* **Super Admin**: `admin@ecom.local` / `Admin@123456` (`SUPER_ADMIN` — access to all brands)
* **Brand Admin**: `brandadmin1@ecom.local` / `BrandAdmin@123` (`BRAND_ADMIN` — restricted to `urban-streetwear`)

### 5. Start Servers
```bash
# Next.js App Router Storefront & Admin Portal:
npm run build && npx next start -p 3001

# Or run development mode:
npm run dev:next
```

---

## 🌐 URLs & Routing

| Destination | Path | Description |
|---|---|---|
| **Urban Streetwear Storefront** | `http://localhost:3001/urban-streetwear` | Dark brutalist mode storefront |
| **Linen & Co. Storefront** | `http://localhost:3001/linen-and-co` | Light editorial mode storefront |
| **Admin Login** | `http://localhost:3001/admin/login` | Session login screen |
| **Admin Overview & Orders** | `http://localhost:3001/admin?brand=urban-streetwear` | Brand dashboard & recent orders |
| **Virtualized Products** | `http://localhost:3001/admin/products?brand=urban-streetwear` | TanStack Virtual table & CSV importer |
| **Order Dispatch Desk** | `http://localhost:3001/admin/orders?brand=urban-streetwear` | Fulfillment & printable packing slips |
| **Live Theme Customizer** | `http://localhost:3001/admin/theme?brand=urban-streetwear` | Real-time interactive branding customizer |

---

## 🚢 Deployment Guide (Supabase + Vercel)

### Step 1: Supabase Database Setup
1. Create a new project in [Supabase](https://supabase.com/).
2. In **Project Settings** $\to$ **Database**, copy your **Connection String** (Transaction pooler or Session pooler):
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
3. Push schema to Supabase:
   ```bash
   DATABASE_URL="your-supabase-connection-string" npm run db:push
   DATABASE_URL="your-supabase-connection-string" npm run seed
   DATABASE_URL="your-supabase-connection-string" npm run create-super-admin
   ```

### Step 2: Deploy to Vercel
1. Import the repository into [Vercel](https://vercel.com/).
2. Set Framework Preset to **Next.js**.
3. Add Environment Variables in Vercel project settings:
   * `DATABASE_URL`: Your Supabase PostgreSQL pooled connection string.
   * `JWT_SECRET`: A secure random 64-character string.
   * `NODE_ENV`: `production`
4. Click **Deploy**. Vercel will build all static & dynamic routes with Edge Middleware.

### Step 3: Custom Domains Setup (Per-Tenant)
1. In Vercel Project Settings $\to$ **Domains**, add each brand's domain (e.g. `streetwear.yourdomain.com`, `linen.yourdomain.com`).
2. Update the `custom_domain` field in the `brands` table:
   ```sql
   UPDATE brands SET custom_domain = 'streetwear.yourdomain.com' WHERE slug = 'urban-streetwear';
   ```
3. [`middleware.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/middleware.ts) will automatically intercept incoming hostnames and route visitors directly to the brand's catalog.

---

## 🧪 Testing & Verification

Run the comprehensive test suite (14 test suites, 59 unit and integration tests):
```bash
# Run unit & isolation tests
npm test

# Run TypeScript typecheck
npm run typecheck

# Run ESLint validation
npm run lint

# Verify query layer scoping (must only output matches inside lib/db/queries)
grep -rn "from(products)\|from(orders)" lib app

# Verify .env is not tracked
git check-ignore .env
```
