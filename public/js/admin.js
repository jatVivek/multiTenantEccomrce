let token = localStorage.getItem("clothing_admin_token");

const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const loginForm = document.getElementById("admin-login-form");
const emailEl = document.getElementById("current-admin-email");

function formatINR(paise) {
  return "₹" + (Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

async function checkAuth() {
  if (!token) {
    authSection.style.display = "block";
    dashboardSection.style.display = "none";
    return;
  }

  try {
    const res = await fetch("/api/admin/me", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Invalid session");

    const data = await res.json();
    authSection.style.display = "none";
    dashboardSection.style.display = "grid";
    emailEl.innerText = `${data.user.email} (${data.user.role})`;

    loadDashboardStats();
    loadBrands(data.brands);
    loadOrders();
  } catch {
    logout();
  }
}

async function loadOrders() {
  const tbody = document.getElementById("orders-table-body");
  if (!tbody) return;

  try {
    const res = await fetch("/api/admin/orders", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;

    const orders = await res.json();
    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #6b7280;">No orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><strong>#${o.orderNumber}</strong></td>
        <td>${o.brandName}</td>
        <td>${o.customerName}<br><small style="color: #6b7280;">${o.customerPhone}</small></td>
        <td><strong>${formatINR(o.totalAmountPaise)}</strong></td>
        <td><span class="badge badge-${o.status}">${o.status}</span></td>
        <td>
          <small>${o.courier || "Pending Courier"} / ${o.trackingId || "No AWB"}</small>
        </td>
        <td>
          <button class="btn-add" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;" onclick="updateFulfillmentPrompt('${o.id}', '${o.status}')">Update</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Failed to load orders", err);
  }
}

window.updateFulfillmentPrompt = async function(orderId, currentStatus) {
  const nextStatus = prompt(
    "Enter updated status (RECEIVED, PACKED, DISPATCHED, DELIVERED, CANCELLED):",
    currentStatus
  );
  if (!nextStatus) return;

  const courier = prompt("Enter Courier Name (e.g., Delhivery, BlueDart, DTDC):", "Delhivery");
  const trackingId = prompt("Enter Tracking / AWB Number:", "AWB" + Math.floor(100000 + Math.random() * 900000));

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/fulfillment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        status: nextStatus.toUpperCase(),
        courier: courier || undefined,
        trackingId: trackingId || undefined
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Update failed");
    }

    alert("✅ Order fulfillment updated!");
    loadOrders();
    loadDashboardStats();
  } catch (err) {
    alert("Error updating order: " + err.message);
  }
};

async function loadDashboardStats() {
  try {
    const res = await fetch("/api/admin/dashboard-stats", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;

    const stats = await res.json();
    document.getElementById("stat-total-orders").innerText = stats.totalOrders;
    document.getElementById("stat-total-rev").innerText = formatINR(stats.totalRevenuePaise);
  } catch (err) {
    console.error("Failed to load dashboard stats", err);
  }
}

let currentBrands = [];

window.showTab = function(tabName) {
  document.getElementById("tab-overview").style.display = tabName === "overview" ? "block" : "none";
  document.getElementById("tab-products").style.display = tabName === "products" ? "block" : "none";

  document.getElementById("nav-overview").classList.toggle("active", tabName === "overview");
  document.getElementById("nav-products").classList.toggle("active", tabName === "products");

  if (tabName === "products") {
    loadBrandProducts();
  }
};

function loadBrands(brands) {
  currentBrands = brands;
  document.getElementById("stat-brand-count").innerText = brands.length;
  const tbody = document.getElementById("brands-table-body");
  const brandSelector = document.getElementById("product-brand-selector");

  if (brands.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #6b7280;">No brand access granted.</td></tr>`;
    if (brandSelector) brandSelector.innerHTML = `<option value="">No brands available</option>`;
    return;
  }

  tbody.innerHTML = brands.map(b => `
    <tr>
      <td><strong>${b.name}</strong></td>
      <td><code>${b.slug}</code></td>
      <td><a href="/store/${b.slug}" target="_blank" style="color: var(--accent); font-weight: 500;">Open Customer Store ↗</a></td>
    </tr>
  `).join("");

  if (brandSelector) {
    brandSelector.innerHTML = brands.map(b => `<option value="${b.slug}">${b.name} (${b.slug})</option>`).join("");
    brandSelector.onchange = () => loadBrandProducts();
  }
}

async function loadBrandProducts() {
  const brandSelector = document.getElementById("product-brand-selector");
  const slug = brandSelector?.value;
  const tbody = document.getElementById("catalog-table-body");
  if (!slug || !tbody) return;

  try {
    const res = await fetch(`/api/brands/${slug}/products`);
    if (!res.ok) throw new Error("Could not load products");
    const products = await res.json();

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #6b7280;">No items found in this brand's catalog.</td></tr>`;
      return;
    }

    tbody.innerHTML = products.map(p => `
      <tr>
        <td><strong>${p.title}</strong></td>
        <td><code>${p.sku}</code></td>
        <td><strong>${formatINR(p.pricePaise)}</strong></td>
        <td>
          <span style="font-weight: 600; color: ${p.stockQuantity > 5 ? 'var(--success)' : 'var(--danger)'};">
            ${p.stockQuantity} units
          </span>
        </td>
        <td>
          <button class="btn-add" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: #4b5563;" onclick="quickUpdateStock('${slug}', '${p.id}', ${p.stockQuantity})">Edit Stock</button>
          <button class="btn-add" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: var(--danger); margin-left: 0.25rem;" onclick="deleteProduct('${slug}', '${p.id}')">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">Error: ${err.message}</td></tr>`;
  }
}

// Create new product form handler
const createProductForm = document.getElementById("create-product-form");
createProductForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const slug = document.getElementById("product-brand-selector").value;
  if (!slug) {
    alert("Please select a brand first");
    return;
  }

  const title = document.getElementById("new-prod-title").value.trim();
  const sku = document.getElementById("new-prod-sku").value.trim();
  const priceRs = parseFloat(document.getElementById("new-prod-price").value);
  const stock = parseInt(document.getElementById("new-prod-stock").value, 10);

  // Find brand id for product_id placeholder
  const activeBrand = currentBrands.find(b => b.slug === slug);
  const productId = activeBrand?.id || crypto.randomUUID();

  try {
    const res = await fetch(`/api/brands/${slug}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        sku,
        title,
        pricePaise: Math.round(priceRs * 100),
        stockQuantity: stock,
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.formErrors?.[0] || "Failed to create product");
    }

    alert(`✅ Product "${title}" created and published to store!`);
    createProductForm.reset();
    loadBrandProducts();
  } catch (err) {
    alert("Error creating product: " + err.message);
  }
});

window.quickUpdateStock = async function(slug, variantId, currentStock) {
  const newStockStr = prompt("Enter updated stock quantity:", String(currentStock));
  if (newStockStr === null) return;
  const newStock = parseInt(newStockStr, 10);
  if (isNaN(newStock) || newStock < 0) {
    alert("Please enter a valid non-negative integer");
    return;
  }

  try {
    const res = await fetch(`/api/brands/${slug}/products/${variantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockQuantity: newStock })
    });

    if (!res.ok) throw new Error("Update failed");
    loadBrandProducts();
  } catch (err) {
    alert("Error updating stock: " + err.message);
  }
};

window.deleteProduct = async function(slug, variantId) {
  if (!confirm("Are you sure you want to remove this product from the storefront?")) return;

  try {
    const res = await fetch(`/api/brands/${slug}/products/${variantId}`, {
      method: "DELETE"
    });

    if (!res.ok) throw new Error("Delete failed");
    loadBrandProducts();
  } catch (err) {
    alert("Error deleting product: " + err.message);
  }
};

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-pwd").value;

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login failed");
    }

    const data = await res.json();
    token = data.token;
    localStorage.setItem("clothing_admin_token", token);
    checkAuth();
  } catch (err) {
    alert(`Authentication failed: ${err.message}`);
  }
});

window.logout = function() {
  localStorage.removeItem("clothing_admin_token");
  token = null;
  authSection.style.display = "block";
  dashboardSection.style.display = "none";
};

checkAuth();
