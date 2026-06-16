// Dashboard and Reports Service for TECHSQUARE POS
import { getDB, getCurrentUser } from '../db.js';
import { getSupabase } from '../supabase-client.js';
import { $, money, today, esc } from '../utils.js';
import { toast } from '../ui/toast.js';
import { STORE1_ID, STORE2_ID, WAREHOUSE_ID } from '../config.js';
import { loadAgentMetrics } from './agents.js';

// Render dashboard page
export function renderDashboard() {
    const DB = getDB();
    const user = getCurrentUser();
    const mainContent = $("mainContent");
    
    if (!mainContent) return;

    // Calculate dashboard metrics
    // For cashiers, only show their store's data; for admins, show all stores
    const userStoreId = user?.storeId;
    const todaySales = user.role === "admin" 
        ? DB.sales.filter(s => s.date_str === today())
        : DB.sales.filter(s => s.date_str === today() && s.store_id === userStoreId);
    const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
    const totalProfit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const transactions = todaySales.length;
    const lowStockCount = user.role === "admin"
        ? DB.variants.filter(v => v.qty < 10 && v.is_active).length
        : DB.variants.filter(v => v.qty < 10 && v.is_active && v.store_id === userStoreId).length;
    const activeLaybys = user.role === "admin"
        ? DB.laybys.filter(l => l.status === 'active').length
        : DB.laybys.filter(l => l.status === 'active' && l.store_id === userStoreId).length;

    mainContent.innerHTML = `
        <div style="margin-bottom: 24px;">
            <h2 style="font-size: 24px; font-weight: 700;">Dashboard</h2>
            <p style="color: var(--tx2); margin-top: 4px;">Welcome back, ${esc(user?.name || 'User')}!</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--ac3); color: var(--ac);">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="stat-value">${money(totalRevenue)}</div>
                <div class="stat-label">Today's Revenue</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--gn2); color: var(--gn);">
                    <i class="fas fa-dollar-sign"></i>
                </div>
                <div class="stat-value">${money(totalProfit)}</div>
                <div class="stat-label">Today's Profit</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--wn2); color: var(--wn);">
                    <i class="fas fa-receipt"></i>
                </div>
                <div class="stat-value">${transactions}</div>
                <div class="stat-label">Transactions</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon" style="background: var(--dn2); color: var(--dn);">
                    <i class="fas fa-boxes-stacked"></i>
                </div>
                <div class="stat-value">${lowStockCount}</div>
                <div class="stat-label">Low Stock Items</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-top: 24px;">
            <div class="card">
                <div class="card-header">
                    <h3 style="font-size: 16px; font-weight: 700;">Financial Summary</h3>
                </div>
                <div class="card-body" style="padding: 16px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tx2);">Revenue:</span>
                        <span style="font-weight: 700;" id="finRevenue">${money(totalRevenue)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tx2);">COGS:</span>
                        <span style="font-weight: 700; color: var(--dn);" id="finCOGS">${money(calculateCOGS())}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-top: 8px; border-top: 1px solid var(--bd);">
                        <span style="color: var(--tx2);">Gross Profit:</span>
                        <span style="font-weight: 700; color: var(--gn);" id="finGross">${money(totalProfit)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--tx2);">Expenses:</span>
                        <span style="font-weight: 700; color: var(--dn);" id="finExpenses">${money(calculateExpenses())}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--bd);">
                        <span style="font-weight: 600;">Net Profit:</span>
                        <span style="font-weight: 700; font-size: 18px; color: var(--ac);" id="finNet">${money(calculateNetProfit())}</span>
                    </div>
                    <div style="margin-top: 12px; padding: 8px; background: var(--bg); border-radius: 6px; font-size: 12px; color: var(--tx2);">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Profit Margin:</span>
                            <span id="finMargin">${calculateProfitMargin()}%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card" id="agentMetricsWidget" style="display: none;">
                <div class="card-header">
                    <h3 style="font-size: 16px; font-weight: 700;">Agent Performance</h3>
                </div>
                <div class="card-body">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                        <div style="text-align: center; padding: 16px; background: var(--bg); border-radius: 8px;">
                            <div style="font-size: 12px; color: var(--tx2); margin-bottom: 8px;">Total Owed</div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--ac);" id="agentTotalOwed">K0.00</div>
                        </div>
                        <div style="text-align: center; padding: 16px; background: var(--bg); border-radius: 8px;">
                            <div style="font-size: 12px; color: var(--tx2); margin-bottom: 8px;">Total Collected</div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--gn);" id="agentTotalCollected">K0.00</div>
                        </div>
                        <div style="text-align: center; padding: 16px; background: var(--bg); border-radius: 8px;">
                            <div style="font-size: 12px; color: var(--tx2); margin-bottom: 8px;">Outstanding</div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--wn);" id="agentTotalOutstanding">K0.00</div>
                        </div>
                    </div>
                    
                    <div id="topAgentCard" style="display: none; margin-top: 16px; padding: 16px; background: var(--ac3); border-radius: 8px; border-left: 4px solid var(--ac);">
                        <div style="font-size: 12px; color: var(--ac); font-weight: 600; margin-bottom: 8px;">🏆 Top Performer</div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-size: 14px; font-weight: 700;" id="topAgentName">-</div>
                                <div style="font-size: 12px; color: var(--tx2);">Sales: <span id="topAgentSales">0</span></div>
                            </div>
                            <div style="font-size: 18px; font-weight: 700; color: var(--ac);" id="topAgentProfit">K0.00</div>
                        </div>
                    </div>
                    
                    <div id="noAgentData" style="display: none; text-align: center; padding: 32px; color: var(--tx3);">
                        <i class="fas fa-user-tie" style="font-size: 32px; margin-bottom: 12px; opacity: 0.3;"></i>
                        <div style="font-size: 14px;">No agent data available</div>
                        <div style="font-size: 12px;">Agent transactions will appear here</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top: 20px;">
            <div class="card-header">
                <h3 style="font-size: 16px; font-weight: 700;">Revenue Chart</h3>
            </div>
            <div class="card-body">
                <canvas id="revenueChart" style="height: 300px;"></canvas>
            </div>
        </div>
    `;

    // Render recent sales
    // renderRecentSales();
    
    // Load agent metrics
    loadAgentMetrics();
    
    // Render revenue chart
    renderRevenueChart();
}

