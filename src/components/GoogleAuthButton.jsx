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
    <div style={{ position: "relative", width: "100%" }}>
      {/* This div IS the button — GIS renders its own iframe button inside it.
          There is no separate custom button anywhere in this component. */}
      <div
        id={elementId}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          minHeight: 44,
          opacity: loading ? 0.5 : 1,
          pointerEvents: loading ? "none" : "auto",
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Skeleton shown only until GIS finishes rendering its button,
          so the layout doesn't jump. Disappears the instant renderButton()
          completes — it is never shown again afterward, so it can never
          appear stacked with the real button. */}
      {!ready && (
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, color: "rgba(226,232,240,0.4)",
        }}>
          Loading {label}…
        </div>
      )}

      {loading && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, fontSize: 13, color: "rgba(226,232,240,0.6)",
          background: "rgba(5,5,10,0.55)", borderRadius: 14,
        }}>
          <span style={{
            width: 14, height: 14,
            border: "2px solid rgba(255,255,255,0.25)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin-slow 0.8s linear infinite",
          }} />
          Connecting…
        </div>
      )}
    </div>
  );
}
