import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import api, { getUser } from "../services/api.js";
import { THEMES } from "../components/Sidebar.jsx";

/* ────────────────────────────────────────────────────────────────────── *
 * ThemeContext — single global source of truth for light/dark mode.      *
 *                                                                         *
 * Why Context and not Zustand/Redux: theme is a single primitive value   *
 * with one writer and many readers, updated rarely (a handful of times   *
 * per session). That is exactly the shape Context is good at and neither *
 * Zustand's external store nor Redux's action/reducer ceremony buys us   *
 * anything here — they'd be justified if we had many independent slices  *
 * of client state updating at high frequency (e.g. a live call-analysis  *
 * feed), which we don't for theme.                                       *
 *                                                                         *
 * Persistence layers, in priority order:                                 *
 *   1. React state       — instant, drives every re-render.              *
 *   2. localStorage      — read synchronously on first paint so there's  *
 *                           no flash of the wrong theme before the        *
 *                           network round-trip resolves, and so the      *
 *                           theme survives a logged-out visit.           *
 *   3. Backend (/api/settings/me) — the real source of truth once a user *
 *                           is authenticated; makes the preference       *
 *                           follow the user across devices/browsers.     *
 *                           Fetched once on mount, and pushed on every    *
 *                           change (fire-and-forget, optimistic — a      *
 *                           failed PATCH never blocks the UI update).    *
 * ────────────────────────────────────────────────────────────────────── */

const ThemeContext = createContext(null);
const THEME_KEY = "convexa_theme";

function readLocalTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "dark";
}

export function ThemeProvider({ children }) {
    const [themeMode, setThemeModeState] = useState(readLocalTheme);
    const hydratedFromServer = useRef(false);

    // Keep <html> color-scheme and localStorage in sync with every change,
    // so a hard refresh (or a page that hasn't mounted the provider yet,
    // e.g. during the initial paint) never shows the wrong theme.
    useEffect(() => {
        document.documentElement.style.colorScheme = themeMode;
        localStorage.setItem(THEME_KEY, themeMode);
    }, [themeMode]);

    // On mount (i.e. once, per full app load) pull the authoritative value
    // from the backend so theme follows the user across devices. This is
    // intentionally a single fetch, not a subscription — theme changes made
    // by *this* tab are applied immediately via setThemeMode below, and we
    // don't need to poll for changes made elsewhere mid-session.
    useEffect(() => {
        const user = getUser();
        if (!user) return;
        api.get("/api/settings/me")
            .then(res => {
                const serverTheme = res?.data?.theme;
                if (serverTheme === "light" || serverTheme === "dark") {
                    hydratedFromServer.current = true;
                    setThemeModeState(serverTheme);
                }
            })
            .catch(() => {
                // No settings row yet, endpoint not reachable, or logged out —
                // fall back silently to whatever localStorage/default gave us.
            });
    }, []);

    const setThemeMode = useCallback((next) => {
        setThemeModeState(prev => {
            const resolved = typeof next === "function" ? next(prev) : next;
            if (resolved !== prev && getUser()) {
                // Optimistic — UI already reflects `resolved` regardless of
                // whether this succeeds; we log failures instead of surfacing
                // a toast, since a theme PATCH failing shouldn't interrupt
                // the person's flow.
                api.patch("/api/settings/me", { theme: resolved }).catch(err => {
                    console.error("Failed to persist theme preference:", err);
                });
            }
            return resolved;
        });
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeMode(prev => (prev === "dark" ? "light" : "dark"));
    }, [setThemeMode]);

    const value = { themeMode, setThemeMode, toggleTheme, T: THEMES[themeMode] };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useTheme() must be called inside a <ThemeProvider>. Wrap your router/App root in ThemeProvider.");
    }
    return ctx;
}
