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
};

// Offline Mode State
let forcedOfflineMode = localStorage.getItem("forcedOfflineMode") === "true";
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
    localStorage.setItem(
        "forcedOfflineMode",
        forcedOfflineMode.toString(),
    );

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
        await offlineDB.init();
        log("OfflineDB initialized successfully");
    } catch (error) {
        console.error("OfflineDB initialization failed:", error);
    }
}

// Load database from Supabase and/or IndexedDB
async function loadDB() {
    try {
        log("Loading database...");

        // Load from IndexedDB first (offline support)
        if (offlineDB) {
            try {
                DB.products = (await offlineDB.getAll("products")) || [];
                DB.variants = (await offlineDB.getAll("variants")) || [];
                DB.serializedItems = (await offlineDB.getAll("serializedItems")) || [];
                DB.sales = (await offlineDB.getAll("sales")) || [];
                DB.saleItems = [];
                DB.stockTransfers = (await offlineDB.getAll("stockTransfers")) || [];
                DB.tradeIns = (await offlineDB.getAll("tradeIns")) || [];
                DB.expenses = (await offlineDB.getAll("expenses")) || [];
                DB.laybys = (await offlineDB.getAll("laybys")) || [];
                DB.laybyPayments = (await offlineDB.getAll("laybyPayments")) || [];
                DB.commissionRecords = (await offlineDB.getAll("commissionRecords")) || [];

                log("Loaded from IndexedDB:", {
                    products: DB.products.length,
                    variants: DB.variants.length,
                    sales: DB.sales.length,
                });
            } catch (idbError) {
                console.error("IndexedDB load error:", idbError);
                // Initialize with empty arrays if IndexedDB fails
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

        // If online and Supabase is available, sync and update IndexedDB
        if (isOnlineMode() && getSupabase()) {
            try {
                log("🌐 Syncing with Supabase...");
                const sb = getSupabase();

                // Add timeout to Supabase requests (5 seconds)
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error(
                                    "Supabase request timeout",
                                ),
                            ),
                        5000,
                    ),
                );

                const supabasePromise = Promise.all([
                    sb.from("products").select("*"),
                    sb.from("variants").select("*"),
                    sb.from("serialized_items").select("*"),
                    sb.from("sales").select("*").order("created_at", { ascending: false }),
                    sb.from("stock_transfers").select("*").order("created_at", { ascending: false }),
                    sb.from("trade_in_transactions").select("*").order("created_at", { ascending: false }),
                    sb.from("expenses").select("*").order("date", { ascending: false }),
                    sb.from("layby_transactions").select("*").order("created_at", { ascending: false }),
                    sb.from("layby_payments").select("*").order("created_at", { ascending: false }),
                    sb.from("commission_records").select("*").order("created_at", { ascending: false }),
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

                // Update IndexedDB with fresh data
                if (offlineDB) {
                    try {
                        await Promise.all([
                            ...DB.products.map((p) => offlineDB.put("products", p)),
                            ...DB.variants.map((v) => offlineDB.put("variants", v)),
                            ...DB.serializedItems.map((s) => offlineDB.put("serializedItems", s)),
                            ...DB.sales.map((s) => offlineDB.put("sales", s)),
                            ...DB.stockTransfers.map((t) => offlineDB.put("stockTransfers", t)),
                            ...DB.tradeIns.map((t) => offlineDB.put("tradeIns", t)),
                            ...DB.expenses.map((e) => offlineDB.put("expenses", e)),
                            ...DB.commissionRecords.map((c) => offlineDB.put("commissionRecords", c)),
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
    } catch (err) {
        console.error("DB load error:", err);
        toast("Error loading data: " + err.message, "error");

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

// Export for use in other modules
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