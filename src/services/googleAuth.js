
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
 * remounted components always get their credential responses.
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
    auto_select: false,

    // Disables FedCM for the One Tap prompt.
    use_fedcm_for_prompt: false,

    // FIX: Disables FedCM for the Sign In button click as well.
    //
    // Without this, Chrome/Edge/Brave use the FedCM API for the button,
    // which requires the click to originate inside Google's own iframe.
    // Because our invisible GIS iframe can be fractionally misaligned with
    // our custom button face, Chrome logs:
    //   "Opening multiple popups was blocked due to lack of user activation."
    // and silently swallows the click — the button appears to do nothing.
    //
    // Setting this to false forces all Chromium browsers onto the classic
    // iframe/postMessage path (the same path Firefox always uses), which
    // our COOP headers (same-origin-allow-popups) already support.
    use_fedcm_for_button: false,
  });
}

/**
 * Renders the official Google Sign-In button.
 *
 * FIX: width is now read from the actual container element instead of being
 * hardcoded to 340. A hardcoded width caused the GIS iframe to be slightly
 * narrower than the wrapper div on some screen sizes/zoom levels, creating
 * a gap where clicks hit the wrapper but miss the iframe. Chrome treats
 * those misses as "no user activation" and blocks the popup. Reading
 * offsetWidth guarantees the iframe fills the container exactly.
 *
 * @param {string} elementId
 */
export function renderGoogleButton(elementId) {
  if (!window.google?.accounts?.id) return;

  const el = document.getElementById(elementId);
  if (!el) return;

  // Use the actual rendered width of the container so the iframe fills it
  // exactly. Fall back to 400 if the element isn't in the layout yet.
  const containerWidth = el.offsetWidth || 400;

  window.google.accounts.id.renderButton(el, {
    theme: "filled_black",
    size:  "large",
    width: containerWidth,
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
  }
}
