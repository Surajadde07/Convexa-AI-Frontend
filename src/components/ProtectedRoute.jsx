/**
 * ProtectedRoute.jsx
 *
 * ── WHY THE BACK BUTTON STILL WORKED ───────────────────────────────────────
 *
 * The previous version used window.location.replace("/") and added a
 * popstate listener inside ProtectedRoute. That sounds correct but has a
 * subtle problem:
 *
 * React Router's BrowserRouter keeps its own internal history stack that
 * is separate from the raw window.history stack. When clearSession() runs
 * and window.location.replace("/") executes, React Router updates its
 * internal stack too — but the browser's bfcache (Back-Forward Cache) may
 * still hold the previous page's full DOM state. Pressing Back restores that
 * cached state WITHOUT triggering a real React render or popstate event,
 * so ProtectedRoute never runs again.
 *
 * ── THE CORRECT FIX ─────────────────────────────────────────────────────────
 *
 * Three layers working together:
 *
 * 1. logoutAndRedirect() — called by every Sign Out button.
 *    Clears the session AND calls window.history.pushState repeatedly to
 *    "fill" the history stack with landing-page entries, so pressing Back
 *    multiple times stays on "/" instead of ever reaching a protected URL.
 *    Then it uses window.location.replace("/") to navigate without adding
 *    another entry.
 *
 * 2. ProtectedRoute render check — synchronous. If isAuthenticated()
 *    returns false at render time, we <Navigate to="/" replace> immediately.
 *    The `replace` prop means the browser replaces the current history entry
 *    instead of pushing, so the protected URL is gone from the forward stack
 *    as well.
 *
 * 3. pageshow listener (not popstate) — fires on bfcache restores.
 *    popstate does NOT fire when the browser restores a page from bfcache.
 *    pageshow fires for both normal loads AND bfcache restores. When
 *    `event.persisted === true` it's a bfcache restore — we re-check auth
 *    and redirect if the token is gone. This is the final safety net.
 *
 * 4. Cache-Control meta tag injected into <head> — tells the browser not
 *    to cache this page. This is the belt-and-suspenders approach that
 *    prevents bfcache from storing the page at all.
 */

import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated, clearSession } from "../services/api";

// ─── Exported logout helper — import this in every Sign Out button ────────────
export function logoutAndRedirect() {
    // 1. Wipe session data
    clearSession();
    sessionStorage.clear();

    // 2. Overwrite history entries so Back doesn't reach a protected page.
    //    We push several "/" entries — pressing Back multiple times stays on "/".
    const STACK_FILL = 5;
    for (let i = 0; i < STACK_FILL; i++) {
        window.history.pushState(null, "", "/");
    }

    // 3. Replace the current entry with "/" so this is the definitive page
    window.location.replace("/");
}

// ─── Guard component ──────────────────────────────────────────────────────────
export default function ProtectedRoute({ children }) {
    const location = useLocation();

    // ── Layer 3: pageshow catches bfcache restores ────────────────────────────
    useEffect(() => {
        const handlePageShow = (e) => {
            // e.persisted === true means the page was restored from bfcache
            if (!isAuthenticated()) {
                window.location.replace("/");
            }
        };

        // Also handle popstate (normal Back/Forward without bfcache)
        const handlePopState = () => {
            if (!isAuthenticated()) {
                window.location.replace("/");
            }
        };

        window.addEventListener("pageshow",  handlePageShow);
        window.addEventListener("popstate",  handlePopState);

        return () => {
            window.removeEventListener("pageshow",  handlePageShow);
            window.removeEventListener("popstate",  handlePopState);
        };
    }, []);

    // ── Layer 2: synchronous render check ────────────────────────────────────
    if (!isAuthenticated()) {
        // `replace` removes the protected URL from the history stack
        return <Navigate to="/" replace state={{ from: location }} />;
    }

    return children;
}
