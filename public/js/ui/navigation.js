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

// Export for use in other modules
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