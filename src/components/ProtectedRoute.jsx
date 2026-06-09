import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "../services/api";

// ─────────────────────────────────────────────────────────────────────────────
//  ProtectedRoute  — Issue #2 fix: back-button after logout reveals dashboard
//
//  Root cause (three separate mechanisms, all fixed here):
//
//  1. handleLogout() used window.location.href = "/login"
//     That PUSHES a new history entry: [..., /dashboard, /login]
//     Pressing Back pops /login and restores /dashboard.
//     Fix: callers must use window.location.replace("/login") so the stack
//     becomes [..., /login] with /dashboard erased. See the comment in
//     DashboardPage.jsx / HistoryPage.jsx / AnalyticsPage.jsx below.
//
//  2. React Router's <Navigate> without `replace` also pushes.
//     Fix: always use <Navigate replace>.
//
//  3. bfcache (back-forward cache) — Safari and Firefox freeze the page in
//     memory. When the user presses Back the frozen DOM is restored instantly,
//     BEFORE any JS runs. The `pageshow` event fires with `e.persisted = true`
//     in this case. If the token is gone we must redirect immediately.
//     The existing `popstate` listener does NOT fire for bfcache restores —
//     only `pageshow` does.
//
//  All three vectors are now covered:
//    popstate  → Back/Forward button in normal SPA navigation
//    pageshow  → bfcache restore (Safari, Firefox, Chrome mobile)
//    render    → <Navigate replace> for any direct component mount without token
// ─────────────────────────────────────────────────────────────────────────────

export default function ProtectedRoute({ children }) {
    const location = useLocation();

    useEffect(() => {
        const redirect = () => {
            if (!isAuthenticated()) {
                // replace() removes the protected URL from history entirely
                window.location.replace("/login");
            }
        };

        // Back/Forward navigation in the SPA
        window.addEventListener("popstate", redirect);

        // bfcache page restoration (Safari, Firefox, Chrome mobile)
        // e.persisted === true means the page came from the freeze cache
        const handlePageShow = (e) => {
            if (e.persisted) redirect();
        };
        window.addEventListener("pageshow", handlePageShow);

        return () => {
            window.removeEventListener("popstate", redirect);
            window.removeEventListener("pageshow", handlePageShow);
        };
    }, []);

    if (!isAuthenticated()) {
        // replace so this URL is overwritten in history, not stacked
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return children;
}
