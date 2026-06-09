/**
 * MiniAudioPlayer.jsx
 *
 * Root causes fixed (Bug #2):
 *
 * 1. RANDOM PLAYBACK FAILURE — audio.play() is a Promise. If the browser
 *    hasn't loaded any audio data yet (preload="none"), the promise can
 *    reject silently. The old code called audio.play().catch(() => {}) which
 *    swallowed the error and left isPlaying=true showing the wrong UI state.
 *    Fix: catch the rejection, reset state, show error.
 *
 * 2. STALE SRC — when filePath changes (e.g. navigating between calls in
 *    history without unmounting), the <audio> element keeps the old src.
 *    The browser may refuse to play or play the wrong file.
 *    Fix: useEffect on filePath — reset error/loaded state and reload.
 *
 * 3. EFFECT CLEANUP — the old code added no cleanup for the "ended" event
 *    listener on the audio element, causing double-fires after re-render.
 *    Fix: return cleanup function from useEffect.
 *
 * 4. MISSING LOADING STATE — users clicked play with no feedback; the
 *    browser was buffering silently. Added a loading indicator.
 */

import { useEffect, useRef, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function MiniAudioPlayer({ filePath, playingId, callId, onPlay, onStop }) {
    const audioRef  = useRef(null);
    const isPlaying = playingId === callId;

    const [loadState, setLoadState] = useState("idle"); // idle | loading | ready | error

    // ── Sync src and reset when filePath changes ───────────────────────────
    useEffect(() => {
        setLoadState("idle");
        const audio = audioRef.current;
        if (!audio || !filePath) return;
        // Issue #1 frontend fix — encode path segments for legacy DB rows
        const safeSrc = BASE_URL + filePath.split("/").map(encodeURIComponent).join("/");
        audio.src = safeSrc;
        audio.load();
    }, [filePath]);

    // ── Audio element event listeners ──────────────────────────────────────
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onCanPlay = () => setLoadState("ready");
        const onError   = () => { setLoadState("error"); onStop?.(); };
        const onEnded   = () => { setLoadState("ready"); onStop?.(); };
        const onWaiting = () => setLoadState("loading");
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
    }, [onStop]);

    // ── When another call takes over, pause this one ───────────────────────
    useEffect(() => {
        if (!isPlaying && audioRef.current) {
            audioRef.current.pause();
        }
    }, [isPlaying]);

    // ── Toggle play / pause ────────────────────────────────────────────────
    const toggle = async (e) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio || loadState === "error") return;

        if (isPlaying) {
            audio.pause();
            onStop?.();
        } else {
            setLoadState("loading");
            onPlay?.(callId);
            try {
                await audio.play();
                setLoadState("ready");
            } catch (err) {
                if (err.name !== "AbortError") {
                    setLoadState("error");
                    onStop?.();
                }
            }
        }
    };

    if (!filePath) return null;

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
                    /* SVG pause icon — more precise than emoji */
                    <svg width="9" height="11" viewBox="0 0 9 11" fill="none">
                        <rect x="0.5" y="0.5" width="2.5" height="10" rx="1" fill="rgb(196,181,253)" />
                        <rect x="6" y="0.5" width="2.5" height="10" rx="1" fill="rgb(196,181,253)" />
                    </svg>
                ) : (
                    /* SVG play icon */
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
