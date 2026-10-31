// Storefront State
const pathParts = window.location.pathname.split("/").filter(Boolean);
// Expect path: /store/:slug
const brandSlug = pathParts[1] || "demo-brand";

let cart = [];
let brandData = null;
let products = [];
let bundles = [];

// DOM Elements
const brandTitleEl = document.getElementById("brand-title");
const heroNameEl = document.getElementById("hero-brand-name");
const productGridEl = document.getElementById("product-grid");
const bundlesSectionEl = document.getElementById("bundles-section");
const bundlesGridEl = document.getElementById("bundles-grid");
const openCartBtn = document.getElementById("open-cart-btn");
const closeCartBtn = document.getElementById("close-cart-btn");
const cartModal = document.getElementById("cart-modal");
const cartItemsContainer = document.getElementById("cart-items-container");
const cartCountEl = document.getElementById("cart-count");
const cartSubtotalEl = document.getElementById("cart-subtotal");
const checkoutForm = document.getElementById("checkout-form");

function formatINR(paise) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

async function loadStore() {
  try {
    // 1. Fetch Brand Details
    const brandRes = await fetch(`/api/brands/${brandSlug}`);
    if (!brandRes.ok) throw new Error("Brand not found");
    brandData = await brandRes.json();

    document.title = `${brandData.name} - Store`;
    brandTitleEl.innerText = `🛍️ ${brandData.name}`;
    heroNameEl.innerText = brandData.name;

    // 2. Fetch Brand Products
    const prodRes = await fetch(`/api/brands/${brandSlug}/products`);
    products = await prodRes.json();
    renderProducts();

    // 3. Fetch Brand Bundles
    const bundleRes = await fetch(`/api/brands/${brandSlug}/bundles`);
    bundles = await bundleRes.json();
    renderBundles();
  } catch (err) {
    productGridEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: red;">Failed to load store: ${err.message}</div>`;
  }
}

function renderBundles() {
  if (!bundles || bundles.length === 0) {
    bundlesSectionEl.style.display = "none";
    return;
  }

  bundlesSectionEl.style.display = "block";
  bundlesGridEl.innerHTML = bundles.map(b => `
    <div class="product-card" style="border: 2px solid #93c5fd; background: #eff6ff;">
      <div class="product-img-placeholder" style="background: #dbeafe;">🎁 Combo</div>
      <div class="product-info">
        <h3 class="product-title">${b.title}</h3>
        <span class="product-sku" style="color: #2563eb; font-weight: 500;">
          Includes ${b.items?.length || 2} curated pieces
        </span>
        <div class="product-footer">
          <span class="price">${formatINR(b.bundlePricePaise)}</span>
          <button class="btn-add" style="background: #2563eb;" onclick="addBundleToCart('${b.id}')">Add Combo</button>
        </div>
      </div>
    </div>
  `).join("");
}

window.addBundleToCart = function(bundleId) {
  const bundle = bundles.find(b => b.id === bundleId);
  if (!bundle) return;

  // Add all items in the bundle or as a single combo line item
  bundle.items.forEach(item => {
    const existing = cart.find(c => c.variantId === item.variantId);
    if (existing) {
      existing.qty += item.qty;
    } else {
      cart.push({
        variantId: item.variantId,
        title: `${item.title || "Combo Item"} (${bundle.title})`,
        sku: `COMBO-${item.variantId.slice(0, 8)}`,
        unitPricePaise: Math.round(bundle.bundlePricePaise / bundle.items.length),
        qty: item.qty
      });
    }
  });

  updateCartUI();
  cartModal.classList.add("active");
};

function renderProducts() {
  if (products.length === 0) {
    productGridEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #6b7280;">No products currently listed.</div>`;
    return;
  }

  productGridEl.innerHTML = products.map(p => `
    <div class="product-card">
      <div class="product-img-placeholder">👕</div>
      <div class="product-info">
        <h3 class="product-title">${p.title}</h3>
        <span class="product-sku">SKU: ${p.sku} | In stock: ${p.stockQuantity}</span>
        <div class="product-footer">
          <span class="price">${formatINR(p.pricePaise)}</span>
          <button class="btn-add" onclick="addToCart('${p.id}')">Add to Bag</button>
        </div>
      </div>
    </div>
  `).join("");
}

window.addToCart = function(variantId) {
  const prod = products.find(p => p.id === variantId);
  if (!prod) return;

  const existing = cart.find(item => item.variantId === variantId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      variantId: prod.id,
      title: prod.title,
      sku: prod.sku,
      unitPricePaise: prod.pricePaise,
      qty: 1
    });
  }
  updateCartUI();
};

let appliedCoupon = null;

const couponInput = document.getElementById("coupon-code-input");
const applyCouponBtn = document.getElementById("apply-coupon-btn");
const couponMsgEl = document.getElementById("coupon-message");
const discountRowEl = document.getElementById("discount-row");
const cartDiscountEl = document.getElementById("cart-discount");
const cartFinalTotalEl = document.getElementById("cart-final-total");