// Helper functions for Financial Summary
function calculateCOGS() {
    const DB = getDB();
    const user = getCurrentUser();
    const userStoreId = user?.storeId;
    const todaySales = user.role === "admin"
        ? DB.sales.filter(s => s.date_str === today())
        : DB.sales.filter(s => s.date_str === today() && s.store_id === userStoreId);
    return todaySales.reduce((sum, s) => {
        const quantity = Number(s.quantity || 1);
        const costPrice = Number(s.cost_price || 0);
        return sum + costPrice * quantity;
    }, 0);
}

function calculateExpenses() {
    const DB = getDB();
    const user = getCurrentUser();
    const userStoreId = user?.storeId;
    const todayExpenses = user.role === "admin"
        ? (DB.expenses || []).filter(e => e.date === today())
        : (DB.expenses || []).filter(e => e.date === today() && e.store_id === userStoreId);
    return todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
}

function calculateNetProfit() {
    const DB = getDB();
    const user = getCurrentUser();
    const userStoreId = user?.storeId;
    const todaySales = user.role === "admin"
        ? DB.sales.filter(s => s.date_str === today())
        : DB.sales.filter(s => s.date_str === today() && s.store_id === userStoreId);
    const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
    const totalProfit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const todayExpenses = user.role === "admin"
        ? (DB.expenses || []).filter(e => e.date === today())
        : (DB.expenses || []).filter(e => e.date === today() && e.store_id === userStoreId);
    const totalExpenses = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    return totalProfit - totalExpenses;
}

function calculateProfitMargin() {
    const DB = getDB();
    const user = getCurrentUser();
    const userStoreId = user?.storeId;
    const todaySales = user.role === "admin"
        ? DB.sales.filter(s => s.date_str === today())
        : DB.sales.filter(s => s.date_str === today() && s.store_id === userStoreId);
    const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
    const totalProfit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);
    if (totalRevenue === 0) return 0;
    return ((totalProfit / totalRevenue) * 100).toFixed(1);
}

