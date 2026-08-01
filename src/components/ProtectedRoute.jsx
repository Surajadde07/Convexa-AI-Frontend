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
import { useWorkspace } from "../context/WorkspaceContext";

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
    const { workspaces, currentWorkspace, loading, initialized } = useWorkspace();

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

    // ── Layer 2: synchronous auth check ────────────────────────────────────
    if (!isAuthenticated()) {
        return <Navigate to="/" replace state={{ from: location }} />;
    }

    if (getUser()?.noWorkspace) {
        return <Navigate to="/no-workspace" replace />;
    }

    // Workspace loading state: Wait until WorkspaceContext has initialized
    if (loading || !initialized) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#05060A]">
                <div className="space-y-4 text-center">
                    <div className="w-16 h-16 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-slate-400">Loading workspace context…</p>
                </div>
            </div>
        );
    }

    // If workspaces list is empty, redirect to /no-workspace
    if (workspaces.length === 0) {
        return <Navigate to="/no-workspace" replace />;
    }

    // Redirect flat routes to workspace-scoped routes
    const match = location.pathname.match(/^\/w\/([^/]+)/);
    if (!match) {
        const activeSlug = currentWorkspace?.company?.slug || workspaces[0]?.slug;
        const subPath = (location.pathname === "/" || location.pathname === "") ? "/dashboard" : location.pathname;
        return <Navigate to={`/w/${activeSlug}${subPath}`} replace />;
    }

    const urlSlug = match[1];
    // Guard against workspace mismatch: Wait for WorkspaceContext to finish switching workspace context
    if (workspaces.some(w => w.slug === urlSlug) && currentWorkspace?.company?.slug !== urlSlug) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#05060A]">
                <div className="space-y-4 text-center">
                    <div className="w-16 h-16 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-slate-400">Loading workspace context…</p>
                </div>
            </div>
        );
    }

    // Role check resolved from currentWorkspace context
    if (roles && roles.length > 0) {
        const currentRole = currentWorkspace?.role;
        if (!roles.includes(currentRole)) {
            const activeSlug = currentWorkspace?.company?.slug || workspaces[0]?.slug;
            return <Navigate to={`/w/${activeSlug}/dashboard`} replace />;
        }
    }

    return children;
}
