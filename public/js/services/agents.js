

import { getDB, getCurrentUser } from '../db.js';
import { getSupabase } from '../supabase-client.js';
import { $, uid, money, today, now, esc } from '../utils.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { STORE1_ID, STORE2_ID, WAREHOUSE_ID } from '../config.js';

// ============================================================================
// COMMISSION CALCULATION
// ============================================================================

/**
 * Calculate commission for a sale
 * @param {Array} cartItems - Array of cart items
 * @param {string} receiptNo - Receipt number
 * @param {string} storeId - Store ID
 * @param {number} totalAmount - Total amount of the sale
 */
export async function calculateCommission(
    cartItems,
    receiptNo,
    storeId,
    totalAmount,
) {
    try {
        const DB = getDB();
        const currentUser = getCurrentUser();
        const sb = getSupabase();

        let totalCommission = 0;

        for (const item of cartItems) {
            // Find the variant to get the commission rate
            const variant = DB.variants.find(
                (v) =>
                    v.sku === item.sku || v.id === item.variantId,
            );

            if (
                variant &&
                variant.commission_rate &&
                variant.commission_rate > 0
            ) {
                const itemTotal = item.price * item.qty;
                const commissionAmount =
                    variant.commission_rate * item.qty; // Commission per unit × quantity
                totalCommission += commissionAmount;

                log(
                    `💰 Commission for ${item.productName}: K${commissionAmount.toFixed(2)} (K${variant.commission_rate} × ${item.qty})`,
                );

                // Record commission
                const commissionRecord = {
                    id: uid(),
                    user_id: currentUser.id,
                    user_name: currentUser.name,
                    store_id: storeId,
                    receipt_number: receiptNo,
                    product_name: item.productName,
                    variant_sku: variant.sku,
                    sale_amount: itemTotal,
                    commission_rate: variant.commission_rate,
                    commission_amount: commissionAmount,
                    quantity: item.qty,
                    date: today(),
                    created_at: now(),
                };

                // Save to IndexedDB first (offline-first)
                const offlineDB = window.offlineDB;
                if (offlineDB) {
                    await offlineDB.put(
                        "commission_records",
                        commissionRecord,
                    );
                    log(
                        "✅ Commission record saved to IndexedDB:",
                        commissionRecord.id,
                    );
                }

                // Sync to Supabase if online
                if (isOnline()) {
                    try {
                        const { error } = await sb
                            .from("commission_records")
                            .insert([commissionRecord]);
                        if (error) throw error;
                        log(
                            "✅ Commission record synced to Supabase",
                        );
                    } catch (insertError) {
                        console.error(
                            "Commission record Supabase insert failed:",
                            insertError,
                        );
                        // Queue for later sync
                        if (offlineDB) {
                            await offlineDB.queueOperation(
                                "create",
                                "commission_records",
                                commissionRecord,
                            );
                        }
                    }
                } else {
                    // Queue for sync when online
                    if (offlineDB) {
                        await offlineDB.queueOperation(
                            "create",
                            "commission_records",
                            commissionRecord,
                        );
                        log("📤 Commission record queued for sync");
                    }
                }
            }
        }

        if (totalCommission > 0) {
            log(
                `💰 Total commission earned: ${money(totalCommission)}`,
            );
            toast(
                `Commission earned: ${money(totalCommission)}`,
                "success",
            );
        } else {
            log("ℹ️ No commission-eligible items in this sale");
        }
    } catch (err) {
        console.error("Commission calculation error:", err);
        // Don't fail the sale if commission fails
    }
}

// ============================================================================
// AGENT PAYMENT METHOD HANDLER
// ============================================================================

/**
 * Handle agent payment method
 * @param {string} storeId - Store ID
 * @param {number} total - Total amount
 * @param {number} discount - Discount amount
 * @param {number} subtotal - Subtotal amount
 * @returns {boolean|object} - False if fallback to cash, or transaction result
 */
export async function handleAgentPaymentMethod(
    storeId,
    total,
    discount,
    subtotal,
) {
    try {
        // Agent system temporarily disabled due to import issues
        log("Agent system not available, falling back to cash");
        toast(
            "Agent system temporarily unavailable, processing as cash sale",
            "info",
        );
        return false;
    } catch (error) {
        console.error("Agent payment method error:", error);
        return false;
    }
}

/**
 * Show agent transaction form
 * @param {object} agent - Agent object
 * @param {string} storeId - Store ID
 * @param {number} total - Total amount
 * @param {number} discount - Discount amount
 * @param {number} subtotal - Subtotal amount
 */
export async function showAgentTransactionForm(
    agent,
    storeId,
    total,
    discount,
    subtotal,
) {
    const cartItems = [...window.cart];

    const html = `
    <div class="agent-transaction-form">
      <div class="form-group">
        <label><strong>Agent:</strong> ${esc(agent.name)}</label>
        <div style="font-size:12px;color:var(--tx2)">
          Balance: <span class="balance-amount ${agent.balance > 0 ? "negative" : "positive"}">${money(Math.abs(agent.balance))}</span>
        </div>
      </div>

      <div class="form-group">
        <label>Products to Assign:</label>
        <div id="agentCartItems">
          ${cartItems
              .map(
                  (item) => `
            <div class="product-selector selected" data-variant-id="${item.variantId}">
              <div class="product-name">${item.productName}</div>
              <div class="product-details">
                <span>${item.desc}</span>
                <span>Qty: ${item.qty} × ${money(item.price)} = ${money(item.qty * item.price)}</span>
              </div>
            </div>
          `,
              )
              .join("")}
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Total Store Amount</label>
          <input type="text" class="form-control" value="${money(total)}" readonly>
        </div>
        <div class="form-group">
          <label>Reseller Price (Optional)</label>
          <input type="number" id="resellerPrice" class="form-control" step="0.01" min="${total}" placeholder="Enter planned selling price">
        </div>
      </div>

      <div style="background:var(--bg2);padding:12px;border-radius:6px;margin:16px 0">
        <div style="font-size:12px;color:var(--tx2);margin-bottom:8px">Transaction Summary:</div>
        <div style="display:flex;justify-content:space-between">
          <span>Store Amount:</span>
          <span style="font-weight:600">${money(total)}</span>
        </div>
        ${
            discount > 0
                ? `
        <div style="display:flex;justify-content:space-between">
          <span>Discount Applied:</span>
          <span style="color:var(--gn)">-${money(discount)}</span>
        </div>
        `
                : ""
        }
      </div>
    </div>
  `;

    openModal(
        "Assign to Agent",
        html,
        `
    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="confirmAgentTransaction('${agent.id}', '${storeId}', ${total}, ${discount}, ${subtotal})">
      <i class="fas fa-user-tie"></i> Assign to Agent
    </button>
  `,
    );
}

