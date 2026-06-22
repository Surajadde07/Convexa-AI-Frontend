/**
 * MiniAudioPlayer.jsx
 *
 * ── CLOUDINARY MIGRATION ─────────────────────────────────────────────────────
 * `cloudinaryUrl` is a complete, already-encoded HTTPS URL returned directly
 * by Cloudinary. It must be used AS-IS — no BASE_URL prefix and no
 * encodeURIComponent().
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Bugs fixed in this revision:
 *
 * 1. ERR_CACHE_OPERATION_NOT_SUPPORTED — calling audio.load() on a
 *    preload="none" element forces an immediate cache lookup. Cloudinary
 *    streams use 206 Partial Content responses; Chrome's cache layer cannot
 *    serve a fresh load() from a cached partial range and fires an error
 *    event, which set loadState="error" before the user ever clicked play.
 *    Fix: removed audio.load() — just set audio.src. The browser fetches
 *    only when play() is called, which is the correct behaviour for
 *    preload="none".
 *
 * 2. Listener churn from unstable onStop reference — onStop was in the
 *    event-listener effect's dependency array. Since both parent pages pass
 *    an inline arrow function, every parent re-render caused all listeners
 *    to be removed and re-added, creating a gap where an error event could
 *    fire against a stale handler. Fix: onStop is stored in a ref; the
 *    event-listener effect has no external dependencies and runs once.
 *
 * 3. Error state set before play attempt — the error event listener fired
 *    unconditionally from the load() call, permanently poisoning loadState
 *    for that session. Removing load() (fix 1) eliminates this entirely.
 *    An isAttemptingPlay ref also guards the handler so background errors
 *    never reach the UI.
 */

import { useEffect, useRef, useState } from "react";

