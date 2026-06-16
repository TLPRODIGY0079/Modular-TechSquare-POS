// Product Management Service for TECHSQUARE POS
import { getDB, getCurrentUser } from '../db.js';
import { getSupabase } from '../supabase-client.js';
import { $, uid, money, today, now, esc } from '../utils.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { STORE1_ID, STORE2_ID, WAREHOUSE_ID } from '../config.js';

// Render products page
export function renderProducts() {
    const DB = getDB();
    const user = getCurrentUser();
    const mainContent = $("mainContent");
    
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="font-size: 24px; font-weight: 700;">Inventory Management</h2>
            <button class="btn btn-primary" id="addProductBtn" style="width: auto;">
                <i class="fas fa-plus"></i> Add Product
            </button>
        </div>

        <div class="tabs">
            <div class="tab active" data-tab="all">All Products</div>
            <div class="tab" data-tab="low-stock">Low Stock</div>
            <div class="tab" data-tab="variants">Variants</div>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" class="search-input" id="productSearch" placeholder="Search products by name, SKU, or category...">
                    <select class="filter-select" id="categoryFilter">
                        <option value="">All Categories</option>
                        <option value="Smartphones">Smartphones</option>
                        <option value="Laptops">Laptops</option>
                        <option value="Accessories">Accessories</option>
                    </select>
                </div>

                <div id="productsContainer" style="margin-top: 20px;">
                    <!-- Products will be rendered here -->
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    const addProductBtn = document.getElementById("addProductBtn");
    if (addProductBtn) {
        addProductBtn.addEventListener("click", () => openProductModal());
    }

    // Render products
    renderProdTable();

    // Setup tabs
    setupProductTabs();
}

// Setup product tabs
function setupProductTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            const tabName = tab.dataset.tab;
            if (tabName === "all") {
                renderProdTable();
            } else if (tabName === "low-stock") {
                renderLowStockTable();
            } else if (tabName === "variants") {
                renderVariants();
            }
        });
    });

    // Search functionality
    const searchInput = document.getElementById("productSearch");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterProducts(searchTerm);
        });
    }
}

