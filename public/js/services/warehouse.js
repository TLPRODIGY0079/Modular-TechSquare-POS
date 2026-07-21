import { getDB, getCurrentUser, loadDB } from '../db.js';
import { getSupabase } from '../supabase-client.js';
import { $, uid, money, today, now, esc } from '../utils.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { STORE1_ID, STORE2_ID, WAREHOUSE_ID } from '../config.js';

// ============================================================================
// WAREHOUSE SYSTEM - SIMPLIFIED & COMPLETE
// ============================================================================

// Stock request storage (synced with Supabase)
let stockRequests = [];

// 📥 Load stock requests from Supabase or localStorage
export async function loadStockRequests() {
    const sb = getSupabase();
    try {
        // Simple load - no joins needed (like sales)
        const { data, error } = await sb
            .from("stock_requests")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;
        stockRequests = data || [];
    } catch (err) {
        console.error("Error loading stock requests:", err);
        // Fallback to localStorage if Supabase fails
        stockRequests = JSON.parse(
            localStorage.getItem("stockRequests") || "[]",
        );
    }
}

// 💾 Save a stock request to Supabase or localStorage
export async function saveStockRequest(request) {
    const sb = getSupabase();
    try {
        const { error } = await sb
            .from("stock_requests")
            .insert([request]);
        if (error) throw error;
    } catch (err) {
        // Fallback: save to localStorage if Supabase fails
        localStorage.setItem(
            "stockRequests",
            JSON.stringify(stockRequests),
        );
    }
}

// 🔄 Update a stock request in Supabase or localStorage
export async function updateStockRequest(id, updates) {
    const sb = getSupabase();
    try {
        const { error } = await sb
            .from("stock_requests")
            .update(updates)
            .eq("id", id);
        if (error) throw error;
    } catch (err) {
        localStorage.setItem(
            "stockRequests",
            JSON.stringify(stockRequests),
        );
    }
}

// Warehouse state
let warehouseCurrentTab = "inventory";

// 🏭 Main warehouse render function
export async function renderWarehouse() {
    const DB = getDB();
    const currentUser = getCurrentUser();
    const sb = getSupabase();
    const offlineDB = window.offlineDB;

    await loadStockRequests();
    const isAdmin =
        currentUser.role === "admin" ||
        currentUser.role === "store_manager";

    if (!isAdmin) {
        document.getElementById("mainContent").innerHTML = `
      <div style="padding:40px;text-align:center">
        <i class="fas fa-lock" style="font-size:48px;color:var(--tx3);margin-bottom:20px"></i>
        <h2>Access Denied</h2>
        <p style="color:var(--tx2);margin-top:10px">You don't have permission to access the warehouse.</p>
      </div>
    `;
        return;
    }

    try {
        // Get pending requests count
        const pendingRequests = stockRequests.filter(
            (r) => r.status === "pending",
        );

        // Get all products with their variants
        const products = DB.products.filter(
            (p) => p.active !== false,
        );
        const variants = DB.variants.filter(
            (v) => v.is_active !== false && v.store_id === WAREHOUSE_ID,
        );

        // Calculate total stock and value
        let totalItems = 0;
        let totalValue = 0;

        variants.forEach((v) => {
            totalItems += v.qty || 0;
            totalValue += (v.qty || 0) * (v.cost_price || 0);
        });

        const html = `
      <div class="warehouse-container">
        <!-- Header -->
        <div class="warehouse-header">
          <div>
            <h1><i class="fas fa-warehouse"></i> Warehouse Management</h1>
            <p style="color:var(--tx2);margin-top:8px">Manage stock across all locations</p>
          </div>
          <div style="display:flex;gap:12px">
            <button class="btn btn-outline" onclick="window.warehouseService.openAddStockModal()">
              <i class="fas fa-plus-circle"></i> Add Stock
            </button>
            <button class="btn btn-primary" onclick="window.warehouseService.openTransferModal()">
              <i class="fas fa-exchange-alt"></i> Transfer Stock
            </button>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--ac3);color:var(--ac)">
              <i class="fas fa-boxes"></i>
            </div>
            <div>
              <div class="stat-value">${totalItems}</div>
              <div class="stat-label">Total Items</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--gn2);color:var(--gn)">
              <i class="fas fa-dollar-sign"></i>
            </div>
            <div>
              <div class="stat-value">K${totalValue.toFixed(2)}</div>
              <div class="stat-label">Total Value</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--wn2);color:var(--wn)">
              <i class="fas fa-inbox"></i>
            </div>
            <div>
              <div class="stat-value">${pendingRequests.length}</div>
              <div class="stat-label">Pending Requests</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--ac3);color:var(--ac)">
              <i class="fas fa-cube"></i>
            </div>
            <div>
              <div class="stat-value">${products.length}</div>
              <div class="stat-label">Product Types</div>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab ${warehouseCurrentTab === "inventory" ? "active" : ""}" onclick="window.warehouseService.switchWarehouseTab('inventory')">
            <i class="fas fa-th-large"></i> Inventory
          </button>
          <button class="tab ${warehouseCurrentTab === "requests" ? "active" : ""}" onclick="window.warehouseService.switchWarehouseTab('requests')">
            <i class="fas fa-inbox"></i> Stock Requests
            ${pendingRequests.length > 0 ? `<span class="badge badge-orange" style="margin-left:8px">${pendingRequests.length}</span>` : ""}
          </button>
          <button class="tab ${warehouseCurrentTab === "transfers" ? "active" : ""}" onclick="window.warehouseService.switchWarehouseTab('transfers')">
            <i class="fas fa-exchange-alt"></i> Transfers
          </button>
        </div>

        <!-- Tab Content -->
        <div id="warehouseTabContent">
          ${renderWarehouseTabContent()}
        </div>
      </div>
    `;

        document.getElementById("mainContent").innerHTML = html;
    } catch (error) {
        console.error("Error rendering warehouse:", error);
        document.getElementById("mainContent").innerHTML = `
      <div style="padding:40px;text-align:center">
        <i class="fas fa-exclamation-triangle" style="font-size:48px;color:var(--dn);margin-bottom:20px"></i>
        <h2>Error Loading Warehouse</h2>
        <p style="color:var(--tx2);margin-top:10px">${error.message}</p>
        <button class="btn btn-primary" onclick="window.warehouseService.renderWarehouse()" style="margin-top:20px">
          <i class="fas fa-refresh"></i> Retry
        </button>
      </div>
    `;
    }
}

