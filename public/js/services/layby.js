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

    mainContent.innerHTML = `<div class="fade-in">
    <div class="tabs" id="laybyTabs">
      <div class="tab active" data-tab="active">Active</div>
      <div class="tab" data-tab="completed">Completed</div>
      <div class="tab" data-tab="all">All</div>
    </div>
    <div id="laybyContent"></div>
  </div>`;

    $("laybyTabs")
        .querySelectorAll(".tab")
        .forEach((t) =>
            t.addEventListener("click", () => {
                $("laybyTabs")
                    .querySelectorAll(".tab")
                    .forEach((x) => x.classList.remove("active"));
                t.classList.add("active");
                renderLaybyTable(t.dataset.tab);
            }),
        );

    const newLaybyBtn = document.createElement("button");
    newLaybyBtn.className = "btn btn-primary btn-sm";
    newLaybyBtn.id = "newLaybyBtn";
    newLaybyBtn.innerHTML = '<i class="fas fa-plus"></i> New Layby';
    newLaybyBtn.addEventListener("click", openNewLaybyModal);
    
    const topbar = document.querySelector(".topbar-actions");
    if (topbar) {
        topbar.innerHTML = "";
        topbar.appendChild(newLaybyBtn);
    }

    renderLaybyTable("active");
}

// Render layby table
function renderLaybyTable(filter) {
    const DB = getDB();
    let laybys = DB.laybys || [];
    if (filter === "active")
        laybys = laybys.filter((l) => l.status === "active");
    if (filter === "completed")
        laybys = laybys.filter((l) => l.status === "completed");

    const c = $("laybyContent");
    if (!c) return;

    c.innerHTML = `<div class="card"><div class="card-body np"><table>
    <thead><tr><th>Layby #</th><th>Customer</th><th>Product</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${
        laybys
            .map((l) => {
                const balanceColor = l.balance > 0 ? "wn" : "gn";
                const statusBadge =
                    l.status === "active"
                        ? "orange"
                        : l.status === "completed"
                          ? "green"
                          : "gray";
                const laybyNumber = l.layby_number || `LB-${String(l.id || '').slice(0, 8)}`;
                return `<tr>
      <td><span class="badge badge-blue">${laybyNumber}</span></td>
      <td><div style="font-weight:600">${esc(l.customer_name)}</div><div style="font-size:11px;color:var(--tx2)">${esc(l.customer_phone || "—")}</div></td>
      <td style="font-weight:600">${esc(l.product_name)}</td>
      <td>${money(l.total_price)}</td>
      <td style="color:var(--gn);font-weight:700">${money(l.amount_paid)}</td>
      <td style="color:var(--${balanceColor});font-weight:700">${money(l.balance)}</td>
      <td><span class="badge badge-${statusBadge}">${l.status}</span></td>
      <td>
        ${l.status === "active" ? `<button class="btn btn-ghost btn-sm pay-layby" data-id="${l.id}"><i class="fas fa-money-bill"></i> Pay</button>` : ""}
        <button class="btn btn-ghost btn-sm view-layby" data-id="${l.id}"><i class="fas fa-eye"></i></button>
      </td>
    </tr>`;
            })
            .join("") ||
        '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--tx3)">No layby transactions</td></tr>'
    }</tbody>
  </table></div></div>`;

    c.querySelectorAll(".pay-layby").forEach((b) =>
        b.addEventListener("click", () =>
            openPaymentModal(b.dataset.id),
        ),
    );
    c.querySelectorAll(".view-layby").forEach((b) =>
        b.addEventListener("click", () =>
            viewLaybyDetails(b.dataset.id),
        ),
    );
}

