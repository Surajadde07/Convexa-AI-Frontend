import api, { getUser } from "./api.js";

/* ────────────────────────────────────────────────────────────────────── *
 * SettingsService — single source of truth for notification, preference,  *
 * and privacy settings (GET/PATCH /api/settings/me).                      *
 *                                                                          *
 * Theme is deliberately NOT handled here — it lives in ThemeContext.jsx   *
 * because it needs to be available synchronously on first paint (before   *
 * any component has mounted enough to call this service), and it's read   *
 * by every single page rather than only Settings. Everything else here   *
 * (notifications, default landing page, export format, privacy) is only  *
 * read by the Settings page itself, so a plain module-level cache with    *
 * subscriber callbacks is enough — no need for a second React context.    *
 *                                                                          *
 * Usage:                                                                  *
 *   const settings = await settingsService.load();      // fetch-once     *
 *   settingsService.patch({ notifCallReady: false });    // optimistic    *
 *   settingsService.subscribe(setLocalState);            // re-render UI  *
 * ────────────────────────────────────────────────────────────────────── */

const DEFAULTS = {
    theme: "dark",
    notifCallReady: true,
    notifNeedsAttention: true,
    notifWeeklyDigest: true,
    defaultLandingPage: "/dashboard",
    exportFormat: "csv",
    shareAnonymizedData: false,
};

let cache = null; // null until first successful load()
let inFlight = null; // dedupes concurrent load() callers
const subscribers = new Set();

function notify() {
    subscribers.forEach(fn => fn(cache));
}

async function load({ force = false } = {}) {
    if (cache && !force) return cache;
    if (inFlight && !force) return inFlight;

    inFlight = api.get("/api/settings/me")
        .then(res => {
            cache = { ...DEFAULTS, ...res.data };
            notify();
            return cache;
        })
        .catch(err => {
            console.error("Failed to load settings, using defaults:", err);
            cache = { ...DEFAULTS };
            notify();
            return cache;
        })
        .finally(() => { inFlight = null; });

    return inFlight;
}

/**
 * Optimistic partial update: applies `patch` to the cache and notifies
 * subscribers immediately, then fires the PATCH in the background. On
 * failure, rolls back to the pre-patch values and re-notifies so the UI
 * reflects reality rather than silently drifting from the server.
 */
async function patch(partial) {
    if (!getUser()) return null;
    const previous = cache ? { ...cache } : { ...DEFAULTS };
    cache = { ...previous, ...partial };
    notify();

    try {
        const res = await api.patch("/api/settings/me", partial);
        cache = { ...cache, ...res.data };
        notify();
        return cache;
    } catch (err) {
        console.error("Failed to save settings, rolling back:", err);
        cache = previous;
        notify();
        throw err;
    }
}

function subscribe(fn) {
    subscribers.add(fn);
    if (cache) fn(cache);
    return () => subscribers.delete(fn);
}

function getCached() {
    return cache;
}

/** Call on logout so the next login doesn't briefly show a stale user's settings. */
function reset() {
    cache = null;
    inFlight = null;
}

export default { load, patch, subscribe, getCached, reset };