// 🔄 Switch warehouse tabs
export function switchWarehouseTab(tabName) {
    warehouseCurrentTab = tabName;
    document.getElementById("warehouseTabContent").innerHTML =
        renderWarehouseTabContent();
}

// 📋 Render transfers page (navigation route)
export async function renderTransfers() {
    const DB = getDB();
    const currentUser = getCurrentUser();
    const sb = getSupabase();
    const mainContent = document.getElementById("mainContent");
    
    if (!mainContent) return;

    await loadStockRequests();
    const isAdmin = currentUser.role === "admin" || currentUser.role === "store_manager";

    if (!isAdmin) {
        document.getElementById("mainContent").innerHTML = `
      <div style="padding:40px;text-align:center">
        <i class="fas fa-lock" style="font-size:48px;color:var(--tx3);margin-bottom:20px"></i>
        <h2>Access Denied</h2>
        <p style="color:var(--tx2);margin-top:10px">You don't have permission to access stock transfers.</p>
      </div>
    `;
        return;
    }

    try {
        // Get transfer records (approved stock requests)
        const transfers = stockRequests
            .filter((r) => r.status === "approved" || r.status === "completed")
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const html = `
      <div class="warehouse-container">
        <div class="warehouse-header">
          <div>
            <h1><i class="fas fa-exchange-alt"></i> Stock Transfer Records</h1>
            <p style="color:var(--tx2);margin-top:8px">Track stock movements between locations</p>
          </div>
          <div style="display:flex;gap:12px">
            <button class="btn btn-outline" onclick="window.warehouseService.openTransferModal()">
              <i class="fas fa-plus-circle"></i> New Transfer
            </button>
            <button class="btn btn-primary" onclick="window.warehouseService.renderWarehouse()">
              <i class="fas fa-warehouse"></i> Warehouse Management
            </button>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--ac3);color:var(--ac)">
              <i class="fas fa-exchange-alt"></i>
            </div>
            <div>
              <div class="stat-value">${transfers.length}</div>
              <div class="stat-label">Total Transfers</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--gn2);color:var(--gn)">
              <i class="fas fa-check-circle"></i>
            </div>
            <div>
              <div class="stat-value">${transfers.filter(t => t.status === 'completed').length}</div>
              <div class="stat-label">Completed</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--wn2);color:var(--wn)">
              <i class="fas fa-clock"></i>
            </div>
            <div>
              <div class="stat-value">${transfers.filter(t => t.status === 'approved').length}</div>
              <div class="stat-label">In Transit</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--dn2);color:var(--dn)">
              <i class="fas fa-cube"></i>
            </div>
            <div>
              <div class="stat-value">${transfers.reduce((sum, t) => sum + (t.quantity || 0), 0)}</div>
              <div class="stat-label">Items Transferred</div>
            </div>
          </div>
        </div>

        <!-- Transfers Table -->
        <div class="card">
          <div class="card-header">
            <h3>Transfer History</h3>
            <div class="search-bar">
              <i class="fas fa-search"></i>
              <input type="text" class="search-input" id="transferSearch" placeholder="Search transfers...">
            </div>
          </div>
          <div class="card-body np">
            ${transfers.length === 0 ? `
              <div class="empty-state">
                <i class="fas fa-exchange-alt"></i>
                <h3>No Transfers Yet</h3>
                <p>Create your first stock transfer between locations</p>
                <button class="btn btn-primary" onclick="window.warehouseService.openTransferModal()" style="margin-top:16px">
                  <i class="fas fa-plus-circle"></i> Create Transfer
                </button>
              </div>
            ` : `
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${transfers.map(transfer => {
                      const variant = DB.variants.find(v => v.id === transfer.variant_id);
                      const product = variant ? DB.products.find(p => p.id === variant.product_id) : null;
                      
                      return `
                        <tr>
                          <td>${new Date(transfer.created_at).toLocaleDateString()}</td>
                          <td>
                            <strong>${product ? product.name : 'Unknown Product'}</strong>
                            <div style="font-size:12px;color:var(--tx2)">
                              ${variant ? `${variant.color || ''} ${variant.storage || ''}`.trim() : ''}
                            </div>
                          </td>
                          <td><span class="badge badge-blue">${transfer.quantity}</span></td>
                          <td>${transfer.from_store_name || 'Warehouse'}</td>
                          <td>${transfer.store_name}</td>
                          <td>
                            <span class="badge ${
                              transfer.status === 'completed' ? 'badge-green' : 
                              transfer.status === 'approved' ? 'badge-blue' : 'badge-orange'
                            }">${transfer.status}</span>
                          </td>
                          <td>
                            ${transfer.status === 'approved' ? `
                              <button class="btn btn-sm btn-success" onclick="window.warehouseService.completeTransfer('${transfer.id}')">
                                <i class="fas fa-check"></i> Complete
                              </button>
                            ` : ''}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      </div>
    `;

        document.getElementById("mainContent").innerHTML = html;

        // Setup search functionality
        const searchInput = document.getElementById("transferSearch");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const rows = document.querySelectorAll("tbody tr");
                rows.forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
                });
            });
        }
    } catch (error) {
        console.error("Error rendering transfers:", error);
        document.getElementById("mainContent").innerHTML = `
      <div style="padding:40px;text-align:center">
        <i class="fas fa-exclamation-triangle" style="font-size:48px;color:var(--dn);margin-bottom:20px"></i>
        <h2>Error Loading Transfers</h2>
        <p style="color:var(--tx2);margin-top:10px">${error.message}</p>
        <button class="btn btn-primary" onclick="window.warehouseService.renderTransfers()" style="margin-top:20px">
          <i class="fas fa-refresh"></i> Retry
        </button>
      </div>
    `;
    }
}

