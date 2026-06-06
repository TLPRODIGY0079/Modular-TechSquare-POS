// Layby (Layaway) Service for TECHSQUARE POS
import { getDB, getCurrentUser } from '../db.js';
import { getSupabase } from '../supabase-client.js';
import { $, uid, money, today, now, esc } from '../utils.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { STORE1_ID, STORE2_ID, WAREHOUSE_ID } from '../config.js';

// Render layby page
export function renderLayby() {
    const DB = getDB();
    const user = getCurrentUser();
    const mainContent = $("mainContent");
    
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="font-size: 24px; font-weight: 700;">Layby Management</h2>
            <button class="btn btn-primary" id="newLaybyBtn" style="width: auto;">
                <i class="fas fa-plus"></i> New Layby
            </button>
        </div>

        <div class="tabs">
            <div class="tab active" data-tab="active">Active</div>
            <div class="tab" data-tab="completed">Completed</div>
            <div class="tab" data-tab="cancelled">Cancelled</div>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" class="search-input" id="laybySearch" placeholder="Search by customer name or product...">
                </div>

                <div style="margin-top: 20px; overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Product</th>
                                <th>Total</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Progress</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="laybyTableBody">
                            <!-- Layby transactions will be rendered here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Setup event listeners
    const newLaybyBtn = document.getElementById("newLaybyBtn");
    if (newLaybyBtn) {
        newLaybyBtn.addEventListener("click", () => openNewLaybyModal());
    }

    // Setup tabs
    setupLaybyTabs();

    // Render layby table
    renderLaybyTable('active');

    // Search functionality
    const searchInput = document.getElementById("laybySearch");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterLaybys(searchTerm);
        });
    }
}

// Setup layby tabs
function setupLaybyTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            const status = tab.dataset.tab;
            renderLaybyTable(status);
        });
    });
}

