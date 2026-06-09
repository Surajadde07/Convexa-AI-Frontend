/**
 * ProtectedRoute.jsx
 *
 * Root cause of Bug #6 (back-button security):
 *
 * The old implementation only checked isAuthenticated() once at render time.
 * After logout, clearSession() removes the token from localStorage, but the
 * browser's History API keeps the previous URL in the stack. When the user
 * presses Back, React Router renders the protected component again FROM CACHE —
 * the component mounts, isAuthenticated() now returns false, and we redirect.
 * BUT: some browsers show a "flash" of the cached page before the JS runs,
 * and React's concurrent mode can delay effects.
 *
 * The fix has two parts:
 *
 * 1. REPLACE state={{ from: location }} with replace={true} on the <Navigate>.
 *    `replace` rewrites the history entry instead of pushing a new one, so
 *    pressing Back from /login doesn't go back to /dashboard — it goes to
 *    whatever was before /dashboard (e.g. /landing or external).
 *
 * 2. Add a popstate listener that re-checks auth on every browser navigation
 *    event. This catches the exact back-button scenario: when the browser
 *    pops back to a protected URL, we immediately redirect before any render.
 *
 * 3. Use window.location.replace() (not navigate()) so the protected URL is
 *    completely removed from the history stack — the user cannot navigate
 *    forward to it again.
 */

import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "../services/api";

export default function ProtectedRoute({ children }) {
    const location = useLocation();

    // Re-check on every popstate (back/forward button press)
    useEffect(() => {
        const handlePop = () => {
            if (!isAuthenticated()) {
                // Replace the protected URL entirely — user can't forward back to it
                window.location.replace("/login");
            }
        };
        window.addEventListener("popstate", handlePop);
        return () => window.removeEventListener("popstate", handlePop);
    }, []);

    if (!isAuthenticated()) {
        // `replace` rewrites the history entry so Back won't return here
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return children;
}