// 📑 Render tab content
function renderWarehouseTabContent() {
    switch (warehouseCurrentTab) {
        case "inventory":
            return renderInventoryTab();
        case "requests":
            return renderRequestsTab();
        case "transfers":
            return renderTransfersTab();
        default:
            return renderInventoryTab();
    }
}

// 📦 Render inventory tab
function renderInventoryTab() {
    const DB = getDB();
    const products = DB.products.filter((p) => p.active !== false);
    const variants = DB.variants.filter((v) => v.is_active !== false && v.store_id === WAREHOUSE_ID);

    // Group variants by product
    const productMap = {};
    products.forEach((p) => {
        productMap[p.id] = { ...p, variants: [] };
    });

    variants.forEach((v) => {
        if (productMap[v.product_id]) {
            productMap[v.product_id].variants.push(v);
        }
    });

    return `
    <div class="card">
      <div class="card-header">
        <h3>Warehouse Stock Inventory</h3>
      </div>
      <div class="card-body np">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>SKU</th>
                <th style="text-align:center">Stock</th>
                <th style="text-align:right">Cost Price</th>
                <th style="text-align:right">Selling Price</th>
                <th style="text-align:right">Total Value</th>
                <th style="text-align:center;width:80px">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(productMap)
                  .map((product) => {
                      if (product.variants.length === 0) return "";

                      return product.variants
                          .map((variant, idx) => {
                              const stockQty = variant.qty || 0;
                              const costPrice = variant.cost_price || 0;
                              const sellingPrice = variant.price || 0;
                              const totalValue = stockQty * costPrice;

                              // Stock status
                              let stockBadge = "badge-green";
                              if (stockQty === 0) stockBadge = "badge-red";
                              else if (stockQty < 10)
                                  stockBadge = "badge-orange";

                              return `
                    <tr>
                      <td>${idx === 0 ? `<strong>${product.name}</strong>` : ""}</td>
                      <td>${variant.color || "-"} / ${variant.storage || "-"}</td>
                      <td>
                        <code style="background:var(--bg4);padding:4px 8px;border-radius:4px;font-size:12px">${variant.sku || "-"}</code>
                        ${variant.sku && variant.sku.startsWith('TRADEIN-') ? '<span class="badge badge-blue" style="margin-left:8px">Trade-in</span>' : ''}
                      </td>
                      <td style="text-align:center"><span class="badge ${stockBadge}">${stockQty}</span></td>
                      <td style="text-align:right;color:var(--tx2)">K${costPrice.toFixed(2)}</td>
                      <td style="text-align:right">K${sellingPrice.toFixed(2)}</td>
                      <td style="text-align:right"><strong>K${totalValue.toFixed(2)}</strong></td>
                      <td style="text-align:center">
                        <button class="btn btn-sm btn-danger" onclick="window.warehouseService.deleteWarehouseProduct('${variant.id}')" title="Delete this variant">
                          <i class="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  `;
                          })
                          .join("");
                  })
                  .join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// 🗑 Delete warehouse product (soft delete by setting active=false)
export async function deleteWarehouseProduct(variantId) {
    const DB = getDB();
    const currentUser = getCurrentUser();
    const sb = getSupabase();
    const offlineDB = window.offlineDB;
    const { showConfirm } = await import('../ui/modal.js');

    showConfirm(
        "Are you sure you want to delete this product from the warehouse? This action will mark it as inactive.",
        async () => {
            try {
                // Get variant details for logging
                const variant = DB.variants.find(
                    (v) => v.id === variantId,
                );
                if (!variant) {
                    toast("Product not found", "error");
                    return;
                }

                // Soft delete: set active to false in Supabase
                const { error: variantError } = await sb
                    .from("variants")
                    .update({
                        is_active: false,
                        updated_at: now(),

                    })
                    .eq("id", variantId);

                if (variantError) throw variantError;

                // If this variant has serialized items, deactivate them too
                if (variant.tracking_type === "serialized") {
                    const { error: serialError } = await sb
                        .from("serialized_items")
                        .update({
                            is_active: false,
                            updated_at: now(),
                        })
                        .eq("variant_id", variantId);

                    if (serialError)
                        console.warn(
                            "Error deactivating serialized items:",
                            serialError,
                        );
                }

                // Update IndexedDB
                await offlineDB.put("variants", {
                    ...variant,
                    active: false,
                    updated_at: now(),
                });

                // Reload data and refresh warehouse view
                await loadDB();
                renderWarehouse();

                toast("Product deleted successfully", "success");
                closeModal();
            } catch (err) {
                console.error(
                    "Error deleting warehouse product:",
                    err,
                );
                toast("Error: " + err.message, "error");
            }
        },
    );
}

