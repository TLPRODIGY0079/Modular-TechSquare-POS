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

    container.innerHTML = `
        <div class="product-grid">
            ${DB.products.map(product => {
                const variants = DB.variants.filter(v => v.product_id === product.id);
                const totalStock = variants.reduce((sum, v) => sum + (v.qty || 0), 0);
                
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
    const lowStockVariants = DB.variants.filter(v => v.qty < 10 && v.is_active);

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
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${DB.variants.map(variant => {
                    const product = DB.products.find(p => p.id === variant.product_id);
                    return `
                        <tr>
                            <td>${esc(product?.name || 'Unknown')}</td>
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

    // This would open a variants management modal
    toast("Variant management coming soon", "info");
}

// Edit variant
function editVariant(variantId) {
    const user = getCurrentUser();
    const isAdmin = user.role === "admin" || user.role === "store_manager";

    if (!isAdmin) {
        toast("Access denied. Only admins can edit variants.", "error");
        return;
    }

    // This would open a variant edit modal
    toast("Variant editing coming soon", "info");
}

// Export service functions for global access
window.productsService = {
    renderProducts,
    editProduct,
    manageVariants,
    editVariant
};

export default {
    renderProducts,
    renderProdTable,
    renderLowStockTable,
    renderVariants,
    openProductModal,
    editProduct,
    manageVariants,
    editVariant
};