// Render layby table
function renderLaybyTable(status) {
    const DB = getDB();
    const tbody = document.getElementById("laybyTableBody");
    if (!tbody) return;

    const laybys = DB.laybys.filter(l => l.status === status);

    if (laybys.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <div class="empty-state">
                        <i class="fas fa-calendar-check"></i>
                        <h3>No ${status} laybys</h3>
                        <p>${status === 'active' ? 'Create a new layby to get started' : 'No laybys in this category'}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = laybys.map(layby => {
        const progress = layby.total_price > 0 ? (layby.amount_paid / layby.total_price) * 100 : 0;
        const progressColor = progress >= 100 ? 'var(--gn)' : progress >= 50 ? 'var(--ac)' : 'var(--wn)';
        
        return `
            <tr>
                <td>
                    <strong>${esc(layby.customer_name)}</strong>
                    <div style="font-size: 12px; color: var(--tx2);">${esc(layby.customer_phone || '')}</div>
                </td>
                <td>${esc(layby.product_name)}</td>
                <td>${money(layby.total_price)}</td>
                <td><span class="badge badge-green">${money(layby.amount_paid)}</span></td>
                <td><span class="badge ${layby.balance > 0 ? 'badge-orange' : 'badge-green'}">${money(layby.balance)}</span></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; height: 6px; background: var(--bg3); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; background: ${progressColor}; border-radius: 3px; width: ${Math.min(100, progress)}%;"></div>
                        </div>
                        <span style="font-size: 12px; font-weight: 600;">${progress.toFixed(0)}%</span>
                    </div>
                </td>
                <td>
                    <div style="display: flex; gap: 4px;">
                        ${layby.status === 'active' ? `
                            <button class="btn btn-sm btn-success" onclick="window.laybyService.recordPayment('${layby.id}')" title="Record Payment">
                                <i class="fas fa-dollar-sign"></i>
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="window.laybyService.viewDetails('${layby.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-outline" onclick="window.laybyService.viewDetails('${layby.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter laybys
function filterLaybys(searchTerm) {
    const DB = getDB();
    const rows = document.querySelectorAll("#laybyTableBody tr");
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Open new layby modal
function openNewLaybyModal() {
    const DB = getDB();
    const user = getCurrentUser();
    
    // Get active variants for product selection
    const activeVariants = DB.variants.filter(v => v.is_active && v.qty > 0);
    
    openModal(
        'Create New Layby',
        `
            <form id="laybyForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Customer Name *</label>
                        <input type="text" class="form-input" id="laybyCustomerName" required>
                    </div>
                    <div class="form-group">
                        <label>Customer Phone</label>
                        <input type="tel" class="form-input" id="laybyCustomerPhone">
                    </div>
                </div>
                <div class="form-group">
                    <label>Customer Email</label>
                    <input type="email" class="form-input" id="laybyCustomerEmail">
                </div>
                <div class="form-group">
                    <label>Select Product *</label>
                    <select class="form-input" id="laybyProduct" required>
                        <option value="">Choose a product...</option>
                        ${activeVariants.map(variant => {
                            const product = DB.products.find(p => p.id === variant.product_id);
                            return `
                                <option value="${variant.id}" data-price="${variant.price}" data-product="${product?.name || 'Unknown'}">
                                    ${product?.name || 'Unknown'} - ${variant.color || ''} ${variant.storage || ''} - ${money(variant.price)}
                                </option>
                            `;
                        }).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Total Price *</label>
                        <input type="number" class="form-input" id="laybyTotalPrice" required step="0.01" readonly>
                    </div>
                    <div class="form-group">
                        <label>Deposit Amount *</label>
                        <input type="number" class="form-input" id="laybyDeposit" required step="0.01" min="0">
                    </div>
                </div>
                <div class="form-group">
                    <label>Start Date *</label>
                    <input type="date" class="form-input" id="laybyStartDate" required value="${today()}">
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea class="form-input" id="laybyNotes" rows="3"></textarea>
                </div>
                <div class="card" style="background: var(--bg3); padding: 16px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Total Price:</span>
                        <span id="laybyTotalDisplay">K0.00</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Deposit:</span>
                        <span id="laybyDepositDisplay">K0.00</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: 700;">
                        <span>Balance:</span>
                        <span id="laybyBalanceDisplay">K0.00</span>
                    </div>
                </div>
            </form>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="createLaybyBtn">
                <i class="fas fa-save"></i> Create Layby
            </button>
        `
    );

    // Setup product selection
    const productSelect = document.getElementById("laybyProduct");
    const totalPriceInput = document.getElementById("laybyTotalPrice");
    
    if (productSelect && totalPriceInput) {
        productSelect.addEventListener("change", () => {
            const selectedOption = productSelect.selectedOptions[0];
            if (selectedOption) {
                const price = parseFloat(selectedOption.dataset.price) || 0;
                totalPriceInput.value = price;
                updateLaybyCalculations();
            }
        });
    }

    // Setup deposit input
    const depositInput = document.getElementById("laybyDeposit");
    if (depositInput) {
        depositInput.addEventListener("input", updateLaybyCalculations);
    }

    // Create layby button
    const createBtn = document.getElementById("createLaybyBtn");
    if (createBtn) {
        createBtn.addEventListener("click", createLayby);
    }
}

// Update layby calculations
function updateLaybyCalculations() {
    const totalPrice = parseFloat(document.getElementById("laybyTotalPrice")?.value) || 0;
    const deposit = parseFloat(document.getElementById("laybyDeposit")?.value) || 0;
    const balance = Math.max(0, totalPrice - deposit);

    document.getElementById("laybyTotalDisplay").textContent = money(totalPrice);
    document.getElementById("laybyDepositDisplay").textContent = money(deposit);
    document.getElementById("laybyBalanceDisplay").textContent = money(balance);
}

// Create layby
async function createLayby() {
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();
    
    const customerName = document.getElementById("laybyCustomerName").value.trim();
    const customerPhone = document.getElementById("laybyCustomerPhone").value.trim();
    const customerEmail = document.getElementById("laybyCustomerEmail").value.trim();
    const variantId = document.getElementById("laybyProduct").value;
    const totalPrice = parseFloat(document.getElementById("laybyTotalPrice").value);
    const deposit = parseFloat(document.getElementById("laybyDeposit").value);
    const startDate = document.getElementById("laybyStartDate").value;
    const notes = document.getElementById("laybyNotes").value.trim();

    if (!customerName || !variantId || !totalPrice) {
        toast("Please fill in all required fields", "error");
        return;
    }

    if (deposit < 0 || deposit > totalPrice) {
        toast("Deposit must be between 0 and total price", "error");
        return;
    }

    try {
        const variant = DB.variants.find(v => v.id === variantId);
        const product = DB.products.find(p => p.id === variant?.product_id);
        const balance = totalPrice - deposit;

        const laybyData = {
            id: uid(),
            store_id: user?.storeId || STORE1_ID,
            user_id: user?.id,
            user_name: user?.name,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail,
            product_name: product?.name || 'Unknown',
            variant_id: variantId,
            total_price: totalPrice,
            deposit_amount: deposit,
            amount_paid: deposit,
            balance: balance,
            status: balance === 0 ? 'completed' : 'active',
            start_date: startDate,
            completion_date: balance === 0 ? today() : null,
            notes: notes,
            created_at: now(),
            updated_at: now()
        };

        // Save to Supabase
        if (sb) {
            const { error: laybyError } = await sb.from("layby_transactions").insert([laybyData]);
            if (laybyError) throw laybyError;

            // Record initial payment if deposit > 0
            if (deposit > 0) {
                const paymentData = {
                    id: uid(),
                    layby_id: laybyData.id,
                    amount: deposit,
                    payment_method: 'cash',
                    user_id: user?.id,
                    user_name: user?.name,
                    notes: 'Initial deposit',
                    created_at: now()
                };
                
                const { error: paymentError } = await sb.from("layby_payments").insert([paymentData]);
                if (paymentError) throw paymentError;
                
                DB.laybyPayments.push(paymentData);
            }
        }

        // Save to local DB
        DB.laybys.unshift(laybyData);

        toast("Layby created successfully", "success");
        closeModal();
        renderLaybyTable('active');

    } catch (error) {
        console.error("Error creating layby:", error);
        toast("Error creating layby: " + error.message, "error");
    }
}

// Record payment for layby
async function recordPayment(laybyId) {
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();
    
    const layby = DB.laybys.find(l => l.id === laybyId);
    if (!layby) {
        toast("Layby not found", "error");
        return;
    }

    openModal(
        'Record Payment',
        `
            <form id="paymentForm">
                <div class="card" style="background: var(--bg3); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Customer:</span>
                        <strong>${esc(layby.customer_name)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Product:</span>
                        <span>${esc(layby.product_name)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Total Price:</span>
                        <span>${money(layby.total_price)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Amount Paid:</span>
                        <span class="badge badge-green">${money(layby.amount_paid)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: 700;">
                        <span>Balance:</span>
                        <span class="badge ${layby.balance > 0 ? 'badge-orange' : 'badge-green'}">${money(layby.balance)}</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Payment Amount *</label>
                    <input type="number" class="form-input" id="paymentAmount" required step="0.01" min="0" max="${layby.balance}">
                </div>
                <div class="form-group">
                    <label>Payment Method *</label>
                    <select class="form-input" id="paymentMethod" required>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="transfer">Bank Transfer</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea class="form-input" id="paymentNotes" rows="2"></textarea>
                </div>
            </form>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="recordPaymentBtn">
                <i class="fas fa-save"></i> Record Payment
            </button>
        `
    );

    const recordBtn = document.getElementById("recordPaymentBtn");
    if (recordBtn) {
        recordBtn.addEventListener("click", () => processLaybyPayment(laybyId));
    }
}

// Process layby payment
async function processLaybyPayment(laybyId) {
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();
    
    const layby = DB.laybys.find(l => l.id === laybyId);
    if (!layby) return;

    const amount = parseFloat(document.getElementById("paymentAmount").value);
    const method = document.getElementById("paymentMethod").value;
    const notes = document.getElementById("paymentNotes").value.trim();

    if (!amount || amount <= 0) {
        toast("Please enter a valid payment amount", "error");
        return;
    }

    if (amount > layby.balance) {
        toast("Payment amount cannot exceed balance", "error");
        return;
    }

    try {
        const newBalance = layby.balance - amount;
        const newPaid = layby.amount_paid + amount;
        const isComplete = newBalance <= 0;

        // Record payment
        const paymentData = {
            id: uid(),
            layby_id: laybyId,
            amount: amount,
            payment_method: method,
            user_id: user?.id,
            user_name: user?.name,
            notes: notes,
            created_at: now()
        };

        if (sb) {
            const { error: paymentError } = await sb.from("layby_payments").insert([paymentData]);
            if (paymentError) throw paymentError;
        }

        DB.laybyPayments.push(paymentData);

        // Update layby
        const updates = {
            amount_paid: newPaid,
            balance: newBalance,
            status: isComplete ? "completed" : "active",
            updated_at: now(),
            completed_at: isComplete ? now() : null,
        };

        if (sb) {
            const { error: updateError } = await sb.from("layby_transactions").update(updates).eq("id", laybyId);
            if (updateError) throw updateError;
        }

        const laybyIndex = DB.laybys.findIndex(l => l.id === laybyId);
        if (laybyIndex !== -1) {
            DB.laybys[laybyIndex] = { ...DB.laybys[laybyIndex], ...updates };
        }

        toast(isComplete ? "Layby completed!" : "Payment recorded successfully", isComplete ? "success" : "success");
        closeModal();
        renderLaybyTable(isComplete ? 'completed' : 'active');

    } catch (error) {
        console.error("Error recording payment:", error);
        toast("Error recording payment: " + error.message, "error");
    }
}

// View layby details
function viewDetails(laybyId) {
    const DB = getDB();
    const layby = DB.laybys.find(l => l.id === laybyId);
    if (!layby) return;

    const payments = DB.laybyPayments.filter(p => p.layby_id === laybyId);

    openModal(
        'Layby Details',
        `
            <div class="card" style="background: var(--bg3); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Customer:</span>
                    <strong>${esc(layby.customer_name)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Phone:</span>
                    <span>${esc(layby.customer_phone || '-')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Email:</span>
                    <span>${esc(layby.customer_email || '-')}</span>
                </div>
                <hr style="margin: 12px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Product:</span>
                    <span>${esc(layby.product_name)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Total Price:</span>
                    <span>${money(layby.total_price)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Deposit:</span>
                    <span>${money(layby.deposit_amount)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Amount Paid:</span>
                    <span class="badge badge-green">${money(layby.amount_paid)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Balance:</span>
                    <span class="badge ${layby.balance > 0 ? 'badge-orange' : 'badge-green'}">${money(layby.balance)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Status:</span>
                    <span class="badge ${layby.status === 'completed' ? 'badge-green' : 'badge-blue'}">${layby.status}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Start Date:</span>
                    <span>${layby.start_date}</span>
                </div>
            </div>

            <h4 style="margin-bottom: 12px;">Payment History</h4>
            ${payments.length === 0 ? `
                <p style="color: var(--tx2); text-align: center; padding: 20px;">No payments recorded yet</p>
            ` : `
                <table style="font-size: 13px;">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(payment => `
                            <tr>
                                <td>${formatDate(payment.created_at)}</td>
                                <td><strong>${money(payment.amount)}</strong></td>
                                <td><span class="badge badge-blue">${payment.payment_method}</span></td>
                                <td>${esc(payment.notes || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Close</button>
            ${layby.status === 'active' ? `
                <button class="btn btn-success" onclick="window.laybyService.recordPayment('${layby.id}')">
                    <i class="fas fa-dollar-sign"></i> Record Payment
                </button>
            ` : ''}
        `
    );
}

// Helper function for date formatting
function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString();
}

// Export service functions for global access
const laybyService = {
    renderLayby,
    recordPayment,
    viewDetails
};

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.laybyService = laybyService;
}

export default laybyService;