// Render recent sales
function renderRecentSales() {
    const DB = getDB();
    const container = document.getElementById("recentSales");
    if (!container) return;

    const recentSales = DB.sales.slice(0, 10);

    if (recentSales.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--tx2);">
                <i class="fas fa-receipt" style="font-size: 24px; margin-bottom: 8px; opacity: 0.3;"></i>
                <p>No recent sales</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table style="font-size: 13px;">
            <thead>
                <tr>
                    <th>Receipt</th>
                    <th>Type</th>
                    <th>Customer</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${recentSales.map(sale => `
                    <tr>
                        <td><strong>${esc(sale.receipt_number)}</strong></td>
                        <td>${sale.payment_method === 'trade_in' ? '<span class="badge badge-blue">Trade-in</span>' : sale.payment_method === 'layby' ? '<span class="badge badge-orange">Layby</span>' : '<span class="badge badge-gray">Sale</span>'}</td>
                        <td>${esc(sale.customer_name || 'Walk-in')}</td>
                        <td><strong>${money(sale.total)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Render revenue chart
function renderRevenueChart() {
    const DB = getDB();
    const canvas = document.getElementById("revenueChart");
    if (!canvas || typeof Chart === 'undefined') return;

    // Get last 7 days of sales
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().slice(0, 10));
    }

    const dailyRevenue = last7Days.map(date => {
        return DB.sales
            .filter(s => s.date_str === date)
            .reduce((sum, s) => sum + s.total, 0);
    });

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: last7Days.map(date => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })),
            datasets: [{
                label: 'Revenue',
                data: dailyRevenue,
                borderColor: '#00C2CB',
                backgroundColor: 'rgba(0, 194, 203, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'K' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Render reports page
export function renderReports() {
    const DB = getDB();
    const user = getCurrentUser();
    const mainContent = $("mainContent");
    
    if (!mainContent) return;

    // Calculate report metrics
    const todaySales = DB.sales.filter(s => s.date_str === today());
    // More flexible date filtering for commissions - check multiple date formats
    const todayCommissions = (DB.commissionRecords || []).filter(c => {
        const commissionDate = c.date || c.created_at?.slice(0, 10);
        return commissionDate === today();
    });

    // Debug logging for commission data
    console.log("📊 End of Day Report Debug:", {
        todaySalesCount: todaySales.length,
        todayCommissionsCount: todayCommissions.length,
        totalCommissionRecords: (DB.commissionRecords || []).length,
        sampleCommission: todayCommissions[0] || "No commissions today",
        todayDate: today(),
        salesWithCommission: todaySales.filter(s => s.commission_rate > 0).length
    });

    // Calculate COGS for today's sales
    const todayCOGS = todaySales.reduce((sum, s) => {
        const quantity = Number(s.quantity || 1);
        const costPrice = Number(s.cost_price || 0);
        return sum + costPrice * quantity;
    }, 0);

    // Calculate COGS by store
    const s1Sales = todaySales.filter(s => s.store_id === STORE1_ID);
    const s2Sales = todaySales.filter(s => s.store_id === STORE2_ID);
    const s1COGS = s1Sales.reduce((sum, s) => sum + Number(s.cost_price || 0) * Number(s.quantity || 1), 0);
    const s2COGS = s2Sales.reduce((sum, s) => sum + Number(s.cost_price || 0) * Number(s.quantity || 1), 0);

    // Group by receipt and sum totals
    const receiptMap = new Map();
    todaySales.forEach((s) => {
        const key = s.receipt_number;
        if (!receiptMap.has(key)) {
            receiptMap.set(key, {
                receipt_number: s.receipt_number,
                store_id: s.store_id,
                payment_method: s.payment_method,
                total: 0
            });
        }
        const receipt = receiptMap.get(key);
        receipt.total += Number(s.total || 0);
    });

    const receipts = Array.from(receiptMap.values());
    const s1 = receipts.filter(s => s.store_id === STORE1_ID);
    const s2 = receipts.filter(s => s.store_id === STORE2_ID);
    const s1Rev = s1.reduce((a, s) => a + Number(s.total || 0), 0);
    const s2Rev = s2.reduce((a, s) => a + Number(s.total || 0), 0);
    const s1Exp = DB.expenses
        .filter(e => e.store_id === STORE1_ID && (e.date || e.created_at?.slice(0, 10)) === today())
        .reduce((a, e) => a + Number(e.amount || 0), 0);
    const s2Exp = DB.expenses
        .filter(e => e.store_id === STORE2_ID && (e.date || e.created_at?.slice(0, 10)) === today())
        .reduce((a, e) => a + Number(e.amount || 0), 0);

    // Commission calculations
    // Primary: compute directly from sale rows using commission_rate * quantity
    const s1CommFromSales = s1Sales.reduce((a, s) => a + Number(s.commission_rate || 0) * Number(s.quantity || 1), 0);
    const s2CommFromSales = s2Sales.reduce((a, s) => a + Number(s.commission_rate || 0) * Number(s.quantity || 1), 0);

    // Fallback: use commission_records if sale rows have no commission_rate
    const s1Commissions = todayCommissions.filter(c => c.store_id === STORE1_ID);
    const s2Commissions = todayCommissions.filter(c => c.store_id === STORE2_ID);
    const s1CommFromRecords = s1Commissions.reduce((a, c) => a + Number(c.commission_amount || 0), 0);
    const s2CommFromRecords = s2Commissions.reduce((a, c) => a + Number(c.commission_amount || 0), 0);

    const s1CommTotal = s1CommFromSales > 0 ? s1CommFromSales : s1CommFromRecords;
    const s2CommTotal = s2CommFromSales > 0 ? s2CommFromSales : s2CommFromRecords;

    // Calculate Gross Profit and Net Profit by store
    const s1GrossProfit = s1Rev - s1COGS;
    const s2GrossProfit = s2Rev - s2COGS;
    const s1NetProfit = s1GrossProfit - s1Exp - s1CommTotal;
    const s2NetProfit = s2GrossProfit - s2Exp - s2CommTotal;

    // Group commissions by user
    const commissionByUser = new Map();
    
    // Primary: Use commission_records if available
    if (todayCommissions.length > 0) {
        todayCommissions.forEach((c) => {
            const key = c.user_id;
            if (!commissionByUser.has(key)) {
                commissionByUser.set(key, {
                    user_name: c.user_name,
                    store_id: c.store_id,
                    total: 0,
                    count: 0
                });
            }
            const user = commissionByUser.get(key);
            user.total += Number(c.commission_amount || 0);
            user.count++;
        });
    } else {
        // Fallback: Calculate from sales records with commission_rate
        todaySales.forEach((s) => {
            if (s.commission_rate && s.commission_rate > 0) {
                const commissionAmount = Number(s.commission_rate) * Number(s.quantity || 1);
                const key = s.user_id;
                if (!commissionByUser.has(key)) {
                    commissionByUser.set(key, {
                        user_name: s.user_name,
                        store_id: s.store_id,
                        total: 0,
                        count: 0
                    });
                }
                const user = commissionByUser.get(key);
                user.total += commissionAmount;
                user.count++;
            }
        });
    }
    
    const commissionUsers = Array.from(commissionByUser.values());
    
    // Debug logging for commission breakdown
    console.log("👥 Commission Breakdown Debug:", {
        commissionUsersCount: commissionUsers.length,
        commissionUsers: commissionUsers,
        usingCommissionRecords: todayCommissions.length > 0
    });

    const payBreakdown = (sales) => {
        const methods = ["cash", "card", "mobile_money", "bank_transfer"];
        return methods
            .map((m) => {
                const t = sales
                    .filter((s) => s.payment_method === m)
                    .reduce((a, s) => a + Number(s.total || 0), 0);
                return t > 0
                    ? `<div class="receipt-row"><span style="text-transform:capitalize">${m.replace("_", " ")}</span><span>${money(t)}</span></div>`
                    : "";
            })
            .join("");
    };

    mainContent.innerHTML = `<div class="fade-in">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card"><div class="card-header"><h3>Store 1 — ${today()}</h3></div><div class="card-body">
        <div class="receipt-row" style="font-size:18px;font-weight:800;margin-bottom:12px"><span>Revenue</span><span>${money(s1Rev)}</span></div>
        ${payBreakdown(s1)}
        <div class="receipt-row" style="margin-top:12px;color:var(--tx2)"><span>COGS</span><span>-${money(s1COGS)}</span></div>
        <div class="receipt-row" style="font-weight:600;color:var(--ac)"><span>Gross Profit</span><span>${money(s1GrossProfit)}</span></div>
        <div class="receipt-row" style="margin-top:8px;color:var(--dn)"><span>Expenses</span><span>-${money(s1Exp)}</span></div>
        <div class="receipt-row" style="color:var(--wn)"><span>Commissions</span><span>-${money(s1CommTotal)}</span></div>
        <div class="receipt-row" style="font-weight:700;font-size:16px;padding-top:8px;border-top:2px solid var(--bd)"><span>Net Profit</span><span>${money(s1NetProfit)}</span></div>
        <div style="margin-top:12px;font-size:12px;color:var(--tx2)">${s1.length} transactions</div>
      </div></div>
      <div class="card"><div class="card-header"><h3>Store 2 — ${today()}</h3></div><div class="card-body">
        <div class="receipt-row" style="font-size:18px;font-weight:800;margin-bottom:12px"><span>Revenue</span><span>${money(s2Rev)}</span></div>
        ${payBreakdown(s2)}
        <div class="receipt-row" style="margin-top:12px;color:var(--tx2)"><span>COGS</span><span>-${money(s2COGS)}</span></div>
        <div class="receipt-row" style="font-weight:600;color:var(--ac)"><span>Gross Profit</span><span>${money(s2GrossProfit)}</span></div>
        <div class="receipt-row" style="margin-top:8px;color:var(--dn)"><span>Expenses</span><span>-${money(s2Exp)}</span></div>
        <div class="receipt-row" style="color:var(--wn)"><span>Commissions</span><span>-${money(s2CommTotal)}</span></div>
        <div class="receipt-row" style="font-weight:700;font-size:16px;padding-top:8px;border-top:2px solid var(--bd)"><span>Net Profit</span><span>${money(s2NetProfit)}</span></div>
        <div style="margin-top:12px;font-size:12px;color:var(--tx2)">${s2.length} transactions</div>
      </div></div>
    </div>

    <div class="card"><div class="card-header"><h3>System-Wide Total</h3></div><div class="card-body">
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:16px">
        <div><div style="font-size:11px;color:var(--tx2)">Total Revenue</div><div style="font-size:22px;font-weight:800">${money(s1Rev + s2Rev)}</div></div>
        <div><div style="font-size:11px;color:var(--tx2)">COGS</div><div style="font-size:22px;font-weight:800;color:var(--tx2)">${money(s1COGS + s2COGS)}</div></div>
        <div><div style="font-size:11px;color:var(--tx2)">Gross Profit</div><div style="font-size:22px;font-weight:800;color:var(--ac)">${money(s1GrossProfit + s2GrossProfit)}</div></div>
        <div><div style="font-size:11px;color:var(--tx2)">Expenses</div><div style="font-size:22px;font-weight:800;color:var(--dn)">${money(s1Exp + s2Exp)}</div></div>
        <div><div style="font-size:11px;color:var(--tx2)">Commissions</div><div style="font-size:22px;font-weight:800;color:var(--wn)">${money(s1CommTotal + s2CommTotal)}</div></div>
        <div><div style="font-size:11px;color:var(--tx2)">Net Profit</div><div style="font-size:22px;font-weight:800;color:var(--gn)">${money(s1NetProfit + s2NetProfit)}</div></div>
      </div>
      <div style="margin-top:12px;font-size:12px;color:var(--tx2);text-align:center">${receipts.length} total transactions</div>
    </div></div>

    <div class="card">
      <div class="card-header"><h3>Commission Breakdown by Staff</h3></div>
      <div class="card-body np">
        ${
            commissionUsers.length > 0
                ? `<table>
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Store</th>
              <th>Sales Count</th>
              <th>Commission Earned</th>
            </tr>
          </thead>
          <tbody>
            ${commissionUsers
                .map(
                    (u) => `<tr>
              <td style="font-weight:600">${esc(u.user_name)}</td>
              <td><span class="badge ${u.store_id === STORE1_ID ? "store-badge-1" : "store-badge-2"}">${u.store_id === STORE1_ID ? "Store 1" : "Store 2"}</span></td>
              <td>${u.count}</td>
              <td style="font-weight:700;color:var(--gn)">${money(u.total)}</td>
            </tr>`,
                )
                .join("")}
            <tr style="background:var(--bg4);font-weight:700">
              <td colspan="3" style="text-align:right;padding-right:20px">TOTAL COMMISSIONS:</td>
              <td style="color:var(--wn);font-size:16px">${money(s1CommTotal + s2CommTotal)}</td>
            </tr>
          </tbody>
        </table>`
                : `<div style="text-align:center;padding:40px;color:var(--tx2)">
          <i class="fas fa-info-circle" style="font-size:32px;margin-bottom:12px;opacity:0.3;display:block"></i>
          <div style="font-size:14px">No commission records for today</div>
          <div style="font-size:12px;margin-top:4px;color:var(--tx3)">Commissions will appear here when products with commission rates are sold</div>
        </div>`
        }
      </div>
    </div>
  </div>`;
}

// Export service functions for global access
const dashboardService = {
    renderDashboard,
    renderReports
};

// Make functions available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.dashboardService = dashboardService;
}

export default dashboardService;