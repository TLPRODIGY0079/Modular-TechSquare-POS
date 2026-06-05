// Sales and POS Service for TECHSQUARE POS
import { getDB, getCurrentUser, getCart, setCart } from '../db.js';
import { getSupabase } from '../supabase-client.js';
import { $, uid, money, today, now, esc } from '../utils.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { STORE1_ID, STORE2_ID, WAREHOUSE_ID } from '../config.js';
import { calculateCommission } from './agents.js';

// Render sales/POS page
export function renderSales() {
    const DB = getDB();
    const user = getCurrentUser();
    const mainContent = $("mainContent");
    
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="pos-layout">
            <div class="pos-products">
                <div style="margin-bottom: 20px;">
                    <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">Point of Sale</h2>
                    <div class="search-bar">
                        <i class="fas fa-search"></i>
                        <input type="text" class="search-input" id="posSearch" placeholder="Search products or scan barcode...">
                        <button class="btn btn-primary" id="barcodeScanBtn" style="width: auto;">
                            <i class="fas fa-barcode"></i>
                        </button>
                    </div>
                </div>
                
                <div id="posProductsGrid" class="product-grid">
                    <!-- Products will be rendered here -->
                </div>
            </div>
            
            <div class="pos-cart">
                <div class="cart-header">
                    <h3 style="font-size: 18px; font-weight: 700;">Current Sale</h3>
                    <div id="cartStoreSelector">
                        <select class="form-input" id="storeSelect" style="font-size: 13px; padding: 6px 10px;">
                            <option value="${STORE1_ID}">Store 1</option>
                            <option value="${STORE2_ID}">Store 2</option>
                        </select>
                    </div>
                </div>
                
                <div id="cartItems" class="cart-items">
                    <!-- Cart items will be rendered here -->
                </div>
                
                <div class="cart-footer">
                    <div class="form-group">
                        <label>Customer Name (optional)</label>
                        <input type="text" class="form-input" id="customerName" placeholder="Enter customer name">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Discount</label>
                            <input type="number" class="form-input" id="cartDiscount" value="0" min="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Payment Method</label>
                            <select class="form-input" id="paymentMethod">
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="transfer">Bank Transfer</option>
                                <option value="layby">Layby</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 16px 0;">
                        <span style="font-size: 16px; font-weight: 600;">Total</span>
                        <span id="cartTotal" style="font-size: 24px; font-weight: 700; color: var(--ac);">K0.00</span>
                    </div>
                    <button class="btn btn-primary" id="completeSaleBtn">
                        <i class="fas fa-check"></i> Complete Sale
                    </button>
                </div>
            </div>
        </div>
    `;

    // Initialize cart
    setCart([]);
    
    // Render products
    renderPOSProducts();
    
    // Setup event listeners
    setupPOSListeners();
}

// Render POS products grid
function renderPOSProducts() {
    const DB = getDB();
    const container = document.getElementById("posProductsGrid");
    if (!container) return;

    const activeVariants = DB.variants.filter(v => v.is_active && v.qty > 0);

    if (activeVariants.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-boxes-stacked"></i>
                <h3>No products available</h3>
                <p>Add products to inventory to start selling</p>
            </div>
        `;
        return;
    }

    container.innerHTML = activeVariants.map(variant => {
        const product = DB.products.find(p => p.id === variant.product_id);
        return `
            <div class="product-tile" style="cursor: pointer;" onclick="window.salesService.addToCart('${variant.id}')">
                <div style="font-weight: 600; font-size: 14px;">${esc(product?.name || 'Unknown')}</div>
                <div style="font-size: 12px; color: var(--tx2); margin-top: 4px;">
                    ${esc(variant.color || '')} ${esc(variant.storage || '')}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <span style="font-weight: 700; color: var(--ac);">${money(variant.price)}</span>
                    <span class="badge ${variant.qty < 5 ? 'badge-red' : 'badge-green'}">${variant.qty} left</span>
                </div>
            </div>
        `;
    }).join('');
}

