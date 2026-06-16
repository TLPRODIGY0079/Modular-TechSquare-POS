// Navigation and sidebar management for TECHSQUARE POS
import { getCurrentUser, setCurrentPage, getCurrentPage } from '../db.js';
import { $ } from '../utils.js';
import { hasAccess as checkAccess } from '../auth.js';

// Page configuration
const PAGES = [
    {
        id: "dashboard",
        label: "Dashboard",
        icon: "fa-chart-pie",
        roles: ["admin", "store_manager", "cashier"],
    },
    {
        id: "sales",
        label: "Sales / POS",
        icon: "fa-cash-register",
        roles: ["admin", "store_manager", "cashier"],
    },
    {
        id: "products",
        label: "Inventory",
        icon: "fa-boxes-stacked",
        roles: ["admin", "store_manager", "cashier"],
    },
    {
        id: "layby",
        label: "Layby",
        icon: "fa-calendar-check",
        roles: ["admin", "store_manager", "cashier"],
    },
    {
        id: "transfers",
        label: "Stock Transfers",
        icon: "fa-right-left",
        roles: ["admin", "store_manager"],
    },
    {
        id: "tradein",
        label: "Trade-In",
        icon: "fa-rotate",
        roles: ["admin", "store_manager", "cashier"],
    },
    {
        id: "expenses",
        label: "Expenses",
        icon: "fa-receipt",
        roles: ["admin", "store_manager"],
    },
    {
        id: "history",
        label: "Sales History",
        icon: "fa-clock-rotate-left",
        roles: ["admin", "store_manager", "cashier"],
    },
    {
        id: "reports",
        label: "End of Day",
        icon: "fa-chart-bar",
        roles: ["admin", "store_manager"],
    },
    {
        id: "warehouse",
        label: "Warehouse",
        icon: "fa-warehouse",
        roles: ["admin", "store_manager"],
    },
    {
        id: "agents",
        label: "Agents",
        icon: "fa-user-tie",
        roles: ["admin", "store_manager"],
    },
];

// Get pages configuration
function getPages() {
    return PAGES;
}

