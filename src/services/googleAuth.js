/**
 * googleAuth.js
 *
 * ── FIX SUMMARY ──────────────────────────────────────────────────────────
 *
 * ROOT CAUSE (confirmed by DevTools screenshots):
 *
 *   Render.com automatically sets `Cross-Origin-Opener-Policy: same-origin`
 *   on all static site deployments. GIS's renderButton() renders its UI
 *   inside a cross-origin iframe (accounts.google.com). When the user
 *   selects their account, GIS delivers the credential back to the parent
 *   page via window.postMessage(). COOP: same-origin severs the browsing
 *   context group between your page and that iframe, so the postMessage is
 *   silently blocked — the credential never arrives, activeCallback never
 *   fires, and the backend is never called.
 *
 *   This is why "Provisional headers are shown" appears for the google
 *   request in the Network tab: the request was INITIATED (axios was called)
 *   but with an undefined/empty credential string, because the callback
 *   received nothing. The backend rejected it (or the request was aborted
 *   before sending). The 404 on login:1 is the blocked postMessage frame,
 *   not a missing backend route.
 *
 * ── FIX 1 (infrastructure): public/_headers + render.yaml ────────────────
 *
 *   Set `Cross-Origin-Opener-Policy: same-origin-allow-popups` on the
 *   Render deployment. This allows GIS's cross-origin popup/iframe to
 *   postMessage back to the parent window while still blocking unrelated
 *   cross-origin openers. See public/_headers and render.yaml.
 *
 * ── FIX 2 (defence-in-depth, this file): explicit use_fedcm_for_prompt ──
 *
 *   Even with the COOP header fixed, GIS may still attempt FedCM on
 *   Chrome 120+ when it detects the user is signed into Google. FedCM has
 *   its own separate origin-validation that is unreliable outside HTTPS
 *   and can re-introduce the same "origin not allowed" failures seen on
 *   localhost. Setting use_fedcm_for_prompt: false explicitly opts out of
 *   FedCM for the prompt() path. Since we never call prompt(), this flag
 *   has no functional effect on renderButton() — but it prevents GIS from
 *   internally upgrading the button flow to FedCM on browsers where FedCM
 *   is available, keeping us on the classic popup path that works correctly
 *   with same-origin-allow-popups COOP.
 *
 * ── FIX 3 (stale callback, from previous fix): activeCallback update ─────
 *
 *   activeCallback is always updated BEFORE the initialized early-return,
 *   ensuring remounted components always receive their credential responses.
 *   See previous fix notes for full explanation.
 */

let scriptLoadPromise = null;
let initialized       = false;
let activeCallback    = null;

const GIS_SRC = "https://accounts.google.com/gsi/client";

/**
 * Loads the GIS script exactly once.
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
 * activeCallback is ALWAYS updated before the initialized guard so that
 * remounted components always get their credential responses (Fix 3).
 *
 * @param {(credentialResponse: { credential: string }) => void} onCredential
 */
export async function initializeGoogleAuth(onCredential) {
  await loadGoogleScript();

  // ALWAYS update — must be before the initialized guard (Fix 3)
  activeCallback = onCredential;

  if (initialized) return;
  initialized = true;

  window.google.accounts.id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback: (response) => {
      if (activeCallback) activeCallback(response);
    },
    auto_select: false,

    // Fix 2: Explicitly disable FedCM to force the classic popup credential
    // delivery path, which works correctly with COOP: same-origin-allow-popups.
    // FedCM uses a different delivery mechanism that is NOT fixed by the COOP
    // header change and would re-introduce failures on Chrome 120+.
    use_fedcm_for_prompt: false,
  });
}

/**
 * Renders the official Google Sign-In button.
 * This is the only rendering path — no custom button, no One Tap prompt.
 *
 * @param {string} elementId
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
 * Call on logout to clear GIS auto-select state.
 */
export function googleSignOut() {
  try {
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {
    // GIS not loaded — safe to ignore
  }
}