// 📬 Render requests tab
function renderRequestsTab() {
    const DB = getDB();
    const requests = stockRequests.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    if (requests.length === 0) {
        return `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <h3>No Stock Requests</h3>
        <p>Cashier stock requests will appear here</p>
      </div>
    `;
    }

    return `
    <div class="card">
      <div class="card-header">
        <h3>Stock Requests</h3>
      </div>
      <div class="card-body" style="padding:16px">
        ${requests
            .map((req) => {
                const variant = DB.variants.find(
                    (v) => v.id === req.variant_id,
                );
                const product = variant
                    ? DB.products.find((p) => p.id === variant.product_id)
                    : null;

                let statusBadge = "badge-orange";
                let statusText = "Pending";
                if (req.status === "approved") {
                    statusBadge = "badge-green";
                    statusText = "Approved";
                } else if (req.status === "rejected") {
                    statusBadge = "badge-red";
                    statusText = "Rejected";
                }

                return `
            <div style="background:var(--bg);border-radius:12px;padding:20px;margin-bottom:12px;border:1px solid var(--bd)">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
                <div>
                  <h4 style="margin:0;font-size:16px">${product ? product.name : "Unknown Product"}</h4>
                  <p style="color:var(--tx2);font-size:13px;margin:4px 0">
                    ${variant ? `${variant.color || ""} ${variant.storage || ""}` : "Unknown Variant"}
                  </p>
                  <p style="color:var(--tx2);font-size:12px;margin:8px 0 0 0">
                    <i class="fas fa-user"></i> ${req.requester_name} •
                    <i class="fas fa-store"></i> ${req.store_name} •
                    <i class="fas fa-clock"></i> ${new Date(req.created_at).toLocaleString()}
                  </p>
                </div>
                <div style="text-align:right">
                  <div style="font-size:24px;font-weight:700;color:var(--ac)">${req.quantity}</div>
                  <div style="font-size:11px;color:var(--tx2)">units</div>
                  <span class="badge ${statusBadge}" style="margin-top:8px">${statusText}</span>
                </div>
              </div>
              ${
                  req.status === "pending"
                      ? `
                <div style="display:flex;gap:8px;margin-top:12px">
                  <button class="btn btn-sm btn-success" onclick="window.warehouseService.approveStockRequest('${req.id}')">
                    <i class="fas fa-check"></i> Approve & Transfer
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="window.warehouseService.rejectStockRequest('${req.id}')">
                    <i class="fas fa-times"></i> Reject
                  </button>
                </div>
              `
                      : ""
              }
              ${req.notes ? `<p style="margin-top:12px;padding:12px;background:var(--bg2);border-radius:8px;font-size:13px;color:var(--tx2)"><strong>Notes:</strong> ${req.notes}</p>` : ""}
            </div>
          `;
            })
            .join("")}
      </div>
    </div>
  `;
}

