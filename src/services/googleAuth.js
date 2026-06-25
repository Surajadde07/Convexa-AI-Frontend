/**
 * googleAuth.js
 *
 * ── BUG FIX: stale `initialized` flag + stale `activeCallback` ───────────
 *
 * PROBLEM:
 *   `initialized` was a module-scoped boolean that was set to `true` once
 *   and never reset. `activeCallback` was also module-scoped.
 *
 *   When the Google login flow triggered a 401 on a background request,
 *   the response interceptor in api.js redirected to /login, which caused
 *   the React tree to unmount and remount LoginPage + GoogleAuthButton.
 *
 *   On remount, GoogleAuthButton called initializeGoogleAuth(newCallback).
 *   Because `initialized === true`, the function returned early WITHOUT
 *   updating `activeCallback`. The GIS button rendered fine (renderGoogleButton
 *   has no such guard), the user clicked it, GIS fired — but the callback
 *   still pointed at the PREVIOUS component instance's closure. That closure
 *   held a stale `navigate`, stale `setLoading`, stale `onError`, and in
 *   some cases a stale `authAPI` reference. The result: either the backend
 *   was never called, or the response was silently swallowed and the UI
 *   showed nothing.
 *
 * FIX:
 *   `activeCallback` is always updated regardless of whether the GIS SDK
 *   has already been initialized. The `initialized` flag guards only the
 *   one-time `google.accounts.id.initialize()` call (which must only run
 *   once per page lifetime per GIS contract). The callback registration
 *   inside GIS itself uses the `activeCallback` indirection, so updating
 *   activeCallback is sufficient — GIS will call the new closure on next
 *   credential selection without needing re-initialization.
 *
 *   This means:
 *   - GIS SDK: initialized once ✓
 *   - google.accounts.id.initialize(): called once ✓
 *   - activeCallback: always points to the latest mounted component ✓
 *   - No stale closures ✓
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
    const script   = existing || document.createElement("script");

    if (!existing) {
      script.src   = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load",  () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("Failed to load Google Identity Services script"))
    );
  });

  return scriptLoadPromise;
}

/**
 * Prepares GIS for use.
 *
 * ALWAYS updates activeCallback so the latest mounted component's closure
 * is used — regardless of whether GIS was already initialized.
 *
 * google.accounts.id.initialize() is called only once (GIS requirement).
 * The callback passed to initialize() is a stable wrapper that delegates
 * to activeCallback, so updating activeCallback is sufficient to "re-wire"
 * the credential response to the current component.
 *
 * @param {(credentialResponse: { credential: string }) => void} onCredential
 */
export async function initializeGoogleAuth(onCredential) {
  await loadGoogleScript();

  // ── CRITICAL FIX: always update the active callback ──────────────────────
  // This must happen BEFORE the `initialized` early-return so that remounted
  // components always receive their credential responses, even when GIS
  // was initialized by an earlier mount.
  activeCallback = onCredential;

  if (initialized) return;
  initialized = true;

  window.google.accounts.id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    // The callback is a stable wrapper — it delegates to `activeCallback`,
    // which is always the latest mounted component's handler (updated above).
    callback: (response) => {
      if (activeCallback) activeCallback(response);
    },
    auto_select: false,
    // use_fedcm_for_prompt intentionally omitted — see original rationale.
  });
}

/**
 * Renders the official Google Sign-In button into the given element.
 * This is the only rendering path — no custom button, no One Tap prompt.
 *
 * Safe to call multiple times for the same element — GIS replaces the
 * previous button content in place.
 *
 * @param {string} elementId - id of the <div> the button should render into
 */
export function renderGoogleButton(elementId) {
  if (!window.google?.accounts?.id) return;

  const el = document.getElementById(elementId);
  if (!el) return;

  window.google.accounts.id.renderButton(el, {
    theme: "filled_black",
    size:  "large",
    width: 340,
    text:  "continue_with",
    shape: "rectangular",
  });
}

/**
 * Call this on logout. Clears GIS auto-select state so the next sign-in
 * shows the account chooser instead of silently reselecting the same account.
 */
export function googleSignOut() {
  try {
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {
    // GIS not loaded — nothing to disable
  }
}
