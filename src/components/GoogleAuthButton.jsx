import { useState, useEffect, useId } from "react";
import { initializeGoogleAuth, renderGoogleButton } from "../services/googleAuth";

export default function GoogleAuthButton({ label, onSuccess, onError, authAPI, storeSession }) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady]     = useState(false);
  const reactId   = useId();
  const elementId = "google-btn-" + reactId.replace(/[:]/g, "");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await initializeGoogleAuth(async (response) => {
          setLoading(true);
          try {
            const res = await authAPI.googleLogin({ credential: response.credential });
            storeSession(res.data);
            onSuccess();
          } catch (err) {
            onError(
              err.response?.data?.message ||
              err.response?.data?.error ||
              "Google sign-in failed. Please try again."
            );
          } finally {
            setLoading(false);
          }
        });

        if (!cancelled) {
          renderGoogleButton(elementId);
          setReady(true);
        }
      } catch {
        if (!cancelled) onError("Google Sign-In is not available right now.");
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{ position: "relative", width: "100%" }}
      onMouseEnter={(e) => {
        const face = e.currentTarget.querySelector(".gab-face");
        if (face) {
          face.style.borderColor = "rgba(255,255,255,0.24)";
          face.style.background  = "rgba(255,255,255,0.09)";
          face.style.boxShadow   = "0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)";
          face.style.transform   = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        const face = e.currentTarget.querySelector(".gab-face");
        if (face) {
          face.style.borderColor = "rgba(255,255,255,0.13)";
          face.style.background  = "rgba(255,255,255,0.05)";
          face.style.boxShadow   = "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)";
          face.style.transform   = "translateY(0px)";
        }
      }}
      onMouseDown={(e) => {
        const face = e.currentTarget.querySelector(".gab-face");
        if (face) {
          face.style.transform  = "translateY(0px)";
          face.style.boxShadow  = "0 1px 4px rgba(0,0,0,0.3)";
          face.style.background = "rgba(255,255,255,0.06)";
        }
      }}
      onMouseUp={(e) => {
        const face = e.currentTarget.querySelector(".gab-face");
        if (face) {
          face.style.transform  = "translateY(-1px)";
          face.style.boxShadow  = "0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)";
          face.style.background = "rgba(255,255,255,0.09)";
        }
      }}
    >

      {/*
       * ── FIX APPLIED HERE ────────────────────────────────────────────────
       *
       * BEFORE (broken in Chrome/Edge/Brave):
       *   - overflow: "hidden" clipped the GIS iframe
       *   - width: 340 hardcoded in renderGoogleButton caused the iframe to
       *     be narrower than the container on some viewports/zoom levels
       *   - Clicks on the gap between the iframe edge and the container edge
       *     registered on the wrapper div, NOT on the iframe
       *   - Chrome requires the popup to be opened from a direct click inside
       *     the iframe (user activation); a click on the wrapper doesn't count
       *   - Result: "Opening multiple popups was blocked due to lack of user
       *     activation" — button silently does nothing in Chrome
       *
       * AFTER (fixed):
       *   - overflow removed so the iframe isn't clipped
       *   - CSS below forces the GIS iframe and its wrapper div to be 100%
       *     wide and at least 50px tall, filling the container exactly
       *   - Every click on our custom button face passes through to the
       *     iframe's full surface area, satisfying Chrome's user-activation
       *     requirement
       *   - use_fedcm_for_button: false in googleAuth.js ensures all
       *     Chromium browsers use the classic iframe path, not FedCM
       * ────────────────────────────────────────────────────────────────────
       */}

      {/* ── INVISIBLE GIS IFRAME (handles all auth click events) ── */}
      <div
        id={elementId}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          opacity: 0,
          // overflow: "hidden" intentionally removed — it was clipping the
          // GIS iframe and causing click-miss in Chrome (see comment above)
          borderRadius: 13,
          display: "flex",
          alignItems: "stretch",
          cursor: "pointer",
          pointerEvents: loading ? "none" : "auto",
        }}
      />

      {/* ── STYLES ── */}
      <style>{`
        /*
         * Force the iframe Google injects to fill our invisible container
         * completely. This is the critical fix for Chrome's user-activation
         * check — the iframe must cover every pixel the user can click.
         */
        #${elementId} > div,
        #${elementId} > div > div {
          width: 100% !important;
          height: 100% !important;
        }
        #${elementId} iframe {
          width: 100% !important;
          height: 100% !important;
          min-height: 50px !important;
          margin: 0 !important;
          display: block !important;
        }

        /* Hover / focus styles for the custom button face */
        .gab-hover-target:hover ~ .gab-face,
        .gab-hover-target:focus-visible ~ .gab-face {
          border-color: rgba(255,255,255,0.24) !important;
          background: rgba(255,255,255,0.09) !important;
          box-shadow: 0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08) !important;
          transform: translateY(-1px) !important;
        }
        .gab-hover-target:active ~ .gab-face {
          transform: translateY(0px) !important;
          background: rgba(255,255,255,0.06) !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3) !important;
        }
        .gab-hover-target:focus-visible {
          outline: none;
        }
        .gab-hover-target:focus-visible ~ .gab-face {
          outline: 2px solid rgba(124,58,237,0.6);
          outline-offset: 2px;
        }
      `}</style>

      {/* ── CUSTOM VISUAL BUTTON (pure UI — pointer-events none) ── */}
      <div
        className="gab-face"
        aria-label={label}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: 50,
          borderRadius: 13,
          border: "1px solid rgba(255,255,255,0.13)",
          background: "rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          cursor: "pointer",
          pointerEvents: "none",
          transition: "border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
          userSelect: "none",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Google SVG logo — official colours */}
        <svg
          width="20" height="20" viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ flexShrink: 0, display: "block" }}
        >
          <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.4a4.62 4.62 0 0 1-2 3.04v2.52h3.23c1.89-1.74 2.97-4.3 2.97-7.35Z" fill="#4285F4"/>
          <path d="M10 20c2.7 0 4.97-.89 6.63-2.42l-3.23-2.52c-.9.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H1.06v2.6A10 10 0 0 0 10 20Z" fill="#34A853"/>
          <path d="M4.39 11.89A6.01 6.01 0 0 1 4.08 10c0-.65.12-1.29.31-1.89V5.51H1.06A10 10 0 0 0 0 10c0 1.61.38 3.13 1.06 4.49l3.33-2.6Z" fill="#FBBC05"/>
          <path d="M10 3.98c1.47 0 2.79.51 3.83 1.5l2.87-2.87C14.97.99 12.7 0 10 0A10 10 0 0 0 1.06 5.51l3.33 2.6C5.18 5.74 7.39 3.98 10 3.98Z" fill="#EA4335"/>
        </svg>

        <span style={{
          fontSize: 14,
          fontWeight: 500,
          color: "rgba(226,232,240,0.9)",
          letterSpacing: "0.01em",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}>
          {label}
        </span>
      </div>

      <div
        className="gab-hover-target"
        tabIndex={-1}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          borderRadius: 13,
          cursor: "pointer",
          pointerEvents: "none",
        }}
      />

      {/* ── LOADING OVERLAY ── */}
      {loading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 4,
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, fontSize: 13,
          color: "rgba(226,232,240,0.8)",
          background: "rgba(5,5,10,0.7)",
          backdropFilter: "blur(6px)",
          borderRadius: 13,
          pointerEvents: "none",
        }}>
          <span style={{
            width: 16, height: 16,
            border: "2px solid rgba(255,255,255,0.2)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            display: "block",
            animation: "spin-slow 0.8s linear infinite",
            flexShrink: 0,
          }} />
          <span style={{ fontWeight: 500, letterSpacing: "0.01em" }}>Connecting…</span>
        </div>
      )}

      {/* ── SKELETON (shown until GIS renders) ── */}
      {!ready && !loading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 3,
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 12,
          borderRadius: 13,
          pointerEvents: "none",
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: "50%",
            background: "linear-gradient(90deg, rgba(255,255,255,0.07) 25%, rgba(255,255,255,0.13) 50%, rgba(255,255,255,0.07) 75%)",
            flexShrink: 0,
          }} />
          <div style={{
            height: 12, width: 138, borderRadius: 6,
            background: "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.11) 50%, rgba(255,255,255,0.06) 75%)",
          }} />
        </div>
      )}

    </div>
  );
}