// Open new layby modal
function openNewLaybyModal() {
    const DB = getDB();
    const user = getCurrentUser();
    const variants = DB.variants.filter((v) => v.is_active !== false && v.qty > 0);

    openModal(
        "New Layby",
        `
    <div class="form-group"><label>Customer Name *</label><input class="form-input" id="lbCustName" required></div>
    <div class="form-group"><label>Customer Phone</label><input class="form-input" id="lbCustPhone" type="tel"></div>
    <div class="form-group"><label>Product *</label>
      <select class="form-input" id="lbVariant" required>
        <option value="">Select product...</option>
        ${variants.map((v) => `<option value="${v.id}" data-price="${v.sale_price || v.price || 0}">${esc(v.product_name)} - ${v.color || ""} ${v.storage || ""} (${money(v.sale_price || v.price || 0)})</option>`).join("")}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Total Price (K) *</label><input class="form-input" id="lbTotal" type="number" step="0.01" readonly></div>
      <div class="form-group"><label>Initial Payment (K) *</label><input class="form-input" id="lbInitial" type="number" step="0.01" min="0" required></div>
    </div>
    <div class="form-group"><label>Notes</label><textarea class="form-input" id="lbNotes" rows="2"></textarea></div>
    <div style="background:var(--bg);padding:12px;border-radius:8px;margin-top:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Total:</span><span id="lbTotalShow">—</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Initial Payment:</span><span id="lbInitialShow">—</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700;padding-top:8px;border-top:1px solid var(--bd)"><span>Balance:</span><span id="lbBalanceShow">—</span></div>
    </div>`,
        `<button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary btn-sm" id="createLaybyBtn">Create Layby</button>`,
    );

    setTimeout(() => {
        $("lbVariant").addEventListener("change", () => {
            const sel = $("lbVariant");
            const price = parseFloat(
                sel.options[sel.selectedIndex]?.dataset.price || 0,
            );
            $("lbTotal").value = price;
            updateLaybySummary();
        });
        $("lbInitial").addEventListener(
            "input",
            updateLaybySummary,
        );
        $("createLaybyBtn").addEventListener("click", createLayby);
    }, 50);
}

// Update layby summary
function updateLaybySummary() {
    const total = parseFloat($("lbTotal").value) || 0;
    const initial = parseFloat($("lbInitial").value) || 0;
    const balance = Math.max(0, total - initial);
    $("lbTotalShow").textContent = money(total);
    $("lbInitialShow").textContent = money(initial);
    $("lbBalanceShow").textContent = money(balance);
}

// Create layby
async function createLayby() {
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();
    
    const custName = $("lbCustName").value.trim();
    const custPhone = $("lbCustPhone").value.trim();
    const variantId = $("lbVariant").value;
    const total = parseFloat($("lbTotal").value) || 0;
    const initial = parseFloat($("lbInitial").value) || 0;
    const notes = $("lbNotes").value.trim();

    if (!custName || !variantId || total <= 0) {
        toast("Please fill required fields", "error");
        return;
    }
    if (initial < 0 || initial > total) {
        toast("Invalid initial payment", "error");
        return;
    }

    const variant = DB.variants.find((v) => v.id === variantId);
    if (!variant) {
        toast("Product not found", "error");
        return;
    }

    const laybyNo = "LB-" + String((DB.laybys || []).length + 1).padStart(5, "0");
    const balance = total - initial;

    try {
        const laybyData = {
            layby_number: laybyNo,
            id: uid(),
            store_id: user?.storeId || STORE1_ID,
            user_id: user?.id,
            user_name: user?.name,
            customer_name: custName,
            customer_phone: custPhone,
            product_name: variant.product_name,
            variant_id: variantId,
            total_price: total,
            deposit_amount: initial,
            amount_paid: initial,
            balance: balance,
            status: balance > 0 ? "active" : "completed",
            notes: notes,
            created_at: now(),
            updated_at: now(),
            completed_at: balance <= 0 ? now() : null,
        };

        if (sb) {
            const { data: layby, error } = await sb
                .from("layby_transactions")
                .insert([laybyData])
                .select()
                .single();
            if (error) throw error;

            // Record initial payment if any
            if (initial > 0) {
                await sb.from("layby_payments").insert([
                    {
                        id: uid(),
                        layby_id: layby.id,
                        amount: initial,
                        payment_method: "cash",
                        user_id: user?.id,
                        user_name: user?.name,
                        notes: "Initial payment",
                        created_at: now()
                    },
                ]);
            }
        }

        DB.laybys.unshift(laybyData);
        await closeModal();
        renderLayby();
        toast(`Layby created: ${laybyNo}`, "success");
    } catch (err) {
        console.error("Layby creation error:", err);
        toast("Error: " + err.message, "error");
    }
}

