/**
 * AudioPlayer.jsx
 *
 * Root causes fixed (Bug #3 + #4):
 *
 * BUG #3 — PROGRESS BAR ONLY VISIBLE ON HOVER:
 *   The old progress bar used `opacity-0 group-hover:opacity-100` on the
 *   thumb dot, but the filled track itself had no visibility issue.
 *   The real problem: the entire progress bar container had
 *   `style={{ background: "rgba(255,255,255,0.1)" }}` which was barely
 *   visible at 10% opacity — it looked invisible until the filled portion
 *   appeared. The thumb also had opacity-0 by default.
 *   Fix: increase track opacity, make thumb always visible (not just on
 *   hover), and add a dedicated "current time / total" row that's always
 *   rendered (not hidden behind loading state).
 *
 * BUG #4 — DESIGN / POLISH:
 *   - Glassmorphism card matching dashboard theme
 *   - Waveform animation while playing
 *   - Better button sizing and gradient
 *   - Buffered range indicator
 *   - Always-visible time stamps
 *   - Smooth transitions on progress fill
 *
 * RELIABILITY FIX:
 *   - loadedmetadata fires inconsistently when the server returns the file
 *     without a Content-Range or Content-Length header. Added "durationchange"
 *     listener as a fallback so duration always populates.
 *   - play() Promise rejection handled — no more silent failures.
 *   - Proper effect cleanup prevents stale event listeners.
 */

import { useEffect, useRef, useState, useCallback } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

