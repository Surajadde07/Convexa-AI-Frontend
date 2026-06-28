let scriptLoadPromise = null;
let initialized       = false;
let activeCallback    = null;

const GIS_SRC = "https://accounts.google.com/gsi/client";

export function loadGoogleScript() {
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) { resolve(); return; }

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

export async function initializeGoogleAuth(onCredential) {
  await loadGoogleScript();

  // Always update callback before the initialized guard — handles remounts
  activeCallback = onCredential;

  if (initialized) return;
  initialized = true;

  window.google.accounts.id.initialize({
    client_id:            import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback:             (response) => { if (activeCallback) activeCallback(response); },
    auto_select:          false,
    use_fedcm_for_prompt: false,
    // Keeps Chromium browsers on the classic iframe/postMessage path.
    // Without this, Chrome uses FedCM for the button click and silently
    // blocks it when COOP is anything other than "unsafe-none".
    use_fedcm_for_button: false,
  });
}

/**
 * Renders the GIS button VISIBLY inside elementId.
 * The button is rendered at the full pixel width of the container,
 * measured after a rAF so the element is guaranteed to be laid out.
 */
export function renderGoogleButton(elementId, onReady) {
  if (!window.google?.accounts?.id) return;

  // Wait one animation frame so the container has a real offsetWidth
  requestAnimationFrame(() => {
    const el = document.getElementById(elementId);
    if (!el) return;

    const w = el.getBoundingClientRect().width || el.offsetWidth || 400;

    window.google.accounts.id.renderButton(el, {
      theme: "filled_black",
      size:  "large",
      width: Math.floor(w),
      text:  "continue_with",
      shape: "rectangular",
    });

    if (onReady) onReady();
  });
}

export function googleSignOut() {
  try { window.google?.accounts?.id?.disableAutoSelect(); } catch {}
}