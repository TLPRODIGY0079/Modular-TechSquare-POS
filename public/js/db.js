// Database state management for TECHSQUARE POS
import { getSupabase } from './supabase-client.js';
import { log, isOnline } from './utils.js';
import { toast } from './ui/toast.js';

// Application State
let currentUser = null;
let currentPage = "dashboard";
let cart = [];

// Database State
let DB = {
    products: [],
    variants: [],
    serializedItems: [],
    sales: [],
    saleItems: [],
    stockTransfers: [],
    tradeIns: [],
    expenses: [],
    laybys: [],
    laybyPayments: [],
    commissionRecords: [],
    agents: [],
    agentAssignments: []
};

// Offline Mode State
let forcedOfflineMode = false;
try {
    forcedOfflineMode = localStorage.getItem("forcedOfflineMode") === "true";
} catch (e) {
    console.warn("localStorage access denied for forcedOfflineMode");
}
let currentPOSStore = null;
let isProcessingTradeIn = false;

// Chart instances
let _revenueChart = null;
let _lowStockInterval = null;

// Offline database instance
let offlineDB = null;

// Helper function to check if we're truly online
function isOnlineMode() {
    return navigator.onLine && !forcedOfflineMode;
}

// Toggle forced offline mode
function toggleForcedOffline() {
    forcedOfflineMode = !forcedOfflineMode;
    try {
        localStorage.setItem(
            "forcedOfflineMode",
            forcedOfflineMode.toString(),
        );
    } catch (e) {
        console.warn("localStorage access denied for forcedOfflineMode");
    }

    // Update UI
    updateConnBadge();

    // Notify user
    if (forcedOfflineMode) {
        toast(
            "Forced offline mode enabled - app will work offline",
            "info",
        );
    } else {
        toast(
            "Forced offline mode disabled - attempting to reconnect",
            "info",
        );
        
        // Reload data when coming back online
        loadDB();
    }
}

// Get database state
function getDB() {
    return DB;
}

// Get current user
function getCurrentUser() {
    return currentUser;
}

// Set current user
function setCurrentUser(user) {
    currentUser = user;
}

// Get current page
function getCurrentPage() {
    return currentPage;
}

// Set current page
function setCurrentPage(page) {
    currentPage = page;
}

// Get cart
function getCart() {
    return cart;
}

// Set cart
function setCart(newCart) {
    cart = newCart;
}

// Initialize offline database
async function initOfflineDB() {
    if (!window.offlineDB) {
        console.error("OfflineDB not loaded");
        return;
    }

    try {
        offlineDB = window.offlineDB;
        // Only init if not already initialized
        if (!offlineDB.db) {
            await offlineDB.init();
        }
        log("OfflineDB initialized successfully");
    } catch (error) {
        console.error("OfflineDB initialization failed:", error);
        // Don't throw - allow app to continue without offline support
    }
}