// Open payment modal
function openPaymentModal(laybyId) {
    const DB = getDB();
    const layby = DB.laybys.find((l) => l.id === laybyId);
    if (!layby) {
        toast("Layby not found", "error");
        return;
    }

    openModal(
        "Record Payment — " + (layby.layby_number || layby.id),
        `
    <div style="background:var(--bg);padding:16px;border-radius:8px;margin-bottom:16px">
      <div style="font-weight:600;margin-bottom:8px">${esc(layby.customer_name)}</div>
      <div style="font-size:13px;color:var(--tx2)">${esc(layby.product_name)}</div>
      <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--bd)">
        <span>Balance Due:</span>
        <span style="font-weight:700;font-size:18px;color:var(--wn)">${money(layby.balance)}</span>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Payment Amount (K) *</label><input class="form-input" id="payAmt" type="number" step="0.01" min="0" max="${layby.balance}" value="${layby.balance}"></div>
      <div class="form-group"><label>Payment Method</label>
      <select class="form-input" id="payMethod">
        <option value="cash">Cash</option>
        <option value="card">Card</option>
        <option value="mobile_money">Mobile Money</option>
        <option value="bank_transfer">Bank Transfer</option>
      </select>
    </div>
    <div class="form-group"><label>Notes</label><input class="form-input" id="payNotes"></input>`,
        `<button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
     <button class="btn btn-success btn-sm" id="recordPayBtn"><i class="fas fa-check"></i> Record Payment</button>`,
    );

    setTimeout(() => {
        $("recordPayBtn").addEventListener("click", () =>
            recordLaybyPayment(laybyId),
        );
    }, 50);
}

// Record layby payment
async function recordLaybyPayment(laybyId) {
    const DB = getDB();
    const sb = getSupabase();
    const user = getCurrentUser();
    
    const layby = DB.laybys.find((l) => l.id === laybyId);
    if (!layby) {
        toast("Layby not found", "error");
        return;
    }

    const amount = parseFloat($("payAmt").value) || 0;
    const method = $("payMethod").value;
    const notes = $("payNotes").value.trim();

    if (amount <= 0 || amount > layby.balance) {
        toast("Invalid payment amount", "error");
        return;
    }

    const newBalance = layby.balance - amount;
    const newPaid = layby.amount_paid + amount;
    const isComplete = newBalance <= 0;

    try {
        // Record payment
        if (sb) {
            await sb.from("layby_payments").insert([
                {
                    id: uid(),
                    layby_id: laybyId,
                    amount: amount,
                    payment_method: method,
                    user_id: user?.id,
                    user_name: user?.name,
                    notes: notes,
                    created_at: now()
                },
            ]);
        }

        // Update layby
        const updates = {
            amount_paid: newPaid,
            balance: newBalance,
            status: isComplete ? "completed" : "active",
            updated_at: now(),
            completed_at: isComplete ? now() : null,
        };
        
        if (sb) {
            await sb
                .from("layby_transactions")
                .update(updates)
                .eq("id", laybyId);
        }

        const laybyIndex = DB.laybys.findIndex((l) => l.id === laybyId);
        if (laybyIndex !== -1) {
            DB.laybys[laybyIndex] = { ...DB.laybys[laybyIndex], ...updates };
        }

        // FIX: On completion — create sale record and reduce inventory
        if (isComplete && sb) {
            const variant = DB.variants.find(
                (v) => v.id === layby.variant_id,
            );
            const receiptNo = "LB-SALE-" + Date.now().toString(36).toUpperCase();
            const storeId = layby.store_id || user?.storeId || STORE1_ID;

            // Create sale record so it appears in sales history
            const saleData = {
                id: uid(),
                store_id: storeId,
                user_id: user?.id,
                user_name: user?.name,
                receipt_number: receiptNo,
                product_name: layby.product_name,
                sku: variant?.sku || "LAYBY",
                variant_label: variant
                    ? `${variant.color || ""} ${variant.storage || ""}`.trim()
                    : "",
                quantity: 1,
                unit_price: layby.total_price,
                cost_price: variant?.cost_price || 0,
                subtotal: layby.total_price,
                discount: 0,
                total: layby.total_price,
                profit: layby.total_price - (variant?.cost_price || 0),
                commission_rate: variant?.commission_rate || 0,
                payment_method: method,
                customer_name: layby.customer_name || "Layby Customer",
                identifier: null,
                date_str: today(),
                created_at: now(),
            };

            const { error: saleErr } = await sb
                .from("sales")
                .insert([saleData]);
            if (saleErr)
                console.error(
                    "Layby sale record error:",
                    saleErr,
                );
            
            DB.sales.unshift(saleData);

            // Reduce variant stock by 1
            if (variant) {
                const newQty = Math.max(0, (variant.qty || 0) - 1);
                const variantUpdate = {
                    qty: newQty,
                    updated_at: now(),
                };
                const { error: vErr } = await sb
                    .from("variants")
                    .update(variantUpdate)
                    .eq("id", variant.id);
                if (vErr)
                    console.error(
                        "Layby variant qty error:",
                        vErr,
                    );

                // Update in-memory
                const vIdx = DB.variants.findIndex(
                    (x) => x.id === variant.id,
                );
                if (vIdx !== -1) {
                    DB.variants[vIdx].qty = newQty;
                }
            }
        }

        await closeModal();
        renderLayby();
        toast(
            isComplete
                ? "Layby completed! Sale recorded in history."
                : "Payment recorded",
            "success",
        );
    } catch (err) {
        console.error("Payment error:", err);
        toast("Error: " + err.message, "error");
    }
}

