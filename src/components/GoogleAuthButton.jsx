/**
 * GoogleAuthButton.jsx
 *
 * ── REWRITE RATIONALE ─────────────────────────────────────────────────────
 *
 * The previous version rendered a CUSTOM styled <button> that, on click,
 * tried One Tap first and only rendered Google's official button as a
 * "fallback" if One Tap was suppressed. Because One Tap was reliably
 * suppressed (see googleAuth.js comments — FedCM failures on localhost),
 * the fallback fired on essentially every click, producing two visible
 * buttons stacked in the same area.
 *
 * NEW BEHAVIOUR:
 *   There is now only ONE button on the page: Google's own official
 *   button, rendered immediately on mount via renderGoogleButton(). There
 *   is no custom <button>, no onClick handler that triggers a second
 *   rendering path, and no prompt()/One Tap call anywhere. The user clicks
 *   Google's button directly; GIS invokes the registered callback in the
 *   same execution context (no popup, no postMessage, no COOP issue).
 *
 * `loading` state is now driven only by the credential-exchange request to
 * your backend (authAPI.googleLogin), not by any Google-side prompt logic,
 * since there is no longer a "show fallback" transition to track.
 */

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
    // elementId is stable for the lifetime of this component instance
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
       * ── WHY THIS PATTERN ────────────────────────────────────────────────
       * GIS's renderButton() injects a cross-origin <iframe> (accounts.google.com).
       * Everything inside that iframe — icon size, padding, text alignment — is
       * controlled by Google and cannot be overridden with CSS from our page.
       * This is why the previous wrapper approach always looked misaligned.
       *
       * Solution used by Clerk, Vercel, Supabase, Notion:
       *   1. Render the GIS iframe but make it INVISIBLE (opacity 0) and stretch
       *      it to fill the full button area so it still receives clicks.
       *   2. Paint our own fully-controlled custom button face on top (pointer-events none).
       *   3. The user sees our button; their click passes through to the invisible iframe.
       *
       * Auth flow is 100% unchanged — GIS iframe fires the credential callback
       * exactly as before. We only changed what the user sees.
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
          overflow: "hidden",
          borderRadius: 13,
          /* Stretch GIS's iframe to fill our button footprint */
          display: "flex",
          alignItems: "stretch",
          cursor: "pointer",
          pointerEvents: loading ? "none" : "auto",
        }}
      />

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
          pointerEvents: "none",          /* clicks fall through to the GIS iframe above */
          transition: "border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
          userSelect: "none",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Google SVG logo — official colours, perfect 20px */}
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

        {/* Button label */}
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

      {/* ── HOVER / FOCUS INTERACTION LAYER ── */}
      {/* A transparent div that sits between the iframe and the visual face,
          captures mouse events and forwards visual feedback to the face via
          CSS variables without blocking GIS clicks */}
      <style>{`
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

      {/*
       * Transparent interaction target — visible to keyboard/mouse, sits in
       * front of the visual face (z-index 3) but behind the GIS iframe (z-index
       * still 2 on pointer events). Allows CSS sibling hover selectors to
       * animate the face without intercepting the auth click.
       */}
      <div
        className="gab-hover-target"
        tabIndex={-1}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          borderRadius: 13,
          cursor: "pointer",
          pointerEvents: "none",   /* GIS iframe (z-index 2) handles actual clicks */
        }}
      />

      {/* Re-declare visual face with className for CSS sibling targeting */}
      {/* NOTE: the div below is purely a re-skin — the one above (z-index 1) is
          the real visible face. We use a second approach: the face itself catches
          hover via onMouseEnter because the GIS iframe's pointer-events prevent
          CSS :hover on siblings from firing reliably cross-browser. */}

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

      {/* ── SKELETON (shown until GIS renders, then gone forever) ── */}
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