// Load database from Supabase and/or IndexedDB
async function loadDB() {
    try {
        log("Loading database...");

        // Show loading indicator
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }

        // Load from IndexedDB first (offline support)
        if (offlineDB && offlineDB.db && typeof offlineDB.getAll === 'function') {
            try {
                DB.products = (await offlineDB.getAll("products")) || [];
                DB.variants = (await offlineDB.getAll("variants")) || [];
                DB.serializedItems = (await offlineDB.getAll("serialized_items")) || [];
                DB.sales = (await offlineDB.getAll("sales")) || [];
                DB.saleItems = [];
                DB.stockTransfers = (await offlineDB.getAll("stock_transfers")) || [];
                DB.tradeIns = (await offlineDB.getAll("trade_in_transactions")) || [];
                DB.expenses = (await offlineDB.getAll("expenses")) || [];
                DB.laybys = (await offlineDB.getAll("layby_transactions")) || [];
                DB.laybyPayments = (await offlineDB.getAll("layby_payments")) || [];
                DB.commissionRecords = (await offlineDB.getAll("commission_records")) || [];
                DB.agents = (await offlineDB.getAll("agents")) || [];
                DB.agentAssignments = (await offlineDB.getAll("agent_assignments")) || [];

                log("Loaded from IndexedDB:", {
                    products: DB.products.length,
                    variants: DB.variants.length,
                    sales: DB.sales.length,
                });
            } catch (idbError) {
                console.error("IndexedDB load error:", idbError);
                // Initialize with empty arrays if IndexedDB fails - app will work with Supabase only
                console.log("⚠️ Continuing without IndexedDB - will use Supabase only");
                DB = {
                    products: [],
                    variants: [],
                    serializedItems: [],
                    sales: [],
                    saleItems: [],
                    stockTransfers: [],
                    tradeIns: [],
                    expenses: [],
                    laybys: [],
                    laybyPayments: [],
                    commissionRecords: [],
                    agents: [],
                };
            }
        }

        // If online and Supabase is available, sync and update IndexedDB
        if (isOnlineMode() && getSupabase()) {
            try {
                log("🌐 Syncing with Supabase...");
                const sb = getSupabase();

                // Add timeout to Supabase requests (15 seconds for large datasets)
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error(
                                    "Supabase request timeout",
                                ),
                            ),
                        15000,
                    ),
                );

                const supabasePromise = Promise.all([
                    sb.from("products").select("*"),
                    sb.from("variants").select("*"),
                    sb.from("serialized_items").select("*"),
                    sb.from("sales").select("*").order("created_at", { ascending: false }).limit(500),
                    sb.from("stock_transfers").select("*").order("created_at", { ascending: false }).limit(100),
                    sb.from("trade_in_transactions").select("*").order("created_at", { ascending: false }).limit(100),
                    sb.from("expenses").select("*").order("date", { ascending: false }).limit(100),
                    sb.from("layby_transactions").select("*").order("created_at", { ascending: false }).limit(100),
                    sb.from("layby_payments").select("*").order("created_at", { ascending: false }).limit(100),
                    sb.from("commission_records").select("*").order("created_at", { ascending: false }).limit(100),
                    sb.from("agents").select("*").order("created_at", { ascending: false }),
                    sb.from("agent_assignments").select("*").order("created_at", { ascending: false }).limit(100),
                ]);

                const [
                    pR,
                    vR,
                    sR,
                    slR,
                    trR,
                    tiR,
                    exR,
                    lbR,
                    lbpR,
                    crR,
                    agR,
                    aaR,
                ] = await Promise.race([
                    supabasePromise,
                    timeoutPromise,
                ]);

                // Only update DB if we got valid data from Supabase
                if (pR && pR.data) DB.products = pR.data;
                if (vR && vR.data) DB.variants = vR.data;
                if (sR && sR.data) DB.serializedItems = sR.data;
                if (slR && slR.data) DB.sales = slR.data;
                DB.saleItems = [];
                if (trR && trR.data) DB.stockTransfers = trR.data;
                if (tiR && tiR.data) DB.tradeIns = tiR.data;
                if (exR && exR.data) DB.expenses = exR.data;
                if (lbR && lbR.data) DB.laybys = lbR.data;
                if (lbpR && lbpR.data) DB.laybyPayments = lbpR.data;
                if (crR && crR.data) DB.commissionRecords = crR.data;
                if (agR && agR.data) DB.agents = agR.data;
                if (aaR && aaR.data) DB.agentAssignments = aaR.data;

                // Update IndexedDB with fresh data
                if (offlineDB) {
                    try {
                        await Promise.all([
                            ...DB.products.map((p) => offlineDB.put("products", p)),
                            ...DB.variants.map((v) => offlineDB.put("variants", v)),
                            ...DB.serializedItems.map((s) => offlineDB.put("serialized_items", s)),
                            ...DB.sales.map((s) => offlineDB.put("sales", s)),
                            ...DB.stockTransfers.map((t) => offlineDB.put("stock_transfers", t)),
                            ...DB.tradeIns.map((t) => offlineDB.put("trade_in_transactions", t)),
                            ...DB.expenses.map((e) => offlineDB.put("expenses", e)),
                            ...DB.commissionRecords.map((c) => offlineDB.put("commission_records", c)),
                            ...DB.agents.map((a) => offlineDB.put("agents", a)),
                            ...DB.agentAssignments.map((a) => offlineDB.put("agent_assignments", a)),
                        ]);
                    } catch (cacheError) {
                        console.error("Failed to cache data in IndexedDB:", cacheError);
                    }
                }

                log("🌐 Synced with Supabase:", {
                    products: DB.products.length,
                    variants: DB.variants.length,
                    sales: DB.sales.length,
                });

                // Process any pending sync queue
                if (offlineDB) {
                    try {
                        await offlineDB.processSyncQueue();
                    } catch (syncError) {
                        console.error("Sync queue processing failed:", syncError);
                    }
                }
            } catch (supabaseError) {
                console.error("Supabase sync error:", supabaseError);
                toast("Failed to sync with server, using offline data", "warning");
            }
        } else {
            log("📱 Offline mode - using cached data");
        }

        // Update connection badge
        updateConnBadge();

        // Hide loading indicator
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    } catch (err) {
        console.error("DB load error:", err);
        toast("Error loading data: " + err.message, "error");

        // Hide loading indicator on error
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }

        // Ensure DB has at least empty arrays
        DB = {
            products: [],
            variants: [],
            serializedItems: [],
            sales: [],
            saleItems: [],
            stockTransfers: [],
            tradeIns: [],
            expenses: [],
            laybys: [],
            laybyPayments: [],
            commissionRecords: [],
        };
    }
}

// Update connection badge in UI
function updateConnBadge() {
    const badge = document.getElementById("connBadge");
    if (badge) {
        if (isOnlineMode()) {
            badge.innerHTML = '<i class="fas fa-wifi"></i> Online';
            badge.style.background = "var(--gn2)";
            badge.style.color = "var(--gn)";
        } else {
            badge.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline';
            badge.style.background = "var(--wn2)";
            badge.style.color = "var(--wn)";
        }
    }
}

// ES6 module exports
export { 
    getDB, 
    getCurrentUser, 
    setCurrentUser, 
    getCurrentPage, 
    setCurrentPage, 
    getCart, 
    setCart, 
    initOfflineDB, 
    loadDB, 
    isOnlineMode, 
    toggleForcedOffline, 
    updateConnBadge 
};

// Export getters/setters for module state
export { offlineDB, currentUser, currentPage, cart, _revenueChart, _lowStockInterval };

// CommonJS fallback for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getDB,
        getCurrentUser,
        setCurrentUser,
        getCurrentPage,
        setCurrentPage,
        getCart,
        setCart,
        initOfflineDB,
        loadDB,
        isOnlineMode,
        toggleForcedOffline,
        updateConnBadge,
        get offlineDB() { return offlineDB; },
        get currentUser() { return currentUser; },
        get currentPage() { return currentPage; },
        get cart() { return cart; },
        get _revenueChart() { return _revenueChart; },
        set _revenueChart(value) { _revenueChart = value; },
        get _lowStockInterval() { return _lowStockInterval; },
        set _lowStockInterval(value) { _lowStockInterval = value; },
    };
}