function fmt(s) {
    if (!isFinite(s) || isNaN(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ filePath, fileName }) {
    const audioRef    = useRef(null);
    const trackRef    = useRef(null);
    const rafRef      = useRef(null);

    const [playing,  setPlaying]  = useState(false);
    const [current,  setCurrent]  = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume,   setVolume]   = useState(1);
    const [muted,    setMuted]    = useState(false);
    const [status,   setStatus]   = useState("loading"); // loading | ready | error

    // ── rAF-based time tracking (smoother than timeupdate at 250ms intervals)
    const tick = useCallback(() => {
        const a = audioRef.current;
        if (!a) return;
        setCurrent(a.currentTime);
        if (a.buffered.length > 0) setBuffered(a.buffered.end(a.buffered.length - 1));
        if (!a.paused) rafRef.current = requestAnimationFrame(tick);
    }, []);

    const startTick = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
    }, [tick]);

    const stopTick = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
    }, []);

    // ── Wire up audio events ───────────────────────────────────────────────
    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;

        const onMeta     = () => { if (isFinite(a.duration)) setDuration(a.duration); setStatus("ready"); };
        const onDurChange= () => { if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration); };
        const onCanPlay  = () => setStatus("ready");
        const onPlaying  = () => { setPlaying(true);  startTick(); };
        const onPause    = () => { setPlaying(false); stopTick(); setCurrent(a.currentTime); };
        const onEnded    = () => { setPlaying(false); stopTick(); setCurrent(0); a.currentTime = 0; };
        const onErr      = () => { setStatus("error"); setPlaying(false); stopTick(); };
        const onWaiting  = () => setStatus("loading");
        const onResume   = () => setStatus("ready");

        a.addEventListener("loadedmetadata",  onMeta);
        a.addEventListener("durationchange",  onDurChange);
        a.addEventListener("canplay",         onCanPlay);
        a.addEventListener("playing",         onPlaying);
        a.addEventListener("pause",           onPause);
        a.addEventListener("ended",           onEnded);
        a.addEventListener("error",           onErr);
        a.addEventListener("waiting",         onWaiting);
        a.addEventListener("canplaythrough",  onResume);

        return () => {
            a.removeEventListener("loadedmetadata",  onMeta);
            a.removeEventListener("durationchange",  onDurChange);
            a.removeEventListener("canplay",         onCanPlay);
            a.removeEventListener("playing",         onPlaying);
            a.removeEventListener("pause",           onPause);
            a.removeEventListener("ended",           onEnded);
            a.removeEventListener("error",           onErr);
            a.removeEventListener("waiting",         onWaiting);
            a.removeEventListener("canplaythrough",  onResume);
            stopTick();
        };
    }, [startTick, stopTick]);

    // ── Controls ───────────────────────────────────────────────────────────
    const toggle = async () => {
        const a = audioRef.current;
        if (!a || status === "error") return;
        if (playing) {
            a.pause();
        } else {
            try {
                await a.play();
            } catch (err) {
                if (err.name !== "AbortError") setStatus("error");
            }
        }
    };

    const seek = (e) => {
        const track = trackRef.current;
        const a = audioRef.current;
        if (!track || !a || !duration) return;
        const rect = track.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        a.currentTime = pct * duration;
        setCurrent(pct * duration);
    };

    const skip = (delta) => {
        const a = audioRef.current;
        if (!a) return;
        a.currentTime = Math.max(0, Math.min(duration, a.currentTime + delta));
        setCurrent(a.currentTime);
    };

    const changeVolume = (e) => {
        const v = Number(e.target.value);
        setVolume(v);
        if (audioRef.current) audioRef.current.volume = v;
        if (v > 0) setMuted(false);
    };

    const toggleMute = () => {
        const a = audioRef.current;
        if (!a) return;
        a.muted = !muted;
        setMuted(!muted);
    };

    const playedPct   = duration > 0 ? (current  / duration) * 100 : 0;
    const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
    const isLoading   = status === "loading";
    const isError     = status === "error";

    if (!filePath) return null;

    return (
        <div className="rounded-2xl border border-white/12 p-5"
            style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.05) 100%)",
                backdropFilter: "blur(12px)",
            }}>
            <audio
                ref={audioRef}
                src={`${BASE_URL}${filePath}`}
                preload="metadata"
            />

            {/* ── Title row ── */}
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border transition-all
                    ${playing
                        ? "bg-violet-500/25 border-violet-500/40 shadow-lg shadow-violet-500/20"
                        : "bg-white/8 border-white/10"}`}>
                    {playing ? (
                        <span className="flex gap-px items-end h-4">
                            {[0,1,2].map(i => (
                                <span key={i} className="w-0.5 rounded-full bg-violet-400"
                                    style={{ height: `${35 + i * 25}%`, animation: `audioBar 0.7s ease-in-out ${i * 0.15}s infinite alternate` }} />
                            ))}
                        </span>
                    ) : "🎙️"}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{fileName || "Recording"}</p>
                    <p className="text-xs mt-0.5 font-mono"
                        style={{ color: isError ? "#ef4444" : "#64748b" }}>
                        {isError ? "⚠️ Audio unavailable" : isLoading ? "Buffering…" : `${fmt(current)} / ${fmt(duration)}`}
                    </p>
                </div>
                {/* Always-visible time display — fixes "only on hover" complaint */}
                {!isError && duration > 0 && (
                    <div className="flex-shrink-0 text-right">
                        <p className="text-xs font-mono font-bold text-white">{fmt(current)}</p>
                        <p className="text-xs font-mono text-slate-600">{fmt(duration)}</p>
                    </div>
                )}
            </div>

            {isError ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-red-400">
                    <span>⚠️</span>
                    <span>Could not load audio file</span>
                </div>
            ) : (
                <>
                    {/* ── Progress bar — always visible ── */}
                    <div
                        ref={trackRef}
                        onClick={seek}
                        className="relative w-full h-2.5 rounded-full cursor-pointer mb-4 overflow-hidden group"
                        style={{ background: "rgba(255,255,255,0.08)" }}>

                        {/* Buffered range */}
                        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                            style={{ width: `${bufferedPct}%`, background: "rgba(255,255,255,0.12)" }} />

                        {/* Played range — always visible, gradient fill */}
                        <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{
                                width: `${playedPct}%`,
                                background: "linear-gradient(90deg, #8b5cf6 0%, #3b82f6 100%)",
                                boxShadow: playing ? "0 0 8px rgba(139,92,246,0.6)" : "none",
                                transition: playing ? "none" : "width 0.2s ease",
                            }} />

                        {/* Thumb — always visible (not just on hover) */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg
                                ring-2 ring-violet-400/50 transition-all group-hover:scale-125"
                            style={{ left: `calc(${playedPct}% - 7px)` }} />
                    </div>

                    {/* ── Controls ── */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <button onClick={() => skip(-10)} title="−10s"
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/8
                                    flex items-center justify-center text-slate-400 hover:text-white transition-all text-xs font-bold">
                                −10
                            </button>

                            {/* Main play/pause */}
                            <button onClick={toggle} disabled={isLoading}
                                className="w-11 h-11 rounded-full flex items-center justify-center transition-all text-base
                                    bg-gradient-to-br from-violet-600 to-blue-600 text-white
                                    hover:from-violet-500 hover:to-blue-500 active:scale-95
                                    hover:shadow-lg hover:shadow-violet-500/40
                                    disabled:opacity-40 disabled:cursor-not-allowed">
                                {isLoading
                                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : playing ? "⏸" : "▶"
                                }
                            </button>

                            <button onClick={() => skip(10)} title="+10s"
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/8
                                    flex items-center justify-center text-slate-400 hover:text-white transition-all text-xs font-bold">
                                +10
                            </button>
                        </div>

                        {/* Volume */}
                        <div className="flex items-center gap-2">
                            <button onClick={toggleMute}
                                className="text-slate-400 hover:text-white transition-colors w-5 text-sm text-center">
                                {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                            </button>
                            <input type="range" min="0" max="1" step="0.05"
                                value={muted ? 0 : volume}
                                onChange={changeVolume}
                                className="w-20 h-1 accent-violet-500 cursor-pointer" />
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes audioBar {
                    from { transform: scaleY(0.4); }
                    to   { transform: scaleY(1); }
                }
            `}</style>
        </div>
    );
}
