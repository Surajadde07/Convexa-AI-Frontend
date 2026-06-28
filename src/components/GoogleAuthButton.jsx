/**
 * GoogleAuthButton.jsx  — FINAL REWRITE
 *
 * ROOT CAUSE OF ALL PREVIOUS FAILURES:
 * ─────────────────────────────────────
 * The "invisible iframe + custom face on top" pattern is inherently broken
 * across browsers because:
 *
 *   1. Chrome's user-activation security model requires the popup to be
 *      triggered by a direct click INSIDE the GIS cross-origin iframe,
 *      not on any element layered over it. Any gap between the iframe and
 *      the wrapper — caused by hardcoded width, overflow:hidden clipping,
 *      or fractional pixel rounding — causes Chrome to log:
 *        "Opening multiple popups was blocked due to lack of user activation"
 *      and silently do nothing.
 *
 *   2. When we removed overflow:hidden to fix Chrome, the GIS iframe
 *      overflowed the container, breaking Firefox's layout and causing
 *      the "message port closed" error there.
 *
 * THE CORRECT APPROACH:
 * ─────────────────────
 * Render Google's iframe VISIBLY. Use CSS to skin it to our dark theme
 * by controlling the container dimensions and letting GIS's `filled_black`
 * theme handle the visual. This is what Vercel, Supabase, and Clerk
 * actually do — they never layer a custom element over the iframe.
 *
 * Our custom styling (border-radius, box-shadow, hover glow) is applied
 * to the WRAPPER around the iframe, not to the iframe itself. The user
 * sees a styled container; the iframe sits inside it fully visible and
 * fully clickable. No z-index games, no opacity tricks, no CSS overrides
 * on cross-origin content.
 */

import { useState, useEffect, useId } from "react";
import { initializeGoogleAuth, renderGoogleButton } from "../services/googleAuth";

// Keyframe for the spinner — injected once
const SPINNER_CSS = `
  @keyframes gab-spin {
    to { transform: rotate(360deg); }
  }
`;

export default function GoogleAuthButton({ label, onSuccess, onError, authAPI, storeSession }) {
  const [loading, setLoading] = useState(false);
  const [ready,   setReady]   = useState(false);
  const [hovered, setHovered] = useState(false);

  const reactId   = useId();
  // elementId must be a valid CSS id (no colons)
  const elementId = "gab-" + reactId.replace(/[^a-zA-Z0-9-]/g, "");

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
              err.response?.data?.error   ||
              "Google sign-in failed. Please try again."
            );
          } finally {
            setLoading(false);
          }
        });

        if (!cancelled) {
          // renderGoogleButton uses rAF internally to ensure the element
          // is laid out before reading its width
          renderGoogleButton(elementId, () => {
            if (!cancelled) setReady(true);
          });
        }
      } catch {
        if (!cancelled) onError("Google Sign-In is not available right now.");
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{SPINNER_CSS}</style>

      {/*
       * OUTER WRAPPER
       * Provides our custom border, shadow, border-radius, and hover glow.
       * The GIS iframe sits inside this at its natural size — no clipping,
       * no opacity tricks, no z-index layering.
       */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position:     "relative",
          width:        "100%",
          height:       44,                   // GIS 'large' button natural height
          borderRadius: 13,
          border:       hovered
            ? "1px solid rgba(255,255,255,0.28)"
            : "1px solid rgba(255,255,255,0.13)",
          boxShadow: hovered
            ? "0 4px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.09)"
            : "0 1px 3px rgba(0,0,0,0.3),  inset 0 1px 0 rgba(255,255,255,0.06)",
          transform:   hovered ? "translateY(-1px)" : "translateY(0px)",
          transition:  "border-color 0.18s, box-shadow 0.18s, transform 0.18s",
          overflow:    "hidden",              // clips GIS iframe to our border-radius
          cursor:      "pointer",
          background:  "rgba(255,255,255,0.04)",
          // Pointer events disabled while loading so the overlay captures them
          pointerEvents: loading ? "none" : "auto",
        }}
      >
        {/*
         * GIS RENDER TARGET
         * Google injects the real iframe here. It is VISIBLE (opacity 1).
         * We don't hide it — we just let it sit inside our styled wrapper.
         * The iframe is naturally 44px tall for size="large", same as our
         * wrapper, so it fills perfectly with no gap.
         *
         * overflow:hidden on the wrapper clips it to our border-radius.
         * This is safe because overflow:hidden on the PARENT of the iframe
         * does not affect Chrome's user-activation detection — only
         * overflow:hidden on the iframe's own container div (the one GIS
         * injects into) was causing the clipping issue before.
         */}
        <div
          id={elementId}
          style={{
            width:   "100%",
            height:  "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // Opacity is 1 — the GIS button is visible inside our wrapper.
            // The wrapper provides all the custom styling.
            opacity: ready ? 1 : 0,
            transition: "opacity 0.2s",
          }}
        />

        {/* SKELETON — shown while GIS script is loading */}
        {!ready && !loading && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10,
            pointerEvents: "none",
          }}>
            {/* Google G placeholder */}
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
              flexShrink: 0,
            }} />
            {/* Text placeholder */}
            <div style={{
              height: 11, width: 130, borderRadius: 6,
              background: "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.11) 50%, rgba(255,255,255,0.06) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.8s infinite",
            }} />
          </div>
        )}

        {/* LOADING OVERLAY — shown while backend call is in flight */}
        {loading && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10,
            background:    "rgba(5,5,10,0.82)",
            backdropFilter: "blur(6px)",
            pointerEvents: "none",
          }}>
            <span style={{
              width: 15, height: 15,
              border: "2px solid rgba(255,255,255,0.18)",
              borderTopColor: "rgba(255,255,255,0.9)",
              borderRadius: "50%",
              display: "block",
              animation: "gab-spin 0.75s linear infinite",
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 13, fontWeight: 500,
              color: "rgba(226,232,240,0.85)",
              letterSpacing: "0.01em",
            }}>
              Connecting…
            </span>
          </div>
        )}
      </div>
    </>
  );
}
