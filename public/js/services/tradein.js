// Trade-In Service for TECHSQUARE POS
import { getDB, getCurrentUser } from '../db.js';
import { getSupabase } from '../supabase-client.js';
import { $, uid, money, today, now, esc } from '../utils.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { STORE1_ID, STORE2_ID, WAREHOUSE_ID } from '../config.js';

// Render trade-in page
export function renderTradeIn() {
    const DB = getDB();
    const user = getCurrentUser();
    const mainContent = $("mainContent");
    
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="warehouse-container">
            <div class="warehouse-header">
                <div>
                    <h1><i class="fas fa-rotate"></i> Trade-In Management</h1>
                    <p style="color:var(--tx2);margin-top:8px">Process device trade-ins and upgrades</p>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                <!-- New Trade-In Form -->
                <div class="card">
                    <div class="card-header">
                        <h3>New Trade-In</h3>
                    </div>
                    <div class="card-body">
                        <form id="tradeInForm">
                            <div class="form-group">
                                <label>Store</label>
                                <select class="form-input" id="tradeInStore" required>
                                    ${user.role === "admin" ? 
                                        `<option value="">Select Store</option>
                                        <option value="${STORE1_ID}">Store 1</option>
                                        <option value="${STORE2_ID}">Store 2</option>` : 
                                        `<option value="${user.storeId}">${user.storeId === STORE1_ID ? "Store 1" : "Store 2"}</option>`
                                    }
                                </select>
                            </div>
                            
                            <div style="background:var(--bg);border-radius:12px;padding:16px;margin-bottom:16px">
                                <div style="font-size:12px;font-weight:700;color:var(--tx2);margin-bottom:12px">
                                    <i class="fas fa-mobile-alt"></i> TRADE-IN DEVICE
                                </div>
                                <div class="form-group">
                                    <label>Device Name *</label>
                                    <input type="text" class="form-input" id="tradeInItemName" placeholder="e.g. iPhone 14 Pro" required>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>IMEI/Serial *</label>
                                        <input type="text" class="form-input" id="tradeInSerialNumber" placeholder="Identifier" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Condition *</label>
                                        <select class="form-input" id="tradeInCondition" required>
                                            <option value="">Select condition</option>
                                            <option value="new">New</option>
                                            <option value="used">Used</option>
                                            <option value="refurbished">Refurbished</option>
                                            <option value="damaged">Damaged</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Trade-In Value (K) *</label>
                                    <input type="number" class="form-input" id="tradeInValue" required min="0" step="0.01">
                                </div>
                            </div>

                            <div style="background:var(--bg);border-radius:12px;padding:16px;margin-bottom:16px">
                                <div style="font-size:12px;font-weight:700;color:var(--tx2);margin-bottom:12px">
                                    <i class="fas fa-cube"></i> NEW DEVICE
                                </div>
                                <div class="form-group">
                                    <label>Select Product *</label>
                                    <select class="form-input" id="tradeInProductId" required>
                                        <option value="">Select Product...</option>
                                        ${DB.products.filter(p => p.active !== false).map(p => {
                                            // For cashiers, only show products that have variants in their store
                                            const hasVariantsInStore = user.role === "admin" 
                                                ? true 
                                                : DB.variants.some(v => v.product_id === p.id && v.store_id === user.storeId && v.active !== false);
                                            if (!hasVariantsInStore) return '';
                                            return `<option value="${p.id}">${p.name}</option>`;
                                        }).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Select Variant *</label>
                                    <select class="form-input" id="tradeInVariantId" required>
                                        <option value="">Select Variant...</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Potential Sale Value</label>
                                    <div id="tradeInSaleValue" style="font-weight:700;color:var(--gn)">K0.00</div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Customer Name</label>
                                <input type="text" class="form-input" id="tradeInCustomerName" placeholder="Walk-in Customer">
                            </div>
                            
                            <div style="background:var(--ac3);border-radius:12px;padding:12px;margin-bottom:16px;font-size:14px">
                                <div style="display:flex;justify-content:space-between;align-items:center">
                                    <span>Net Payment:</span>
                                    <strong id="tradeInNetPayment" style="font-size:18px">K0.00</strong>
                                </div>
                            </div>

                            <button type="submit" class="btn btn-primary" style="width:100%">
                                <i class="fas fa-rotate"></i> Process Trade-In
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Recent Trade-Ins -->
                <div class="card">
                    <div class="card-header">
                        <h3>Recent Trade-Ins</h3>
                    </div>
                    <div class="card-body np">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Trade-In Device</th>
                                    <th>New Device</th>
                                    <th>Net Payment</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="recentTradeIns">
                                ${DB.tradeIns.length === 0 ?
                                    `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--tx3)">No trade-ins yet</td></tr>` :
                                    DB.tradeIns
                                        .filter(t => user.role === "admin" || t.store_id === user.storeId)
                                        .slice(0, 10)
                                        .map(t => {
                                            return `
                                                <tr>
                                                    <td>${new Date(t.created_at).toLocaleDateString()}</td>
                                                    <td>
                                                        <strong>${t.item_name}</strong>
                                                        <div style="font-size:12px;color:var(--tx2)">${t.serial_number || '-'}</div>
                                                    </td>
                                                    <td>
                                                        <strong>${t.new_device_name || 'New Device'}</strong>
                                                        <div style="font-size:12px;color:var(--tx2)">${t.new_device_variant || ''}</div>
                                                    </td>
                                                    <td style="font-weight:700;color:var(--gn)">${money(t.sale_value - t.trade_in_value)}</td>
                                                    <td>
                                                        <span class="badge ${
                                                            t.status === 'completed' ? 'badge-green' :
                                                            t.status === 'approved' ? 'badge-blue' :
                                                            t.status === 'rejected' ? 'badge-red' : 'badge-orange'
                                                        }">${t.status}</span>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Setup form submission
    const form = document.getElementById("tradeInForm");
    if (form) {
        form.addEventListener("submit", processTradeInForm);
    }

    // Setup product change event
    const productIdSelect = document.getElementById("tradeInProductId");
    if (productIdSelect) {
        productIdSelect.addEventListener("change", updateTradeInVariants);
    }

    // Setup variant change event
    const variantIdSelect = document.getElementById("tradeInVariantId");
    if (variantIdSelect) {
        variantIdSelect.addEventListener("change", updateTradeInNet);
    }

    // Setup input change events for net calculation
    const tradeInValue = document.getElementById("tradeInValue");
    if (tradeInValue) {
        tradeInValue.addEventListener("input", window.updateTradeInNet);
    }

    // Initialize variants dropdown
    updateTradeInVariants();
}

// Update trade-in variants based on selected product
function updateTradeInVariants() {
    const DB = getDB();
    const user = getCurrentUser();
    const productId = document.getElementById("tradeInProductId")?.value;
    const variantSelect = document.getElementById("tradeInVariantId");

    if (!variantSelect) return;

    if (!productId) {
        variantSelect.innerHTML = '<option value="">Select Variant...</option>';
        return;
    }

    // For cashiers, only show variants from their store
    const variants = DB.variants.filter(v => 
        v.product_id === productId && 
        v.active !== false &&
        (user.role === "admin" || v.store_id === user.storeId)
    );
    variantSelect.innerHTML = variants.length > 0
        ? variants.map(v => `<option value="${v.id}" data-price="${v.price || 0}" data-name="${v.product_name || ''}">
            ${v.color || ''} ${v.storage || ''} - ${money(v.price || 0)}
           </option>`).join('')
        : '<option value="">No variants available</option>';

    updateTradeInNet();
}

// Update trade-in net payment calculation
window.updateTradeInNet = function() {
    const tradeInValue = parseFloat(document.getElementById("tradeInValue")?.value) || 0;
    const saleValue = parseFloat(document.getElementById("tradeInSaleValue")?.value) || 0;
    const netPayment = saleValue - tradeInValue;

    const netPaymentElement = document.getElementById("tradeInNetPayment");
    if (netPaymentElement) {
        netPaymentElement.textContent = money(netPayment);
    }
}

// Update net payment calculation
window.updateTradeInNet = function() {
    const tradeInValue = parseFloat(document.getElementById("tradeInValue")?.value) || 0;
    const variantSelect = document.getElementById("tradeInVariantId");
    const saleValueElement = document.getElementById("tradeInSaleValue");
    const netPaymentElement = document.getElementById("tradeInNetPayment");

    let saleValue = 0;
    if (variantSelect && variantSelect.selectedOptions[0]) {
        saleValue = parseFloat(variantSelect.selectedOptions[0].dataset.price) || 0;
    }

    const netPayment = saleValue - tradeInValue;

    if (saleValueElement) saleValueElement.textContent = money(saleValue);
    if (netPaymentElement) {
        netPaymentElement.textContent = money(netPayment);
        netPaymentElement.style.color = netPayment >= 0 ? 'var(--gn)' : 'var(--dn)';
    }
};

// Process trade-in form submission
async function processTradeInForm(e) {
    e.preventDefault();
    
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();
    
    const storeId = user.role === "admin" 
        ? document.getElementById("tradeInStore")?.value
        : user.storeId;
    const item_name = document.getElementById("tradeInItemName")?.value.trim();
    const serial_number = document.getElementById("tradeInSerialNumber")?.value.trim();
    const condition = document.getElementById("tradeInCondition")?.value;
    const trade_in_value = parseFloat(document.getElementById("tradeInValue")?.value) || 0;
    const variant_id = document.getElementById("tradeInVariantId")?.value;
    const customer_name = document.getElementById("tradeInCustomerName")?.value.trim() || "Walk-in Customer";

    const variant = variant_id ? DB.variants.find(v => v.id === variant_id) : null;
    const product = variant ? DB.products.find(p => p.id === variant.product_id) : null;
    const sale_value = variant ? (variant.price || 0) : 0;

    if (!storeId || !item_name || !serial_number || !condition || !trade_in_value || !variant_id) {
        toast("Please fill in all required fields", "error");
        return;
    }
    
    try {
        const tradeInData = {
            id: uid(),
            store_id: storeId,
            user_id: user?.id,
            user_name: user?.name,
            customer_name: customer_name,
            item_name: item_name,
            item_description: `${item_name} - ${condition}`,
            serial_number: serial_number,
            condition: condition,
            new_device_name: product ? product.name : '',
            new_device_variant: variant ? `${variant.color || ''} ${variant.storage || ''}`.trim() : '',
            trade_in_value: trade_in_value,
            sale_value: sale_value,
            status: "completed", // Auto-complete trade-ins when created
            notes: "",
            created_at: now(),
            updated_at: now()
        };

        // Store variant_id locally for later inventory deduction (not saved to DB to avoid schema issues)
        tradeInData._variant_id = variant_id;
        tradeInData._variant = variant;

        // Create database copy without local-only fields
        const dbData = { ...tradeInData };
        delete dbData._variant_id;
        delete dbData._variant;

        // Save to Supabase (if online)
        if (sb) {
            try {
                const { error } = await sb.from("trade_in_transactions").insert([dbData]);
                if (error) throw error;
            } catch (supabaseError) {
                console.error("Supabase trade-in save failed, saving locally:", supabaseError);
                // Save to IndexedDB for offline sync
                const offlineDB = window.offlineDB;
                if (offlineDB) {
                    try {
                        await offlineDB.put('trade_in_transactions', dbData);
                        await offlineDB.queueOperation('create', 'trade_in_transactions', dbData, dbData.id);
                        console.log("Trade-in saved to offline DB for sync");
                    } catch (offlineError) {
                        console.error("Offline DB save failed:", offlineError);
                        throw offlineError; // Re-throw to handle in main catch block
                    }
                }
            }
        }

        // Save to local DB (always, regardless of Supabase success)
        DB.tradeIns = DB.tradeIns || [];
        DB.tradeIns.unshift(tradeInData);

        // Add traded-in item as a regular variant (simplified approach)
        try {
            // Find or create "Trade-In Devices" product
            let tradeInProduct = DB.products.find(p => p.name === "Trade-In Devices");
            let tradeInProductId;

            if (!tradeInProduct) {
                // Only try to create product if online or if we can save locally
                const newProduct = {
                    id: uid(),
                    name: "Trade-In Devices",
                    category: "Trade-Ins",
                    created_at: now(),
                    updated_at: now()
                };

                if (sb) {
                    try {
                        const { error: productError } = await sb.from("products").insert([newProduct]);
                        if (productError) throw productError;

                        // Add to local DB
                        DB.products = DB.products || [];
                        DB.products.unshift(newProduct);
                        tradeInProduct = newProduct;
                        console.log("Trade-in: Created Trade-In Devices product");
                    } catch (productError) {
                        console.error("Product creation failed, saving locally:", productError);
                        // Save product to offline DB
                        const offlineDB = window.offlineDB;
                        if (offlineDB) {
                            await offlineDB.put('products', newProduct);
                            await offlineDB.queueOperation('create', 'products', newProduct, newProduct.id);
                        }
                        // Still add to local DB
                        DB.products = DB.products || [];
                        DB.products.unshift(newProduct);
                        tradeInProduct = newProduct;
                    }
                } else {
                    // Offline mode - add to local DB only
                    DB.products = DB.products || [];
                    DB.products.unshift(newProduct);
                    tradeInProduct = newProduct;
                    console.log("Trade-in: Created Trade-In Devices product (offline)");
                }
            }

            tradeInProductId = tradeInProduct.id;

                // Create variant for the traded-in item
                const tradeInVariantData = {
                    id: uid(),
                    product_id: tradeInProductId,
                    sku: `TRADEIN-${serial_number}`,
                    color: item_name, // Use the device name as color variant
                    storage: tradeInData.condition,
                    price: sale_value, // Potential sale value
                    cost_price: trade_in_value, // Trade-in value (cost to acquire)
                    qty: 1,
                    store_id: storeId, // Add to the store that processed the trade-in
                    is_active: true, // Make it available for sale
                    created_at: now(),
                    updated_at: now()
                };

                if (sb) {
                    try {
                        const { error: variantError } = await sb.from("variants").insert([tradeInVariantData]);
                        if (variantError) throw variantError;
                    } catch (variantError) {
                        console.error("Supabase variant creation failed, saving locally:", variantError);
                        // Save to offline DB
                        const offlineDB = window.offlineDB;
                        if (offlineDB) {
                            await offlineDB.put('variants', tradeInVariantData);
                            await offlineDB.queueOperation('create', 'variants', tradeInVariantData, tradeInVariantData.id);
                        }
                    }
                }

                // Always add to local DB
                DB.variants = DB.variants || [];
                DB.variants.unshift(tradeInVariantData);

                console.log("Trade-in: Added as variant:", tradeInVariantData.sku, "Device:", item_name);
                toast("Trade-in device added to inventory", "success");
            } catch (variantError) {
                console.error("Error adding trade-in as variant:", variantError);
                toast("Trade-in completed but device not added to inventory: " + variantError.message, "error");
                // Don't fail the whole trade-in if variant addition fails
            }

        // Deduct the new device variant from inventory (like layby does)
        if (variant) {
            try {
                const newQty = Math.max(0, (variant.qty || 0) - 1);
                const variantUpdate = {
                    qty: newQty,
                    updated_at: now(),
                };

                if (sb) {
                    try {
                        const { error: vErr } = await sb
                            .from("variants")
                            .update(variantUpdate)
                            .eq("id", variant.id);
                        if (vErr) throw vErr;
                    } catch (supabaseError) {
                        console.error("Supabase variant update failed, queueing for sync:", supabaseError);
                        // Queue for offline sync
                        const offlineDB = window.offlineDB;
                        if (offlineDB) {
                            await offlineDB.queueOperation('update', 'variants', variantUpdate, variant.id);
                        }
                    }
                }

                // Always update in-memory
                const vIdx = DB.variants.findIndex((x) => x.id === variant.id);
                if (vIdx !== -1) {
                    DB.variants[vIdx].qty = newQty;
                }
                console.log("Trade-in: Deducted 1 from variant inventory, new qty:", newQty);
            } catch (variantError) {
                console.error("Error deducting variant inventory:", variantError);
                // Don't fail the whole trade-in if variant deduction fails
            }
        }

        // Create sales record for trade-in (like layby does)
        try {
            const receiptNumber = "TRDIN-" + String((DB.sales || []).length + 1).padStart(5, "0");
            const saleData = {
                id: uid(),
                store_id: storeId,
                user_id: user?.id,
                user_name: user?.name,
                receipt_number: receiptNumber,
                product_name: product?.name || tradeInData.item_name,
                sku: variant?.sku || "TRADEIN",
                variant_label: variant
                    ? `${variant.color || ""} ${variant.storage || ""}`.trim()
                    : "",
                quantity: 1,
                unit_price: sale_value,
                cost_price: trade_in_value,
                subtotal: sale_value,
                discount: trade_in_value, // Trade-in value acts as discount
                total: sale_value - trade_in_value,
                profit: (sale_value - trade_in_value) - trade_in_value,
                commission_rate: variant?.commission_rate || 0,
                payment_method: "trade_in",
                customer_name: customer_name || "Trade-in Customer",
                identifier: serial_number,
                date_str: today(),
                created_at: now(),
            };

            if (sb) {
                try {
                    const { error: saleErr } = await sb.from("sales").insert([saleData]);
                    if (saleErr) throw saleErr;
                } catch (supabaseError) {
                    console.error("Supabase sale save failed, saving locally:", supabaseError);
                    // Save to offline DB
                    const offlineDB = window.offlineDB;
                    if (offlineDB) {
                        try {
                            await offlineDB.put('sales', saleData);
                            await offlineDB.queueOperation('create', 'sales', saleData, saleData.id);
                        } catch (offlineError) {
                            console.error("Failed to save sale to offline DB:", offlineError);
                        }
                    }
                }
            }

            // Always save to local DB
            DB.sales.unshift(saleData);

            // Create commission record if variant has commission rate
            if (variant && variant.commission_rate > 0) {
                const commissionAmount = (sale_value - trade_in_value) * (variant.commission_rate / 100);
                const commissionData = {
                    id: uid(),
                    agent_id: user?.id,
                    agent_name: user?.name,
                    store_id: storeId,
                    receipt_number: receiptNumber,
                    total_amount: sale_value - trade_in_value,
                    commission_rate: variant.commission_rate,
                    commission_amount: commissionAmount,
                    status: "pending",
                    items: JSON.stringify([{
                        product_name: product?.name || tradeInData.item_name,
                        variant_label: variant
                            ? `${variant.color || ""} ${variant.storage || ""}`.trim()
                            : "",
                        quantity: 1,
                        unit_price: sale_value,
                        commission_rate: variant.commission_rate,
                        commission_amount: commissionAmount
                    }]),
                    sale_date: today(),
                    created_at: now(),
                };

                if (sb) {
                    try {
                        const { error: commErr } = await sb.from("commission_records").insert([commissionData]);
                        if (commErr) {
                            console.error("Trade-in commission record error:", commErr);
                            // Queue for offline sync
                            const offlineDB = window.offlineDB;
                            if (offlineDB) {
                                await offlineDB.queueOperation('create', 'commission_records', commissionData, commissionData.id);
                            }
                        }
                    } catch (commError) {
                        console.error("Commission insert failed, queueing for sync:", commError);
                    }
                }

                DB.commissionRecords = DB.commissionRecords || [];
                DB.commissionRecords.unshift(commissionData);
                console.log("Trade-in commission record created:", commissionAmount);
            }
        } catch (saleError) {
            console.error("Error creating trade-in sale record:", saleError);
            // Don't fail the whole trade-in if sale record creation fails
        }

        // Save to local DB with all fields
        DB.tradeIns.unshift(tradeInData);
        
        // Clear form
        document.getElementById("tradeInForm").reset();
        
        // Re-render to show new trade-in
        renderTradeIn();
        
        // Re-render dashboard recent sales to show trade-in badge
        const recentSalesContainer = document.getElementById("recentSales");
        if (recentSalesContainer) {
            // Import and re-render recent sales directly
            import('./dashboard.js').then(({ renderRecentSales }) => {
                renderRecentSales();
            });
        }
        
        // Re-render warehouse if it's currently visible
        const warehouseContent = document.getElementById("warehouseTabContent");
        if (warehouseContent) {
            import('./warehouse.js').then(({ renderWarehouse }) => {
                renderWarehouse();
            });
        }
        
        toast("Trade-in created successfully", "success");
    } catch (error) {
        console.error("Error creating trade-in:", error);
        toast("Error creating trade-in: " + error.message, "error");
    }
}

// Setup trade-in tabs
function setupTradeInTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            const status = tab.dataset.tab;
            renderTradeInTable(status);
        });
    });
}

// Render trade-in table
function renderTradeInTable(status) {
    const DB = getDB();
    const tbody = document.getElementById("tradeInTableBody");
    if (!tbody) return;

    const tradeIns = DB.tradeIns.filter(t => t.status === status);

    if (tradeIns.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <div class="empty-state">
                        <i class="fas fa-rotate"></i>
                        <h3>No ${status} trade-ins</h3>
                        <p>${status === 'pending' ? 'Create a new trade-in request to get started' : 'No trade-ins in this category'}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = tradeIns.map(tradeIn => `
        <tr>
            <td>
                <strong>${esc(tradeIn.customer_name || '-')}</strong>
                <div style="font-size: 12px; color: var(--tx2);">${esc(tradeIn.customer_phone || '')}</div>
            </td>
            <td>
                <strong>${esc(tradeIn.item_name)}</strong>
                <div style="font-size: 12px; color: var(--tx2);">${esc(tradeIn.item_description || '')}</div>
                ${tradeIn.serial_number ? `<div style="font-size: 12px; color: var(--tx2);">SN: ${esc(tradeIn.serial_number)}</div>` : ''}
            </td>
            <td><span class="badge badge-blue">${esc(tradeIn.condition || 'Unknown')}</span></td>
            <td><strong>${money(tradeIn.trade_in_value || 0)}</strong></td>
            <td><strong>${money(tradeIn.sale_value || 0)}</strong></td>
            <td>
                <span class="badge ${
                    tradeIn.status === 'completed' ? 'badge-green' : 
                    tradeIn.status === 'approved' ? 'badge-blue' : 
                    tradeIn.status === 'rejected' ? 'badge-red' : 'badge-orange'
                }">${tradeIn.status}</span>
            </td>
            <td>
                <div style="display: flex; gap: 4px;">
                    ${tradeIn.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="window.tradeInService.approveTradeIn('${tradeIn.id}')" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="window.tradeInService.rejectTradeIn('${tradeIn.id}')" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : tradeIn.status === 'approved' ? `
                        <button class="btn btn-sm btn-primary" onclick="window.tradeInService.completeTradeIn('${tradeIn.id}')" title="Complete">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline" onclick="window.tradeInService.viewTradeInDetails('${tradeIn.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Filter trade-ins
function filterTradeIns(searchTerm) {
    const rows = document.querySelectorAll("#tradeInTableBody tr");
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Open trade-in modal
function openTradeInModal() {
    openModal(
        'New Trade-In Request',
        `
            <form id="tradeInForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Customer Name *</label>
                        <input type="text" class="form-input" id="tradeInCustomerName" required>
                    </div>
                    <div class="form-group">
                        <label>Customer Phone</label>
                        <input type="tel" class="form-input" id="tradeInCustomerPhone">
                    </div>
                </div>
                <div class="form-group">
                    <label>Item Name *</label>
                    <input type="text" class="form-input" id="tradeInItemName" required>
                </div>
                <div class="form-group">
                    <label>Item Description</label>
                    <textarea class="form-input" id="tradeInItemDescription" rows="3"></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Serial Number (if applicable)</label>
                        <input type="text" class="form-input" id="tradeInSerialNumber">
                    </div>
                    <div class="form-group">
                        <label>Condition *</label>
                        <select class="form-input" id="tradeInCondition" required>
                            <option value="">Select condition</option>
                            <option value="new">New</option>
                            <option value="used">Used</option>
                            <option value="refurbished">Refurbished</option>
                            <option value="damaged">Damaged</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Trade-In Value *</label>
                        <input type="number" class="form-input" id="tradeInValue" required step="0.01" min="0">
                    </div>
                    <div class="form-group">
                        <label>Potential Sale Value</label>
                        <input type="number" class="form-input" id="tradeInSaleValue" step="0.01" min="0">
                    </div>
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea class="form-input" id="tradeInNotes" rows="3"></textarea>
                </div>
            </form>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="createTradeInBtn">
                <i class="fas fa-save"></i> Create Trade-In
            </button>
        `
    );

    const createBtn = document.getElementById("createTradeInBtn");
    if (createBtn) {
        createBtn.addEventListener("click", createTradeIn);
    }
}

// Create trade-in
async function createTradeIn() {
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();
    
    const customerName = document.getElementById("tradeInCustomerName").value.trim();
    const customerPhone = document.getElementById("tradeInCustomerPhone").value.trim();
    const itemName = document.getElementById("tradeInItemName").value.trim();
    const itemDescription = document.getElementById("tradeInItemDescription").value.trim();
    const serialNumber = document.getElementById("tradeInSerialNumber").value.trim();
    const condition = document.getElementById("tradeInCondition").value;
    const tradeInValue = parseFloat(document.getElementById("tradeInValue").value);
    const saleValue = parseFloat(document.getElementById("tradeInSaleValue").value) || 0;
    const notes = document.getElementById("tradeInNotes").value.trim();

    if (!customerName || !itemName || !condition || !tradeInValue) {
        toast("Please fill in all required fields", "error");
        return;
    }

    try {
        const tradeInData = {
            id: uid(),
            store_id: user?.storeId || STORE1_ID,
            user_id: user?.id,
            user_name: user?.name,
            customer_name: customerName,
            customer_phone: customerPhone,
            item_name: itemName,
            item_description: itemDescription,
            serial_number: serialNumber,
            condition: condition,
            trade_in_value: tradeInValue,
            sale_value: saleValue,
            status: 'pending',
            notes: notes,
            created_at: now(),
            updated_at: now()
        };

        // Save to Supabase
        if (sb) {
            const { error } = await sb.from("trade_in_transactions").insert([tradeInData]);
            if (error) throw error;
        }

        // Save to local DB
        DB.tradeIns.unshift(tradeInData);

        toast("Trade-in created successfully", "success");
        closeModal();
        renderTradeInTable('pending');

    } catch (error) {
        console.error("Error creating trade-in:", error);
        toast("Error creating trade-in: " + error.message, "error");
    }
}

// Approve trade-in
async function approveTradeIn(tradeInId) {
    const DB = getDB();
    const sb = getSupabase();
    
    showConfirm("Approve this trade-in request?", async () => {
        try {
            const updates = {
                status: 'approved',
                updated_at: now()
            };

            if (sb) {
                const { error } = await sb.from("trade_in_transactions").update(updates).eq("id", tradeInId);
                if (error) throw error;
            }

            const index = DB.tradeIns.findIndex(t => t.id === tradeInId);
            if (index !== -1) {
                DB.tradeIns[index] = { ...DB.tradeIns[index], ...updates };
            }

            toast("Trade-in approved", "success");
            renderTradeInTable('approved');
        } catch (error) {
            console.error("Error approving trade-in:", error);
            toast("Error approving trade-in: " + error.message, "error");
        }
    });
}

// Reject trade-in
async function rejectTradeIn(tradeInId) {
    const DB = getDB();
    const sb = getSupabase();
    
    showConfirm("Reject this trade-in request?", async () => {
        try {
            const updates = {
                status: 'rejected',
                updated_at: now()
            };

            if (sb) {
                const { error } = await sb.from("trade_in_transactions").update(updates).eq("id", tradeInId);
                if (error) throw error;
            }

            const index = DB.tradeIns.findIndex(t => t.id === tradeInId);
            if (index !== -1) {
                DB.tradeIns[index] = { ...DB.tradeIns[index], ...updates };
            }

            toast("Trade-in rejected", "success");
            renderTradeInTable('rejected');
        } catch (error) {
            console.error("Error rejecting trade-in:", error);
            toast("Error rejecting trade-in: " + error.message, "error");
        }
    });
}

// Complete trade-in
async function completeTradeIn(tradeInId) {
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();

    showConfirm("Mark this trade-in as completed? This will add the traded-in item to warehouse inventory and deduct the new device from stock.", async () => {
        try {
            const tradeIn = DB.tradeIns.find(t => t.id === tradeInId);
            if (!tradeIn) {
                toast("Trade-in not found", "error");
                return;
            }

            const updates = {
                status: 'completed',
                updated_at: now()
            };

            if (sb) {
                const { error } = await sb.from("trade_in_transactions").update(updates).eq("id", tradeInId);
                if (error) throw error;
            }

            const index = DB.tradeIns.findIndex(t => t.id === tradeInId);
            if (index !== -1) {
                DB.tradeIns[index] = { ...DB.tradeIns[index], ...updates };
            }

            // Add traded-in item to warehouse as serialized item
            try {
                const serializedItemData = {
                    id: uid(),
                    sku: `TRADEIN-${tradeIn.serial_number || tradeIn.id}`,
                    variant_id: null,
                    product_name: tradeIn.item_name,
                    serial_number: tradeIn.serial_number || tradeIn.id,
                    condition: tradeIn.condition,
                    status: 'trade_in',
                    location: 'warehouse',
                    trade_in_id: tradeIn.id,
                    is_active: true,
                    cost_price: tradeIn.trade_in_value,
                    selling_price: tradeIn.sale_value,
                    notes: `Traded-in from ${tradeIn.customer_name}. ${tradeIn.item_description}`,
                    created_at: now(),
                    updated_at: now()
                };

                // Save to Supabase
                if (sb) {
                    const { error: serialError } = await sb.from("serialized_items").insert([serializedItemData]);
                    if (serialError) {
                        console.warn("Error adding serialized item to warehouse:", serialError);
                        // Don't throw error - trade-in is still completed
                    }
                }

                // Save to local DB
                DB.serializedItems.push(serializedItemData);
            } catch (warehouseError) {
                console.warn("Error adding to warehouse (trade-in still completed):", warehouseError);
            }

            // Deduct inventory of the new device given to customer
            if (tradeIn._variant) {
                try {
                    const variant = tradeIn._variant;
                    const newQty = Math.max(0, (variant.qty || 0) - 1);

                    const variantUpdate = {
                        qty: newQty,
                        updated_at: now()
                    };

                    if (sb) {
                        const { error: vErr } = await sb
                            .from("variants")
                            .update(variantUpdate)
                            .eq("id", variant.id);
                        if (vErr)
                            console.error("Trade-in variant deduction error:", vErr);
                    }

                    // Update in-memory
                    const vIdx = DB.variants.findIndex((x) => x.id === variant.id);
                    if (vIdx !== -1) {
                        DB.variants[vIdx].qty = newQty;
                    }
                } catch (inventoryError) {
                    console.warn("Error deducting inventory (trade-in still completed):", inventoryError);
                }
            }

            toast("Trade-in completed: Traded-in item added to warehouse, new device stock deducted", "success");
            renderTradeInTable('completed');
        } catch (error) {
            console.error("Error completing trade-in:", error);
            toast("Error completing trade-in: " + error.message, "error");
        }
    });
}

// View trade-in details
function viewTradeInDetails(tradeInId) {
    const DB = getDB();
    const tradeIn = DB.tradeIns.find(t => t.id === tradeInId);
    if (!tradeIn) return;

    openModal(
        'Trade-In Details',
        `
            <div class="card" style="background: var(--bg3); padding: 16px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Customer:</span>
                    <strong>${esc(tradeIn.customer_name)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Phone:</span>
                    <span>${esc(tradeIn.customer_phone || '-')}</span>
                </div>
                <hr style="margin: 12px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Item:</span>
                    <strong>${esc(tradeIn.item_name)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Description:</span>
                    <span>${esc(tradeIn.item_description || '-')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Serial Number:</span>
                    <span>${esc(tradeIn.serial_number || '-')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Condition:</span>
                    <span class="badge badge-blue">${esc(tradeIn.condition)}</span>
                </div>
                <hr style="margin: 12px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Trade-In Value:</span>
                    <strong>${money(tradeIn.trade_in_value)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Potential Sale Value:</span>
                    <span>${money(tradeIn.sale_value || 0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Status:</span>
                    <span class="badge ${
                        tradeIn.status === 'completed' ? 'badge-green' : 
                        tradeIn.status === 'approved' ? 'badge-blue' : 
                        tradeIn.status === 'rejected' ? 'badge-red' : 'badge-orange'
                    }">${tradeIn.status}</span>
                </div>
                ${tradeIn.notes ? `
                    <hr style="margin: 12px 0;">
                    <div style="margin-top: 8px;">
                        <strong>Notes:</strong>
                        <p>${esc(tradeIn.notes)}</p>
                    </div>
                ` : ''}
            </div>
        `,
        `<button class="btn btn-outline" onclick="window.closeModal()">Close</button>`
    );
}

// Export service functions for global access
const tradeInService = {
    renderTradeIn,
    updateTradeInVariants,
    updateTradeInNet,
    processTradeInForm
};

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.tradeInService = tradeInService;
}

export default tradeInService;