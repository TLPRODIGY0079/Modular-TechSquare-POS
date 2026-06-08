// Authentication module for TECHSQUARE POS
import { getSupabase } from './supabase-client.js';
import { setCurrentUser, getCurrentUser } from './db.js';
import { toast } from './ui/toast.js';

// Restore user session
async function restoreSession() {
    const sb = getSupabase();

    if (!sb) {
        // Supabase SDK not available — try to restore from localStorage cache
        try {
            const cached = localStorage.getItem("techsquare-cached-user");
            if (cached) {
                try {
                    const user = JSON.parse(cached);
                    setCurrentUser(user);
                    return true;
                } catch (e) {
                    console.error("Failed to parse cached user:", e);
                }
            }
        } catch (storageError) {
            console.warn("LocalStorage access blocked, cannot restore session:", storageError);
        }
        return false;
    }

    try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return false;

        const { data: { user } } = await sb.auth.getUser();
        if (!user) return false;

        const { data: profile } = await sb
            .from("user_profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (!profile) {
            const userData = {
                id: user.id,
                email: user.email,
                name: user.email,
                role: "cashier",
                storeId: null,
                noProfile: true,
            };
            setCurrentUser(userData);

            try {
                localStorage.setItem(
                    "techsquare-cached-user",
                    JSON.stringify(userData),
                );
            } catch (storageError) {
                console.warn("LocalStorage access blocked, user not cached:", storageError);
            }

            return true;
        }

        const userData = {
            id: user.id,
            email: user.email,
            name: profile.name,
            role: profile.role,
            storeId: profile.store_id,
        };
        setCurrentUser(userData);

        try {
            localStorage.setItem(
                "techsquare-cached-user",
                JSON.stringify(userData),
            );
        } catch (storageError) {
            console.warn("LocalStorage access blocked, user not cached:", storageError);
        }

        return true;
    } catch (error) {
        console.error("Session restore error:", error);
        return false;
    }
}

// Sign in with email and password
async function signIn(email, password) {
    const sb = getSupabase();

    if (!sb) {
        return { ok: false, error: "Cannot sign in while offline" };
    }

    try {
        const { data, error } = await sb.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return { ok: false, error: error.message };
        }

        const { data: profile, error: pErr } = await sb
            .from("user_profiles")
            .select("*")
            .eq("id", data.user.id)
            .single();

        if (pErr || !profile) {
            return {
                ok: false,
                error: "User profile not found. Contact admin.",
            };
        }

        const user = {
            id: data.user.id,
            email: data.user.email,
            name: profile.name,
            role: profile.role,
            storeId: profile.store_id,
        };

        setCurrentUser(user);

        // Handle localStorage with error catching for tracking prevention
        try {
            localStorage.setItem(
                "techsquare-cached-user",
                JSON.stringify(user),
            );
        } catch (storageError) {
            console.warn("LocalStorage access blocked, user not cached:", storageError);
            // Continue without caching - session will still work
        }

        return { ok: true };
    } catch (error) {
        console.error("Sign in error:", error);
        return { ok: false, error: error.message };
    }
}

// Sign out
async function logout() {
    const sb = getSupabase();

    if (sb) {
        try {
            await sb.auth.signOut();
        } catch (error) {
            console.error("Sign out error:", error);
        }
    }

    try {
        localStorage.removeItem("techsquare-cached-user");
    } catch (storageError) {
        console.warn("LocalStorage access blocked, cannot remove cached user:", storageError);
    }

    setCurrentUser(null);

    // Redirect to login page
    window.location.replace("login.html");
}

// Check if user has access to a specific page
function hasAccess(page) {
    const user = getCurrentUser();
    if (!user) return false;

    const PAGES = [
        {
            id: "dashboard",
            roles: ["admin", "store_manager", "cashier"],
        },
        {
            id: "sales",
            roles: ["admin", "store_manager", "cashier"],
        },
        {
            id: "products",
            roles: ["admin", "store_manager", "cashier"],
        },
        {
            id: "layby",
            roles: ["admin", "store_manager", "cashier"],
        },
        {
            id: "agents",
            roles: ["admin", "store_manager"],
        },
        {
            id: "transfers",
            roles: ["admin", "store_manager"],
        },
        {
            id: "tradein",
            roles: ["admin", "store_manager", "cashier"],
        },
        {
            id: "expenses",
            roles: ["admin", "store_manager"],
        },
        {
            id: "history",
            roles: ["admin", "store_manager", "cashier"],
        },
        {
            id: "reports",
            roles: ["admin", "store_manager"],
        },
        {
            id: "warehouse",
            roles: ["admin", "warehouse_manager"],
        },
        {
            id: "settings",
            roles: ["admin"],
        },
    ];

    const pageConfig = PAGES.find((p) => p.id === page);
    if (!pageConfig) return false;

    return pageConfig.roles.includes(user.role);
}

// ES6 module exports
export { restoreSession, signIn, logout, hasAccess };

// CommonJS fallback for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        restoreSession,
        signIn,
        logout,
        hasAccess
    };
}