// 🚚 Render transfers tab
function renderTransfersTab() {
    const DB = getDB();
    const transfers = (DB.stockTransfers || [])
        .filter((r) => r.status === "approved")
        .sort(
            (a, b) =>
                new Date(b.updated_at) - new Date(a.updated_at),
        );

    if (transfers.length === 0) {
        return `
      <div class="empty-state">
        <i class="fas fa-exchange-alt"></i>
        <h3>No Transfers Yet</h3>
        <p>Approved stock transfers will appear here</p>
      </div>
    `;
    }

    return `
    <div class="card">
      <div class="card-header">
        <h3>Transfer History</h3>
      </div>
      <div class="card-body np">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>To Store</th>
                <th>Requested By</th>
                <th>Approved By</th>
              </tr>
            </thead>
            <tbody>
              ${transfers
                  .map((t) => {
                      const variant = DB.variants.find(
                          (v) => v.id === t.variant_id,
                      );
                      const product = variant
                          ? DB.products.find((p) => p.id === variant.product_id)
                          : null;

                      return `
                <tr>
                  <td>${new Date(t.updated_at || t.created_at).toLocaleDateString()}</td>
                  <td>${product ? product.name : "Unknown"}</td>
                  <td style="text-align:center">${t.quantity}</td>
                  <td>${t.store_name}</td>
                  <td>${t.requester_name}</td>
                  <td>${t.approved_by_name || "-"}</td>
                </tr>
              `;
                  })
                  .join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// 🔍 Find or create a variant at the destination store for stock transfers
export async function findOrCreateDestinationVariant(
    sourceVariant,
    destStoreId,
) {
    const DB = getDB();
    const sb = getSupabase();
    const offlineDB = window.offlineDB;

    // Look for an existing variant for the same product/color/storage at the destination store
    let destVariant = DB.variants.find(
        (v) =>
            v.product_id === sourceVariant.product_id &&
            v.store_id === destStoreId &&
            v.color === sourceVariant.color &&
            v.storage === sourceVariant.storage &&
            v.condition === sourceVariant.condition &&
            v.active !== false,
    );

    if (destVariant) return destVariant;

    // Create a new variant at the destination store
    const storeSuffix = destStoreId === STORE1_ID ? "S1" : "S2";
    const newVariant = {
        product_id: sourceVariant.product_id,


        sku: `${(sourceVariant.sku || "VAR").split("-").slice(0, 2).join("-")}-${storeSuffix}-${Date.now().toString().slice(-4)}`,
        color: sourceVariant.color,
        storage: sourceVariant.storage,
        store_id: destStoreId,

        qty: 0,

        cost_price: sourceVariant.cost_price || 0,
        price: sourceVariant.price || 0,
        commission_rate: sourceVariant.commission_rate || 0,
        is_active: true,
        created_at: now(),
        updated_at: now(),
    };

    if (navigator.onLine) {
        const { data, error } = await sb
            .from("variants")
            .insert([newVariant])
            .select();
        if (error) throw error;
        if (data && data[0]) return data[0];
    }

    // Fallback: assign a local ID if offline
    newVariant.id = uid();
    DB.variants.push(newVariant);
    if (offlineDB) await offlineDB.put("variants", newVariant);
    return newVariant;
}

// ✅ Approve stock request
export async function approveStockRequest(requestId) {
    const DB = getDB();
    const currentUser = getCurrentUser();
    const sb = getSupabase();

    try {
        const request = stockRequests.find(
            (r) => r.id === requestId,
        );
        if (!request) {
            alert("Request not found");
            return;
        }

        const variant = DB.variants.find(
            (v) => v.id === request.variant_id,
        );
        if (!variant) {
            alert("Product variant not found");
            return;
        }

        // Check if source has enough stock
        if (variant.qty < request.quantity) {
            alert(
                `Insufficient stock. Available: ${variant.qty}, Requested: ${request.quantity}`,
            );
            return;
        }

        if (
            !confirm(
                `Approve request and transfer ${request.quantity} units to ${request.store_name}?`,
            )
        ) {
            return;
        }

        // Reduce source variant stock
        variant.qty -= request.quantity;

        if (navigator.onLine) {
            const { error } = await sb
                .from("variants")
                .update({ qty: variant.qty, updated_at: now() })
                .eq("id", variant.id);
            if (error) throw error;
        }

        // Increase destination store variant stock
        const destVariant = await findOrCreateDestinationVariant(
            variant,
            request.store_id,
        );
        destVariant.qty = (destVariant.qty || 0) + request.quantity;

        if (navigator.onLine) {
            const { error } = await sb
                .from("variants")
                .update({ qty: destVariant.qty, updated_at: now() })
                .eq("id", destVariant.id);
            if (error) throw error;
        }

        // Update request status
        request.status = "approved";
        request.approved_by = currentUser.id;
        request.approved_by_name = currentUser.name;
        request.approved_at = now();

        await updateStockRequest(requestId, {
            status: "approved",
            approved_by: currentUser.id,
            approved_by_name: currentUser.name,
            approved_at: now(),
        });
        await loadDB();

        toast("Stock request approved and transferred!", "success");
        renderWarehouse();
    } catch (error) {
        console.error("Error approving request:", error);
        alert("Error: " + error.message);
    }
}

// ❌ Reject stock request
export async function rejectStockRequest(requestId) {
    const currentUser = getCurrentUser();

    try {
        const notes = prompt("Reason for rejection (optional):");
        if (notes === null) return;

        const request = stockRequests.find(
            (r) => r.id === requestId,
        );
        if (!request) {
            alert("Request not found");
            return;
        }

        request.status = "rejected";
        request.notes = notes || "Rejected by admin";
        request.approved_by = currentUser.id;
        request.approved_by_name = currentUser.name;
        request.approved_at = now();

        await updateStockRequest(requestId, {
            status: "rejected",
            notes: request.notes,
            approved_by: currentUser.id,
            approved_by_name: currentUser.name,
            approved_at: now(),
        });

        toast("Stock request rejected", "info");
        renderWarehouse();
    } catch (error) {
        console.error("Error rejecting request:", error);
        alert("Error: " + error.message);
    }
}

// Add stock mode state
let addStockMode = "existing";

// ➕ Open add stock modal
export function openAddStockModal() {
    const DB = getDB();

    const variants = DB.variants.filter((v) => v.is_active !== false && v.store_id === WAREHOUSE_ID);
    const products = DB.products || [];

    openModal(
        "Add Stock to Warehouse",
        `
    <form id="addStockForm" onsubmit="window.warehouseService.processAddStock(event)">
      <div class="form-group">
        <label>Mode</label>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <button type="button" class="btn btn-primary btn-sm" id="addStockModeExisting" onclick="window.warehouseService.toggleAddStockMode('existing')" style="flex:1">Add to Existing</button>
          <button type="button" class="btn btn-outline btn-sm" id="addStockModeNew" onclick="window.warehouseService.toggleAddStockMode('new')" style="flex:1">New Product</button>
        </div>
      </div>

      <!-- Existing variant mode -->
      <div id="addStockExistingFields">
        <div class="form-group">
          <label>Product Variant</label>
          <select class="form-input" id="addStockVariantId" onchange="window.warehouseService.updateAddStockInfo()">
            <option value="">Select product...</option>
            ${variants
                .map((v) => {
                    const product = products.find((p) => p.id === v.product_id);
                    const storeName =
                        v.store_id === STORE1_ID ? "Store 1" : "Store 2";
                    return `<option value="${v.id}" data-qty="${v.qty || 0}">${product ? product.name : "Unknown"} - ${v.color || ""} ${v.storage || ""} (${storeName}, Current: ${v.qty || 0})</option>`;
                })
                .join("")}
          </select>
        </div>
      </div>

      <!-- New product mode -->
      <div id="addStockNewFields" style="display:none">
        <div class="form-row">
          <div class="form-group"><label>Product Name *</label><input class="form-input" id="addStockProductName" placeholder="e.g. iPhone 15 Pro"></div>
          <div class="form-group"><label>Brand</label><input class="form-input" id="addStockBrand" placeholder="e.g. Apple"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Category</label>
            <select class="form-input" id="addStockCategory">
              <option value="phone">Phone</option>
              <option value="laptop">Laptop</option>
              <option value="accessory">Accessory</option>
              <option value="gaming_console">Gaming Console</option>
              <option value="bluetooth_speaker">Bluetooth Speaker</option>
              <option value="phone_accessory">Phone Accessory</option>
              <option value="laptop_accessory">Laptop Accessory</option>
            </select>
          </div>
          <div class="form-group"><label>Description</label><input class="form-input" id="addStockDescription" placeholder="Optional description"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Color</label><input class="form-input" id="addStockColor" placeholder="e.g. Black"></div>
          <div class="form-group"><label>Storage</label><input class="form-input" id="addStockStorage" placeholder="e.g. 256"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Store *</label>
            <select class="form-input" id="addStockStore">
              <option value="${WAREHOUSE_ID}">Warehouse (Central Stock)</option>
              <option value="${STORE1_ID}">Store 1</option>
              <option value="${STORE2_ID}">Store 2</option>
            </select>
          </div>
          <div class="form-group"><label>Condition *</label>
            <select class="form-input" id="addStockCondition">
              <option value="brand_new">Brand New</option>
              <option value="pre_owned">Pre-Owned</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Cost Price (K) *</label><input class="form-input" id="addStockCostPrice" type="number" step="0.01" min="0" value="0"></div>
          <div class="form-group"><label>Sale Price (K) *</label><input class="form-input" id="addStockSalePrice" type="number" step="0.01" min="0" value="0"></div>
        </div>
        <div class="form-group"><label>Commission Rate (K)</label><input class="form-input" id="addStockCommission" type="number" step="0.01" min="0" value="0"></div>
      </div>

      <div class="form-group">
        <label>Quantity to Add *</label>
        <input type="number" class="form-input" id="addStockQuantity" min="1" required>
        <small id="addStockInfo" style="color:var(--tx2);font-size:12px;margin-top:4px;display:block"></small>
      </div>
      <div class="form-group">
        <label>Notes (optional)</label>
        <textarea class="form-input" id="addStockNotes" rows="2" placeholder="e.g. New shipment received"></textarea>
      </div>
    </form>
  `,
        `
    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('addStockForm').requestSubmit()">
      <i class="fas fa-plus-circle"></i> Add Stock
    </button>
  `,
    );
}

// 🔄 Toggle add stock mode (existing vs new product)
export function toggleAddStockMode(mode) {
    addStockMode = mode;
    const existingFields = document.getElementById(
        "addStockExistingFields",
    );
    const newFields = document.getElementById("addStockNewFields");
    const btnExisting = document.getElementById(
        "addStockModeExisting",
    );
    const btnNew = document.getElementById("addStockModeNew");
    const variantSelect =
        document.getElementById("addStockVariantId");
    if (mode === "existing") {
        existingFields.style.display = "";
        newFields.style.display = "none";
        btnExisting.className = "btn btn-primary btn-sm";
        btnNew.className = "btn btn-outline btn-sm";
        if (variantSelect) variantSelect.required = true;
    } else {
        existingFields.style.display = "none";
        newFields.style.display = "";
        btnExisting.className = "btn btn-outline btn-sm";
        btnNew.className = "btn btn-primary btn-sm";
        if (variantSelect) variantSelect.required = false;
    }
    document.getElementById("addStockInfo").textContent = "";
}

// ℹ Update add stock info display
export function updateAddStockInfo() {
    const select = document.getElementById("addStockVariantId");
    const option = select.options[select.selectedIndex];
    const qty = option ? option.getAttribute("data-qty") : 0;
    const info = document.getElementById("addStockInfo");
    if (qty) {
        info.textContent = `Current stock: ${qty} units`;
    } else {
        info.textContent = "";
    }
}

// ⚙ Process add stock form submission
export async function processAddStock(e) {
    e.preventDefault();

    const DB = getDB();
    const sb = getSupabase();
    const offlineDB = window.offlineDB;

    try {
        const quantity = parseInt(
            document.getElementById("addStockQuantity").value,
        );
        const notes =
            document.getElementById("addStockNotes").value;

        if (!quantity || quantity < 1) {
            toast("Please enter a valid quantity", "error");
            return;
        }

        if (addStockMode === "existing") {
            const variantId =
                document.getElementById("addStockVariantId").value;
            if (!variantId) {
                toast("Please select a variant", "error");
                return;
            }

            const variant = DB.variants.find(
                (v) => v.id === variantId,
            );
            if (!variant) {
                toast("Product variant not found", "error");
                return;
            }

            const oldQty = variant.qty || 0;
            variant.qty = oldQty + quantity;

            if (navigator.onLine) {
                const { error } = await sb
                    .from("variants")
                    .update({ qty: variant.qty, updated_at: now() })
                    .eq("id", variantId);
                if (error) throw error;
            }

            if (offlineDB) {
                await offlineDB.put("variants", variant);
            }

            await loadDB();
            closeModal();
            toast(
                `Added ${quantity} units (${oldQty} → ${variant.qty})`,
                "success",
            );
            renderWarehouse();
        } else {
            // New product mode
            const productName = document
                .getElementById("addStockProductName")
                .value.trim();
            const brand = document
                .getElementById("addStockBrand")
                .value.trim();
            const category = document
                .getElementById("addStockCategory")
                .value;
            const description = document
                .getElementById("addStockDescription")
                .value.trim();
            const color = document
                .getElementById("addStockColor")
                .value.trim();
            const storage = document
                .getElementById("addStockStorage")
                .value.trim();
            const storeId =
                document.getElementById("addStockStore").value;
            const condition = document
                .getElementById("addStockCondition")
                .value;
            const costPrice = parseFloat(
                document.getElementById("addStockCostPrice").value,
            );
            const salePrice = parseFloat(
                document.getElementById("addStockSalePrice")
                    .value,
            );
            const commission = parseFloat(
                document.getElementById("addStockCommission")
                    .value || 0,
            );

            if (!productName) {
                toast("Product name is required", "error");
                return;
            }

            // Create new product
            const newProduct = {
                id: uid(),
                name: productName,
                brand: brand || "",
                category: category,
                description: description || "",

                created_at: now(),
                updated_at: now(),
            };

            if (navigator.onLine) {
                const { data: productData, error: productError } =
                    await sb
                        .from("products")
                        .insert([newProduct])
                        .select();
                if (productError) throw productError;
                if (productData && productData[0]) {
                    newProduct.id = productData[0].id;
                }
            }

            DB.products.push(newProduct);
            if (offlineDB) {
                await offlineDB.put("products", newProduct);
            }

            // Create new variant
            const sku = `${brand.substring(0, 3).toUpperCase()}-${productName.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
            const newVariant = {
                id: uid(),
                product_id: newProduct.id,


                sku: sku,
                color: color || "",
                storage: storage || "",
                store_id: storeId,

                qty: quantity,

                cost_price: costPrice,
                price: salePrice,
                commission_rate: commission,

                created_at: now(),
                updated_at: now(),
            };

            if (navigator.onLine) {
                const { data: variantData, error: variantError } =
                    await sb
                        .from("variants")
                        .insert([newVariant])
                        .select();
                if (variantError) throw variantError;
                if (variantData && variantData[0]) {
                    newVariant.id = variantData[0].id;
                }
            }

            DB.variants.push(newVariant);
            if (offlineDB) {
                await offlineDB.put("variants", newVariant);
            }

            await loadDB();
            closeModal();
            toast(
                `New product "${productName}" added with ${quantity} units`,
                "success",
            );
            renderWarehouse();
        }
    } catch (error) {
        console.error("Error adding stock:", error);
        toast("Error: " + error.message, "error");
    }
}

