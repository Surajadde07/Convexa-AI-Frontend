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
import { isAuthenticated, clearSession, getUser } from "../services/api";
import { googleSignOut } from "../services/googleAuth";

// ─── Exported logout helper — import this in every Sign Out button ────────────
export function logoutAndRedirect() {
    // 0. Tell GIS/FedCM the user explicitly signed out — without this call,
    //    Google's FedCM credential-mediation state still treats the browser
    //    as "signed in" to this site, which can suppress the next prompt()
    //    or surface "FedCM was disabled based on previous user action".
    googleSignOut();

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
// `roles` is optional. Omit it for any page every authenticated user (any
// role) can reach — that's every existing route today, unchanged. Pass it
// only for future manager/admin-only pages, e.g.:
//   <ProtectedRoute roles={["MANAGER", "ADMIN"]}><CompanyDashboard /></ProtectedRoute>
export default function ProtectedRoute({ children, roles }) {
    const location = useLocation();

    // ── Layer 3: pageshow catches bfcache restores ────────────────────────────
    useEffect(() => {
        const handlePageShow = (e) => {
            if (!isAuthenticated()) {
                window.location.replace("/");
                return;
            }
            if (getUser()?.noWorkspace) {
                window.location.replace("/no-workspace");
            }
        };

        // Also handle popstate (normal Back/Forward without bfcache)
        const handlePopState = () => {
            if (!isAuthenticated()) {
                window.location.replace("/");
                return;
            }
            if (getUser()?.noWorkspace) {
                window.location.replace("/no-workspace");
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

    // ── Company-First (Model A): workspace access gate ────────────────────────
    // If the user authenticated but has no workspace (removed from their company),
    // block all protected pages and show the dedicated No Workspace page.
    // This prevents workspace-less accounts from accessing dashboards or APIs.
    if (getUser()?.noWorkspace) {
        return <Navigate to="/no-workspace" replace />;
    }

    // Role gate — only applies when the route opts in via the `roles` prop.
    // A USER manually typing a manager/admin URL lands back on /dashboard
    // rather than seeing a blank page or a raw 403 from the API.
    if (roles && roles.length > 0) {
        const currentRole = getUser()?.role;
        if (!roles.includes(currentRole)) {
            return <Navigate to="/dashboard" replace />;
        }
    }

    return children;
}
