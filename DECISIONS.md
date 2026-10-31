# Architecture Decisions Log

## Phase M1: Media & Upload Infrastructure

### 1. Storage Provider Abstraction
- **Context:** Media assets must be uploaded to dedicated per-brand storage paths (`brands/{brandId}/{type}/{uuid}.{ext}`). In production, Supabase Storage (S3-compatible) is targeted, but local development and automated CI test suites must run seamlessly without requiring active cloud credentials.
- **Decision:** Implemented a unified `StorageProvider` interface (`upload`, `delete`, `getPublicUrl`, `createSignedUploadUrl`). Created `SupabaseStorageProvider` with automatic fallback to a local filesystem/mock provider (`LocalStorageProvider`) if `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are not set.
- **Path Isolation:** Files are strictly stored under `brands/{brandId}/{type}/{uuid}.{ext}`. Server-side validations prevent directory traversal and cross-tenant access.

### 2. File Signature & Security Verification
- **Context:** Client-provided MIME types (e.g., `image/jpeg` sent in HTTP headers) can be easily spoofed to upload malicious executables or scripts.
- **Decision:** Every uploaded payload undergoes binary magic-number validation on the server before database registration:
  - JPEG: `FF D8 FF`
  - PNG: `89 50 4E 47 0D 0A 1A 0A`
  - WebP: `RIFF .... WEBP`
  - AVIF: `.... ftyp avif`
  - SVGs are rejected by default unless sanitized; raw executable extensions are rejected immediately.
- **EXIF Stripping:** Client-side HTML5 canvas redrawing automatically strips private EXIF, geolocation, and camera metadata during compression to WebP.

### 3. Progressive Image Loading & Blur Placeholders
- **Context:** Mobile storefronts require fast LCP and zero Cumulative Layout Shift (CLS).
- **Decision:** During upload verification, a micro 10x10 blurred thumbnail is generated as a base64 Data URI (`blur_data_url`). This is stored in `media_assets` and served via `next/image` with `placeholder="blur"` and `blurDataURL`.

### 4. Storage Quota Metering
- **Context:** Brands operate under subscription plans with designated storage quotas (e.g., 1 GB on Starter, 5 GB on Growth, 25 GB on Pro).
- **Decision:** Brand storage is computed directly from the sum of `size_bytes` in `media_assets` combined with `usage_events`. Server-side upload actions strictly block attempts that would exceed 100% of the brand's quota, and return amber warnings when reaching $\ge 80\%$.

### 5. Backward Compatibility & Backfill
- **Context:** Existing products store image URLs in a JSON array (`products.images`).
- **Decision:** The `media_assets` table was added without breaking or removing `products.images`. A migration backfills existing product image URLs into `media_assets` records. The system seamlessly supports both asset UUID references and direct URL string fallbacks.

## Phase M2: Product Media, Videos, Reels & SSRF Safe Ingestion

### 6. Video Provider Abstraction (Supabase, Bunny Stream, Cloudflare Stream)
- **Context:** Storing large or high-volume short-form videos directly on general-purpose object storage can incur high bandwidth costs and lack specialized video transcoding/CDN streaming.
- **Decision:** Implemented a unified `VideoProvider` interface (`upload`, `getPlaybackUrl`, `delete`). Default implementation is `SupabaseVideoProvider` (leveraging Supabase Storage / LocalStorage fallback). Added typed, production-ready adapter stubs for `BunnyStreamProvider` and `CloudflareStreamProvider`, switchable at runtime without frontend changes via `process.env.VIDEO_PROVIDER`.

### 7. Video Binary Signature & Rule Constraints
- **Context:** Malicious binaries or oversized video files could exhaust brand quotas and degrade mobile performance.
- **Decision:** Binary magic bytes are inspected on the server:
  - MP4 / MOV: `ftyp` or `moov` at offset 4..8
  - WebM: `0x1A 0x45 0xDF 0xA3` (EBML header)
- Enforces strict constraints: max duration of 30 seconds (reel style) and max file size of 25 MB. Generates and stores poster thumbnail frame (`poster_url`).

### 8. Per-Variant Image Mapping Architecture
- **Context:** Color and style variants (e.g., Black tee vs. Sage Green tee) require variant-specific image sets on the storefront.
- **Decision:** Rather than altering the table schema with intrusive migrations, variant images are stored inside `product_variants.attributes.images` (JSONB array of URLs). When a customer selects a variant, the `<ProductGallery />` immediately filters and highlights the corresponding variant images while preserving product videos.

### 9. SSRF Guard for Remote Media Ingestion
- **Context:** The bulk CSV importer accepts external `image_urls`. Blindly fetching user-supplied URLs exposes the internal network, cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`), and localhost services to Server-Side Request Forgery (SSRF).
- **Decision:** Implemented `assertSsrfSafeUrl` and `ingestRemoteImageSafe`. Before initiating any HTTP fetch:
  - Protocol must strictly be `http:` or `https:`.
  - Hostname is resolved via DNS.
  - The resolved IP is verified against loopback (`127.0.0.0/8`, `::1`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata (`169.254.0.0/16`).
  - Fetched images are size-capped (8 MB), binary-signature validated, EXIF-stripped, and re-hosted into the tenant's isolated storage bucket.

### 10. Storefront Reel & Mixed Gallery Experience
- **Context:** Modern clothing brands drive higher conversion via short-form video reels on both homepage and product pages.
- **Decision:** Created `<ProductGallery />` supporting mixed images and video reels with IntersectionObserver viewport detection (pause when scrolled out of view, muted autoplay on view), tap-to-unmute audio toggle, and reduced-motion / `saveData` detection. Rendered a 9:16 vertical `<ReelsStrip />` on the brand home page. Injected Schema.org `VideoObject` into Product JSON-LD structured data.

### 11. Dynamic Super Admin Platform Attribution & Footer Branding
- **Context:** The storefront footer contained hardcoded text (`. Multi-tenant architecture powered by Antigravity.`). The Super Admin required this attribution text to be completely dynamic and editable without code changes, while still respecting white-label plan features (`remove_powered_by`).
- **Decision:**
  - Added table `platform_settings` (`key`, `value`, `updated_at`) with default key `footer_badge_text`.
  - Added a dedicated "Platform Branding" management tab in the Super Admin Console (`/admin/platform`), featuring an interactive live storefront preview and instant update action.
  - Server-side resolution in `BrandLayout`: storefront footers dynamically fetch the latest `footer_badge_text` from `platform_settings`, evaluate the brand's effective plan features via `getEffectiveBrandFeatures`, and automatically suppress the badge when `remove_powered_by` is active. Every update writes an immutable entry to `platform_audit_logs`.

### 12. Strict Super-Admin-Only Restriction for Live Theme Customizer
- **Context:** Individual brand administrators (`BRAND_ADMIN`) should not have autonomous control over theme styling or visual layout modifications; this capability is reserved strictly for the platform owner (`SUPER_ADMIN`).
- **Decision:**
  - Completely removed "Theme Customizer" links from the regular brand admin navigation bar in [`app/admin/layout.tsx`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/app/admin/layout.tsx) and dashboard quick actions in [`app/admin/page.tsx`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/app/admin/page.tsx) for non-super-admins.
  - Added strict server-side authorization check in [`AdminThemePage`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/app/admin/theme/page.tsx): any non-`SUPER_ADMIN` navigating to `/admin/theme` is redirected away.
  - Added server-side role gate in [`updateBrandThemeAction`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/app/admin/actions.ts): requests by any role other than `SUPER_ADMIN` fail with an authorization error even if called directly.
  - In the Super Admin Console ([`PlatformConsoleClient.tsx`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/components/admin/platform/PlatformConsoleClient.tsx)), added a direct "Theme" button next to each tenant brand row, allowing Super Admin to launch the Live Theme Customizer for any client.

### 13. Super Admin Brand CRUD & Storefront Active/Inactive Status Management
- **Context:** Super Admin needed direct platform-level control under `/admin/platform` to provision new brands, edit brand details, toggle storefront availability (Active / Inactive), and permanently delete client brands along with cascaded cleanup of dependent tenant records.
- **Decision:**
  - **Brand Provisioning:** Implemented `createBrandWithSubscription` query and `createBrandAction` server action. Allows Super Admin to provision a new brand (`name`, `slug`, `currency`, `whatsappNumber`, `upiVpa`, `customDomain`, `planId`). Automatically creates brand subscription with the selected plan, grants the provisioning admin access in `adminBrandAccess`, and logs an immutable audit event (`BRAND_CREATE`).
  - **Brand Storefront Inactive / Active Toggle:**
    - Updated `ClientPlatformOverview` and `getAllBrandSubscriptions()` to return `isActive: b.isActive`.
    - Added `toggleBrandActiveStatus` query and `toggleBrandActiveAction` server action.
    - Since `getBrandBySlug` strictly checks `eq(brands.isActive, true)`, setting a brand to `isActive = false` immediately disables customer routing on `/[brand_slug]`, returning a clean 404 without altering subscription records. Toggling back immediately restores customer access.
  - **Brand Metadata Edit:** Added `updateBrandDetails` and `updateBrandDetailsAction` allowing Super Admin to update brand name, slug, currency, WhatsApp phone, UPI VPA, and custom domain with collision checks and audit logs.
  - **Permanent Deletion:** Added `deleteBrandPermanently` and `deleteBrandAction`. Executes an atomic database transaction safely deleting all tenant child records (`productVariants`, `bundles`, `products`, `orders`, `brandOrderCounters`, `discountCoupons`, `importBatches`, `mediaAssets`, `brandSubscriptions`, `brandCredentials`, `usageEvents`, `adminBrandAccess`, and finally `brands`). Front-end requires typing the exact brand slug into a confirmation modal before unlocking the delete action.
  - **User Interface:** Added a prominent **"+ Create New Brand"** button in `/admin/platform` opening an interactive modal, quick action buttons for editing brand metadata, an inline Storefront Active/Inactive toggle switch per client, and a permanent deletion modal. All mutations revalidate `/admin` and `/admin/platform`.

### 14. Dynamic Media Serving for Local Filesystem Uploads in Production
- **Context:** In Next.js production mode (`next start`), files written to `public/uploads/` at runtime (after `next build`) are not present in the static file route manifest, causing image GET requests to fall through to the dynamic `[brand_slug]` route and return 404 HTML, resulting in broken image icons in `<MediaUploader />`.
- **Decision:**
  - Implemented dynamic Next.js route handler at [`app/uploads/[...path]/route.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/app/uploads/[...path]/route.ts) with strict path traversal protection, MIME resolution (`.webp`, `.png`, `.jpg`, `.avif`, `.mp4`), and caching headers (`max-age=86400, stale-while-revalidate=604800`).
  - Updated [`middleware.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/middleware.ts) to bypass routing middleware for `/uploads`.
  - Added `serveStatic` for `/uploads/*` in [`src/api/index.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/src/api/index.ts) to ensure dual-compatibility across both Next.js and Hono servers.


### 15. Storefront Customer Authentication, Account Hub & Order Management
- **Context:** Storefront customers had no way to authenticate, view their order history, track order statuses in real-time, self-service cancel recent orders, or save delivery addresses for faster 1-click checkout.
- **Tenant Isolation & Security:**
  - Added `customers` table with `id`, `brand_id` (FK cascade), `name`, `email`, `phone`, `password_hash`, `saved_addresses` (JSONB), `reset_token`, and `reset_token_expires_at`.
  - Unique composite index on `(brand_id, email)` guarantees strict email uniqueness per tenant, while allowing customers to register independently under different brands without collision.
  - Authentication tokens use 30-day JWTs signed with `JWT_SECRET`, scoped to `brandId` and stored in tenant-isolated HTTP-only cookies (`customer_token_${brandId}`).
- **Order History & Self-Service Cancellation:**
  - Order lookup matches tenant orders by customer phone or delivery address email: `and(eq(orders.brandId, brandId), or(eq(orders.customerPhone, customerPhone), sql`${orders.deliveryAddress}->>'email' = ${customerEmail}`))`. This matches both past orders and current orders.
  - Customers can self-service cancel orders in `RECEIVED` status. Once an order moves to `PACKED`, `DISPATCHED`, or `DELIVERED`, cancellation is safely blocked server-side, directing the customer to brand support.
- **Storefront Account Hub:**
  - Created `/account/login` (with toggle between Sign In and Sign Up), `/account/forgot-password` (2-step verification code flow), `/account/orders` (history, tracking, re-ordering, cancellation), `/account/addresses` (saved address CRUD), and `/account` (profile settings).
  - Integrated customer dropdown & mobile navigation in `<StorefrontHeader />`.
  - Integrated 1-click address selector and auto-fill in `<CheckoutForm />` and `/checkout/page.tsx`.
- **Query Scoping Invariant:** All queries against `customers` and `orders` strictly reside in `lib/db/queries/`.


### 16. Server Action Payload Body Size Limit & React Error #441 Prevention
- **Context:** Submitting product forms or media registrations with multiple images or video frames crashed in Next.js production mode with `⨯ Error: Body exceeded 1 MB limit (statusCode: 413)`, which Next.js masked as `Minified React error #441`.
- **Decision:**
  - Configured `experimental.serverActions.bodySizeLimit: "50mb"` and `experimental.proxyClientMaxBodySize: "50mb"` in [`next.config.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/next.config.ts).
  - This allows product creation with multiple high-res photos, 25 MB product video reels, and bulk imports without hitting the 1 MB body size cap.


### 17. Full Product Editing & Client-Side Cache Rollback Prevention
- **Context:** When admins edited products, background query re-fetches or Next.js Server Component revalidations (`revalidatePath`) could arrive 2–3 seconds later carrying stale cached data, overwriting local state and causing the UI to revert to old data until a manual browser refresh.
- **Decision:**
  - Added atomic `updateProductWithVariants` in [`lib/db/queries/admin.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/lib/db/queries/admin.ts) and `updateProductAction` in [`app/admin/actions.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/app/admin/actions.ts).
  - Built [`components/admin/EditProductModal.tsx`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/components/admin/EditProductModal.tsx) allowing full editing of titles, prices, descriptions, images, and variant inventory.
  - Implemented a timestamp-based mutation protection guard (`lastMutationTimeRef`) in [`components/admin/ProductTableVirtual.tsx`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/components/admin/ProductTableVirtual.tsx) that blocks stale background revalidations from overwriting locally mutated records during the in-flight synchronization window.


### 18. Prevention of Stale/Seeded Data Flashing & Layout-Preserving Loading States
- **Context:** On initial mount and re-fetching, views could momentarily flash hardcoded seed/placeholder data before live API responses resolved. Components also lacked dedicated error recovery prompts, and fast unmounting during active fetches could cause race conditions.
- **Decision:**
  - **State Machine Isolation:** Decoupled live network flows from hardcoded seed data; views initialize directly in `"loading"` state and transition strictly to `"success"` or `"error"`.
  - **Layout-Matching Skeletons:** Added dedicated route-level loading skeletons (`app/admin/products/loading.tsx`, `app/admin/orders/loading.tsx`, `app/[brand_slug]/account/orders/loading.tsx`, `app/[brand_slug]/loading.tsx`) that match exact content dimensions, eliminating Cumulative Layout Shift (CLS).
  - **Asynchronous Flow Hardening:** Updated `MediaLibraryModal.tsx` and `LoadMoreProducts.tsx` with active mount guards (`isCurrent`), explicit zero-data empty states (preventing dummy seed fallbacks), and inline error retry triggers.


### 19. Dynamic Storefront Elements & Super Admin Brand Login Provisioning
- **Context:**
  1. Storefront elements (Header navigation buttons like Tops and Bottoms, Hero badge, Primary CTA button text and destination, Secondary CTA button text and destination, and Announcement bar destination) were partially static or hardcoded. Super Admin needed full dynamic control over all button labels and landing destinations directly from the Live Theme Customizer.
  2. Super Admin needed the ability to create brand admin login credentials (email and password) directly from the Super Admin Console—both when provisioning a new brand and at any subsequent time for existing brands.
- **Dynamic Storefront Elements Decision:**
  - Extended `BrandThemeConfig` in [`lib/db/queries/brands.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/lib/db/queries/brands.ts) to include `navLinks: NavLinkItem[]`, `announcementLink?: string`, `heroBadge?: string`, `heroCtaLink?: string`, `heroSecondaryCtaText?: string`, and `heroSecondaryCtaLink?: string`.
  - Created [`lib/storefront-url.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/lib/storefront-url.ts) with `resolveStorefrontUrl` which dynamically resolves relative paths (`/catalog`, `/catalog?category=Tops`), brand-prefixed paths, relative strings, and external URLs.
  - Updated [`components/storefront/StorefrontHeader.tsx`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/components/storefront/StorefrontHeader.tsx) to render dynamic navigation links across both desktop and mobile layouts.
  - Updated [`components/storefront/HeroSection.tsx`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/components/storefront/HeroSection.tsx) to render dynamic badge text, dynamic primary CTA (`Shop Collection` / custom label + landing URL), and dynamic secondary CTA (`Shop Cargo Pants` / custom label + landing URL).
  - Updated [`components/storefront/AnnouncementBar.tsx`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/components/storefront/AnnouncementBar.tsx) to support clickable landing destinations.
  - Enhanced [`components/admin/ThemeCustomizerClient.tsx`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/components/admin/ThemeCustomizerClient.tsx) with a Navigation Link Manager (add, edit label, edit destination URL, delete, reset to defaults), Hero Badge & CTA Destination controls, Announcement Link input, and an interactive Live Preview that visualizes click targets in real-time.
- **Super Admin Brand Login (Email & Password) Provisioning Decision:**
  - Added `getBrandAdminUsers`, `createBrandAdminUser`, `resetBrandAdminPassword`, and `revokeBrandAdminAccess` in [`lib/db/queries/platform.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/lib/db/queries/platform.ts).
  - Integrated optional initial Brand Admin `adminEmail` and `adminPassword` fields into `createBrandWithSubscription` so provisioning a new brand can automatically generate the tenant's admin credentials in an atomic transaction.
  - Added server actions in [`app/admin/platform/actions.ts`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/app/admin/platform/actions.ts) protected by `requireSuperAdmin()`.
  - Updated [`components/admin/platform/PlatformConsoleClient.tsx`](file:///home/its-vini/Projrects-RUSA/ClothingSetupEcomLightWeighr15kto30k/components/admin/platform/PlatformConsoleClient.tsx) with:
    - Dedicated "Brand Logins" action button (Key icon) in each brand row opening the `BrandLoginsModal`.
    - Modal displays existing brand admins, enables creating new logins with email & password, provides instant password resetting, and allows revoking access.
    - Added Brand Admin credentials fields into the "Create New Brand" modal for immediate provisioning upon brand onboarding.
  - Verified with comprehensive test suite in `tests/dynamic-storefront-and-brand-admins.test.ts` (7/7 passing) and full project test suite (136/136 tests passing).
