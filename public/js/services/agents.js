

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
 * Load agent metrics for dashboard
 * This function relies on getGlobalMetrics from the agent service
 */
export async function loadAgentMetrics() {
    try {
        // Use the fixed agent service functions directly
        if (typeof window.getGlobalMetrics === "undefined") {
            // Agent service not loaded, skip metrics
            log("Agent service not available, skipping metrics");
            return;
        }

        const currentUser = getCurrentUser();

        // Get store context
        const storeId =
            currentUser.role === "admin"
                ? null
                : currentUser.storeId;

        // Load global agent metrics using the global function
        const metrics = await window.getGlobalMetrics(storeId);

        // Show widget if there are agents
        if (metrics.totalAgents > 0) {
            const widget = $("agentMetricsWidget");
            if (widget) {
                widget.style.display = "block";

                // Update metrics
                $("agentTotalOwed").textContent = money(
                    metrics.totalOwed,
                );
                $("agentTotalCollected").textContent = money(
                    metrics.totalCollected,
                );
                $("agentTotalOutstanding").textContent = money(
                    metrics.totalOutstanding,
                );

                // Show top agent if exists
                if (metrics.topAgent) {
                    const topAgentCard = $("topAgentCard");
                    if (topAgentCard) {
                        topAgentCard.style.display = "block";
                        $("topAgentName").textContent =
                            metrics.topAgent.name;
                        $("topAgentSales").textContent =
                            metrics.topAgent.totalSales;
                        $("topAgentProfit").textContent = money(
                            metrics.topAgent.totalProfit,
                        );
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error loading agent metrics:", error);
        // Hide widget on error
        const widget = $("agentMetricsWidget");
        if (widget) {
            widget.style.display = "none";
        }
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

        // Save to Supabase
        if (sb) {
            const { error: assignError } = await sb.from("agent_assignments").insert([assignmentData]);
            if (assignError) throw assignError;
        }

        // Save to local DB
        if (!DB.agentAssignments) DB.agentAssignments = [];
        DB.agentAssignments.unshift(assignmentData);

        // Deduct from inventory
        const newQty = variant.qty - qty;
        const variantUpdate = {
            qty: newQty,
            updated_at: now()
        };

        if (sb) {
            const { error: variantError } = await sb.from("variants").update(variantUpdate).eq("id", variantId);
            if (variantError) throw variantError;
        }

        // Update local variant
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

        // Save sale to Supabase
        if (sb) {
            const { error: saleError } = await sb.from("sales").insert([saleData]);
            if (saleError) throw saleError;
        }

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
            const { error: assignError } = await sb.from("agent_assignments").update(updates).eq("id", assignmentId);
            if (assignError) throw assignError;
        }

        // Update local assignment
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

    const activeAssignments = assignments.filter(a => a.status !== 'completed');
    const completedAssignments = assignments.filter(a => a.status === 'completed');

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
    saveAgent,
    viewAgentDetails,
    editAgent,
    updateAgent,
    openAssignProductModal,
    assignProductToAgent,
    extendAgentDueDate,
    completeAgentAssignment,
    renderAgentAssignments
};

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.agentsService = agentsService;
}

export default agentsService;
