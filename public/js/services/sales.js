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
                    ${user.role === "admin" ? `
                    <div id="cartStoreSelector">
                        <select class="form-input" id="storeSelect" style="font-size: 13px; padding: 6px 10px;">
                            <option value="${STORE1_ID}">Store 1</option>
                            <option value="${STORE2_ID}">Store 2</option>
                        </select>
                    </div>
                    ` : `
                    <div style="font-size: 13px; color: var(--tx2); font-weight: 600;">
                        ${user.storeId === STORE1_ID ? "Store 1" : "Store 2"}
                    </div>
                    `}
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
    const user = getCurrentUser();
    const container = document.getElementById("posProductsGrid");
    if (!container) return;

    // Get the selected store (admin can choose, cashiers use their assigned store)
    const selectedStoreId = user.role === "admin" 
        ? (document.getElementById("storeSelect")?.value || STORE1_ID)
        : (user?.storeId || STORE1_ID);

    const activeVariants = DB.variants.filter(v => v.is_active && v.qty > 0 && v.store_id === selectedStoreId);

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
    const user = getCurrentUser();
    
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
        barcodeBtn.addEventListener("click", openBarcodeScanner);
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

    // Store selector change - re-render products for selected store (admin only)
    if (user.role === "admin") {
        const storeSelect = document.getElementById("storeSelect");
        if (storeSelect) {
            storeSelect.addEventListener("change", () => {
                renderPOSProducts();
            });
        }
    }
}

// Barcode scanner functions
let html5QrcodeScanner = null;

function openBarcodeScanner() {
    const overlay = document.getElementById("barcodeScannerOverlay");
    if (!overlay) {
        toast("Barcode scanner UI not found", "error");
        return;
    }
    
    overlay.style.display = "flex";
    
    // Initialize scanner
    if (typeof Html5Qrcode !== 'undefined') {
        // Clear previous instance if exists
        if (html5QrcodeScanner) {
            try {
                html5QrcodeScanner.clear();
            } catch (e) {
                console.log("Scanner clear error:", e);
            }
        }
        
        html5QrcodeScanner = new Html5Qrcode("barcodeReader");
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            facingMode: "environment" // Use back camera
        };
        
        html5QrcodeScanner.start(
            { facingMode: "environment" },
            config,
            onBarcodeDetected,
            (errorMessage) => {
                // Ignore frequent scanning errors
                if (!errorMessage.includes('No barcode')) {
                    console.log("Barcode scan error:", errorMessage);
                }
            }
        ).catch(err => {
            console.error("Scanner start error:", err);
            toast("Failed to start camera: " + err.message, "error");
            closeBarcodeScanner();
        });
    } else {
        toast("Barcode scanner library not loaded", "error");
        closeBarcodeScanner();
    }
    
    // Setup close button
    const closeBtn = document.getElementById("barcodeScannerClose");
    if (closeBtn) {
        closeBtn.onclick = closeBarcodeScanner;
    }
}

