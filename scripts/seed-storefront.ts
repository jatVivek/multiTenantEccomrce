import { db } from "../lib/db/index";
import { brands, products, productVariants, bundles } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding 2 distinct brands with theme configs, products, variants, and bundles...");

  // Brand 1: Urban Streetwear (Dark, neon accent, industrial sans-serif, bold-banner hero)
  const brand1Data = {
    slug: "urban-streetwear",
    name: "NOVA STREETWEAR",
    logoUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=200&q=80",
    whatsappNumber: "+919876543210",
    upiVpa: "novastreetwear@upi",
    currency: "INR",
    themeConfig: {
      colors: {
        primary: "#FF5500",
        primaryForeground: "#000000",
        secondary: "#1C1C24",
        secondaryForeground: "#FFFFFF",
        accent: "#FF2200",
        accentForeground: "#FFFFFF",
        background: "#0A0A0E",
        surface: "#14141B",
        text: "#F5F5F7",
        muted: "#8E8E93",
        border: "#2A2A35",
      },
      fonts: {
        heading: "var(--font-space-grotesk), 'Space Grotesk', system-ui, sans-serif",
        body: "var(--font-inter), 'Inter', system-ui, sans-serif",
      },
      heroStyle: "bold-banner",
      layoutStyle: "compact",
      announcement: "⚡ DROP 04: TECHWEAR NOW LIVE • FREE EXPRESS SHIPPING OVER ₹1,499",
      heroHeadline: "ARCHITECTURAL TECHWEAR & OVERSIZED BASICS",
      heroSubtitle: "Engineered 380 GSM loopback cotton, modular utility cuts, and zero-compromise urban aesthetics.",
      heroCtaText: "EXPLORE DROP 04",
      heroImageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1600&q=80",
    },
    isActive: true,
  };

  // Brand 2: Linen & Co (Light, warm cream, serif typography, editorial-split hero)
  const brand2Data = {
    slug: "linen-and-co",
    name: "LINEN & CO.",
    logoUrl: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=200&q=80",
    whatsappNumber: "+919876543211",
    upiVpa: "linenandco@upi",
    currency: "INR",
    themeConfig: {
      colors: {
        primary: "#3F4A3C",
        primaryForeground: "#FDFBF7",
        secondary: "#E8E2D5",
        secondaryForeground: "#262422",
        accent: "#8B5E3C",
        accentForeground: "#FFFFFF",
        background: "#F9F7F2",
        surface: "#FFFFFF",
        text: "#242220",
        muted: "#78726A",
        border: "#E3DDD3",
      },
      fonts: {
        heading: "var(--font-playfair), 'Playfair Display', Georgia, serif",
        body: "var(--font-inter), 'Inter', system-ui, sans-serif",
      },
      heroStyle: "editorial-split",
      layoutStyle: "spacious",
      announcement: "🌿 Hand-loomed 100% Pure Normandy Flax Linen • Free Monogramming Above ₹2,999",
      heroHeadline: "Timeless Breathable Elegance for Every Season",
      heroSubtitle: "Naturally temperature-regulating, pre-washed European linen crafted for effortless living.",
      heroCtaText: "DISCOVER THE COLLECTION",
      heroImageUrl: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=1600&q=80",
    },
    isActive: true,
  };

  // Upsert Brand 1
  let [b1] = await db.select().from(brands).where(eq(brands.slug, brand1Data.slug));
  if (!b1) {
    [b1] = await db.insert(brands).values(brand1Data).returning();
  } else {
    [b1] = await db.update(brands).set(brand1Data).where(eq(brands.id, b1.id)).returning();
  }

  // Upsert Brand 2
  let [b2] = await db.select().from(brands).where(eq(brands.slug, brand2Data.slug));
  if (!b2) {
    [b2] = await db.insert(brands).values(brand2Data).returning();
  } else {
    [b2] = await db.update(brands).set(brand2Data).where(eq(brands.id, b2.id)).returning();
  }

  console.log(`✅ Brands ready: ${b1.name} (${b1.id}), ${b2.name} (${b2.id})`);

  // Clean existing products for these two brands
  await db.delete(products).where(eq(products.brandId, b1.id));
  await db.delete(products).where(eq(products.brandId, b2.id));
  await db.delete(productVariants).where(eq(productVariants.brandId, b1.id));
  await db.delete(productVariants).where(eq(productVariants.brandId, b2.id));
  await db.delete(bundles).where(eq(bundles.brandId, b1.id));
  await db.delete(bundles).where(eq(bundles.brandId, b2.id));

  // --- BRAND 1 PRODUCTS ---
  const b1Products = [
    {
      brandId: b1.id,
      title: "Heavyweight Boxy Tee 380 GSM",
      slug: "heavyweight-boxy-tee-380gsm",
      description: "Dense 380 GSM custom combed cotton jersey. Drop shoulder cut with reinforced twin-needle collar. Garment pre-shrunk and silicon-washed for an unmatched tactile drape.",
      category: "T-Shirts",
      featured: true,
      basePricePaise: 179900,
      compareAtPricePaise: 249900,
      images: [
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=1000&q=80",
      ],
      variants: [
        { sku: "NV-TEE-BLK-S", title: "S / Obsidian Black", pricePaise: 179900, stock: 12, attributes: { size: "S", color: "Obsidian Black", colorHex: "#111111", compare_at_price_paise: 249900 } },
        { sku: "NV-TEE-BLK-M", title: "M / Obsidian Black", pricePaise: 179900, stock: 8, attributes: { size: "M", color: "Obsidian Black", colorHex: "#111111", compare_at_price_paise: 249900 } },
        { sku: "NV-TEE-BLK-L", title: "L / Obsidian Black", pricePaise: 179900, stock: 3, attributes: { size: "L", color: "Obsidian Black", colorHex: "#111111", compare_at_price_paise: 249900 } },
        { sku: "NV-TEE-BLK-XL", title: "XL / Obsidian Black", pricePaise: 189900, stock: 0, attributes: { size: "XL", color: "Obsidian Black", colorHex: "#111111", compare_at_price_paise: 259900 } },
        { sku: "NV-TEE-GRY-M", title: "M / Washed Ash Grey", pricePaise: 179900, stock: 15, attributes: { size: "M", color: "Washed Ash Grey", colorHex: "#6B7280", compare_at_price_paise: 249900 } },
        { sku: "NV-TEE-GRY-L", title: "L / Washed Ash Grey", pricePaise: 179900, stock: 2, attributes: { size: "L", color: "Washed Ash Grey", colorHex: "#6B7280", compare_at_price_paise: 249900 } },
        { sku: "NV-TEE-ORG-L", title: "L / Solar Orange", pricePaise: 189900, stock: 6, attributes: { size: "L", color: "Solar Orange", colorHex: "#FF5500", compare_at_price_paise: 259900 } },
      ],
    },
    {
      brandId: b1.id,
      title: "Cargo Parachute Utility Pants",
      slug: "cargo-parachute-utility-pants",
      description: "Tactical ripstop nylon with 6 ergonomic gusseted pockets, magnetic Fidlock toggles, and adjustable bungee hem cinches for custom taper styling.",
      category: "Bottoms",
      featured: true,
      basePricePaise: 329900,
      compareAtPricePaise: 449900,
      images: [
        "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?auto=format&fit=crop&w=1000&q=80",
      ],
      variants: [
        { sku: "NV-CRG-BLK-3030", title: "30x30 / Stealth Black", pricePaise: 329900, stock: 5, attributes: { size: "30", waist: 30, inseam: 30, color: "Stealth Black", colorHex: "#0D0D0E", compare_at_price_paise: 449900 } },
        { sku: "NV-CRG-BLK-3230", title: "32x30 / Stealth Black", pricePaise: 329900, stock: 9, attributes: { size: "32", waist: 32, inseam: 30, color: "Stealth Black", colorHex: "#0D0D0E", compare_at_price_paise: 449900 } },
        { sku: "NV-CRG-BLK-3232", title: "32x32 / Stealth Black", pricePaise: 329900, stock: 1, attributes: { size: "32", waist: 32, inseam: 32, color: "Stealth Black", colorHex: "#0D0D0E", compare_at_price_paise: 449900 } },
        { sku: "NV-CRG-BLK-3432", title: "34x32 / Stealth Black", pricePaise: 329900, stock: 0, attributes: { size: "34", waist: 34, inseam: 32, color: "Stealth Black", colorHex: "#0D0D0E", compare_at_price_paise: 449900 } },
        { sku: "NV-CRG-OLV-3230", title: "32x30 / Olive Drab", pricePaise: 339900, stock: 7, attributes: { size: "32", waist: 32, inseam: 30, color: "Olive Drab", colorHex: "#4B5320", compare_at_price_paise: 459900 } },
      ],
    },
    {
      brandId: b1.id,
      title: "Modular Technical Windbreaker Shell",
      slug: "modular-technical-windbreaker",
      description: "DWR water-repellent shell with dual two-way waterproof taped zippers, detachable hood visor, and concealed interior gear sling straps.",
      category: "Outerwear",
      featured: true,
      basePricePaise: 419900,
      compareAtPricePaise: 599900,
      images: [
        "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80",
      ],
      variants: [
        { sku: "NV-WND-S", title: "S / Carbon Grey", pricePaise: 419900, stock: 4, attributes: { size: "S", color: "Carbon Grey", colorHex: "#374151", compare_at_price_paise: 599900 } },
        { sku: "NV-WND-M", title: "M / Carbon Grey", pricePaise: 419900, stock: 8, attributes: { size: "M", color: "Carbon Grey", colorHex: "#374151", compare_at_price_paise: 599900 } },
        { sku: "NV-WND-L", title: "L / Carbon Grey", pricePaise: 419900, stock: 0, attributes: { size: "L", color: "Carbon Grey", colorHex: "#374151", compare_at_price_paise: 599900 } },
      ],
    },
    {
      brandId: b1.id,
      title: "French Terry Acid Wash Hoodie 450 GSM",
      slug: "french-terry-acid-wash-hoodie",
      description: "Heavyweight 450 GSM French terry hoodie. Double-layered hood without drawstrings for clean silhouette, kangaroo pouch with hidden zip pocket.",
      category: "Hoodies",
      featured: false,
      basePricePaise: 279900,
      compareAtPricePaise: 399900,
      images: [
        "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1000&q=80",
      ],
      variants: [
        { sku: "NV-HD-M", title: "M / Acid Charcoal", pricePaise: 279900, stock: 11, attributes: { size: "M", color: "Acid Charcoal", colorHex: "#27272A", compare_at_price_paise: 399900 } },
        { sku: "NV-HD-L", title: "L / Acid Charcoal", pricePaise: 279900, stock: 14, attributes: { size: "L", color: "Acid Charcoal", colorHex: "#27272A", compare_at_price_paise: 399900 } },
      ],
    },
  ];

  for (const p of b1Products) {
    const { variants: variantList, ...prodData } = p;
    const [insertedProd] = await db.insert(products).values(prodData).returning();

    for (let i = 0; i < variantList.length; i++) {
      const v = variantList[i];
      await db.insert(productVariants).values({
        productId: insertedProd.id,
        brandId: b1.id,
        sku: v.sku,
        title: v.title,
        pricePaise: v.pricePaise,
        stockQuantity: v.stock,
        attributes: v.attributes,
        position: i,
      });
    }

    // Add bundle for Tee and Cargo
    if (insertedProd.slug === "heavyweight-boxy-tee-380gsm") {
      await db.insert(bundles).values({
        brandId: b1.id,
        productId: insertedProd.id,
        title: "⚡ Street Tech Set: Heavyweight Tee + Cargo Utility Pants",
        bundlePricePaise: 449900, // Regular ₹5,098 -> ₹4,499 (Save ₹599)
        items: [
          { title: "Heavyweight Boxy Tee (Choice of size & color)", value: "₹1,799" },
          { title: "Cargo Parachute Utility Pants", value: "₹3,299" },
          { title: "Exclusive Woven Utility Lanyard", value: "FREE" },
        ],
        isActive: true,
      });

      await db.insert(bundles).values({
        brandId: b1.id,
        productId: insertedProd.id,
        title: "⚡ Twin Pack: 2x Heavyweight Boxy Tees (Save ₹400)",
        bundlePricePaise: 319800,
        items: [
          { title: "1st Heavyweight Tee", value: "₹1,799" },
          { title: "2nd Heavyweight Tee", value: "₹1,799" },
        ],
        isActive: true,
      });
    }
  }

  // --- BRAND 2 PRODUCTS ---
  const b2Products = [
    {
      brandId: b2.id,
      title: "Relaxed Camp-Collar Normandy Linen Shirt",
      slug: "camp-collar-normandy-linen-shirt",
      description: "Woven from 100% long-staple French Normandy flax. Enzyme stone-washed for immediate buttery softness, featuring genuine mother-of-pearl buttons and a breezy relaxed silhouette.",
      category: "Shirts",
      featured: true,
      basePricePaise: 249900,
      compareAtPricePaise: 349900,
      images: [
        "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1000&q=80",
      ],
      variants: [
        { sku: "LC-CMP-OAT-S", title: "S / Natural Oatmeal", pricePaise: 249900, stock: 14, attributes: { size: "S", color: "Natural Oatmeal", colorHex: "#E5DEC9", compare_at_price_paise: 349900 } },
        { sku: "LC-CMP-OAT-M", title: "M / Natural Oatmeal", pricePaise: 249900, stock: 8, attributes: { size: "M", color: "Natural Oatmeal", colorHex: "#E5DEC9", compare_at_price_paise: 349900 } },
        { sku: "LC-CMP-OAT-L", title: "L / Natural Oatmeal", pricePaise: 249900, stock: 4, attributes: { size: "L", color: "Natural Oatmeal", colorHex: "#E5DEC9", compare_at_price_paise: 349900 } },
        { sku: "LC-CMP-OAT-XL", title: "XL / Natural Oatmeal", pricePaise: 249900, stock: 0, attributes: { size: "XL", color: "Natural Oatmeal", colorHex: "#E5DEC9", compare_at_price_paise: 349900 } },
        { sku: "LC-CMP-SGE-M", title: "M / Sage Olive", pricePaise: 259900, stock: 9, attributes: { size: "M", color: "Sage Olive", colorHex: "#708269", compare_at_price_paise: 359900 } },
        { sku: "LC-CMP-SGE-L", title: "L / Sage Olive", pricePaise: 259900, stock: 2, attributes: { size: "L", color: "Sage Olive", colorHex: "#708269", compare_at_price_paise: 359900 } },
        { sku: "LC-CMP-WHT-M", title: "M / Bleached Chalk", pricePaise: 249900, stock: 18, attributes: { size: "M", color: "Bleached Chalk", colorHex: "#FDFCFA", compare_at_price_paise: 349900 } },
      ],
    },
    {
      brandId: b2.id,
      title: "Pleated Wide-Leg Linen Trouser",
      slug: "pleated-wide-leg-linen-trouser",
      description: "Tailored with a single forward pleat, extended tab waistband, and breathable unlined drape. Perfect for warm evening gatherings or Mediterranean vacations.",
      category: "Trousers",
      featured: true,
      basePricePaise: 379900,
      compareAtPricePaise: 499900,
      images: [
        "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1000&q=80",
      ],
      variants: [
        { sku: "LC-TRS-IVR-3030", title: "30x30 / Natural Ivory", pricePaise: 379900, stock: 6, attributes: { size: "30", waist: 30, inseam: 30, color: "Natural Ivory", colorHex: "#F4F1EA", compare_at_price_paise: 499900 } },
        { sku: "LC-TRS-IVR-3230", title: "32x30 / Natural Ivory", pricePaise: 379900, stock: 10, attributes: { size: "32", waist: 32, inseam: 30, color: "Natural Ivory", colorHex: "#F4F1EA", compare_at_price_paise: 499900 } },
        { sku: "LC-TRS-IVR-3232", title: "32x32 / Natural Ivory", pricePaise: 379900, stock: 3, attributes: { size: "32", waist: 32, inseam: 32, color: "Natural Ivory", colorHex: "#F4F1EA", compare_at_price_paise: 499900 } },
        { sku: "LC-TRS-IVR-3432", title: "34x32 / Natural Ivory", pricePaise: 379900, stock: 0, attributes: { size: "34", waist: 34, inseam: 32, color: "Natural Ivory", colorHex: "#F4F1EA", compare_at_price_paise: 499900 } },
        { sku: "LC-TRS-SND-3230", title: "32x30 / Desert Sand", pricePaise: 389900, stock: 8, attributes: { size: "32", waist: 32, inseam: 30, color: "Desert Sand", colorHex: "#C2B280", compare_at_price_paise: 509900 } },
      ],
    },
    {
      brandId: b2.id,
      title: "Mandarin Collar Linen Popover",
      slug: "mandarin-collar-linen-popover",
      description: "Clean band collar with a three-button placket and curved vented hem. Lightweight 180 GSM Belgian linen yarn-dyed for subtle natural slub texture.",
      category: "Shirts",
      featured: true,
      basePricePaise: 219900,
      compareAtPricePaise: 299900,
      images: [
        "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=1000&q=80",
      ],
      variants: [
        { sku: "LC-POP-M", title: "M / Sky Blue Chambray", pricePaise: 219900, stock: 12, attributes: { size: "M", color: "Sky Blue Chambray", colorHex: "#99BADD", compare_at_price_paise: 299900 } },
        { sku: "LC-POP-L", title: "L / Sky Blue Chambray", pricePaise: 219900, stock: 5, attributes: { size: "L", color: "Sky Blue Chambray", colorHex: "#99BADD", compare_at_price_paise: 299900 } },
      ],
    },
    {
      brandId: b2.id,
      title: "Drawstring Resort Linen Shorts",
      slug: "drawstring-resort-linen-shorts",
      description: "6.5-inch inseam tailored casual shorts with elasticated drawstring waist and breathable cotton pocket bags.",
      category: "Shorts",
      featured: false,
      basePricePaise: 199900,
      compareAtPricePaise: 279900,
      images: [
        "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=1000&q=80",
      ],
      variants: [
        { sku: "LC-SHT-M", title: "M / Olive Tint", pricePaise: 199900, stock: 7, attributes: { size: "M", color: "Olive Tint", colorHex: "#8A9A5B", compare_at_price_paise: 279900 } },
        { sku: "LC-SHT-L", title: "L / Olive Tint", pricePaise: 199900, stock: 10, attributes: { size: "L", color: "Olive Tint", colorHex: "#8A9A5B", compare_at_price_paise: 279900 } },
      ],
    },
  ];

  for (const p of b2Products) {
    const { variants: variantList, ...prodData } = p;
    const [insertedProd] = await db.insert(products).values(prodData).returning();

    for (let i = 0; i < variantList.length; i++) {
      const v = variantList[i];
      await db.insert(productVariants).values({
        productId: insertedProd.id,
        brandId: b2.id,
        sku: v.sku,
        title: v.title,
        pricePaise: v.pricePaise,
        stockQuantity: v.stock,
        attributes: v.attributes,
        position: i,
      });
    }

    if (insertedProd.slug === "camp-collar-normandy-linen-shirt") {
      await db.insert(bundles).values({
        brandId: b2.id,
        productId: insertedProd.id,
        title: "🌿 Riviera Resort Set: Camp-Collar Shirt + Linen Trousers",
        bundlePricePaise: 549900, // Regular ₹6,298 -> ₹5,499 (Save ₹799)
        items: [
          { title: "Relaxed Camp-Collar Normandy Linen Shirt", value: "₹2,499" },
          { title: "Pleated Wide-Leg Linen Trouser", value: "₹3,799" },
          { title: "Linen Garment Travel Wash Bag", value: "FREE" },
        ],
        isActive: true,
      });
    }
  }

  console.log("🎉 Seed finished successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
