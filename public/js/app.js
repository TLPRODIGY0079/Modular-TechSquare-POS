// Main entry point for TECHSQUARE POS
import { DEBUG, APP_NAME, APP_VERSION } from './config.js';
import { initSupabase, getSupabase } from './supabase-client.js';
import { initOfflineDB, loadDB, setCurrentUser, getCurrentUser, setCurrentPage, isOnlineMode, toggleForcedOffline, updateConnBadge } from './db.js';
import { restoreSession, signIn, logout, hasAccess } from './auth.js';
import { toast } from './ui/toast.js';
import { openModal, closeModal, showConfirm, initModal } from './ui/modal.js';
import { initNavigation, navigate } from './ui/navigation.js';

// Import services
import { renderDashboard } from './services/dashboard.js';
import { renderProducts } from './services/products.js';
import { renderSales } from './services/sales.js';
import { renderLayby } from './services/layby.js';
import { renderAgents } from './services/agents.js';
import { renderWarehouse } from './services/warehouse.js';
import { renderExpenses } from './services/expenses.js';
import { renderTransfers } from './services/warehouse.js';
import { renderTradeIn } from './services/tradein.js';
import { renderHistory } from './services/sales.js';
import { renderReports } from './services/dashboard.js';

// Make functions globally available for onclick handlers
window.toast = toast;
window.openModal = openModal;
window.closeModal = closeModal;
window.showConfirm = showConfirm;
window.logout = logout;
window.toggleForcedOffline = toggleForcedOffline;
window.navigateTo = navigate;

// Page rendering functions
window.renderDashboard = renderDashboard;
window.renderProducts = renderProducts;
window.renderSales = renderSales;
window.renderLayby = renderLayby;
window.renderAgents = renderAgents;
window.renderWarehouse = renderWarehouse;
window.renderExpenses = renderExpenses;
window.renderTransfers = renderTransfers;
window.renderTradeIn = renderTradeIn;
window.renderHistory = renderHistory;
window.renderReports = renderReports;

// Theme management
let currentTheme = localStorage.getItem("techsquare-theme") || "light";

function getSavedTheme() {
    return localStorage.getItem("techsquare-theme") || "light";
}

function updateThemeBtn() {
    const btn = document.getElementById("themeToggle");
    if (btn) {
        const icon = btn.querySelector("i");
        if (icon) {
            icon.className = currentTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
        }
    }
}

function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("techsquare-theme", theme);
    updateThemeBtn();
}

function toggleTheme() {
    applyTheme(currentTheme === "light" ? "dark" : "light");
}

// Make theme functions globally available
window.toggleTheme = toggleTheme;

// Initialize application
async function startApp() {
    try {
        console.log(`${APP_NAME} v${APP_VERSION} starting...`);

        // Initialize Supabase
        initSupabase();

        // Initialize offline database
        await initOfflineDB();

        // Initialize UI components
        initModal();
        initNavigation();

        // Apply saved theme
        applyTheme(getSavedTheme());

        // Check for existing session
        const sessionRestored = await restoreSession();
        
        if (sessionRestored) {
            const user = getCurrentUser();
            if (user) {
                console.log("Session restored for:", user.email);
                
                // Show app shell
                const appShell = document.getElementById("appShell");
                const loginScreen = document.getElementById("loginScreen");
                
                if (appShell) appShell.style.display = "flex";
                if (loginScreen) loginScreen.style.display = "none";

                // Load database
                await loadDB();

                // Navigate to dashboard
                await navigate("dashboard");
            } else {
                showLoginScreen();
            }
        } else {
            showLoginScreen();
        }

        // Setup online/offline event listeners
        window.addEventListener("online", () => {
            updateConnBadge();
            toast("You're back online", "success");
            loadDB(); // Reload data when coming back online
        });

        window.addEventListener("offline", () => {
            updateConnBadge();
            toast("You're offline - using cached data", "warning");
        });

        // Initial connection badge update
        updateConnBadge();

        console.log(`${APP_NAME} initialized successfully`);
    } catch (error) {
        console.error("App initialization error:", error);
        toast("Failed to initialize application: " + error.message, "error");
    }
}

// Show login screen
function showLoginScreen() {
    const appShell = document.getElementById("appShell");
    const loginScreen = document.getElementById("loginScreen");
    
    if (appShell) appShell.style.display = "none";
    if (loginScreen) loginScreen.style.display = "flex";

    // Setup login form
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const email = document.getElementById("loginEmail").value;
            const password = document.getElementById("loginPassword").value;
            const loginBtn = document.getElementById("loginBtn");
            const loginError = document.getElementById("loginError");

            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
            }

            if (loginError) loginError.style.display = "none";

            const result = await signIn(email, password);

            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            }

            if (result.ok) {
                // Reload page to initialize app with authenticated user
                window.location.reload();
            } else {
                if (loginError) {
                    loginError.textContent = result.error;
                    loginError.style.display = "block";
                }
                toast(result.error, "error");
            }
        });
    }
}

// Start the application when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp);
} else {
    startApp();
}