// 🚚 Open transfer modal
export function openTransferModal() {
    const DB = getDB();

    const variants = DB.variants.filter(
        (v) => v.is_active !== false && v.store_id === WAREHOUSE_ID && v.qty > 0,
    );

    if (variants.length === 0) {
        alert("No stock available to transfer");
        return;
    }

    const stores = [
        { id: STORE1_ID, name: "Store 1" },
        { id: STORE2_ID, name: "Store 2" },
    ];

    openModal(
        "Transfer Stock",
        `
    <form id="transferForm" onsubmit="window.warehouseService.processTransfer(event)">
      <div class="form-group">
        <label>Product Variant</label>
        <select class="form-input" id="transferVariantId" required onchange="window.warehouseService.updateTransferStock()">
          <option value="">Select product...</option>
          ${variants
              .map((v) => {
                  const product = DB.products.find(
                      (p) => p.id === v.product_id,
                  );
                  return `<option value="${v.id}" data-qty="${v.qty}">${product ? product.name : "Unknown"} - ${v.color || ""} ${v.storage || ""} (Stock: ${v.qty})</option>`;
              })
              .join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Quantity</label>
        <input type="number" class="form-input" id="transferQuantity" min="1" required>
        <small id="transferStockInfo" style="color:var(--tx2);font-size:12px;margin-top:4px;display:block"></small>
      </div>
      <div class="form-group">
        <label>To Store</label>
        <select class="form-input" id="transferStoreId" required>
          <option value="">Select store...</option>
          ${stores.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Notes (optional)</label>
        <textarea class="form-input" id="transferNotes" rows="2"></textarea>
      </div>
    </form>
  `,
        `
    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('transferForm').requestSubmit()">
      <i class="fas fa-exchange-alt"></i> Transfer Stock
    </button>
  `,
    );
}

