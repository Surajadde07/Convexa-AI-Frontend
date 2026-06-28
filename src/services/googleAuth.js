
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

  activeCallback = onCredential;

  if (initialized) return;
  initialized = true;

  window.google.accounts.id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback: (response) => {
      if (activeCallback) activeCallback(response);
    },
    auto_select: false,

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
  }
}