export default function MiniAudioPlayer({ cloudinaryUrl, playingId, callId, onPlay, onStop }) {
    const audioRef  = useRef(null);
    const isPlaying = playingId === callId;

    const [loadState, setLoadState] = useState("idle"); // idle | loading | ready | error

    // ── Stable ref for onStop — avoids unstable dependency in effects ────────
    // onStop is an inline arrow in both parent pages, so its reference changes
    // on every parent render. Storing it in a ref means the event-listener
    // effect never needs to re-run due to this prop changing.
    const onStopRef = useRef(onStop);
    useEffect(() => { onStopRef.current = onStop; }, [onStop]);

    // ── Track whether a play() attempt is in flight ──────────────────────────
    // Prevents background / stale error events from poisoning loadState.
    const isAttemptingPlay = useRef(false);

    // ── Sync src when cloudinaryUrl changes — DO NOT call audio.load() ───────
    // Setting .src is sufficient. audio.load() on a preload="none" element
    // triggers an immediate cache/network fetch. Cloudinary uses 206 Partial
    // Content; Chrome cannot serve a fresh load() from a cached partial range
    // and fires net::ERR_CACHE_OPERATION_NOT_SUPPORTED, which the error
    // listener was incorrectly treating as a fatal playback failure.
    // The browser will fetch the resource correctly when play() is called.
    useEffect(() => {
        setLoadState("idle");
        isAttemptingPlay.current = false;
        const audio = audioRef.current;
        if (!audio || !cloudinaryUrl) return;
        audio.src = cloudinaryUrl;
        // No audio.load() here — intentional.
    }, [cloudinaryUrl]);

    // ── Audio element event listeners — stable, run once ────────────────────
    // No external dependencies: onStop is accessed via onStopRef.current.
    // This effect never re-runs mid-playback, eliminating the listener-churn
    // race condition.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onCanPlay = () => setLoadState("ready");

        const onError = () => {
            // Only surface errors that happen during an actual play attempt.
            // Stale cache errors from src assignment or background probing
            // are ignored — they do not reflect a user-visible failure.
            if (!isAttemptingPlay.current) return;
            setLoadState("error");
            onStopRef.current?.();
        };

        const onEnded   = () => { setLoadState("ready"); onStopRef.current?.(); };
        const onWaiting = () => { if (isAttemptingPlay.current) setLoadState("loading"); };
        const onPlaying = () => setLoadState("ready");

        audio.addEventListener("canplay",  onCanPlay);
        audio.addEventListener("error",    onError);
        audio.addEventListener("ended",    onEnded);
        audio.addEventListener("waiting",  onWaiting);
        audio.addEventListener("playing",  onPlaying);

        return () => {
            audio.removeEventListener("canplay",  onCanPlay);
            audio.removeEventListener("error",    onError);
            audio.removeEventListener("ended",    onEnded);
            audio.removeEventListener("waiting",  onWaiting);
            audio.removeEventListener("playing",  onPlaying);
        };
    }, []); // intentionally empty — stable via refs

    // ── When another call takes over, pause this one ─────────────────────────
    useEffect(() => {
        if (!isPlaying && audioRef.current) {
            audioRef.current.pause();
            isAttemptingPlay.current = false;
        }
    }, [isPlaying]);

    // ── Toggle play / pause ──────────────────────────────────────────────────
    const toggle = async (e) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio || loadState === "error") return;

        if (isPlaying) {
            audio.pause();
            isAttemptingPlay.current = false;
            onStop?.();
        } else {
            setLoadState("loading");
            isAttemptingPlay.current = true;
            onPlay?.(callId);
            try {
                await audio.play();
                setLoadState("ready");
            } catch (err) {
                isAttemptingPlay.current = false;
                if (err.name !== "AbortError") {
                    setLoadState("error");
                    onStop?.();
                }
            }
        }
    };

    if (!cloudinaryUrl) return null;

    const isLoading = isPlaying && loadState === "loading";
    const isError   = loadState === "error";

    return (
        <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}
            onClick={e => e.stopPropagation()}>
            <audio ref={audioRef} preload="none" />

            {/* Play / Pause / Error / Loading button */}
            <button
                onClick={toggle}
                disabled={isError}
                title={isError ? "Audio unavailable" : isPlaying ? "Pause" : "Play audio"}
                style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: isError
                        ? "1px solid rgba(239,68,68,0.25)"
                        : isPlaying
                            ? "1px solid rgba(139,92,246,0.45)"
                            : "1px solid rgba(255,255,255,0.1)",
                    background: isError
                        ? "rgba(239,68,68,0.1)"
                        : isPlaying
                            ? "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(37,99,235,0.25))"
                            : "rgba(255,255,255,0.05)",
                    cursor: isError ? "not-allowed" : "pointer",
                    boxShadow: isPlaying ? "0 0 10px rgba(139,92,246,0.25)" : "none",
                    transition: "all 0.2s",
                }}
                onMouseEnter={e => {
                    if (!isError && !isPlaying) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                    }
                }}
                onMouseLeave={e => {
                    if (!isError && !isPlaying) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                    }
                }}
            >
                {isError ? (
                    <span style={{ fontSize:11, color:"#f87171" }}>✕</span>
                ) : isLoading ? (
                    <span style={{
                        width:10, height:10, display:"block",
                        border:"1.5px solid rgba(167,139,250,0.35)",
                        borderTopColor:"#a78bfa", borderRadius:"50%",
                        animation:"miniSpin .7s linear infinite",
                    }} />
                ) : isPlaying ? (
                    <svg width="9" height="11" viewBox="0 0 9 11" fill="none">
                        <rect x="0.5" y="0.5" width="2.5" height="10" rx="1" fill="rgb(196,181,253)" />
                        <rect x="6" y="0.5" width="2.5" height="10" rx="1" fill="rgb(196,181,253)" />
                    </svg>
                ) : (
                    <svg width="9" height="11" viewBox="0 0 9 11" fill="none" style={{ marginLeft:1 }}>
                        <polygon points="0,0.5 9,5.5 0,10.5" fill="#94a3b8" />
                    </svg>
                )}
            </button>

            {/* Animated waveform bars while playing */}
            {isPlaying && !isLoading && !isError && (
                <span style={{ display:"flex", gap:2, alignItems:"flex-end", height:12 }}>
                    {[0,1,2].map(i => (
                        <span key={i} style={{
                            width: 2.5, borderRadius: 2,
                            background: "linear-gradient(180deg,#a78bfa,#60a5fa)",
                            height: `${40 + i * 20}%`,
                            animation: `miniAudioBar 0.75s ease-in-out ${i * 0.15}s infinite alternate`,
                        }} />
                    ))}
                </span>
            )}

            <style>{`
                @keyframes miniAudioBar {
                    from { transform: scaleY(0.35); }
                    to   { transform: scaleY(1); }
                }
                @keyframes miniSpin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}