// ℹ Update transfer stock info display
export function updateTransferStock() {
    const select = document.getElementById("transferVariantId");
    const option = select.options[select.selectedIndex];
    const qty = option ? option.getAttribute("data-qty") : 0;
    const info = document.getElementById("transferStockInfo");
    const input = document.getElementById("transferQuantity");

    if (qty) {
        info.textContent = `Available in warehouse: ${qty} units`;
        input.max = qty;
    } else {
        info.textContent = "";
        input.max = "";
    }
}

// ⚙ Process transfer form submission
export async function processTransfer(e) {
    e.preventDefault();

    const DB = getDB();
    const currentUser = getCurrentUser();
    const sb = getSupabase();

    try {
        const variantId =
            document.getElementById("transferVariantId").value;
        const quantity = parseInt(
            document.getElementById("transferQuantity").value,
        );
        const storeId =
            document.getElementById("transferStoreId").value;
        const notes =
            document.getElementById("transferNotes").value;

        const variant = DB.variants.find((v) => v.id === variantId);
        if (!variant) {
            alert("Product variant not found");
            return;
        }

        if (variant.qty < quantity) {
            alert(`Insufficient stock. Available: ${variant.qty}`);
            return;
        }

        // Reduce source variant stock
        variant.qty -= quantity;

        if (navigator.onLine) {
            const { error } = await sb
                .from("variants")
                .update({ qty: variant.qty, updated_at: now() })
                .eq("id", variantId);
            if (error) throw error;
        }

        // Increase destination store variant stock
        const destVariant = await findOrCreateDestinationVariant(
            variant,
            storeId,
        );
        destVariant.qty = (destVariant.qty || 0) + quantity;

        if (navigator.onLine) {
            const { error } = await sb
                .from("variants")
                .update({ qty: destVariant.qty, updated_at: now() })
                .eq("id", destVariant.id);
            if (error) throw error;
        }

        // Create transfer record
        const transfer = {
            id: uid(),
            variant_id: variantId,
            quantity: quantity,
            from_store_id: variant.store_id,
            from_store_name:
                variant.store_id === STORE1_ID
                    ? "Store 1"
                    : "Store 2",
            store_id: storeId,
            store_name:
                storeId === STORE1_ID ? "Store 1" : "Store 2",
            requester_name: "Admin Transfer",
            approved_by: currentUser.id,
            approved_by_name: currentUser.name,
            status: "approved",
            notes: notes,
            created_at: now(),
            updated_at: now(),
        };

        stockRequests.push(transfer);
        await saveStockRequest(transfer);

        await loadDB();
        closeModal();
        toast("Stock transferred successfully!", "success");
        renderWarehouse();
    } catch (error) {
        console.error("Error processing transfer:", error);
        alert("Error: " + error.message);
    }
}

