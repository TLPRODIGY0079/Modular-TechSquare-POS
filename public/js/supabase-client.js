// Supabase client setup for TECHSQUARE POS
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let sb = null;

// Initialize Supabase client
function initSupabase() {
    if (window.supabase) {
        sb = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
                auth: {
                    storageKey: "techsquare-auth",
                    autoRefreshToken: true,
                    persistSession: true,
                },
            },
        );
        return sb;
    } else {
        console.warn(
            "Supabase SDK not loaded — running in offline-only mode",
        );
        return null;
    }
}

// Get Supabase client instance
function getSupabase() {
    if (!sb) {
        sb = initSupabase();
    }
    return sb;
}

// Check if Supabase is available
function isSupabaseAvailable() {
    return sb !== null;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSupabase,
        getSupabase,
        isSupabaseAvailable
    };
}