// View layby details
function viewLaybyDetails(laybyId) {
    const DB = getDB();
    const layby = DB.laybys.find((l) => l.id === laybyId);
    if (!layby) {
        toast("Layby not found", "error");
        return;
    }

    const payments = (DB.laybyPayments || []).filter(
        (p) => p.layby_id === laybyId,
    );
    const balanceColor = layby.balance > 0 ? "wn" : "gn";
    const statusBadge =
        layby.status === "active" ? "orange" : "green";

    openModal(
        "Layby Details — " + (layby.layby_number || layby.id),
        `
    <div style="background:var(--bg);padding:16px;border-radius:8px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-weight:600">${esc(layby.customer_name)}</span>
        <span class="badge badge-${statusBadge}">${layby.status}</span>
      </div>
      <div style="font-size:13px;color:var(--tx2);margin-bottom:4px">${esc(layby.customer_phone || "No phone")}</div>
      <div style="font-size:13px;color:var(--tx2)">${esc(layby.product_name)}</div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--bd)">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Total:</span><span>${money(layby.total_price)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Paid:</span><span style="color:var(--gn)">${money(layby.amount_paid)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:700;padding-top:6px;border-top:1px solid var(--bd)"><span>Balance:</span><span style="color:var(--${balanceColor})">${money(layby.balance)}</span></div>
      </div>
    </div>
    ${
        payments.length
            ? `<div style="margin-bottom:12px"><strong>Payment History:</strong></div>
    <div style="max-height:200px;overflow-y:auto">${payments
        .map(
            (p) => `
      <div style="background:var(--bg);padding:12px;border-radius:8px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-weight:600">${money(p.amount)}</span>
          <span style="font-size:11px;color:var(--tx2)">${new Date(p.created_at).toLocaleDateString()}</span>
        </div>
        <div style="font-size:12px;color:var(--tx2)">${p.payment_method.replace("_", " ")} • ${esc(p.user_name)}</div>
        ${p.notes ? `<div style="font-size:11px;color:var(--tx3);margin-top:4px">${esc(p.notes)}</div>` : ""}
      </div>`,
        )
        .join("")}</div>`
            : '<div style="text-align:center;padding:20px;color:var(--tx3)">No payments yet</div>'
    }`,
        `<button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>`,
    );
}

// Export service functions for global access
const laybyService = {
    renderLayby
};

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.laybyService = laybyService;
}

export default laybyService;