// 📬 Cashier: Open stock request modal
export function openStockRequestModal() {
    const DB = getDB();

    const variants = DB.variants.filter(
        (v) => v.is_active !== false && v.store_id === WAREHOUSE_ID && v.qty > 0,
    );

    if (variants.length === 0) {
        alert("No stock available in warehouse");
        return;
    }

    openModal(
        "Request Stock from Warehouse",
        `
    <form id="stockRequestForm" onsubmit="window.warehouseService.submitStockRequest(event)">
      <div class="form-group">
        <label>Product</label>
        <select class="form-input" id="requestVariantId" required>
          <option value="">Select product...</option>
          ${variants
              .map((v) => {
                  const product = DB.products.find(
                      (p) => p.id === v.product_id,
                  );
                  return `<option value="${v.id}">${product ? product.name : "Unknown"} - ${v.color || ""} ${v.storage || ""} (Available: ${v.qty})</option>`;
              })
              .join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Quantity Needed</label>
        <input type="number" class="form-input" id="requestQuantity" min="1" required>
      </div>
      <div class="form-group">
        <label>Reason (optional)</label>
        <textarea class="form-input" id="requestNotes" rows="2" placeholder="Why do you need this stock?"></textarea>
      </div>
    </form>
  `,
        `
    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="document.getElementById('stockRequestForm').requestSubmit()">
      <i class="fas fa-paper-plane"></i> Submit Request
    </button>
  `,
    );
}

// 📤 Submit stock request
export async function submitStockRequest(e) {
    e.preventDefault();

    const DB = getDB();
    const currentUser = getCurrentUser();

    try {
        const variantId =
            document.getElementById("requestVariantId").value;
        const quantity = parseInt(
            document.getElementById("requestQuantity").value,
        );
        const notes = document.getElementById("requestNotes").value;

        const variant = DB.variants.find((v) => v.id === variantId);
        if (!variant) {
            alert("Product not found");
            return;
        }

        if (variant.qty < quantity) {
            alert(
                `Insufficient stock in warehouse. Available: ${variant.qty}`,
            );
            return;
        }

        // Create request (SIMPLE - like sales)
        const product = DB.products.find(
            (p) => p.id === variant.product_id,
        );
        const request = {
            id: uid(),
            variant_id: variantId,
            product_name: product
                ? product.name
                : "Unknown Product",
            variant_details:
                `${variant.color || ""} ${variant.storage || ""}`.trim(),
            quantity: quantity,
            requested_by: currentUser.id,
            requester_name: currentUser.name,
            store_id: currentUser.storeId, // Fixed: use storeId (camelCase) not store_id
            store_name:
                currentUser.storeId === STORE1_ID
                    ? "Store 1"
                    : "Store 2",
            status: "pending",
            notes: notes || "",
            // created_at auto-generated by database
        };

        stockRequests.push(request);

        // Debug: log what we're sending
        console.log("Sending stock request:", request);

        await saveStockRequest(request);

        closeModal();
        toast(
            "Stock request submitted! Waiting for admin approval.",
            "success",
        );
    } catch (error) {
        console.error("Error submitting request:", error);
        alert("Error: " + error.message);
    }
}

// 🔄 Update transfer status (for stock_transfers table)
export async function updateTransfer(id, status) {
    const sb = getSupabase();
    await sb
        .from("stock_transfers")
        .update({ status, updated_at: now() })
        .eq("id", id);
    await loadDB();
    toast("Transfer " + status, "success");
}

// ✅ Complete transfer (for stock_transfers table)
export async function completeTransfer(id) {
    const DB = getDB();
    const sb = getSupabase();

    const tr = DB.stockTransfers.find((t) => t.id === id);
    if (!tr) return;
    const srcVar = DB.variants.find(
        (v) =>
            v.id === tr.variant_id && v.store_id === tr.from_store_id,
    );
    const dstVar = DB.variants.find(
        (v) => v.id === tr.variant_id && v.store_id === tr.to_store_id,
    );
    if (srcVar) {
        await sb
            .from("variants")
            .update({
                qty: Math.max(0, (srcVar.qty || 0) - tr.quantity),
            })
            .eq("id", srcVar.id);
    }
    if (dstVar) {
        await sb
            .from("variants")
            .update({ qty: (dstVar.qty || 0) + tr.quantity })
            .eq("id", dstVar.id);
    }
    await sb
        .from("stock_transfers")
        .update({ status: "completed", updated_at: now(), completed_at: now() })
        .eq("id", id);
    await loadDB();
    toast("Transfer completed", "success");
}

// Export as a service object for window.warehouseService access
const warehouseService = {
    loadStockRequests,
    saveStockRequest,
    updateStockRequest,
    renderWarehouse,
    renderTransfers,
    deleteWarehouseProduct,
    findOrCreateDestinationVariant,
    approveStockRequest,
    rejectStockRequest,
    processAddStock,
    processTransfer,
    submitStockRequest,
    updateTransfer,
    completeTransfer,
    switchWarehouseTab,
    openAddStockModal,
    toggleAddStockMode,
    updateAddStockInfo,
    openTransferModal,
    updateTransferStock,
    openStockRequestModal,
};

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.warehouseService = warehouseService;
}

export default warehouseService;