/**
 * Confirm agent transaction
 * @param {string} agentId - Agent ID
 * @param {string} storeId - Store ID
 * @param {number} total - Total amount
 * @param {number} discount - Discount amount
 * @param {number} subtotal - Subtotal amount
 */
export async function confirmAgentTransaction(
    agentId,
    storeId,
    total,
    discount,
    subtotal,
) {
    try {
        // Agent system temporarily disabled
        toast("Agent system temporarily unavailable", "info");
        closeModal();
    } catch (error) {
        console.error("Agent transaction error:", error);
        toast(
            "Failed to create agent transaction: " + error.message,
            "error",
        );
    }
}

// ============================================================================
// AGENT MANAGEMENT UI
// ============================================================================

/**
 * Render the agents page
 */
export async function renderAgents() {
    const DB = getDB();
    const currentUser = getCurrentUser();
    const sb = getSupabase();
    const mainContent = $("mainContent");

    if (!mainContent) return;

    try {
        // Load agents from database
        let agents = [];
        try {
            if (sb) {
                const { data, error } = await sb.from("agents").select("*").order("created_at", { ascending: false });
                if (error) throw error;
                agents = data || [];
            }
        } catch (err) {
            console.error("Error loading agents from Supabase:", err);
            // Fallback to local data if available
            agents = DB.agents || [];
        }

        // Load agent assignments from database
        let agentAssignments = [];
        try {
            if (sb) {
                const { data, error } = await sb.from("agent_assignments").select("*").order("created_at", { ascending: false });
                if (error) throw error;
                agentAssignments = data || [];
            }
        } catch (err) {
            console.error("Error loading agent assignments from Supabase:", err);
            // Fallback to local data if available
            agentAssignments = DB.agentAssignments || [];
        }
        DB.agentAssignments = agentAssignments;

        // Calculate statistics
        const totalAgents = agents.length;
        const activeAgents = agents.filter(a => a.active !== false).length;
        const totalBalance = agents.reduce((sum, a) => sum + (a.balance || 0), 0);

        mainContent.innerHTML = `
            <div class="warehouse-container">
                <div class="warehouse-header">
                    <div>
                        <h1><i class="fas fa-user-tie"></i> Agent Management</h1>
                        <p style="color:var(--tx2);margin-top:8px">Manage consignment agents and resellers</p>
                    </div>
                    <div style="display:flex;gap:12px">
                        <button class="btn btn-outline" onclick="window.agentsService.openNewAgentModal()">
                            <i class="fas fa-plus-circle"></i> New Agent
                        </button>
                    </div>
                </div>

                <!-- Stats Cards -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon" style="background:var(--ac3);color:var(--ac)">
                            <i class="fas fa-users"></i>
                        </div>
                        <div>
                            <div class="stat-value">${totalAgents}</div>
                            <div class="stat-label">Total Agents</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="background:var(--gn2);color:var(--gn)">
                            <i class="fas fa-user-check"></i>
                        </div>
                        <div>
                            <div class="stat-value">${activeAgents}</div>
                            <div class="stat-label">Active Agents</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="background:var(--wn2);color:var(--wn)">
                            <i class="fas fa-wallet"></i>
                        </div>
                        <div>
                            <div class="stat-value">${money(totalBalance)}</div>
                            <div class="stat-label">Total Balance</div>
                        </div>
                    </div>
                </div>

                <!-- Agents List -->
                <div class="card">
                    <div class="card-header">
                        <h3>Registered Agents</h3>
                        <div style="display:flex;gap:8px;align-items:center">
                            <input type="text" class="form-input" id="agentSearch" placeholder="Search agents..." style="width:200px;padding:8px 12px">
                        </div>
                    </div>
                    <div class="card-body np">
                        ${agents.length === 0 ? `
                            <div class="empty-state">
                                <i class="fas fa-user-tie"></i>
                                <h3>No agents registered</h3>
                                <p>Get started by adding your first agent</p>
                            </div>
                        ` : `
                            <div class="agents-grid">
                                ${agents.map(agent => `
                                    <div class="agent-card">
                                        <div style="display:flex;justify-content:space-between;align-items:start">
                                            <div>
                                                <div style="font-weight:600;font-size:16px">${esc(agent.name)}</div>
                                                <div style="font-size:12px;color:var(--tx2);margin-top:4px">${esc(agent.phone || 'No phone')}</div>
                                            </div>
                                            <span class="badge ${agent.active !== false ? 'badge-green' : 'badge-gray'}">
                                                ${agent.active !== false ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
                                            <div style="background:var(--bg);padding:8px;border-radius:6px">
                                                <div style="font-size:11px;color:var(--tx2)">Balance</div>
                                                <div style="font-weight:600;font-size:14px;color:${(agent.balance || 0) > 0 ? 'var(--wn)' : 'var(--gn)'}">
                                                    ${money(Math.abs(agent.balance || 0))}
                                                </div>
                                            </div>
                                            <div style="background:var(--bg);padding:8px;border-radius:6px">
                                                <div style="font-size:11px;color:var(--tx2)">Credit Limit</div>
                                                <div style="font-weight:600;font-size:14px">
                                                    ${agent.credit_limit ? money(agent.credit_limit) : 'Not set'}
                                                </div>
                                            </div>
                                        </div>
                                        <div style="margin-top:12px;display:flex;gap:8px">
                                            <button class="btn btn-sm btn-outline" onclick="window.agentsService.viewAgentDetails('${agent.id}')">
                                                <i class="fas fa-eye"></i> View
                                            </button>
                                            <button class="btn btn-sm btn-outline" onclick="window.agentsService.editAgent('${agent.id}')">
                                                <i class="fas fa-edit"></i> Edit
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>

                <!-- Agent Assignments Section -->
                <div id="agentAssignmentsContainer" style="margin-top:24px"></div>
            </div>
        `;

        // Render assignments section
        renderAgentAssignments();

        // Setup search functionality
        const searchInput = document.getElementById("agentSearch");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const cards = document.querySelectorAll(".agent-card");
                cards.forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(searchTerm) ? "block" : "none";
                });
            });
        }

    } catch (error) {
        console.error("Error rendering agents:", error);
        mainContent.innerHTML = `
            <div style="padding:40px;text-align:center">
                <i class="fas fa-exclamation-triangle" style="font-size:48px;color:var(--dn);margin-bottom:20px"></i>
                <h2>Error Loading Agents</h2>
                <p style="color:var(--tx2);margin-top:10px">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Open new agent modal
 */
function openNewAgentModal() {
    const currentUser = getCurrentUser();

    openModal(
        "Add New Agent",
        `
            <form id="agentForm">
                <div class="form-group">
                    <label>Agent Name *</label>
                    <input type="text" class="form-input" id="agentName" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="tel" class="form-input" id="agentPhone">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" class="form-input" id="agentEmail">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Credit Limit</label>
                        <input type="number" class="form-input" id="agentCreditLimit" step="0.01" min="0" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label>Commission Rate (%)</label>
                        <input type="number" class="form-input" id="agentCommissionRate" step="0.1" min="0" max="100" placeholder="0.0">
                    </div>
                </div>
                <div class="form-group">
                    <label>Store</label>
                    <select class="form-input" id="agentStore" required>
                        ${currentUser.role === "admin" ?
                            `<option value="">Select Store</option>
                            <option value="${STORE1_ID}">Store 1</option>
                            <option value="${STORE2_ID}">Store 2</option>` :
                            `<option value="${currentUser.storeId}">${currentUser.storeId === STORE1_ID ? "Store 1" : "Store 2"}</option>`
                        }
                    </select>
                </div>
            </form>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="saveAgentBtn">
                <i class="fas fa-save"></i> Create Agent
            </button>
        `
    );

    const saveBtn = document.getElementById("saveAgentBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", () => saveAgent());
    }
}

/**
 * Save new agent
 */
async function saveAgent() {
    const DB = getDB();
    const sb = getSupabase();
    const currentUser = getCurrentUser();

    const name = document.getElementById("agentName").value.trim();
    const phone = document.getElementById("agentPhone").value.trim();
    const email = document.getElementById("agentEmail").value.trim();
    const creditLimit = parseFloat(document.getElementById("agentCreditLimit").value) || null;
    const commissionRate = parseFloat(document.getElementById("agentCommissionRate").value) || null;
    const storeId = document.getElementById("agentStore").value;

    if (!name || !storeId) {
        toast("Agent name and store are required", "error");
        return;
    }

    try {
        const agentData = {
            id: uid(),
            name,
            phone,
            email,
            store_id: storeId,
            credit_limit: creditLimit,
            balance: 0,
            commission_rate: commissionRate,
            active: true,
            created_at: now(),
            updated_at: now()
        };

        // Save to Supabase
        if (sb) {
            const { error } = await sb.from("agents").insert([agentData]);
            if (error) throw error;
        }

        // Save to local DB
        if (!DB.agents) DB.agents = [];
        DB.agents.unshift(agentData);

        toast("Agent created successfully", "success");
        closeModal();
        renderAgents();
    } catch (error) {
        console.error("Error creating agent:", error);
        toast("Failed to create agent", "error");
    }
}

/**
 * View agent details
 */
function viewAgentDetails(agentId) {
    const DB = getDB();
    const agent = DB.agents?.find(a => a.id === agentId);

    if (!agent) {
        toast("Agent not found", "error");
        return;
    }

    openModal(
        "Agent Details",
        `
            <div class="agent-details">
                <div style="background:var(--bg);padding:16px;border-radius:8px;margin-bottom:16px">
                    <div style="font-weight:700;font-size:18px">${esc(agent.name)}</div>
                    <div style="font-size:13px;color:var(--tx2);margin-top:4px">${esc(agent.phone || 'No phone')}</div>
                    ${agent.email ? `<div style="font-size:13px;color:var(--tx2)">${esc(agent.email)}</div>` : ''}
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
                    <div style="background:var(--bg);padding:12px;border-radius:8px">
                        <div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Current Balance</div>
                        <div style="font-weight:700;font-size:20px;color:${(agent.balance || 0) > 0 ? 'var(--wn)' : 'var(--gn)'}">
                            ${money(Math.abs(agent.balance || 0))}
                        </div>
                    </div>
                    <div style="background:var(--bg);padding:12px;border-radius:8px">
                        <div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Credit Limit</div>
                        <div style="font-weight:700;font-size:20px">
                            ${agent.credit_limit ? money(agent.credit_limit) : 'Not set'}
                        </div>
                    </div>
                </div>

                <div style="background:var(--ac3);padding:12px;border-radius:8px">
                    <div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Status</div>
                    <span class="badge ${agent.active !== false ? 'badge-green' : 'badge-gray'}">
                        ${agent.active !== false ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Close</button>
        `
    );
}

/**
 * Edit agent
 */
function editAgent(agentId) {
    const DB = getDB();
    const currentUser = getCurrentUser();
    const agent = DB.agents?.find(a => a.id === agentId);

    if (!agent) {
        toast("Agent not found", "error");
        return;
    }

    openModal(
        "Edit Agent",
        `
            <form id="agentForm">
                <div class="form-group">
                    <label>Agent Name *</label>
                    <input type="text" class="form-input" id="agentName" value="${esc(agent.name)}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="tel" class="form-input" id="agentPhone" value="${esc(agent.phone || '')}">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" class="form-input" id="agentEmail" value="${esc(agent.email || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Credit Limit</label>
                        <input type="number" class="form-input" id="agentCreditLimit" value="${agent.credit_limit || ''}" step="0.01" min="0">
                    </div>
                    <div class="form-group">
                        <label>Commission Rate (%)</label>
                        <input type="number" class="form-input" id="agentCommissionRate" value="${agent.commission_rate || ''}" step="0.1" min="0" max="100">
                    </div>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select class="form-input" id="agentActive">
                        <option value="true" ${agent.active !== false ? 'selected' : ''}>Active</option>
                        <option value="false" ${agent.active === false ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
            </form>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="updateAgentBtn">
                <i class="fas fa-save"></i> Update Agent
            </button>
        `
    );

    const updateBtn = document.getElementById("updateAgentBtn");
    if (updateBtn) {
        updateBtn.addEventListener("click", () => updateAgent(agentId));
    }
}

/**
 * Update agent
 */
async function updateAgent(agentId) {
    const DB = getDB();
    const sb = getSupabase();

    const name = document.getElementById("agentName").value.trim();
    const phone = document.getElementById("agentPhone").value.trim();
    const email = document.getElementById("agentEmail").value.trim();
    const creditLimit = parseFloat(document.getElementById("agentCreditLimit").value) || null;
    const commissionRate = parseFloat(document.getElementById("agentCommissionRate").value) || null;
    const active = document.getElementById("agentActive").value === "true";

    if (!name) {
        toast("Agent name is required", "error");
        return;
    }

    try {
        const updates = {
            name,
            phone,
            email,
            credit_limit: creditLimit,
            commission_rate: commissionRate,
            active,
            updated_at: now()
        };

        // Update in Supabase
        if (sb) {
            const { error } = await sb.from("agents").update(updates).eq("id", agentId);
            if (error) throw error;
        }

        // Update in local DB
        const index = DB.agents?.findIndex(a => a.id === agentId);
        if (index !== -1) {
            DB.agents[index] = { ...DB.agents[index], ...updates };
        }

        toast("Agent updated successfully", "success");
        closeModal();
        renderAgents();
    } catch (error) {
        console.error("Error updating agent:", error);
        toast("Failed to update agent", "error");
    }
}

/**
 * Render the agents grid
 * @param {Array} agents - Array of agent objects
 */
export async function renderAgentsGrid(agents) {
    const grid = $("agentsGrid");
    if (!grid) return;

    grid.innerHTML = `
    <div style="text-align:center;padding:40px;color:var(--tx2)">
      <i class="fas fa-user-tie" style="font-size:48px;margin-bottom:16px;opacity:0.3"></i>
      <h3>Agent System Temporarily Unavailable</h3>
      <p>The agent consignment system is being updated. Please check back later.</p>
    </div>
  `;
}

// ============================================================================
// AGENT METRICS
// ============================================================================

/**
 * Calculate global agent metrics from database
 * This function provides metrics for the dashboard agent performance card
 */
async function getGlobalMetrics(storeId = null) {
    const DB = getDB();
    
    // Filter assignments by store if storeId is provided
    const assignments = storeId 
        ? (DB.agentAssignments || []).filter(a => a.store_id === storeId)
        : (DB.agentAssignments || []);
    
    const agents = DB.agents || [];
    
    // Calculate metrics
    const totalAgents = agents.length;
    
    // Calculate total owed (sum of agreed amounts for active assignments)
    const totalOwed = assignments
        .filter(a => a.status === 'active')
        .reduce((sum, a) => sum + (a.agreed_amount || 0), 0);
    
    // Calculate total collected (sum of agreed amounts for completed assignments)
    const totalCollected = assignments
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.agreed_amount || 0), 0);
    
    // Calculate outstanding (active assignments)
    const totalOutstanding = totalOwed;
    
    // Find top agent by total sales
    let topAgent = null;
    if (assignments.length > 0) {
        // Group assignments by agent
        const agentPerformance = new Map();
        
        assignments.forEach(assignment => {
            const agentId = assignment.agent_id;
            if (!agentPerformance.has(agentId)) {
                const agent = agents.find(a => a.id === agentId);
                agentPerformance.set(agentId, {
                    name: agent?.name || 'Unknown',
                    totalSales: 0,
                    totalProfit: 0,
                    completedAssignments: 0
                });
            }
            
            const perf = agentPerformance.get(agentId);
            if (assignment.status === 'completed') {
                perf.totalSales += 1;
                perf.totalProfit += (assignment.agreed_amount || 0);
                perf.completedAssignments += 1;
            }
        });
        
        // Find top performer
        let maxSales = 0;
        agentPerformance.forEach((perf) => {
            if (perf.totalSales > maxSales) {
                maxSales = perf.totalSales;
                topAgent = perf;
            }
        });
    }
    
    return {
        totalAgents,
        totalOwed,
        totalCollected,
        totalOutstanding,
        topAgent
    };
}


if (typeof window !== 'undefined') {
    window.getGlobalMetrics = getGlobalMetrics;
}

/**
 * Load agent metrics for dashboard
 * This function relies on getGlobalMetrics from the agent service
 */
export async function loadAgentMetrics() {
    try {
        const widget = $("agentMetricsWidget");
        const noAgentData = $("noAgentData");
        
        if (!widget) {
            log("Agent metrics widget not found in dashboard");
            return;
        }

        const currentUser = getCurrentUser();


        const storeId =
            currentUser.role === "admin"
                ? null
                : currentUser.storeId;

        // Load global agent metrics using the local function
        const metrics = await getGlobalMetrics(storeId);

        console.log("🔍 Agent Metrics Debug:", metrics);

        // Show widget if there are agents
        if (metrics.totalAgents > 0 || metrics.totalOwed > 0) {
            widget.style.display = "block";
            if (noAgentData) noAgentData.style.display = "none";

            // Update metrics
            const totalOwedEl = $("agentTotalOwed");
            const totalCollectedEl = $("agentTotalCollected");
            const totalOutstandingEl = $("agentTotalOutstanding");
            
            if (totalOwedEl) totalOwedEl.textContent = money(metrics.totalOwed);
            if (totalCollectedEl) totalCollectedEl.textContent = money(metrics.totalCollected);
            if (totalOutstandingEl) totalOutstandingEl.textContent = money(metrics.totalOutstanding);

            // Show top agent if exists
            if (metrics.topAgent) {
                const topAgentCard = $("topAgentCard");
                if (topAgentCard) {
                    topAgentCard.style.display = "block";
                    
                    const topAgentNameEl = $("topAgentName");
                    const topAgentSalesEl = $("topAgentSales");
                    const topAgentProfitEl = $("topAgentProfit");
                    
                    if (topAgentNameEl) topAgentNameEl.textContent = metrics.topAgent.name;
                    if (topAgentSalesEl) topAgentSalesEl.textContent = metrics.topAgent.totalSales;
                    if (topAgentProfitEl) topAgentProfitEl.textContent = money(metrics.topAgent.totalProfit);
                }
            } else {
                const topAgentCard = $("topAgentCard");
                if (topAgentCard) topAgentCard.style.display = "none";
            }
        } else {
            // No agents, show no data message
            widget.style.display = "block";
            if (noAgentData) noAgentData.style.display = "block";
            
            // Hide top agent card
            const topAgentCard = $("topAgentCard");
            if (topAgentCard) topAgentCard.style.display = "none";
        }
    } catch (error) {
        console.error("Error loading agent metrics:", error);
        // Show no data message on error
        const widget = $("agentMetricsWidget");
        const noAgentData = $("noAgentData");
        
        if (widget) widget.style.display = "block";
        if (noAgentData) noAgentData.style.display = "block";
        
        const topAgentCard = $("topAgentCard");
        if (topAgentCard) topAgentCard.style.display = "none";
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if the application is online
 * @returns {boolean}
 */
function isOnline() {
    return navigator.onLine;
}

/**
 * Log message to console with prefix
 * @param {string} message - Message to log
 */
function log(message) {
    console.log(`[AgentService] ${message}`);
}

// ============================================================================
// AGENT ASSIGNMENT FUNCTIONS (CONSIGNMENT)
// ============================================================================

/**
 * Open modal to assign product to agent
 */
function openAssignProductModal() {
    const DB = getDB();
    const currentUser = getCurrentUser();

    // Get agents for the user's store
    const agents = (DB.agents || []).filter(a => 
        a.active !== false && 
        (currentUser.role === "admin" || a.store_id === currentUser.storeId)
    );

    // Get variants available in the user's store
    const variants = DB.variants.filter(v => 
        v.is_active && 
        v.qty > 0 && 
        (currentUser.role === "admin" || v.store_id === currentUser.storeId)
    );

    const html = `
        <form id="assignProductForm">
            <div class="form-group">
                <label>Agent *</label>
                <select class="form-input" id="assignAgent" required>
                    <option value="">Select Agent...</option>
                    ${agents.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Product *</label>
                <select class="form-input" id="assignVariant" required>
                    <option value="">Select Product...</option>
                    ${variants.map(v => {
                        const product = DB.products.find(p => p.id === v.product_id);
                        return `<option value="${v.id}" data-price="${v.price || 0}" data-product="${esc(product?.name || '')}" data-sku="${esc(v.sku || '')}" data-variant="${esc(`${v.color || ''} ${v.storage || ''}`)}">
                            ${esc(product?.name || 'Unknown')} - ${esc(v.color || '')} ${esc(v.storage || '')} - ${money(v.price || 0)}
                        </option>`;
                    }).join('')}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Agreed Amount (K) *</label>
                    <input type="number" class="form-input" id="assignAmount" required min="0" step="0.01">
                </div>
                <div class="form-group">
                    <label>Due Date *</label>
                    <input type="date" class="form-input" id="assignDueDate" required>
                </div>
            </div>
            <div class="form-group">
                <label>Quantity *</label>
                <input type="number" class="form-input" id="assignQty" value="1" min="1" required>
            </div>
        </form>
    `;

    openModal(
        "Assign Product to Agent",
        html,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="confirmAssignBtn">
                <i class="fas fa-check"></i> Assign Product
            </button>
        `
    );

    // Set default due date to 7 days from now
    const dueDateInput = document.getElementById("assignDueDate");
    if (dueDateInput) {
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 7);
        dueDateInput.value = defaultDate.toISOString().split('T')[0];
    }

    // Handle variant selection to auto-fill agreed amount
    const variantSelect = document.getElementById("assignVariant");
    const amountInput = document.getElementById("assignAmount");
    if (variantSelect && amountInput) {
        variantSelect.addEventListener("change", () => {
            const selectedOption = variantSelect.selectedOptions[0];
            if (selectedOption) {
                amountInput.value = selectedOption.dataset.price || '';
            }
        });
    }

    const confirmBtn = document.getElementById("confirmAssignBtn");
    if (confirmBtn) {
        confirmBtn.addEventListener("click", assignProductToAgent);
    }
}

/**
 * Assign product to agent
 */
async function assignProductToAgent() {
    const DB = getDB();
    const sb = getSupabase();
    const currentUser = getCurrentUser();

    const agentId = document.getElementById("assignAgent").value;
    const variantId = document.getElementById("assignVariant").value;
    const agreedAmount = parseFloat(document.getElementById("assignAmount").value) || 0;
    const dueDate = document.getElementById("assignDueDate").value;
    const qty = parseInt(document.getElementById("assignQty").value) || 1;

    if (!agentId || !variantId || !agreedAmount || !dueDate) {
        toast("Please fill in all required fields", "error");
        return;
    }

    const variant = DB.variants.find(v => v.id === variantId);
    const product = DB.products.find(p => p.id === variant?.product_id);
    const agent = DB.agents?.find(a => a.id === agentId);

    if (!variant || !product || !agent) {
        toast("Variant, product, or agent not found", "error");
        return;
    }

    if (variant.qty < qty) {
        toast(`Insufficient stock. Only ${variant.qty} available.`, "error");
        return;
    }

    try {
        const storeId = agent.store_id || currentUser.storeId || STORE1_ID;

        // Create assignment record
        const assignmentData = {
            id: uid(),
            agent_id: agentId,
            store_id: storeId,
            product_id: product.id,
            variant_id: variantId,
            sku: variant.sku,
            product_name: product.name,
            variant_label: `${variant.color || ''} ${variant.storage || ''}`.trim(),
            qty: qty,
            agreed_amount: agreedAmount,
            date_taken: today(),
            due_date: dueDate,
            status: 'active',
            created_at: now(),
            updated_at: now()
        };

        // Save to Supabase (if online)
        if (sb) {
            try {
                const { error: assignError } = await sb.from("agent_assignments").insert([assignmentData]);
                if (assignError) throw assignError;
            } catch (supabaseError) {
                console.error("Supabase assignment save failed, saving locally:", supabaseError);
                // Save to IndexedDB for offline sync
                const offlineDB = window.offlineDB;
                if (offlineDB) {
                    try {
                        await offlineDB.put('agent_assignments', assignmentData);
                        await offlineDB.queueOperation('create', 'agent_assignments', assignmentData, assignmentData.id);
                        console.log("Assignment saved to offline DB for sync");
                    } catch (offlineError) {
                        console.error("Offline DB save failed:", offlineError);
                        throw offlineError;
                    }
                }
            }
        }

        // Save to local DB (always, regardless of Supabase success)
        if (!DB.agentAssignments) DB.agentAssignments = [];
        DB.agentAssignments.unshift(assignmentData);

        // Deduct from inventory
        const newQty = variant.qty - qty;
        const variantUpdate = {
            qty: newQty,
            updated_at: now()
        };

        if (sb) {
            try {
                const { error: variantError } = await sb.from("variants").update(variantUpdate).eq("id", variantId);
                if (variantError) throw variantError;
            } catch (supabaseError) {
                console.error("Supabase variant update failed, queueing for sync:", supabaseError);
                // Queue for offline sync
                const offlineDB = window.offlineDB;
                if (offlineDB) {
                    await offlineDB.queueOperation('update', 'variants', variantUpdate, variantId);
                }
            }
        }

        // Always update local variant
        const variantIndex = DB.variants.findIndex(v => v.id === variantId);
        if (variantIndex !== -1) {
            DB.variants[variantIndex].qty = newQty;
        }

        toast(`Successfully assigned ${qty}x ${product.name} to ${agent.name}`, "success");
        closeModal();
        renderAgents(); // Refresh to show new assignment
    } catch (error) {
        console.error("Error assigning product to agent:", error);
        toast("Failed to assign product: " + error.message, "error");
    }
}

/**
 * Extend due date for assignment
 */
async function extendAgentDueDate(assignmentId) {
    const DB = getDB();
    const sb = getSupabase();

    const assignment = DB.agentAssignments?.find(a => a.id === assignmentId);
    if (!assignment) {
        toast("Assignment not found", "error");
        return;
    }

    const newDueDate = prompt("Enter new due date (YYYY-MM-DD):", assignment.due_date);
    if (!newDueDate) return;

    try {
        const updates = {
            extended_due_date: newDueDate,
            status: 'extended',
            updated_at: now()
        };

        if (sb) {
            const { error } = await sb.from("agent_assignments").update(updates).eq("id", assignmentId);
            if (error) throw error;
        }

        // Update local DB
        const index = DB.agentAssignments.findIndex(a => a.id === assignmentId);
        if (index !== -1) {
            DB.agentAssignments[index] = { ...DB.agentAssignments[index], ...updates };
        }

        toast("Due date extended successfully", "success");
        renderAgentAssignments();
    } catch (error) {
        console.error("Error extending due date:", error);
        toast("Failed to extend due date: " + error.message, "error");
    }
}

/**
 * Complete agent assignment
 */
async function completeAgentAssignment(assignmentId) {
    const DB = getDB();
    const sb = getSupabase();
    const currentUser = getCurrentUser();

    const assignment = DB.agentAssignments?.find(a => a.id === assignmentId);
    if (!assignment) {
        toast("Assignment not found", "error");
        return;
    }

    if (!confirm(`Mark this assignment as completed? This will record a sale of ${money(assignment.agreed_amount)}.`)) {
        return;
    }

    try {
        // Create sales record for the completed assignment
        const receiptNumber = "AGENT-" + String((DB.sales || []).length + 1).padStart(5, "0");
        const saleData = {
            id: uid(),
            store_id: assignment.store_id,
            user_id: currentUser.id,
            user_name: currentUser.name,
            receipt_number: receiptNumber,
            product_name: assignment.product_name,
            sku: assignment.sku,
            variant_label: assignment.variant_label,
            quantity: assignment.qty,
            unit_price: assignment.agreed_amount / assignment.qty,
            cost_price: 0, // Cost price unknown for agent sales
            subtotal: assignment.agreed_amount,
            discount: 0,
            total: assignment.agreed_amount,
            profit: assignment.agreed_amount, // Assume full amount is profit
            commission_rate: 0,
            payment_method: "agent",
            customer_name: `Agent: ${assignment.agent_id}`,
            identifier: assignment.id,
            date_str: today(),
            created_at: now()
        };

        // Save sale to Supabase (if online)
        if (sb) {
            try {
                const { error: saleError } = await sb.from("sales").insert([saleData]);
                if (saleError) throw saleError;
            } catch (supabaseError) {
                console.error("Supabase sale save failed, saving locally:", supabaseError);
                // Save to IndexedDB for offline sync
                const offlineDB = window.offlineDB;
                if (offlineDB) {
                    try {
                        await offlineDB.put('sales', saleData);
                        await offlineDB.queueOperation('create', 'sales', saleData, saleData.id);
                        console.log("Agent sale saved to offline DB for sync");
                    } catch (offlineError) {
                        console.error("Offline DB save failed:", offlineError);
                    }
                }
            }
        }

        // Save sale to local DB (always, regardless of Supabase success)
        if (!DB.sales) DB.sales = [];
        DB.sales.unshift(saleData);

        // Save sale to local DB
        if (!DB.sales) DB.sales = [];
        DB.sales.unshift(saleData);

        // Update assignment status
        const updates = {
            status: 'completed',
            completed_at: now(),
            payment_date: today(),
            updated_at: now()
        };

        if (sb) {
            try {
                const { error: assignError } = await sb.from("agent_assignments").update(updates).eq("id", assignmentId);
                if (assignError) throw assignError;
            } catch (supabaseError) {
                console.error("Supabase assignment update failed, queueing for sync:", supabaseError);
                // Queue for offline sync
                const offlineDB = window.offlineDB;
                if (offlineDB) {
                    await offlineDB.queueOperation('update', 'agent_assignments', updates, assignmentId);
                }
            }
        }

        // Update local assignment (always, regardless of Supabase success)
        const index = DB.agentAssignments.findIndex(a => a.id === assignmentId);
        if (index !== -1) {
            DB.agentAssignments[index] = { ...DB.agentAssignments[index], ...updates };
        }

        toast("Assignment completed and sale recorded", "success");
        renderAgentAssignments();
    } catch (error) {
        console.error("Error completing assignment:", error);
        toast("Failed to complete assignment: " + error.message, "error");
    }
}

/**
 * Return product from agent (when agent can't sell it)
 */
async function returnAgentProduct(assignmentId) {
    const DB = getDB();
    const sb = getSupabase();
    const currentUser = getCurrentUser();

    const assignment = DB.agentAssignments?.find(a => a.id === assignmentId);
    if (!assignment) {
        toast("Assignment not found", "error");
        return;
    }

    if (assignment.status !== 'active') {
        toast("Only active assignments can be returned", "error");
        return;
    }

    const agent = DB.agents?.find(a => a.id === assignment.agent_id);
    const variant = DB.variants.find(v => v.id === assignment.variant_id);
    const product = DB.products.find(p => p.id === variant?.product_id);

    if (!agent || !variant || !product) {
        toast("Agent, product, or variant not found", "error");
        return;
    }

    // Check return period (30 days from assignment)
    const assignmentDate = new Date(assignment.date_taken);
    const returnDeadline = new Date(assignmentDate);
    returnDeadline.setDate(returnDeadline.getDate() + 30);
    const isWithinReturnPeriod = new Date() <= returnDeadline;

    // Open return modal
    openModal(
        `Return Product - ${product.name}`,
        `
            <div style="padding: 20px;">
                <div style="background: var(--bg); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="font-weight: 600; margin-bottom: 8px;">Assignment Details:</div>
                    <div style="font-size: 13px; color: var(--tx2);">
                        <div>Product: <strong>${esc(product.name)}</strong></div>
                        <div>Agent: ${esc(agent.name)}</div>
                        <div>Quantity: ${assignment.qty}</div>
                        <div>Assigned: ${assignment.date_taken}</div>
                        <div>Agreed Amount: ${money(assignment.agreed_amount)}</div>
                    </div>
                </div>

                ${!isWithinReturnPeriod ? `
                    <div style="background: var(--wn2); padding: 12px; border-radius: 6px; border-left: 3px solid var(--wn); margin-bottom: 16px;">
                        <p style="font-size: 13px; color: var(--wn);">
                            <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                            Return period expired (30 days from ${assignment.date_taken})
                        </p>
                    </div>
                ` : ''}

                <div class="form-group">
                    <label>Return Reason *</label>
                    <select class="form-input" id="returnReason" required>
                        <option value="">Select reason...</option>
                        <option value="unsold">Could not sell product</option>
                        <option value="damaged">Product damaged while with agent</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Product Condition *</label>
                    <select class="form-input" id="returnCondition" required>
                        <option value="">Select condition...</option>
                        <option value="new">Same as when taken (new)</option>
                        <option value="damaged">Damaged</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Penalty Fee (K)</label>
                    <input type="number" class="form-input" id="penaltyFee" placeholder="Optional penalty amount" min="0" step="0.01">
                    <div style="font-size: 12px; color: var(--tx2); margin-top: 4px;">Optional - charges agent for return</div>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="confirmBalanceDeduction" checked>
                        Deduct from agent balance/credit limit
                    </label>
                </div>
            </div>
        `,
        `
            <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="confirmReturnBtn">
                <i class="fas fa-undo"></i> Confirm Return
            </button>
        `
    );

    // Setup confirm button
    const confirmBtn = document.getElementById('confirmReturnBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => processReturn(assignment, agent, variant, product));
    }
}

/**
 * Process the return transaction
 */
async function processReturn(assignment, agent, variant, product) {
    const DB = getDB();
    const sb = getSupabase();
    const currentUser = getCurrentUser();

    const returnReason = document.getElementById('returnReason').value;
    const returnCondition = document.getElementById('returnCondition').value;
    const penaltyFee = parseFloat(document.getElementById('penaltyFee').value) || 0;
    const confirmBalanceDeduction = document.getElementById('confirmBalanceDeduction').checked;

    if (!returnReason || !returnCondition) {
        toast("Please select return reason and condition", "error");
        return;
    }

    try {
        // Only restore inventory if product is in acceptable condition
        const canRestoreInventory = returnCondition === 'new';
        
        if (canRestoreInventory) {
            // Restore inventory
            const newQty = variant.qty + assignment.qty;
            const variantUpdate = {
                qty: newQty,
                updated_at: now()
            };

            if (sb) {
                try {
                    const { error: variantError } = await sb.from("variants").update(variantUpdate).eq("id", variant.id);
                    if (variantError) throw variantError;
                } catch (supabaseError) {
                    console.error("Supabase variant update failed, queueing for sync:", supabaseError);
                    // Queue for offline sync
                    const offlineDB = window.offlineDB;
                    if (offlineDB) {
                        await offlineDB.queueOperation('update', 'variants', variantUpdate, variant.id);
                    }
                }
            }

            // Update local variant
            const variantIndex = DB.variants.findIndex(v => v.id === variant.id);
            if (variantIndex !== -1) {
                DB.variants[variantIndex].qty = newQty;
            }
        }

        // Calculate balance/credit limit impact
        let balanceDeduction = 0;
        if (confirmBalanceDeduction && returnCondition === 'damaged') {
            balanceDeduction = penaltyFee + assignment.agreed_amount;
        } else if (confirmBalanceDeduction && penaltyFee > 0) {
            balanceDeduction = penaltyFee;
        }

        // Update agent balance if needed
        if (balanceDeduction > 0 && agent) {
            const newBalance = (agent.balance || 0) + balanceDeduction;
            const agentUpdate = {
                balance: newBalance,
                updated_at: now()
            };

            if (sb) {
                try {
                    const { error: agentError } = await sb.from("agents").update(agentUpdate).eq("id", agent.id);
                    if (agentError) throw agentError;
                } catch (supabaseError) {
                    console.error("Supabase agent update failed, queueing for sync:", supabaseError);
                    const offlineDB = window.offlineDB;
                    if (offlineDB) {
                        await offlineDB.queueOperation('update', 'agents', agentUpdate, agent.id);
                    }
                }
            }

            // Update local agent
            const agentIndex = DB.agents.findIndex(a => a.id === agent.id);
            if (agentIndex !== -1) {
                DB.agents[agentIndex].balance = newBalance;
            }
        }

        // Update assignment status
        const updates = {
            status: 'returned',
            returned_at: now(),
            return_reason: returnReason,
            return_condition: returnCondition,
            penalty_fee: penaltyFee,
            balance_impact: balanceDeduction,
            updated_at: now()
        };

        if (sb) {
            try {
                const { error: assignError } = await sb.from("agent_assignments").update(updates).eq("id", assignment.id);
                if (assignError) throw assignError;
            } catch (supabaseError) {
                console.error("Supabase assignment update failed, queueing for sync:", supabaseError);
                const offlineDB = window.offlineDB;
                if (offlineDB) {
                    await offlineDB.queueOperation('update', 'agent_assignments', updates, assignment.id);
                }
            }
        }

        // Update local assignment
        const index = DB.agentAssignments.findIndex(a => a.id === assignment.id);
        if (index !== -1) {
            DB.agentAssignments[index] = { ...DB.agentAssignments[index], ...updates };
        }

        toast(
            `Product returned successfully. ${canRestoreInventory ? 'Inventory restored.' : 'Inventory not restored (damaged product)'} ${balanceDeduction > 0 ? `Balance deduction: ${money(balanceDeduction)}` : ''}`,
            "success"
        );
        closeModal();
        renderAgentAssignments();
    } catch (error) {
        toast("Failed to process return: " + error.message, "error");
    }
}

/**
 * Render agent assignments section
 */
function renderAgentAssignments() {
    const DB = getDB();
    const currentUser = getCurrentUser();
    const container = document.getElementById("agentAssignmentsContainer");
    if (!container) return;

    // Filter assignments by user's store
    const assignments = (DB.agentAssignments || []).filter(a => 
        currentUser.role === "admin" || a.store_id === currentUser.storeId
    );

    const activeAssignments = assignments.filter(a => a.status !== 'completed' && a.status !== 'returned');
    const completedAssignments = assignments.filter(a => a.status === 'completed');
    const returnedAssignments = assignments.filter(a => a.status === 'returned');

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3>Active Assignments</h3>
                <button class="btn btn-sm btn-primary" onclick="window.agentsService.openAssignProductModal()">
                    <i class="fas fa-plus"></i> Assign Product
                </button>
            </div>
            <div class="card-body np">
                ${activeAssignments.length === 0 ? `
                    <div style="padding:40px;text-align:center;color:var(--tx2)">
                        <i class="fas fa-inbox" style="font-size:32px;margin-bottom:12px;opacity:0.3"></i>
                        <p>No active assignments</p>
                    </div>
                ` : `
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Agent</th>
                                <th>Date Taken</th>
                                <th>Due Date</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeAssignments.map(a => {
                                const agent = DB.agents?.find(ag => ag.id === a.agent_id);
                                return `
                                    <tr>
                                        <td>
                                            <strong>${esc(a.product_name)}</strong>
                                            <div style="font-size:12px;color:var(--tx2)">${esc(a.variant_label)}</div>
                                        </td>
                                        <td>${esc(agent?.name || 'Unknown')}</td>
                                        <td>${a.date_taken}</td>
                                        <td>${a.extended_due_date || a.due_date}</td>
                                        <td style="font-weight:700">${money(a.agreed_amount)}</td>
                                        <td>
                                            <span class="badge ${a.status === 'extended' ? 'badge-orange' : 'badge-green'}">
                                                ${a.status === 'extended' ? 'Extended' : 'Active'}
                                            </span>
                                        </td>
                                        <td>
                                            <button class="btn btn-sm btn-outline" onclick="window.agentsService.extendAgentDueDate('${a.id}')" title="Extend Due Date">
                                                <i class="fas fa-clock"></i>
                                            </button>
                                            <button class="btn btn-sm btn-outline" onclick="window.agentsService.returnAgentProduct('${a.id}')" title="Return Product">
                                                <i class="fas fa-undo"></i>
                                            </button>
                                            <button class="btn btn-sm btn-primary" onclick="window.agentsService.completeAgentAssignment('${a.id}')" title="Complete Assignment">
                                                <i class="fas fa-check"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        </div>

        <div class="card" style="margin-top:20px">
            <div class="card-header">
                <h3>Completed Assignments</h3>
            </div>
            <div class="card-body np">
                ${completedAssignments.length === 0 ? `
                    <div style="padding:40px;text-align:center;color:var(--tx2)">
                        <i class="fas fa-check-circle" style="font-size:32px;margin-bottom:12px;opacity:0.3"></i>
                        <p>No completed assignments</p>
                    </div>
                ` : `
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Agent</th>
                                <th>Date Taken</th>
                                <th>Completed</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${completedAssignments.map(a => {
                                const agent = DB.agents?.find(ag => ag.id === a.agent_id);
                                return `
                                    <tr>
                                        <td>
                                            <strong>${esc(a.product_name)}</strong>
                                            <div style="font-size:12px;color:var(--tx2)">${esc(a.variant_label)}</div>
                                        </td>
                                        <td>${esc(agent?.name || 'Unknown')}</td>
                                        <td>${a.date_taken}</td>
                                        <td>${a.completed_at ? new Date(a.completed_at).toLocaleDateString() : '-'}</td>
                                        <td style="font-weight:700">${money(a.agreed_amount)}</td>
                                        <td>
                                            <span class="badge badge-green">Completed</span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `}
            </div>

        <div class="card" style="margin-top:20px">
            <div class="card-header">
                <h3>Returned Assignments</h3>
            </div>
            <div class="card-body np">
                ${returnedAssignments.length === 0 ? `
                    <div style="padding:40px;text-align:center;color:var(--tx2)">
                        <i class="fas fa-undo" style="font-size:32px;margin-bottom:12px;opacity:0.3"></i>
                        <p>No returned assignments</p>
                    </div>
                ` : `
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Agent</th>
                                <th>Date Taken</th>
                                <th>Returned</th>
                                <th>Reason</th>
                                <th>Condition</th>
                                <th>Penalty</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${returnedAssignments.map(a => {
                                const agent = DB.agents?.find(ag => ag.id === a.agent_id);
                                return `
                                    <tr>
                                        <td>
                                            <strong>${esc(a.product_name)}</strong>
                                            <div style="font-size:12px;color:var(--tx2)">${esc(a.variant_label)}</div>
                                        </td>
                                        <td>${esc(agent?.name || 'Unknown')}</td>
                                        <td>${a.date_taken}</td>
                                        <td>${a.returned_at ? new Date(a.returned_at).toLocaleDateString() : '-'}</td>
                                        <td>
                                            <span class="badge ${a.return_reason === 'damaged' ? 'badge-red' : 'badge-orange'}">
                                                ${a.return_reason === 'damaged' ? 'Damaged' : 'Unsold'}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge ${a.return_condition === 'new' ? 'badge-green' : 'badge-red'}">
                                                ${a.return_condition === 'new' ? 'Same condition' : 'Damaged'}
                                            </span>
                                        </td>
                                        <td>${a.penalty_fee ? money(a.penalty_fee) : '-'}</td>
                                        <td>
                                            <span class="badge badge-gray">Returned</span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        </div>
    `;
}

// Export service functions for global access
const agentsService = {
    renderAgents,
    calculateCommission,
    handleAgentPaymentMethod,
    showAgentTransactionForm,
    confirmAgentTransaction,
    renderAgentsGrid,
    openNewAgentModal,
    loadAgentMetrics,
    getGlobalMetrics,
    saveAgent,
    viewAgentDetails,
    editAgent,
    updateAgent,
    openAssignProductModal,
    assignProductToAgent,
    extendAgentDueDate,
    completeAgentAssignment,
    returnAgentProduct,
    renderAgentAssignments
};

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.agentsService = agentsService;
    window.getGlobalMetrics = getGlobalMetrics;
}

export default agentsService;
