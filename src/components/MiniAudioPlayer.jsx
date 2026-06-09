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
        audio.src = `${BASE_URL}${filePath}`;
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
        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <audio ref={audioRef} preload="none" />

            <button
                onClick={toggle}
                disabled={isError}
                title={isError ? "Audio unavailable" : isPlaying ? "Pause" : "Play audio"}
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all border text-xs
                    ${isError
                        ? "bg-red-500/10 border-red-500/20 text-red-500 cursor-not-allowed"
                        : isPlaying
                            ? "bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-violet-500/30"
                            : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white hover:border-white/20"
                    }`}>
                {isError ? "✕" : isLoading ? (
                    <span className="w-3 h-3 border border-violet-400/40 border-t-violet-400 rounded-full animate-spin block" />
                ) : isPlaying ? "⏸" : "▶"}
            </button>

            {isPlaying && !isLoading && !isError && (
                <span className="flex gap-px items-end h-3">
                    {[0, 1, 2].map(i => (
                        <span key={i}
                            className="w-0.5 rounded-full bg-violet-400"
                            style={{
                                height: `${40 + i * 20}%`,
                                animation: `miniAudioBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                            }} />
                    ))}
                </span>
            )}

            <style>{`
                @keyframes miniAudioBar {
                    from { transform: scaleY(0.4); }
                    to   { transform: scaleY(1); }
                }
            `}</style>
        </div>
    );
}