// Render sidebar navigation
function renderSidebar() {
    const user = getCurrentUser();
    if (!user) return;

    const pages = PAGES.filter((p) => p.roles.includes(user.role));
    const currentPage = getCurrentPage();
    
    // Calculate pending stock requests count
    let pendingCount = 0;
    try {
        if (typeof stockRequests !== "undefined" && stockRequests) {
            pendingCount = stockRequests.filter((r) => r.status === "pending").length;
        }
    } catch (e) {
        // stockRequests might not be defined yet
    }

    const sidebarNav = $("sidebarNav");
    if (sidebarNav) {
        sidebarNav.innerHTML = pages
            .map((p) => {
                let badge = "";
                if (p.id === "warehouse" && pendingCount > 0) {
                    badge = `<span style="background:#ef4444;color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:auto">${pendingCount}</span>`;
                }
                return `<div class="nav-item ${currentPage === p.id ? "active" : ""}" data-page="${p.id}" style="display:flex;align-items:center;gap:8px">
                    <i class="fas ${p.icon}"></i>${p.label}${badge}
                </div>`;
            })
            .join("");

        // Add click handlers
        sidebarNav
            .querySelectorAll(".nav-item")
            .forEach((el) =>
                el.addEventListener("click", () => {
                    navigate(el.dataset.page);
                    closeSidebar();
                }),
            );
    }

    // Render user info in sidebar footer
    const sidebarUser = $("sidebarUser");
    if (sidebarUser && user) {
        const initials = user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
        
        sidebarUser.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;padding:16px;border-top:1px solid var(--bd)">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--ac);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">${initials}</div>
                <div style="flex:1;overflow:hidden">
                    <div style="font-size:13px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${user.name}</div>
                    <div style="font-size:11px;color:var(--tx2);text-transform:capitalize">${user.role.replace(/_/g, " ")}</div>
                </div>
                <button class="btn-ghost" id="logoutBtn" title="Logout" style="padding:8px">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        `;

        // Add logout handler
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                if (typeof logout === 'function') {
                    logout();
                }
            });
        }
    }
}

// Close sidebar (mobile)
function closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    
    if (sidebar) {
        sidebar.classList.remove("open");
    }
    if (backdrop) {
        backdrop.style.display = "none";
    }
}

// Render topbar actions
function renderTopbarActions(extra = "") {
    const topbarActions = $("topbarActions");
    if (!topbarActions) return;

    topbarActions.innerHTML = `
        <div id="connBadge" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-right:8px">
            <i class="fas fa-wifi"></i> Online
        </div>
        <button class="btn-ghost" id="printerManagerBtn" title="Printer Manager">
            <i class="fas fa-print"></i>
        </button>
        <button class="btn-ghost" id="themeToggle" title="Toggle theme">
            <i class="fas fa-moon"></i>
        </button>
        ${extra}
    `;

    // Add theme toggle handler
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            if (typeof toggleTheme === 'function') {
                toggleTheme();
            }
        });
    }
    
    // Add printer manager handler
    const printerManagerBtn = document.getElementById("printerManagerBtn");
    if (printerManagerBtn) {
        printerManagerBtn.addEventListener("click", showPrinterManager);
    }
}

// Show printer manager modal
function showPrinterManager() {
    // Import printer service dynamically
    import('../services/printer.js').then(module => {
        const printerService = module.default;
        const isConnected = printerService.getConnectionStatus();
        const isBluetoothAvailable = printerService.isBluetoothAvailable();
        
        const modalContent = `
            <div style="padding: 20px;">
                <h3 style="margin-bottom: 20px; font-size: 18px; font-weight: 700;">
                    <i class="fas fa-print" style="margin-right: 10px; color: var(--ac);"></i>
                    Printer Manager
                </h3>
                
                <!-- Bluetooth Status -->
                <div style="background: var(--bg); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <span style="font-weight: 600;">Bluetooth Support</span>
                        <span class="badge ${isBluetoothAvailable ? 'badge-green' : 'badge-red'}">
                            ${isBluetoothAvailable ? 'Available' : 'Not Available'}
                        </span>
                    </div>
                    ${!isBluetoothAvailable ? `
                        <p style="font-size: 12px; color: var(--tx2); margin-top: 8px;">
                            <i class="fas fa-info-circle"></i> 
                            Bluetooth printing requires a compatible browser (Chrome, Edge). 
                        </p>
                    ` : ''}
                </div>
                
                <!-- Connection Status -->
                <div style="background: var(--bg); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <span style="font-weight: 600;">Printer Connection</span>
                        <span class="badge ${isConnected ? 'badge-green' : 'badge-orange'}">
                            ${isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                </div>
                
                <!-- Actions -->
                ${isBluetoothAvailable ? `
                    <div style="display: grid; gap: 12px;">
                        ${!isConnected ? `
                            <button class="btn btn-primary" id="connectPrinterBtn" style="width: 100%;">
                                <i class="fab fa-bluetooth" style="margin-right: 8px;"></i>
                                Connect Bluetooth Printer
                            </button>
                        ` : `
                            <button class="btn btn-outline" id="disconnectPrinterBtn" style="width: 100%;">
                                <i class="fas fa-unlink" style="margin-right: 8px;"></i>
                                Disconnect Printer
                            </button>
                        `}
                        
                        <button class="btn btn-outline" id="testPrintBtn" style="width: 100%;" ${!isConnected ? 'disabled style="opacity: 0.5;"' : ''}>
                            <i class="fas fa-file-alt" style="margin-right: 8px;"></i>
                            Print Test Page
                        </button>
                    </div>
                ` : `
                    <div style="background: var(--wn2); padding: 12px; border-radius: 6px; border-left: 3px solid var(--wn);">
                        <p style="font-size: 13px; color: var(--wn);">
                            <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                            Standard printing is available via browser print dialog when generating receipts.
                        </p>
                    </div>
                `}
            </div>
        `;
        
        // Show modal
        if (typeof openModal === 'function') {
            openModal(
                'Printer Manager',
                modalContent,
                `
                    <button class="btn btn-outline" onclick="window.closeModal()">Close</button>
                `
            );
            
            // Setup button handlers after modal is rendered
            setTimeout(() => {
                if (!isConnected) {
                    const connectBtn = document.getElementById('connectPrinterBtn');
                    if (connectBtn) {
                        connectBtn.addEventListener('click', async () => {
                            connectBtn.disabled = true;
                            connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                            
                            const success = await printerService.connectBluetoothPrinter();
                            
                            connectBtn.disabled = false;
                            connectBtn.innerHTML = '<i class="fab fa-bluetooth" style="margin-right: 8px;"></i> Connect Bluetooth Printer';
                            
                            if (success) {
                                // Refresh modal
                                setTimeout(() => {
                                    closeModal();
                                    showPrinterManager();
                                }, 1000);
                            }
                        });
                    }
                } else {
                    const disconnectBtn = document.getElementById('disconnectPrinterBtn');
                    if (disconnectBtn) {
                        disconnectBtn.addEventListener('click', () => {
                            printerService.disconnectPrinter();
                            closeModal();
                            showPrinterManager();
                        });
                    }
                    
                    const testPrintBtn = document.getElementById('testPrintBtn');
                    if (testPrintBtn) {
                        testPrintBtn.addEventListener('click', async () => {
                            testPrintBtn.disabled = true;
                            testPrintBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Printing...';
                            
                            await printerService.printTestPage();
                            
                            testPrintBtn.disabled = false;
                            testPrintBtn.innerHTML = '<i class="fas fa-file-alt" style="margin-right: 8px;"></i> Print Test Page';
                        });
                    }
                }
            }, 100);
        }
    }).catch(error => {
        console.error('Failed to load printer service:', error);
        if (typeof toast === 'function') {
            toast('Failed to load printer service', 'error');
        }
    });
}

// Navigate to a page
async function navigate(page) {
    const user = getCurrentUser();
    if (!user) return;

    // Check access
    if (!checkAccess(page)) {
        console.error("Access denied to page:", page);
        return;
    }

    // Update current page
    setCurrentPage(page);

    // Update page title
    const pageTitle = $("pageTitle");
    if (pageTitle) {
        const pageConfig = PAGES.find((p) => p.id === page);
        if (pageConfig) {
            pageTitle.textContent = pageConfig.label;
        }
    }

    // Update sidebar active state
    renderSidebar();

    // Render page content
    const mainContent = $("mainContent");
    if (mainContent) {
        mainContent.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
        
        try {
            // Dynamically import and render the page
            switch (page) {
                case "dashboard":
                    if (typeof renderDashboard === 'function') {
                        await renderDashboard();
                    }
                    break;
                case "sales":
                    if (typeof renderSales === 'function') {
                        await renderSales();
                    }
                    break;
                case "products":
                    if (typeof renderProducts === 'function') {
                        await renderProducts();
                    }
                    break;
                case "layby":
                    if (typeof renderLayby === 'function') {
                        await renderLayby();
                    }
                    break;
                case "transfers":
                    if (typeof renderTransfers === 'function') {
                        await renderTransfers();
                    }
                    break;
                case "tradein":
                    if (typeof renderTradeIn === 'function') {
                        await renderTradeIn();
                    }
                    break;
                case "expenses":
                    if (typeof renderExpenses === 'function') {
                        await renderExpenses();
                    }
                    break;
                case "history":
                    if (typeof renderHistory === 'function') {
                        await renderHistory();
                    }
                    break;
                case "reports":
                    if (typeof renderReports === 'function') {
                        await renderReports();
                    }
                    break;
                case "warehouse":
                    if (typeof renderWarehouse === 'function') {
                        await renderWarehouse();
                    }
                    break;
                case "agents":
                    if (typeof renderAgents === 'function') {
                        await renderAgents();
                    }
                    break;
                default:
                    mainContent.innerHTML = '<div class="empty-state"><h3>Page not found</h3><p>The requested page does not exist.</p></div>';
            }
        } catch (error) {
            console.error("Page render error:", error);
            mainContent.innerHTML = `<div class="empty-state"><h3>Error loading page</h3><p>${error.message}</p></div>`;
        }
    }
}

// Initialize navigation
function initNavigation() {
    // Menu toggle for mobile
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");

    if (menuToggle && sidebar && backdrop) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            backdrop.style.display = sidebar.classList.contains("open") ? "block" : "none";
        });

        backdrop.addEventListener("click", () => {
            closeSidebar();
        });
    }

    // Render initial sidebar
    renderSidebar();
    
    // Render topbar actions
    renderTopbarActions();
}

// ES6 module exports
export { getPages, renderSidebar, closeSidebar, renderTopbarActions, navigate, initNavigation };

// CommonJS fallback for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getPages,
        renderSidebar,
        closeSidebar,
        renderTopbarActions,
        navigate,
        initNavigation
    };
}