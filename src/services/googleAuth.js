/**
 * googleAuth.js
 *
 * ── REWRITE RATIONALE ─────────────────────────────────────────────────────
 *
 * The previous version used:
 *   - use_fedcm_for_prompt: true
 *   - google.accounts.id.prompt()           (One Tap)
 *   - google.accounts.id.renderButton()      (fallback only, into a visible div)
 *
 * This combination is the root cause of every reported symptom:
 *
 *   "The given origin is not allowed for the given client ID"
 *   → FedCM's origin-validation handshake is unreliable on http://localhost
 *     even when the origin IS correctly whitelisted in Cloud Console.
 *     FedCM was designed assuming HTTPS; Chrome's FedCM implementation
 *     frequently rejects plain-HTTP origins during local development.
 *
 *   "Second Google button appears"
 *   → One Tap (`prompt()`) was suppressed (a direct consequence of the
 *     FedCM failure above), which triggered the renderButton() fallback —
 *     stacking Google's official button on top of the custom button the
 *     user already clicked.
 *
 *   "Account selection succeeds but nothing happens / backend never called"
 *   → "Cross-Origin-Opener-Policy policy would block the window.postMessage
 *     call" — when the fallback-rendered button opens a popup-style account
 *     chooser, GIS delivers the credential back to the parent window via
 *     postMessage. If anything in the response chain sets a COOP header,
 *     that postMessage is silently dropped and the registered callback is
 *     NEVER invoked. No error surfaces because no request to your backend
 *     is ever made.
 *
 * ── THE FIX ──────────────────────────────────────────────────────────────
 *
 * Removed entirely:
 *   - use_fedcm_for_prompt
 *   - prompt() / One Tap
 *   - the "render only on fallback" pattern
 *
 * New approach — the simplest one that Google's own docs recommend for
 * maximum cross-browser / cross-environment reliability:
 *
 *   1. initialize() once, exactly as before (this part was already correct
 *      and is kept).
 *   2. renderButton() is now the ONLY rendering path — called immediately,
 *      always, into a div that IS the visible button. There is no separate
 *      custom button anymore. What the user sees IS the official Google
 *      button from the very first render. No second button can appear
 *      because there is only ever one button in the DOM.
 *   3. No popup. The official renderButton() flow (without FedCM) delivers
 *      the credential via a direct callback invocation in the same
 *      JS execution context — no cross-window postMessage, no COOP issue.
 *
 * googleSignOut() is unchanged — disableAutoSelect() on logout is still
 * correct practice regardless of which flow is used above it.
 */

let scriptLoadPromise = null;
let initialized       = false;
let activeCallback    = null;

const GIS_SRC = "https://accounts.google.com/gsi/client";

/**
 * Loads the GIS script exactly once. Returns a promise that resolves once
 * window.google.accounts.id is ready to use.
 */
export function loadGoogleScript() {
    if (scriptLoadPromise) return scriptLoadPromise;

    scriptLoadPromise = new Promise((resolve, reject) => {
        if (window.google?.accounts?.id) {
            resolve();
            return;
        }

        const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
        const script = existing || document.createElement("script");

        if (!existing) {
            script.src   = GIS_SRC;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }

        script.addEventListener("load", () => resolve());
        script.addEventListener("error", () =>
            reject(new Error("Failed to load Google Identity Services script"))
        );
    });

    return scriptLoadPromise;
}

/**
 * Initializes GIS exactly once for the lifetime of the page.
 *
 * NOTE: use_fedcm_for_prompt has been removed. FedCM is only relevant to
 * the One Tap prompt() flow, which this file no longer uses. Removing it
 * eliminates the "origin not allowed" / "FedCM NetworkError" failures that
 * occurred specifically on http://localhost during local development.
 *
 * @param {(credentialResponse: { credential: string }) => void} onCredential
 */
export async function initializeGoogleAuth(onCredential) {
    await loadGoogleScript();

    activeCallback = onCredential;

    if (initialized) return;
    initialized = true;

    window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: (response) => {
            if (activeCallback) activeCallback(response);
        },
        // auto_select left false — never silently sign a returning user in
        // without an explicit click; avoids surprising behaviour and the
        // FedCM auto-select edge cases entirely.
        auto_select: false,
        // use_fedcm_for_prompt removed — this file no longer calls prompt()
        // at all, so the flag has no effect and only existed to enable a
        // code path that was actively causing failures.
    });
}

/**
 * Renders the official Google Sign-In button into the given element.
 * This is now the ONLY way a Google button appears on the page — there is
 * no custom button and no One Tap prompt, so there is no possibility of
 * two buttons ever being visible simultaneously.
 *
 * Safe to call multiple times for the same element (e.g. on re-render) —
 * GIS replaces the previous button content in place.
 *
 * @param {string} elementId - id of the <div> the button should render into
 */
export function renderGoogleButton(elementId) {
    if (!window.google?.accounts?.id) return;

    const el = document.getElementById(elementId);
    if (!el) return;

    window.google.accounts.id.renderButton(el, {
        theme:  "filled_black",
        size:   "large",
        width:  340,
        text:   "continue_with",
        shape:  "rectangular",
    });
}

/**
 * Call this on logout. Tells GIS that the user has explicitly signed out,
 * clearing the auto-select credential state so a future sign-in shows the
 * account chooser again rather than silently re-selecting the same account.
 */
export function googleSignOut() {
    try {
        window.google?.accounts?.id?.disableAutoSelect();
    } catch {
        // GIS not loaded yet — nothing to disable, safe to ignore
    }
}