// Render products table
function renderProdTable() {
    const DB = getDB();
    const user = getCurrentUser();
    const container = document.getElementById("productsContainer");
    if (!container) return;

    if (DB.products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-boxes-stacked"></i>
                <h3>No products found</h3>
                <p>Get started by adding your first product</p>
            </div>
        `;
        return;
    }

    // Get current store (non-admin users see their store, admins see all or can filter)
    const currentStoreId = user?.storeId;
    const isAdmin = user.role === "admin" || user.role === "store_manager";

    container.innerHTML = `
        <div class="product-grid">
            ${DB.products.map(product => {
                // Filter variants by store if not admin, or if admin wants store-specific view
                const variants = DB.variants.filter(v =>
                    v.product_id === product.id &&
                    (isAdmin || v.store_id === currentStoreId)
                );
                const totalStock = variants.reduce((sum, v) => sum + (v.qty || 0), 0);
                
                // For cashiers, only show products that have variants in their store
                if (!isAdmin && variants.length === 0) return '';
                
                return `
                    <div class="product-tile" data-product-id="${product.id}">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="font-weight: 600; font-size: 14px;">${esc(product.name)}</div>
                            <div class="badge ${totalStock < 10 ? 'badge-red' : 'badge-green'}">${totalStock} in stock</div>
                        </div>
                        <div style="font-size: 12px; color: var(--tx2); margin-top: 4px;">${esc(product.category || 'Uncategorized')}</div>
                        <div style="font-size: 12px; color: var(--tx2); margin-top: 2px;">${variants.length} variant(s)</div>
                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                            <button class="btn btn-sm btn-outline" onclick="window.productsService.editProduct('${product.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="window.productsService.manageVariants('${product.id}')">
                                <i class="fas fa-cubes"></i> Variants
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Render low stock table
function renderLowStockTable() {
    const DB = getDB();
    const user = getCurrentUser();
    const container = document.getElementById("productsContainer");
    if (!container) return;

    const isAdmin = user.role === "admin" || user.role === "store_manager";
    const currentStoreId = user?.storeId;

    const lowStockVariants = DB.variants.filter(v =>
        v.qty < 10 &&
        v.is_active &&
        (isAdmin || v.store_id === currentStoreId)
    );

    if (lowStockVariants.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>Stock levels healthy</h3>
                <p>No products are running low on stock</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>SKU</th>
                    <th>Stock</th>
                    <th>Price</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${lowStockVariants.map(variant => {
                    const product = DB.products.find(p => p.id === variant.product_id);
                    return `
                        <tr>
                            <td>${esc(product?.name || 'Unknown')}</td>
                            <td>${esc(variant.color || '')} ${esc(variant.storage || '')}</td>
                            <td>${esc(variant.sku)}</td>
                            <td><span class="badge badge-red">${variant.qty}</span></td>
                            <td>${money(variant.price)}</td>
                            <td>
                                ${isAdmin ? `
                                <button class="btn btn-sm btn-outline" onclick="window.productsService.editVariant('${variant.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                ` : ''}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Render variants
function renderVariants() {
    const DB = getDB();
    const user = getCurrentUser();
    const container = document.getElementById("productsContainer");
    if (!container) return;

    const isAdmin = user.role === "admin" || user.role === "store_manager";
    const currentStoreId = user?.storeId;

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Color</th>
                    <th>Storage</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Commission</th>
                    <th>Store</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${DB.variants.filter(v => isAdmin || v.store_id === currentStoreId).map(variant => {
                    const product = DB.products.find(p => p.id === variant.product_id);
                    return `
                        <tr>
                            <td>${esc(product?.name || 'Unknown')}</td>
                            <td>${esc(variant.sku)}</td>
                            <td>${esc(variant.color || '-')}</td>
                            <td>${esc(variant.storage || '-')}</td>
                            <td>${money(variant.price)}</td>
                            <td>
                                <span class="badge ${variant.qty < 5 ? 'badge-red' : 'badge-green'}">${variant.qty}</span>
                            </td>
                            <td>${variant.commission_rate ? money(variant.commission_rate) : '-'}</td>
                            <td>
                                <span class="badge ${variant.store_id === WAREHOUSE_ID ? 'badge-blue' : 'badge-green'}">
                                    ${variant.store_id === WAREHOUSE_ID ? 'Warehouse' : (variant.store_id === STORE1_ID ? 'Store 1' : 'Store 2')}
                                </span>
                            </td>
                            <td>
                                <span class="badge ${variant.is_active ? 'badge-green' : 'badge-gray'}">
                                    ${variant.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td>
                                ${isAdmin ? `
                                <button class="btn btn-sm btn-outline" onclick="window.productsService.editVariant('${variant.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                ` : ''}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Filter products
function filterProducts(searchTerm) {
    const DB = getDB();
    const productTiles = document.querySelectorAll(".product-tile");
    
    productTiles.forEach(tile => {
        const productId = tile.dataset.productId;
        const product = DB.products.find(p => p.id === productId);
        const variants = DB.variants.filter(v => v.product_id === productId);
        
        const searchableText = `
            ${product.name} 
            ${product.category} 
            ${variants.map(v => v.sku).join(' ')}
        `.toLowerCase();
        
        tile.style.display = searchableText.includes(searchTerm) ? 'block' : 'none';
    });
}

// Open product modal
function openProductModal(productId = null) {
    const DB = getDB();
    const product = productId ? DB.products.find(p => p.id === productId) : null;
    
    openModal(
        product ? 'Edit Product' : 'Add Product',
        `
            <form id="productForm">
                <div class="form-group">
                    <label>Product Name *</label>
                    <input type="text" class="form-input" id="productName" value="${product?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea class="form-input" id="productDescription" rows="3">${product?.description || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Category</label>
                        <select class="form-input" id="productCategory">
                            <option value="">Select category</option>
                            <option value="Smartphones" ${product?.category === 'Smartphones' ? 'selected' : ''}>Smartphones</option>
                            <option value="Laptops" ${product?.category === 'Laptops' ? 'selected' : ''}>Laptops</option>
                            <option value="Accessories" ${product?.category === 'Accessories' ? 'selected' : ''}>Accessories</option>
                            <option value="Tablets" ${product?.category === 'Tablets' ? 'selected' : ''}>Tablets</option>
                            <option value="Wearables" ${product?.category === 'Wearables' ? 'selected' : ''}>Wearables</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Brand</label>
                        <input type="text" class="form-input" id="productBrand" value="${product?.brand || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Cost Price</label>
                    <input type="number" class="form-input" id="productCostPrice" value="${product?.cost_price || ''}" step="0.01">
                </div>
            </form>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="saveProductBtn">
                <i class="fas fa-save"></i> ${product ? 'Update' : 'Create'} Product
            </button>
        `
    );

    const saveBtn = document.getElementById("saveProductBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", () => saveProduct(productId));
    }
}

// Save product
async function saveProduct(productId = null) {
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();
    
    const name = document.getElementById("productName").value.trim();
    const description = document.getElementById("productDescription").value.trim();
    const category = document.getElementById("productCategory").value;
    const brand = document.getElementById("productBrand").value.trim();
    const costPrice = parseFloat(document.getElementById("productCostPrice").value) || 0;

    if (!name) {
        toast("Product name is required", "error");
        return;
    }

    try {
        const productData = {
            name,
            description,
            category,
            brand,
            cost_price: costPrice,
            updated_at: now()
        };

        if (productId) {
            // Update existing product
            if (sb) {
                const { error } = await sb.from("products").update(productData).eq("id", productId);
                if (error) throw error;
            }
            
            const index = DB.products.findIndex(p => p.id === productId);
            if (index !== -1) {
                DB.products[index] = { ...DB.products[index], ...productData };
            }
            
            toast("Product updated successfully", "success");
        } else {
            // Create new product
            productData.id = uid();
            productData.is_active = true;
            productData.created_at = now();
            
            if (sb) {
                const { error } = await sb.from("products").insert([productData]);
                if (error) throw error;
            }
            
            DB.products.unshift(productData);
            toast("Product created successfully", "success");
        }

        closeModal();
        renderProdTable();
    } catch (error) {
        console.error("Error saving product:", error);
        toast("Error saving product: " + error.message, "error");
    }
}

// Edit product
function editProduct(productId) {
    openProductModal(productId);
}

// Manage variants
function manageVariants(productId) {
    const user = getCurrentUser();
    const isAdmin = user.role === "admin" || user.role === "store_manager";

    if (!isAdmin) {
        toast("Access denied. Only admins can manage variants.", "error");
        return;
    }

    const DB = getDB();
    const product = DB.products.find(p => p.id === productId);
    const variants = DB.variants.filter(v => v.product_id === productId);

    if (!product) {
        toast("Product not found", "error");
        return;
    }

    openModal(
        `Manage Variants - ${product.name}`,
        `
            <div class="variants-list">
                <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <h4>Current Variants (${variants.length})</h4>
                    <button class="btn btn-sm btn-primary" id="addVariantBtn">
                        <i class="fas fa-plus"></i> Add Variant
                    </button>
                </div>
                ${variants.length === 0 ? `
                    <div class="empty-state">
                        <i class="fas fa-cubes"></i>
                        <p>No variants yet. Add your first variant!</p>
                    </div>
                ` : `
                    <table>
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>Color</th>
                                <th>Storage</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${variants.map(variant => `
                                <tr>
                                    <td>${esc(variant.sku)}</td>
                                    <td>${esc(variant.color || '-')}</td>
                                    <td>${esc(variant.storage || '-')}</td>
                                    <td>${money(variant.price)}</td>
                                    <td>${variant.qty}</td>
                                    <td>
                                        <span class="badge ${variant.is_active ? 'badge-green' : 'badge-gray'}">
                                            ${variant.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-outline" onclick="window.productsService.editVariant('${variant.id}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Close</button>
        `
    );

    const addVariantBtn = document.getElementById("addVariantBtn");
    if (addVariantBtn) {
        addVariantBtn.addEventListener("click", () => {
            closeModal();
            addVariant(productId);
        });
    }
}

// Add new variant
function addVariant(productId) {
    const DB = getDB();
    const product = DB.products.find(p => p.id === productId);

    if (!product) {
        toast("Product not found", "error");
        return;
    }

    openModal(
        `Add Variant - ${product.name}`,
        `
            <form id="variantForm">
                <div class="form-group">
                    <label>Product</label>
                    <input type="text" class="form-input" value="${esc(product.name)}" disabled>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>SKU *</label>
                        <input type="text" class="form-input" id="variantSku" placeholder="e.g. IP15-PRO-BLK-256" required>
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <input type="text" class="form-input" id="variantColor" placeholder="e.g. Black">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Storage</label>
                        <input type="text" class="form-input" id="variantStorage" placeholder="e.g. 256GB">
                    </div>
                    <div class="form-group">
                        <label>Cost Price</label>
                        <input type="number" class="form-input" id="variantCostPrice" step="0.01" placeholder="0.00">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Selling Price *</label>
                        <input type="number" class="form-input" id="variantPrice" step="0.01" placeholder="0.00" required>
                    </div>
                    <div class="form-group">
                        <label>Stock Quantity *</label>
                        <input type="number" class="form-input" id="variantQty" min="0" value="0" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Commission Rate (per unit)</label>
                        <input type="number" class="form-input" id="variantCommissionRate" step="0.01" min="0" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="variantActive" checked>
                            Active
                        </label>
                    </div>
                </div>
            </form>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="saveVariantBtn">
                <i class="fas fa-save"></i> Create Variant
            </button>
        `
    );

    const saveBtn = document.getElementById("saveVariantBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", () => saveNewVariant(productId));
    }
}

// Save new variant
async function saveNewVariant(productId) {
    const DB = getDB();
    const sb = getSupabase();

    const sku = document.getElementById("variantSku").value.trim();
    const color = document.getElementById("variantColor").value.trim();
    const storage = document.getElementById("variantStorage").value.trim();
    const costPrice = parseFloat(document.getElementById("variantCostPrice").value) || 0;
    const price = parseFloat(document.getElementById("variantPrice").value) || 0;
    const qty = parseInt(document.getElementById("variantQty").value) || 0;
    const commissionRate = parseFloat(document.getElementById("variantCommissionRate").value) || 0;
    const isActive = document.getElementById("variantActive").checked;

    if (!sku) {
        toast("SKU is required", "error");
        return;
    }

    if (price <= 0) {
        toast("Selling price must be greater than 0", "error");
        return;
    }

    try {
        const variantData = {
            id: uid(),
            product_id: productId,
            sku,
            color,
            storage,
            cost_price: costPrice,
            price,
            qty,
            commission_rate: commissionRate,
            is_active: isActive,
            created_at: now(),
            updated_at: now()
        };

        // Insert new variant
        if (sb) {
            const { error } = await sb.from("variants").insert([variantData]);
            if (error) throw error;
        }

        DB.variants.push(variantData);
        toast("Variant created successfully", "success");
        closeModal();

        // Refresh the current view
        const activeTab = document.querySelector(".tab.active")?.dataset.tab;
        if (activeTab === "variants") {
            renderVariants();
        } else if (activeTab === "low-stock") {
            renderLowStockTable();
        } else {
            renderProdTable();
        }
    } catch (error) {
        console.error("Error creating variant:", error);
        toast("Failed to create variant", "error");
    }
}

// Edit variant
function editVariant(variantId) {
    const user = getCurrentUser();
    const isAdmin = user.role === "admin" || user.role === "store_manager";

    if (!isAdmin) {
        toast("Access denied. Only admins can edit variants.", "error");
        return;
    }

    const DB = getDB();
    const variant = DB.variants.find(v => v.id === variantId);
    const product = DB.products.find(p => p.id === variant.product_id);

    if (!variant) {
        toast("Variant not found", "error");
        return;
    }

    openModal(
        `Edit Variant - ${product?.name || 'Unknown'}`,
        `
            <form id="variantForm">
                <div class="form-group">
                    <label>Product</label>
                    <input type="text" class="form-input" value="${esc(product?.name || 'Unknown')}" disabled>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>SKU *</label>
                        <input type="text" class="form-input" id="variantSku" value="${esc(variant.sku || '')}" required>
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <input type="text" class="form-input" id="variantColor" value="${esc(variant.color || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Storage</label>
                        <input type="text" class="form-input" id="variantStorage" value="${esc(variant.storage || '')}">
                    </div>
                    <div class="form-group">
                        <label>Cost Price</label>
                        <input type="number" class="form-input" id="variantCostPrice" value="${variant.cost_price || ''}" step="0.01">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Selling Price *</label>
                        <input type="number" class="form-input" id="variantPrice" value="${variant.price || ''}" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Stock Quantity *</label>
                        <input type="number" class="form-input" id="variantQty" value="${variant.qty || 0}" min="0" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Commission Rate (per unit)</label>
                        <input type="number" class="form-input" id="variantCommissionRate" value="${variant.commission_rate || 0}" step="0.01" min="0" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="variantActive" ${variant.is_active ? 'checked' : ''}>
                            Active
                        </label>
                    </div>
                </div>
            </form>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="saveVariantBtn">
                <i class="fas fa-save"></i> Update Variant
            </button>
        `
    );

    const saveBtn = document.getElementById("saveVariantBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", () => saveVariant(variantId));
    }
}

// Save variant
async function saveVariant(variantId) {
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();

    const sku = document.getElementById("variantSku").value.trim();
    const color = document.getElementById("variantColor").value.trim();
    const storage = document.getElementById("variantStorage").value.trim();
    const costPrice = parseFloat(document.getElementById("variantCostPrice").value) || 0;
    const price = parseFloat(document.getElementById("variantPrice").value) || 0;
    const qty = parseInt(document.getElementById("variantQty").value) || 0;
    const commissionRate = parseFloat(document.getElementById("variantCommissionRate").value) || 0;
    const isActive = document.getElementById("variantActive").checked;

    if (!sku) {
        toast("SKU is required", "error");
        return;
    }

    if (price <= 0) {
        toast("Selling price must be greater than 0", "error");
        return;
    }

    try {
        const variantData = {
            sku,
            color,
            storage,
            cost_price: costPrice,
            price,
            qty,
            commission_rate: commissionRate,
            is_active: isActive,
            updated_at: now()
        };

        // Update existing variant
        if (sb) {
            const { error } = await sb.from("variants").update(variantData).eq("id", variantId);
            if (error) throw error;
        }

        const index = DB.variants.findIndex(v => v.id === variantId);
        if (index !== -1) {
            DB.variants[index] = { ...DB.variants[index], ...variantData };
        }

        toast("Variant updated successfully", "success");
        closeModal();

        // Refresh the current view
        const activeTab = document.querySelector(".tab.active")?.dataset.tab;
        if (activeTab === "variants") {
            renderVariants();
        } else if (activeTab === "low-stock") {
            renderLowStockTable();
        } else {
            renderProdTable();
        }
    } catch (error) {
        console.error("Error saving variant:", error);
        toast("Failed to update variant", "error");
    }
}

// Export service functions for global access
window.productsService = {
    renderProducts,
    editProduct,
    manageVariants,
    editVariant,
    addVariant,
    saveVariant,
    saveNewVariant
};

export default {
    renderProducts,
    renderProdTable,
    renderLowStockTable,
    renderVariants,
    openProductModal,
    editProduct,
    manageVariants,
    editVariant,
    addVariant,
    saveVariant,
    saveNewVariant
};