function closeBarcodeScanner() {
    const overlay = document.getElementById("barcodeScannerOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
    
    if (html5QrcodeScanner) {
        try {
            html5QrcodeScanner.stop().then(() => {
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
            }).catch(err => {
                console.log("Scanner stop error:", err);
                html5QrcodeScanner = null;
            });
        } catch (e) {
            console.log("Scanner cleanup error:", e);
            html5QrcodeScanner = null;
        }
    }
}

function onBarcodeDetected(decodedText, decodedResult) {
    console.log("Barcode detected:", decodedText);
    
    // Stop scanning temporarily
    if (html5QrcodeScanner) {
        html5QrcodeScanner.pause();
    }
    
    // Search for product by barcode/SKU
    const DB = getDB();
    let foundProduct = null;
    let foundVariant = null;
    
    // First try to find by SKU in variants
    foundVariant = DB.variants.find(v => v.sku === decodedText);
    if (foundVariant) {
        foundProduct = DB.products.find(p => p.id === foundVariant.product_id);
    }
    
    // If not found, try to find by barcode in products
    if (!foundProduct) {
        foundProduct = DB.products.find(p => p.barcode === decodedText);
        if (foundProduct) {
            foundVariant = DB.variants.find(v => v.product_id === foundProduct.id && v.qty > 0);
        }
    }
    
    if (foundProduct && foundVariant) {
        // Add to cart
        addToCart(foundVariant.id);
        toast(`Added: ${foundProduct.name}`, "success");
        
        // Close scanner after successful scan
        setTimeout(() => {
            closeBarcodeScanner();
        }, 1000);
    } else {
        toast(`Product not found: ${decodedText}`, "error");
        
        // Resume scanning after 2 seconds
        setTimeout(() => {
            if (html5QrcodeScanner) {
                html5QrcodeScanner.resume();
            }
        }, 2000);
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

    const storeId = user.role === "admin" 
        ? (document.getElementById("storeSelect")?.value || STORE1_ID)
        : (user?.storeId || STORE1_ID);
    const customerName = document.getElementById("customerName")?.value.trim() || null;
    const discount = parseFloat(document.getElementById("cartDiscount")?.value) || 0;
    const paymentMethod = document.getElementById("paymentMethod")?.value || 'cash';

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = Math.max(0, subtotal - discount);
    const receiptNo = "SALE-" + Date.now().toString(36).toUpperCase();

    try {
        // Create sale records for each item
        for (const item of cart) {
            // Generate unique receipt number for each item to avoid constraint violation
            const itemReceiptNo = receiptNo + "-" + (cart.indexOf(item) + 1);
            
            const saleData = {
                id: uid(),
                store_id: storeId,
                user_id: user?.id,
                user_name: user?.name,
                receipt_number: itemReceiptNo,
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

            // Save to Supabase (if online)
            let supabaseSuccess = false;
            if (sb) {
                try {
                    const { error } = await sb.from("sales").insert([saleData]);
                    if (error) throw error;
                    supabaseSuccess = true;
                } catch (supabaseError) {
                    console.error("Supabase save failed, saving locally:", supabaseError);
                    // Save to IndexedDB for offline sync
                    const offlineDB = window.offlineDB;
                    if (offlineDB) {
                        try {
                            await offlineDB.put('sales', saleData);
                            await offlineDB.queueOperation('create', 'sales', saleData, saleData.id);
                            console.log("Sale saved to offline DB for sync");
                        } catch (offlineError) {
                            console.error("Offline DB save failed:", offlineError);
                        }
                    }
                }
            }

            // Save to local DB (always, regardless of Supabase success)
            DB.sales.unshift(saleData);

            // Update variant stock
            const variant = DB.variants.find(v => v.id === item.variantId);
            if (variant) {
                const newQty = Math.max(0, variant.qty - item.quantity);
                const variantUpdate = {
                    qty: newQty,
                    updated_at: now()
                };

                // Try Supabase update (if online)
                if (sb) {
                    try {
                        const { error } = await sb.from("variants").update(variantUpdate).eq("id", variant.id);
                        if (error) throw error;
                    } catch (supabaseError) {
                        console.error("Supabase variant update failed, queueing for sync:", supabaseError);
                        // Queue for offline sync
                        const offlineDB = window.offlineDB;
                        if (offlineDB) {
                            try {
                                await offlineDB.queueOperation('update', 'variants', variantUpdate, variant.id);
                            } catch (offlineError) {
                                console.error("Failed to queue variant update:", offlineError);
                            }
                        }
                    }
                }

                // Always update local DB
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
                <button class="btn btn-primary" id="printReceiptBtn">
                    <i class="fas fa-print"></i> Print Receipt
                </button>
            `
        );

        // Setup print button handler
        setTimeout(() => {
            const printBtn = document.getElementById('printReceiptBtn');
            if (printBtn) {
                printBtn.addEventListener('click', () => {
                    closeModal();
                    printReceipt(receiptNo);
                });
            }
        }, 100);

    } catch (error) {
        console.error("Sale completion error:", error);
        toast("Error completing sale: " + error.message, "error");
    }
}

// Print receipt
function printReceipt(receiptNo) {
    const DB = getDB();
    // Handle both base receipt numbers (e.g., "SALE-12345") and item-specific ones (e.g., "SALE-12345-1")
    const baseReceiptNo = receiptNo.split('-').slice(0, -1).join('-') || receiptNo;
    const sales = DB.sales.filter(s => s.receipt_number.startsWith(baseReceiptNo));
    
    if (sales.length === 0) {
        toast("Receipt not found", "error");
        return;
    }

    // Show printer selection modal
    openModal(
        "Select Printer",
        `
            <div style="text-align: center; padding: 20px;">
                <p style="margin-bottom: 20px; color: var(--tx2);">How would you like to print the receipt?</p>
                
                <div style="display: grid; gap: 12px; margin-bottom: 20px;">
                    <button class="btn btn-outline" id="bluetoothPrintBtn" style="width: 100%; padding: 16px;">
                        <i class="fab fa-bluetooth" style="font-size: 24px; margin-right: 12px;"></i>
                        <div style="text-align: left; display: inline-block;">
                            <div style="font-weight: 700; font-size: 14px;">Bluetooth Receipt Printer</div>
                            <div style="font-size: 12px; color: var(--tx2);">Connect to thermal printer</div>
                        </div>
                    </button>
                    
                    <button class="btn btn-outline" id="standardPrintBtn" style="width: 100%; padding: 16px;">
                        <i class="fas fa-print" style="font-size: 24px; margin-right: 12px;"></i>
                        <div style="text-align: left; display: inline-block;">
                            <div style="font-weight: 700; font-size: 14px;">Standard Printer</div>
                            <div style="font-size: 12px; color: var(--tx2);">Use system printer dialog</div>
                        </div>
                    </button>
                </div>
                
                <p style="font-size: 12px; color: var(--tx3);">
                    <i class="fas fa-info-circle"></i> 
                    For Bluetooth printing, ensure your printer is paired and connected to your device
                </p>
            </div>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
        `
    );

    // Setup button handlers
    document.getElementById('bluetoothPrintBtn').addEventListener('click', async () => {
        closeModal();
        
        // Dynamically import printer service
        try {
            const printerService = (await import('./printer.js')).default;
            
            // Check if Bluetooth is available
            if (!printerService.isBluetoothAvailable()) {
                toast("Bluetooth not supported in this browser. Try Chrome or Edge.", "error");
                return;
            }
            
            // Connect to printer if not already connected
            if (!printerService.getConnectionStatus()) {
                const connected = await printerService.connectBluetoothPrinter();
                if (!connected) {
                    return; // Connection failed
                }
            }
            
            // Print the receipt
            await printerService.printBluetoothReceipt(baseReceiptNo, sales, DB);
        } catch (error) {
            console.error("Printer service error:", error);
            toast("Failed to load printer service: " + error.message, "error");
        }
    });

    document.getElementById('standardPrintBtn').addEventListener('click', () => {
        closeModal();
        printStandardReceipt(baseReceiptNo, sales);
    });
}

// Standard print receipt (original implementation)
function printStandardReceipt(receiptNo, sales) {
    const DB = getDB();
    
    const firstSale = sales[0];
    const totalAmount = sales.reduce((sum, s) => sum + s.total, 0);
    const totalItems = sales.reduce((sum, s) => sum + s.quantity, 0);
    const storeName = firstSale.store_id === STORE1_ID ? "Store 1" : "Store 2";
    const cashierName = firstSale.user_name || "System";
    const customerName = firstSale.customer_name || "Walk-in Customer";
    const paymentMethod = firstSale.payment_method || "Cash";
    
    // Generate receipt items
    const itemsHTML = sales.map((sale, index) => {
        const itemTotal = sale.total;
        const unitPrice = sale.unit_price || 0;
        const variantLabel = sale.variant_label || "";
        
        return `
            <div class="receipt-item">
                <div class="item-qty">${sale.quantity}x</div>
                <div class="item-details">
                    <div class="item-name">${sale.product_name}</div>
                    ${variantLabel ? `<div class="item-variant">${variantLabel}</div>` : ""}
                    <div class="item-price">@ ${money(unitPrice)}</div>
                </div>
                <div class="item-total">${money(itemTotal)}</div>
            </div>
        `;
    }).join('');

    // Generate receipt HTML with improved formatting
    const receiptHTML = `
        <div class="receipt">
            <div class="receipt-header">
                <div class="receipt-center">
                    <h2>TECHSQUARE</h2>
                    <p class="receipt-subtitle">Multi-Store POS System</p>
                    <p class="receipt-store">${storeName}</p>
                </div>
            </div>
            
            <hr class="receipt-divider">
            
            <div class="receipt-info">
                <div class="receipt-row">
                    <span>Receipt #:</span>
                    <span>${receiptNo}</span>
                </div>
                <div class="receipt-row">
                    <span>Date:</span>
                    <span>${formatDate(firstSale.created_at)}</span>
                </div>
                <div class="receipt-row">
                    <span>Time:</span>
                    <span>${firstSale.created_at ? new Date(firstSale.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                </div>
                <div class="receipt-row">
                    <span>Cashier:</span>
                    <span>${cashierName}</span>
                </div>
                <div class="receipt-row">
                    <span>Customer:</span>
                    <span>${customerName}</span>
                </div>
                <div class="receipt-row">
                    <span>Payment:</span>
                    <span>${paymentMethod}</span>
                </div>
            </div>
            
            <hr class="receipt-divider">
            
            <div class="receipt-items">
                ${itemsHTML}
            </div>
            
            <hr class="receipt-divider">
            
            <div class="receipt-summary">
                <div class="receipt-row">
                    <span>Total Items:</span>
                    <span>${totalItems}</span>
                </div>
                <div class="receipt-row receipt-total">
                    <span>TOTAL AMOUNT:</span>
                    <span>${money(totalAmount)}</span>
                </div>
            </div>
            
            <div class="receipt-footer">
                <hr class="receipt-divider">
                <div class="receipt-center">
                    <p class="thank-you">Thank you for shopping with</p>
                    <p class="thank-you-bold">TECHSQUARE!</p>
                    <p class="receipt-contact">Contact: +1 (555) 123-4567</p>
                    <p class="receipt-website">www.techsquare.com</p>
                </div>
                <hr class="receipt-divider">
                <div class="receipt-center">
                    <p class="receipt-terms">Terms & Conditions Apply</p>
                    <p class="receipt-return">Return Policy: 7 days with receipt</p>
                </div>
            </div>
        </div>
    `;

    // Open print window with improved styling
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt ${receiptNo}</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Courier New', 'Monaco', monospace;
                        font-size: 12px;
                        margin: 0;
                        padding: 20px;
                        background: #fff;
                    }
                    
                    .receipt {
                        max-width: 280px;
                        margin: 0 auto;
                        padding: 10px;
                        background: #fff;
                    }
                    
                    .receipt-center {
                        text-align: center;
                    }
                    
                    .receipt-header h2 {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 5px;
                        text-transform: uppercase;
                    }
                    
                    .receipt-subtitle {
                        font-size: 10px;
                        color: #666;
                        margin-bottom: 3px;
                    }
                    
                    .receipt-store {
                        font-size: 11px;
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    
                    .receipt-divider {
                        border: none;
                        border-top: 1px dashed #000;
                        margin: 8px 0;
                    }
                    
                    .receipt-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 4px;
                        font-size: 11px;
                    }
                    
                    .receipt-info {
                        margin-bottom: 8px;
                    }
                    
                    .receipt-items {
                        margin: 8px 0;
                    }
                    
                    .receipt-item {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 6px;
                        font-size: 11px;
                    }
                    
                    .item-qty {
                        font-weight: bold;
                        min-width: 30px;
                    }
                    
                    .item-details {
                        flex: 1;
                        margin-left: 8px;
                    }
                    
                    .item-name {
                        font-weight: bold;
                        margin-bottom: 1px;
                    }
                    
                    .item-variant {
                        font-size: 9px;
                        color: #666;
                        margin-bottom: 1px;
                    }
                    
                    .item-price {
                        font-size: 10px;
                        color: #666;
                    }
                    
                    .item-total {
                        font-weight: bold;
                        min-width: 60px;
                        text-align: right;
                    }
                    
                    .receipt-summary {
                        margin-top: 8px;
                    }
                    
                    .receipt-total {
                        font-size: 14px;
                        font-weight: bold;
                        margin-top: 8px;
                        padding-top: 8px;
                    }
                    
                    .receipt-footer {
                        margin-top: 15px;
                    }
                    
                    .thank-you {
                        font-size: 11px;
                        margin-bottom: 2px;
                    }
                    
                    .thank-you-bold {
                        font-size: 14px;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    
                    .receipt-contact {
                        font-size: 10px;
                        color: #666;
                        margin-bottom: 2px;
                    }
                    
                    .receipt-website {
                        font-size: 10px;
                        color: #666;
                        margin-bottom: 8px;
                    }
                    
                    .receipt-terms {
                        font-size: 9px;
                        color: #888;
                        margin-bottom: 2px;
                    }
                    
                    .receipt-return {
                        font-size: 9px;
                        color: #888;
                    }
                    
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                        }
                        
                        .receipt {
                            max-width: 100%;
                            margin: 0;
                            padding: 10px;
                        }
                    }
                </style>
            </head>
            <body>${receiptHTML}</body>
            </html>
        `);
        printWindow.document.close();
        
        // Wait for content to load, then print
        printWindow.onload = function() {
            printWindow.print();
        };
        
        // Fallback: print immediately if onload doesn't fire
        setTimeout(() => {
            try {
                printWindow.print();
            } catch (e) {
                console.log("Print error:", e);
            }
        }, 500);
    }
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
    const user = getCurrentUser();
    const mainContent = $("mainContent");
    
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="warehouse-container">
            <div class="warehouse-header">
                <div>
                    <h1><i class="fas fa-clock-rotate-left"></i> Sales History</h1>
                    <p style="color:var(--tx2);margin-top:8px">View and analyze past sales transactions</p>
                </div>
                <div style="display:flex;gap:12px">
                    <button class="btn btn-outline" id="exportXlsBtn">
                        <i class="fas fa-file-excel"></i> Excel
                    </button>
                    <button class="btn btn-outline" id="exportPdfBtn">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                </div>
            </div>

            <div class="search-bar" style="margin-bottom:16px">
                <div class="form-group" style="margin:0">
                    <label style="font-size:11px;margin-bottom:4px">Date</label>
                    <input type="date" class="form-input" id="histDate" value="${today()}" style="padding:8px 12px">
                </div>
                <div class="search-wrap">
                    <i class="fas fa-search"></i>
                    <input class="search-input" id="histSearch" placeholder="Search receipt or customer...">
                </div>
                ${user.role === "admin" ? `
                <select class="filter-select" id="histStore">
                    <option value="">All Stores</option>
                    <option value="${STORE1_ID}">Store 1</option>
                    <option value="${STORE2_ID}">Store 2</option>
                </select>
                ` : ''}
            </div>

            <div id="histStats" style="margin-bottom:20px"></div>

            <div class="card">
                <div class="card-body np">
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Products</th>
                                    <th>Date & Time</th>
                                    <th>Store</th>
                                    <th>Customer</th>
                                    <th>Amount</th>
                                    <th>Commission</th>
                                    <th>Cashing</th>
                                    <th>Cashier</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="histBody">
                                <!-- Sales will be rendered here -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Setup event listeners
    const dateInput = document.getElementById("histDate");
    if (dateInput) {
        dateInput.addEventListener("change", renderHistTable);
    }

    const searchInput = document.getElementById("histSearch");
    if (searchInput) {
        searchInput.addEventListener("input", renderHistTable);
    }

    if (user.role === "admin") {
        const storeSelect = document.getElementById("histStore");
        if (storeSelect) {
            storeSelect.addEventListener("change", renderHistTable);
        }
    }

    const exportXlsBtn = document.getElementById("exportXlsBtn");
    if (exportXlsBtn) {
        exportXlsBtn.addEventListener("click", exportSalesExcel);
    }

    const exportPdfBtn = document.getElementById("exportPdfBtn");
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener("click", exportSalesPDF);
    }

    // Render the table
    renderHistTable();
}

// Get filtered sales based on current filters
function getFilteredSales() {
    const DB = getDB();
    const user = getCurrentUser();
    const date = document.getElementById("histDate")?.value || today();
    const q = (document.getElementById("histSearch")?.value || "").toLowerCase();
    const sf = user.role === "admin" ? (document.getElementById("histStore")?.value || "") : (user?.storeId || "");

    const daySales = DB.sales.filter((s) => {
        const d = s.date_str || s.created_at?.slice(0, 10);
        if (d !== date) return false;
        // For cashiers, always filter by their store; for admins, use the selector if provided
        if (user.role !== "admin" && s.store_id !== user.storeId) return false;
        if (user.role === "admin" && sf && s.store_id !== sf) return false;
        return true;
    });

    // Group by receipt and sum totals
    const receiptMap = new Map();
    daySales.forEach((s) => {
        const key = s.receipt_number;
        if (!receiptMap.has(key)) {
            receiptMap.set(key, {
                receipt_number: s.receipt_number,
                store_id: s.store_id,
                customer_name: s.customer_name,
                user_name: s.user_name,
                payment_method: s.payment_method,
                created_at: s.created_at,
                date_str: s.date_str,
                total: 0,
                discount: 0,
                items: [],
            });
        }
        const receipt = receiptMap.get(key);
        receipt.total += Number(s.total || 0);
        receipt.discount += Number(s.discount || 0);
        receipt.items.push(s);
    });

    const receipts = Array.from(receiptMap.values());

    // Apply search filter
    return receipts.filter((r) => {
        if (
            q &&
            !(r.receipt_number || "").toLowerCase().includes(q) &&
            !(r.customer_name || "").toLowerCase().includes(q)
        )
            return false;
        return true;
    });
}

// Render the sales history table
function renderHistTable() {
    const DB = getDB();
    const user = getCurrentUser();
    const body = document.getElementById("histBody");
    if (!body) return;

    const sales = getFilteredSales();
    const rev = sales.reduce((a, s) => a + Number(s.total || 0), 0);
    const itemCount = sales.reduce((a, s) => a + s.items.length, 0);
    
    // Render stats
    const statsDiv = document.getElementById("histStats");
    if (statsDiv) {
        statsDiv.innerHTML = `
            <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--ac3);color:var(--ac)">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div class="stat-value">${money(rev)}</div>
                    <div class="stat-label">Revenue</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--gn2);color:var(--gn)">
                        <i class="fas fa-receipt"></i>
                    </div>
                    <div class="stat-value">${sales.length}</div>
                    <div class="stat-label">Transactions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--wn2);color:var(--wn)">
                        <i class="fas fa-boxes-stacked"></i>
                    </div>
                    <div class="stat-value">${itemCount}</div>
                    <div class="stat-label">Items Sold</div>
                </div>
            </div>
        `;
    }

    // Check if user is cashier to apply store filtering
    const isCashier = user.role === "cashier";
    const filteredSales = isCashier ? sales.filter((s) => s.store_id === user.storeId) : sales;

    body.innerHTML = filteredSales.length === 0
        ? `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--tx3)">No sales found</td></tr>`
        : filteredSales.map((s) => {
            // Get commission for this receipt
            const receiptCommissions = (DB.commissionRecords || []).filter(
                (c) => c.receipt_number === s.receipt_number,
            );

            // Build product list with commissions
            const productList = s.items.map((item) => {
                const itemCommissionFromRate = Number(item.commission_rate || 0) * Number(item.quantity || 1);
                const itemCommissionFromRecords = receiptCommissions
                    .filter((c) => (item.sku && c.variant_sku === item.sku) || c.product_name === item.product_name)
                    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);
                const itemCommission = itemCommissionFromRate > 0 ? itemCommissionFromRate : itemCommissionFromRecords;
                const itemSubtotal = (item.unit_price || 0) * (item.quantity || 1);

                return `<div style="margin-bottom:4px">
                    <span style="font-weight:600">${esc(item.product_name)}</span>
                    ${item.variant_label ? `<span style="color:var(--tx3);font-size:11px"> (${esc(item.variant_label)})</span>` : ""}
                    <span style="color:var(--tx3);font-size:11px"> ×${item.quantity}</span>
                    <span style="color:var(--tx2);font-size:11px"> = ${money(itemSubtotal)}</span>
                    ${itemCommission > 0 ? `<span style="color:var(--wn);font-size:11px;margin-left:8px">📊 ${money(itemCommission)}</span>` : ""}
                </div>`;
            }).join("");

            // Calculate total commission
            const totalCommissionFromRates = s.items.reduce(
                (sum, item) => sum + Number(item.commission_rate || 0) * Number(item.quantity || 1),
                0,
            );
            const totalCommissionFromRecords = receiptCommissions.reduce(
                (sum, c) => sum + (c.commission_amount || 0),
                0,
            );
            const totalCommission = totalCommissionFromRates > 0 ? totalCommissionFromRates : totalCommissionFromRecords;

            // Type badges
            const typeBadge = s.receipt_number.startsWith('TI-') 
                ? '<span class="badge badge-orange" style="font-size:9px;margin-bottom:4px"><i class="fas fa-rotate"></i> Trade-In</span><br>' 
                : s.receipt_number.startsWith('LB-SALE-') 
                    ? '<span class="badge badge-purple" style="font-size:9px;margin-bottom:4px"><i class="fas fa-calendar-check"></i> Layby</span><br>' 
                    : '';

            const cashingAmount = (s.total || 0) - totalCommission;

            return `<tr>
                <td style="min-width:200px">${typeBadge}${productList}</td>
                <td style="font-size:12px;color:var(--tx2);white-space:nowrap">${
                    s.created_at
                        ? new Date(s.created_at).toLocaleString("en", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                        })
                        : "—"
                }</td>
                <td><span class="badge ${s.store_id === STORE1_ID ? "badge-blue" : "badge-green"}">${s.store_id === STORE1_ID ? "Store 1" : "Store 2"}</span></td>
                <td style="font-size:13px">${esc(s.customer_name || "Walk-in")}</td>
                <td style="font-weight:700">${money(s.total)}</td>
                <td style="font-weight:600;color:var(--wn)">${money(totalCommission)}</td>
                <td style="font-weight:700;color:var(--gn)">${money(cashingAmount)}</td>
                <td style="font-size:12px;color:var(--tx2)">${esc(s.user_name || "—")}</td>
                <td><button class="btn btn-sm btn-outline" onclick="window.salesService.viewReceipt('${s.receipt_number}')"><i class="fas fa-eye"></i></button></td>
            </tr>`;
        }).join('');

    // Setup view receipt buttons
    body.querySelectorAll("button[onclick*='viewReceipt']").forEach((b) => {
        // Already handled by the global window.salesService.viewReceipt
    });
}

// Export sales to Excel
function exportSalesExcel() {
    if (!window.XLSX) {
        toast("XLSX library not loaded", "error");
        return;
    }
    const sales = getFilteredSales();
    if (!sales.length) {
        toast("No data to export", "error");
        return;
    }

    const rows = sales.map((s) => ({
        'Receipt Number': s.receipt_number,
        'Date': s.created_at ? new Date(s.created_at).toLocaleDateString() : '—',
        'Store': s.store_id === STORE1_ID ? 'Store 1' : 'Store 2',
        'Customer': s.customer_name || 'Walk-in',
        'Total': s.total,
        'Payment Method': s.payment_method,
        'Cashier': s.user_name
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, `sales_report_${today()}.xlsx`);
    
    toast("Sales report exported successfully", "success");
}

// Export sales to PDF
function exportSalesPDF() {
    if (!window.jspdf) {
        toast("jsPDF library not loaded", "error");
        return;
    }
    const sales = getFilteredSales();
    if (!sales.length) {
        toast("No data to export", "error");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Sales Report", 14, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${today()}`, 14, 30);
    
    let yPos = 45;
    sales.forEach((s, i) => {
        if (yPos > 270) {
            doc.addPage();
            yPos = 20;
        }
        doc.text(`${i + 1}. ${s.receipt_number} - ${money(s.total)} - ${s.customer_name || 'Walk-in'}`, 14, yPos);
        yPos += 8;
    });

    doc.save(`sales_report_${today()}.pdf`);
    toast("Sales report exported successfully", "success");
}

// Render sales history table
function renderSalesHistoryTable() {
    // This function is deprecated - use renderHistTable instead
    renderHistTable();
}

// View receipt
function viewReceipt(receiptNo) {
    printReceipt(receiptNo);
}

// Export service functions for global access
const salesService = {
    renderSales,
    addToCart,
    removeFromCart,
    incrementQuantity,
    decrementQuantity,
    completeSale,
    printReceipt,
    renderHistory,
    viewReceipt,
    getFilteredSales,
    renderHistTable,
    exportSalesExcel,
    exportSalesPDF,
    openBarcodeScanner,
    closeBarcodeScanner
};


// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.salesService = salesService;
}

export default salesService;