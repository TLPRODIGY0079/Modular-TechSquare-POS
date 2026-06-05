/**
 * Agent and Commission Service
 * Handles agent management, commission calculations, and agent transactions
 */

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
                        "commissionRecords",
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
                                "commissionRecords",
                                commissionRecord,
                            );
                        }
                    }
                } else {
                    // Queue for sync when online
                    if (offlineDB) {
                        await offlineDB.queueOperation(
                            "create",
                            "commissionRecords",
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
    // Import renderTopbarActions dynamically to avoid circular dependency
    const { renderTopbarActions } = await import('../app.js');

    renderTopbarActions(
        `<button class="btn btn-primary btn-sm" id="newAgentBtn"><i class="fas fa-plus"></i> New Agent</button>`,
    );

    $("mainContent").innerHTML = `<div class="fade-in">
    <div style="text-align: center; padding: 60px; color: var(--tx2)">
      <i class="fas fa-user-tie" style="font-size: 48px; margin-bottom: 16px"></i>
      <h3>Agent System</h3>
      <p>Agent management system is being configured.</p>
      <p style="margin-top: 16px; font-size: 13px; color: var(--tx3)">
        This feature will be available once the agent system is fully set up.
      </p>
    </div>
  </div>`;

    // Simple event listener for new agent button
    setTimeout(() => {
        const newBtn = $("newAgentBtn");
        if (newBtn) {
            newBtn.addEventListener("click", () => {
                toast("Agent system is being configured", "info");
            });
        }
    }, 100);
}

/**
 * Render the agents grid
 * @param {Array} agents - Array of agent objects
 */
export async function renderAgentsGrid(agents) {
    const grid = $("agentsGrid");
    if (!grid) return;

    // Agent system temporarily disabled
    grid.innerHTML = `
    <div style="text-align:center;padding:40px;color:var(--tx2)">
      <i class="fas fa-user-tie" style="font-size:48px;margin-bottom:16px;opacity:0.3"></i>
      <h3>Agent System Temporarily Unavailable</h3>
      <p>The agent consignment system is being updated. Please check back later.</p>
    </div>
  `;
}

/**
 * Open new agent modal
 */
export function openNewAgentModal() {
    // Agent system temporarily disabled
    toast("Agent system temporarily unavailable", "info");
}

/**
 * Create a new agent
 */
export async function createAgent() {
    try {
        // Agent system temporarily disabled
        toast("Agent system temporarily unavailable", "info");
        closeModal();
    } catch (error) {
        console.error("Create agent error:", error);
        toast("Error: " + error.message, "error");
    }
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
