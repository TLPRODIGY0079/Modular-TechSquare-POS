// Configuration and constants for TECHSQUARE POS
// Version: 2.0.5 - Financial fixes + cost_price corrections

// Supabase Configuration
const SUPABASE_URL = "https://ojstpssuxgmkjhzpillr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qc3Rwc3N1eGdta2poenBpbGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Nzg1MDcsImV4cCI6MjA5MjU1NDUwN30.uQ-049hvQU7WjpGFd6KGRcAuJ5TXtmqMK2mhl5UZMK4";

// Store IDs
const STORE1_ID = "00000000-0000-0000-0000-000000000001";
const STORE2_ID = "00000000-0000-0000-0000-000000000002";
const WAREHOUSE_ID = "00000000-0000-0000-0000-000000000000"; // Warehouse (central stock)

// Application Settings
const APP_NAME = "TECHSQUARE";
const APP_VERSION = "2.0.5";
const DEBUG = false;

// Export for use in other modules (ES6)
export {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    STORE1_ID,
    STORE2_ID,
    WAREHOUSE_ID,
    APP_NAME,
    APP_VERSION,
    DEBUG
};