applyCouponBtn?.addEventListener("click", async () => {
  const code = couponInput.value.trim();
  if (!code) return;

  const totalPaise = cart.reduce((sum, item) => sum + (item.unitPricePaise * item.qty), 0);
  if (totalPaise === 0) {
    alert("Please add items to your bag first");
    return;
  }

  try {
    const res = await fetch(`/api/brands/${brandSlug}/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotalPaise: totalPaise })
    });

    const data = await res.json();
    if (!res.ok) {
      appliedCoupon = null;
      couponMsgEl.style.display = "block";
      couponMsgEl.style.color = "var(--danger)";
      couponMsgEl.innerText = data.error || "Invalid coupon";
    } else {
      appliedCoupon = data;
      couponMsgEl.style.display = "block";
      couponMsgEl.style.color = "var(--success)";
      couponMsgEl.innerText = `🎉 Coupon '${data.code}' applied! You saved ${formatINR(data.discountPaise)}`;
    }
    updateCartUI();
  } catch (err) {
    alert("Error applying coupon: " + err.message);
  }
});

function updateCartUI() {
  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  cartCountEl.innerText = totalCount;

  const subtotalPaise = cart.reduce((sum, item) => sum + (item.unitPricePaise * item.qty), 0);
  cartSubtotalEl.innerText = formatINR(subtotalPaise);

  let discountPaise = 0;
  if (appliedCoupon && subtotalPaise > 0) {
    if (appliedCoupon.discountType === "PERCENTAGE") {
      discountPaise = Math.round((subtotalPaise * appliedCoupon.discountValue) / 100);
    } else {
      discountPaise = Math.min(appliedCoupon.discountValue, subtotalPaise);
    }
  }

  if (discountPaise > 0) {
    discountRowEl.style.display = "flex";
    cartDiscountEl.innerText = `-${formatINR(discountPaise)}`;
  } else {
    discountRowEl.style.display = "none";
  }

  const finalTotalPaise = Math.max(0, subtotalPaise - discountPaise);
  if (cartFinalTotalEl) {
    cartFinalTotalEl.innerText = formatINR(finalTotalPaise);
  }

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `<p style="color: #6b7280; text-align: center; padding: 2rem 0;">Your bag is empty.</p>`;
    appliedCoupon = null;
    if (couponMsgEl) couponMsgEl.style.display = "none";
    if (discountRowEl) discountRowEl.style.display = "none";
    return;
  }

  cartItemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div>
        <strong>${item.title}</strong>
        <div style="font-size: 0.85rem; color: #6b7280;">${item.qty} × ${formatINR(item.unitPricePaise)}</div>
      </div>
      <div>
        <strong>${formatINR(item.unitPricePaise * item.qty)}</strong>
      </div>
    </div>
  `).join("");
}

openCartBtn.addEventListener("click", () => {
  cartModal.classList.add("active");
});

closeCartBtn.addEventListener("click", () => {
  cartModal.classList.remove("active");
});

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (cart.length === 0) {
    alert("Please add at least one item to cart before checkout");
    return;
  }

  const orderPayload = {
    customerName: document.getElementById("cust-name").value,
    customerPhone: document.getElementById("cust-phone").value,
    deliveryAddress: {
      line1: document.getElementById("cust-addr").value,
      city: document.getElementById("cust-city").value,
      state: "State",
      pincode: document.getElementById("cust-pincode").value
    },
    items: cart,
    shippingPaise: 0,
    paymentMethod: document.getElementById("cust-pay").value,
    idempotencyKey: `ord_${Date.now()}_${Math.random().toString(36).substring(7)}`
  };

  try {
    const res = await fetch(`/api/brands/${brandSlug}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Order placement failed");
    }

    const createdOrder = await res.json();
    cart = [];
    updateCartUI();
    cartModal.classList.remove("active");

    if (createdOrder.paymentMethod === "UPI" && createdOrder.paymentLinks?.upi) {
      const utrPrompt = confirm(
        `🎉 Order #${createdOrder.orderNumber} placed!\n\nPay via UPI (${createdOrder.paymentLinks.upi}).\n\nClick OK to open UPI or proceed with WhatsApp update.`
      );
      if (utrPrompt) {
        window.open(createdOrder.paymentLinks.upi, "_blank");
      }
    } else {
      const openWa = confirm(
        `🎉 Order #${createdOrder.orderNumber} placed!\n\nWould you like to send your order confirmation directly on WhatsApp?`
      );
      if (openWa && createdOrder.paymentLinks?.whatsapp) {
        window.open(createdOrder.paymentLinks.whatsapp, "_blank");
      }
    }
  } catch (err) {
    alert(`Order error: ${err.message}`);
  }
});

loadStore();
