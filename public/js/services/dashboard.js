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
    const todaySales = DB.sales.filter(s => s.date_str === today());
    const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
    const totalProfit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const transactions = todaySales.length;
    const lowStockCount = DB.variants.filter(v => v.qty < 10 && v.is_active).length;
    const activeLaybys = DB.laybys.filter(l => l.status === 'active').length;

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
                    <h3 style="font-size: 16px; font-weight: 700;">Recent Sales</h3>
                </div>
                <div class="card-body">
                    <div id="recentSales">
                        <!-- Recent sales will be rendered here -->
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 style="font-size: 16px; font-weight: 700;">Agent Performance</h3>
                </div>
                <div class="card-body">
                    <div id="agentMetrics">
                        <!-- Agent metrics will be rendered here -->
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
    renderRecentSales();
    
    // Load agent metrics
    loadAgentMetrics();
    
    // Render revenue chart
    renderRevenueChart();
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
                    <th>Customer</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${recentSales.map(sale => `
                    <tr>
                        <td><strong>${esc(sale.receipt_number)}</strong></td>
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
    const totalRevenue = DB.sales.reduce((sum, s) => sum + s.total, 0);
    const totalProfit = DB.sales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const totalCommission = DB.commissionRecords.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.commission_amount, 0);

    mainContent.innerHTML = `
        <div style="margin-bottom: 24px;">
            <h2 style="font-size: 24px; font-weight: 700;">End of Day Reports</h2>
        </div>

        <div class="tabs">
            <div class="tab active" data-tab="summary">Summary</div>
            <div class="tab" data-tab="sales">Sales Report</div>
            <div class="tab" data-tab="commissions">Commissions</div>
        </div>

        <div class="card">
            <div class="card-body">
                <div id="reportContent">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon" style="background: var(--ac3); color: var(--ac);">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="stat-value">${money(totalRevenue)}</div>
                            <div class="stat-label">Total Revenue</div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: var(--gn2); color: var(--gn);">
                                <i class="fas fa-dollar-sign"></i>
                            </div>
                            <div class="stat-value">${money(totalProfit)}</div>
                            <div class="stat-label">Total Profit</div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: var(--wn2); color: var(--wn);">
                                <i class="fas fa-receipt"></i>
                            </div>
                            <div class="stat-value">${DB.sales.length}</div>
                            <div class="stat-label">Total Transactions</div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: var(--dn2); color: var(--dn);">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="stat-value">${money(totalCommission)}</div>
                            <div class="stat-label">Pending Commissions</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Setup tabs
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            const tabName = tab.dataset.tab;
            updateReportContent(tabName);
        });
    });
}

// Update report content based on tab
function updateReportContent(tabName) {
    const DB = getDB();
    const container = document.getElementById("reportContent");
    if (!container) return;

    switch (tabName) {
        case 'summary':
            // Show summary (default)
            renderReports(); // Re-render with default view
            break;
        case 'sales':
            // Show sales report
            container.innerHTML = `
                <h3 style="margin-bottom: 16px;">Sales Report</h3>
                <button class="btn btn-outline" onclick="window.dashboardService.exportSalesReport()">
                    <i class="fas fa-download"></i> Export CSV
                </button>
                <p style="color: var(--tx2); margin-top: 12px;">Detailed sales reporting coming soon</p>
            `;
            break;
        case 'commissions':
            // Show commissions report
            const pendingCommissions = DB.commissionRecords.filter(r => r.status === 'pending');
            container.innerHTML = `
                <h3 style="margin-bottom: 16px;">Commission Report</h3>
                ${pendingCommissions.length === 0 ? `
                    <div class="empty-state">
                        <i class="fas fa-check-circle"></i>
                        <h3>No pending commissions</h3>
                    </div>
                ` : `
                    <table>
                        <thead>
                            <tr>
                                <th>Agent</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendingCommissions.map(commission => `
                                <tr>
                                    <td>${esc(commission.agent_name || 'Unknown')}</td>
                                    <td><strong>${money(commission.commission_amount)}</strong></td>
                                    <td>${commission.sale_date || '-'}</td>
                                    <td><span class="badge badge-orange">${commission.status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `}
            `;
            break;
    }
}

// Export sales report
function exportSalesReport() {
    const DB = getDB();
    
    if (typeof XLSX === 'undefined') {
        toast("Excel export not available", "error");
        return;
    }

    try {
        const salesData = DB.sales.map(sale => ({
            'Receipt Number': sale.receipt_number,
            'Date': sale.date_str,
            'Customer': sale.customer_name || 'Walk-in',
            'Product': sale.product_name,
            'Variant': sale.variant_label,
            'Quantity': sale.quantity,
            'Unit Price': sale.unit_price,
            'Total': sale.total,
            'Payment Method': sale.payment_method,
            'Sales Person': sale.user_name
        }));

        const ws = XLSX.utils.json_to_sheet(salesData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sales");
        XLSX.writeFile(wb, `sales_report_${today()}.xlsx`);
        
        toast("Sales report exported successfully", "success");
    } catch (error) {
        console.error("Export error:", error);
        toast("Error exporting report: " + error.message, "error");
    }
}

// Export service functions for global access
window.dashboardService = {
    renderDashboard,
    renderReports,
    exportSalesReport
};

export default {
    renderDashboard,
    renderReports,
    exportSalesReport
};