// Setup POS event listeners
function setupPOSListeners() {
    // Search functionality
    const searchInput = document.getElementById("posSearch");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterPOSProducts(searchTerm);
        });
    }

    // Barcode scanner
    const barcodeBtn = document.getElementById("barcodeScanBtn");
    if (barcodeBtn) {
        barcodeBtn.addEventListener("click", () => {
            toast("Barcode scanner coming soon", "info");
        });
    }

    // Complete sale
    const completeBtn = document.getElementById("completeSaleBtn");
    if (completeBtn) {
        completeBtn.addEventListener("click", completeSale);
    }

    // Update cart total on input changes
    const discountInput = document.getElementById("cartDiscount");
    if (discountInput) {
        discountInput.addEventListener("input", updateCartDisplay);
    }
}

// Filter POS products
function filterPOSProducts(searchTerm) {
    const DB = getDB();
    const productTiles = document.querySelectorAll("#posProductsGrid .product-tile");
    
    productTiles.forEach(tile => {
        const text = tile.textContent.toLowerCase();
        tile.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

// Add item to cart
function addToCart(variantId) {
    const DB = getDB();
    const cart = getCart();
    const variant = DB.variants.find(v => v.id === variantId);
    
    if (!variant) {
        toast("Product not found", "error");
        return;
    }

    if (variant.qty <= 0) {
        toast("Product out of stock", "error");
        return;
    }

    const existingItem = cart.find(item => item.variantId === variantId);
    
    if (existingItem) {
        if (existingItem.quantity >= variant.qty) {
            toast("Not enough stock available", "error");
            return;
        }
        existingItem.quantity++;
    } else {
        const product = DB.products.find(p => p.id === variant.product_id);
        cart.push({
            variantId,
            productId: variant.product_id,
            name: product?.name || 'Unknown',
            variantLabel: `${variant.color || ''} ${variant.storage || ''}`.trim(),
            sku: variant.sku,
            price: variant.price,
            costPrice: variant.cost_price || 0,
            quantity: 1,
            maxQuantity: variant.qty,
            commissionRate: variant.commission_rate || 0
        });
    }

    setCart(cart);
    updateCartDisplay();
}

// Remove item from cart
function removeFromCart(variantId) {
    const cart = getCart();
    const index = cart.findIndex(item => item.variantId === variantId);
    
    if (index !== -1) {
        cart.splice(index, 1);
        setCart(cart);
        updateCartDisplay();
    }
}

// Update item quantity in cart
function updateCartQuantity(variantId, delta) {
    const cart = getCart();
    const item = cart.find(item => item.variantId === variantId);
    
    if (item) {
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0) {
            removeFromCart(variantId);
        } else if (newQuantity <= item.maxQuantity) {
            item.quantity = newQuantity;
            setCart(cart);
            updateCartDisplay();
        } else {
            toast("Not enough stock available", "error");
        }
    }
}

// Update cart display
function updateCartDisplay() {
    const cart = getCart();
    const container = document.getElementById("cartItems");
    const totalElement = document.getElementById("cartTotal");
    
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--tx2);">
                <i class="fas fa-shopping-cart" style="font-size: 32px; margin-bottom: 12px; opacity: 0.3;"></i>
                <p>Cart is empty</p>
            </div>
        `;
        if (totalElement) totalElement.textContent = money(0);
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${esc(item.name)}</div>
                <div class="cart-item-variant">${esc(item.variantLabel)} - ${esc(item.sku)}</div>
                <div class="cart-item-price">${money(item.price)} x ${item.quantity}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div class="qty-control">
                    <button class="qty-btn" onclick="window.salesService.decrementQuantity('${item.variantId}')">-</button>
                    <span class="qty-val">${item.quantity}</span>
                    <button class="qty-btn" onclick="window.salesService.incrementQuantity('${item.variantId}')">+</button>
                </div>
                <button class="btn btn-sm btn-ghost btn-danger" onclick="window.salesService.removeFromCart('${item.variantId}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    // Calculate total
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = parseFloat(document.getElementById("cartDiscount")?.value) || 0;
    const total = Math.max(0, subtotal - discount);
    
    if (totalElement) totalElement.textContent = money(total);
}

// Complete sale
async function completeSale() {
    const DB = getDB();
    const cart = getCart();
    const user = getCurrentUser();
    const sb = getSupabase();
    
    if (cart.length === 0) {
        toast("Cart is empty", "error");
        return;
    }

    const storeId = document.getElementById("storeSelect")?.value || user?.storeId || STORE1_ID;
    const customerName = document.getElementById("customerName")?.value.trim() || null;
    const discount = parseFloat(document.getElementById("cartDiscount")?.value) || 0;
    const paymentMethod = document.getElementById("paymentMethod")?.value || 'cash';

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = Math.max(0, subtotal - discount);
    const receiptNo = "SALE-" + Date.now().toString(36).toUpperCase();

    try {
        // Create sale records for each item
        for (const item of cart) {
            const saleData = {
                id: uid(),
                store_id: storeId,
                user_id: user?.id,
                user_name: user?.name,
                receipt_number: receiptNo,
                product_name: item.name,
                sku: item.sku,
                variant_label: item.variantLabel,
                quantity: item.quantity,
                unit_price: item.price,
                cost_price: item.costPrice,
                subtotal: item.price * item.quantity,
                discount: discount / cart.length,
                total: (item.price * item.quantity) - (discount / cart.length),
                profit: (item.price - item.costPrice) * item.quantity,
                commission_rate: item.commissionRate,
                payment_method: paymentMethod,
                customer_name: customerName,
                date_str: today(),
                created_at: now()
            };

            // Save to Supabase
            if (sb) {
                const { error } = await sb.from("sales").insert([saleData]);
                if (error) throw error;
            }

            // Save to local DB
            DB.sales.unshift(saleData);

            // Update variant stock
            const variant = DB.variants.find(v => v.id === item.variantId);
            if (variant) {
                const newQty = Math.max(0, variant.qty - item.quantity);
                const variantUpdate = {
                    qty: newQty,
                    updated_at: now()
                };

                if (sb) {
                    const { error } = await sb.from("variants").update(variantUpdate).eq("id", variant.id);
                    if (error) console.error("Variant update error:", error);
                }

                variant.qty = newQty;
            }
        }

        // Calculate commission if applicable
        if (cart.some(item => item.commissionRate > 0)) {
            try {
                await calculateCommission(cart, receiptNo, storeId, total);
            } catch (error) {
                console.error("Commission calculation error:", error);
            }
        }

        // Clear cart
        setCart([]);
        updateCartDisplay();
        
        // Refresh products grid
        renderPOSProducts();

        toast(`Sale completed! Receipt: ${receiptNo}`, "success");

        // Show receipt option
        openModal(
            "Sale Completed",
            `
                <div style="text-align: center;">
                    <i class="fas fa-check-circle" style="font-size: 48px; color: var(--gn); margin-bottom: 16px;"></i>
                    <h3 style="margin-bottom: 8px;">Sale Successful!</h3>
                    <p style="color: var(--tx2); margin-bottom: 16px;">Receipt: ${receiptNo}</p>
                    <div style="background: var(--bg); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Total Items:</span>
                            <span>${cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-weight: 700;">
                            <span>Total Amount:</span>
                            <span>${money(total)}</span>
                        </div>
                    </div>
                </div>
            `,
            `
                <button class="btn btn-outline" onclick="window.closeModal()">Close</button>
                <button class="btn btn-primary" onclick="window.salesService.printReceipt('${receiptNo}')">
                    <i class="fas fa-print"></i> Print Receipt
                </button>
            `
        );

    } catch (error) {
        console.error("Sale completion error:", error);
        toast("Error completing sale: " + error.message, "error");
    }
}

// Print receipt
function printReceipt(receiptNo) {
    const DB = getDB();
    const sales = DB.sales.filter(s => s.receipt_number === receiptNo);
    
    if (sales.length === 0) {
        toast("Receipt not found", "error");
        return;
    }

    // Generate receipt HTML
    const receiptHTML = `
        <div class="receipt">
            <div class="receipt-center">
                <h2>TECHSQUARE</h2>
                <p>Multi-Store POS</p>
            </div>
            <hr>
            <div class="receipt-row">
                <span>Receipt:</span>
                <span>${receiptNo}</span>
            </div>
            <div class="receipt-row">
                <span>Date:</span>
                <span>${formatDate(sales[0].created_at)}</span>
            </div>
            <hr>
            ${sales.map(sale => `
                <div class="receipt-row">
                    <span>${sale.product_name}</span>
                    <span>${money(sale.total)}</span>
                </div>
                <div class="receipt-row">
                    <span>  ${sale.variant_label} x ${sale.quantity}</span>
                    <span></span>
                </div>
            `).join('')}
            <hr>
            <div class="receipt-row" style="font-weight: 700;">
                <span>TOTAL:</span>
                <span>${money(sales.reduce((sum, s) => sum + s.total, 0))}</span>
            </div>
            <div class="receipt-center" style="margin-top: 20px;">
                <p>Thank you for your purchase!</p>
            </div>
        </div>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`
            <html>
            <head>
                <title>Receipt ${receiptNo}</title>
                <style>
                    body { font-family: 'Courier New', monospace; margin: 20px; }
                    .receipt { max-width: 300px; margin: 0 auto; }
                    .receipt-center { text-align: center; }
                    .receipt-row { display: flex; justify-content: space-between; }
                    hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
                </style>
            </head>
            <body>${receiptHTML}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
    
    closeModal();
}

// Helper function for cart quantity controls
function incrementQuantity(variantId) {
    updateCartQuantity(variantId, 1);
}

function decrementQuantity(variantId) {
    updateCartQuantity(variantId, -1);
}

// Helper function for date formatting
function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleString();
}

// Render sales history page
export function renderHistory() {
    const DB = getDB();
    const mainContent = $("mainContent");
    
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div style="margin-bottom: 24px;">
            <h2 style="font-size: 24px; font-weight: 700;">Sales History</h2>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" class="search-input" id="salesSearch" placeholder="Search by receipt, customer, or product...">
                    <input type="date" class="form-input" id="salesDateFilter" style="width: auto;">
                </div>

                <div style="margin-top: 20px; overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Receipt</th>
                                <th>Date</th>
                                <th>Customer</th>
                                <th>Products</th>
                                <th>Total</th>
                                <th>Payment</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="salesHistoryBody">
                            <!-- Sales will be rendered here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    renderSalesHistoryTable();
}

// Render sales history table
function renderSalesHistoryTable() {
    const DB = getDB();
    const tbody = document.getElementById("salesHistoryBody");
    if (!tbody) return;

    if (DB.sales.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <div class="empty-state">
                        <i class="fas fa-receipt"></i>
                        <h3>No sales found</h3>
                        <p>Start making sales to see history here</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Group by receipt number
    const salesByReceipt = {};
    DB.sales.forEach(sale => {
        if (!salesByReceipt[sale.receipt_number]) {
            salesByReceipt[sale.receipt_number] = [];
        }
        salesByReceipt[sale.receipt_number].push(sale);
    });

    tbody.innerHTML = Object.entries(salesByReceipt).map(([receiptNo, sales]) => {
        const firstSale = sales[0];
        const total = sales.reduce((sum, s) => sum + s.total, 0);
        const productNames = [...new Set(sales.map(s => s.product_name))].slice(0, 2).join(', ');
        
        return `
            <tr>
                <td><strong>${receiptNo}</strong></td>
                <td>${formatDate(firstSale.created_at)}</td>
                <td>${esc(firstSale.customer_name || 'Walk-in')}</td>
                <td>${esc(productNames)}${sales.length > 2 ? '...' : ''}</td>
                <td><strong>${money(total)}</strong></td>
                <td><span class="badge badge-blue">${firstSale.payment_method}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="window.salesService.viewReceipt('${receiptNo}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// View receipt
function viewReceipt(receiptNo) {
    printReceipt(receiptNo);
}

// Export service functions for global access
window.salesService = {
    renderSales,
    addToCart,
    removeFromCart,
    incrementQuantity,
    decrementQuantity,
    completeSale,
    printReceipt,
    renderHistory,
    viewReceipt
};

export default {
    renderSales,
    addToCart,
    removeFromCart,
    incrementQuantity,
    decrementQuantity,
    completeSale,
    printReceipt,
    renderHistory,
    viewReceipt
};