// Utility functions for TECHSQUARE POS

// DOM helper
const $ = (id) => document.getElementById(id);

// Generate unique ID
const uid = () => crypto.randomUUID();

// Format money
const money = (n) =>
    "K" +
    Number(n || 0).toLocaleString("en", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

// Get today's date in YYYY-MM-DD format
const today = () => new Date().toISOString().slice(0, 10);

// Get current timestamp
const now = () => new Date().toISOString();

// Escape HTML to prevent XSS
const esc = (s) => {
    if (s == null) return "";
    const d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
};

// Debug logging
const log = (...a) => {
    if (DEBUG) console.log(...a);
};

// Check if we're online
const isOnline = () => navigator.onLine;

// Debounce function
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Format date for display
const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-ZA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

// Export for use in other modules (ES6)
export {
    $,
    uid,
    money,
    today,
    now,
    esc,
    log,
    isOnline,
    debounce,
    formatDate
};