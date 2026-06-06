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
        <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="font-size: 24px; font-weight: 700;">Trade-In Management</h2>
            <button class="btn btn-primary" id="newTradeInBtn" style="width: auto;">
                <i class="fas fa-plus"></i> New Trade-In
            </button>
        </div>

        <div class="tabs">
            <div class="tab active" data-tab="pending">Pending</div>
            <div class="tab" data-tab="approved">Approved</div>
            <div class="tab" data-tab="rejected">Rejected</div>
            <div class="tab" data-tab="completed">Completed</div>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" class="search-input" id="tradeInSearch" placeholder="Search trade-ins...">
                </div>

                <div style="margin-top: 20px; overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Item</th>
                                <th>Condition</th>
                                <th>Trade-In Value</th>
                                <th>Sale Value</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="tradeInTableBody">
                            <!-- Trade-ins will be rendered here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Setup event listeners
    const newTradeInBtn = document.getElementById("newTradeInBtn");
    if (newTradeInBtn) {
        newTradeInBtn.addEventListener("click", () => openTradeInModal());
    }

    // Setup tabs
    setupTradeInTabs();

    // Render trade-in table
    renderTradeInTable('pending');

    // Search functionality
    const searchInput = document.getElementById("tradeInSearch");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterTradeIns(searchTerm);
        });
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
    
    showConfirm("Mark this trade-in as completed?", async () => {
        try {
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

            toast("Trade-in completed", "success");
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
    approveTradeIn,
    rejectTradeIn,
    completeTradeIn,
    viewTradeInDetails
};

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.tradeInService = tradeInService;
}

export default tradeInService;