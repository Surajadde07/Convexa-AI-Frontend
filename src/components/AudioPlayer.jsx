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

    // Issue #1 frontend fix — encode each path segment so spaces, '#', '?'
    // etc. in legacy DB rows don't break the URL the browser constructs.
    // encodeURIComponent encodes everything; we then restore the '/' separators.
    const safeSrc = BASE_URL + filePath.split("/").map(encodeURIComponent).join("/");

    return (
        /* ── Card shell — glassmorphism matching the rest of the app ── */
        <div style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(30,27,75,0.6) 50%, rgba(10,22,40,0.7) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: 20,
            padding: "20px 22px",
        }}>
            <audio ref={audioRef} src={safeSrc} preload="metadata" />

            {/* ── Header row: icon · title · time counter ── */}
            <div className="flex items-center gap-3 mb-5">
                {/* Animated icon */}
                <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: playing ? "rgba(139,92,246,0.22)" : "rgba(255,255,255,0.06)",
                    border: playing ? "1px solid rgba(139,92,246,0.45)" : "1px solid rgba(255,255,255,0.09)",
                    boxShadow: playing ? "0 0 14px rgba(139,92,246,0.3)" : "none",
                    transition: "all 0.3s ease",
                }}>
                    {playing ? (
                        <span className="flex gap-px items-end" style={{ height: 16 }}>
                            {[0,1,2].map(i => (
                                <span key={i} style={{
                                    width: 2.5, borderRadius: 2,
                                    background: "linear-gradient(180deg,#a78bfa,#60a5fa)",
                                    height: `${35 + i * 25}%`,
                                    animation: `audioBar 0.7s ease-in-out ${i*0.15}s infinite alternate`,
                                }} />
                            ))}
                        </span>
                    ) : (
                        <span style={{ fontSize: 17, lineHeight: 1 }}>🎙️</span>
                    )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                        fontSize: 13, fontWeight: 600, color: "#f1f5f9",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        marginBottom: 2,
                    }}>
                        {fileName || "Recording"}
                    </p>
                    <p style={{
                        fontSize: 11, fontFamily: "ui-monospace,monospace",
                        color: isError ? "#f87171" : "#475569",
                    }}>
                        {isError ? "⚠ Audio unavailable" : isLoading ? "Buffering…" : `${fmt(current)} · ${fmt(duration)}`}
                    </p>
                </div>

                {/* Always-visible time stamp (Issue #3 fix) */}
                {!isError && duration > 0 && (
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <p style={{ fontSize: 13, fontFamily: "ui-monospace,monospace", fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>
                            {fmt(current)}
                        </p>
                        <p style={{ fontSize: 10, fontFamily: "ui-monospace,monospace", color: "#334155", marginTop: 2 }}>
                            {fmt(duration)}
                        </p>
                    </div>
                )}
            </div>

            {isError ? (
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "14px 0", fontSize: 13, color: "#f87171",
                    background: "rgba(239,68,68,0.07)", borderRadius: 12,
                    border: "1px solid rgba(239,68,68,0.15)",
                }}>
                    <span>⚠️</span>
                    <span>Could not load audio file</span>
                </div>
            ) : (
                <>
                    {/* ── Progress track ─────────────────────────────────────────
                        Always fully visible. The thumb is permanent, not hover-only.
                        Clicking anywhere seeks. Playing adds a glow on the fill. */}
                    <div
                        ref={trackRef}
                        onClick={seek}
                        role="progressbar"
                        aria-valuenow={Math.round(current)}
                        aria-valuemax={Math.round(duration || 1)}
                        style={{
                            position: "relative", width: "100%", height: 6,
                            borderRadius: 6, cursor: "pointer", marginBottom: 18,
                            background: "rgba(255,255,255,0.07)",
                        }}
                        className="group"
                    >
                        {/* Buffered */}
                        <div style={{
                            position: "absolute", inset: "0 auto 0 0",
                            borderRadius: 6, width: `${bufferedPct}%`,
                            background: "rgba(255,255,255,0.11)",
                            transition: "width 0.5s ease",
                        }} />

                        {/* Played — gradient, glow while playing */}
                        <div style={{
                            position: "absolute", inset: "0 auto 0 0",
                            borderRadius: 6, width: `${playedPct}%`,
                            background: "linear-gradient(90deg,#8b5cf6 0%,#3b82f6 100%)",
                            boxShadow: playing ? "0 0 10px rgba(139,92,246,0.55)" : "none",
                            transition: playing ? "none" : "width 0.15s ease",
                        }} />

                        {/* Thumb — always visible */}
                        <div style={{
                            position: "absolute", top: "50%", transform: "translateY(-50%)",
                            left: `calc(${playedPct}% - 7px)`,
                            width: 14, height: 14, borderRadius: "50%",
                            background: "#fff",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.4), 0 0 0 2px rgba(139,92,246,0.5)",
                            transition: "left 0.1s linear, transform 0.15s ease",
                        }}
                            className="group-hover:scale-125"
                        />
                    </div>

                    {/* ── Controls row ── */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        {/* Playback controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {/* Skip −10 */}
                            <button onClick={() => skip(-10)} title="Back 10 s"
                                style={{
                                    width: 32, height: 32, borderRadius: "50%",
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.09)",
                                    color: "#94a3b8", fontSize: 11, fontWeight: 700,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    cursor: "pointer", transition: "all 0.2s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.1)"; e.currentTarget.style.color="#fff"; }}
                                onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.color="#94a3b8"; }}
                            >−10</button>

                            {/* Play / Pause — main CTA */}
                            <button onClick={toggle} disabled={isLoading} title={playing ? "Pause" : "Play"}
                                style={{
                                    width: 44, height: 44, borderRadius: "50%",
                                    background: isLoading ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg,#7c3aed,#2563eb)",
                                    border: "none", color: "#fff", fontSize: 15,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    cursor: isLoading ? "not-allowed" : "pointer",
                                    boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
                                    transition: "all 0.2s",
                                }}
                                onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.boxShadow="0 6px 28px rgba(124,58,237,0.55)"; e.currentTarget.style.transform="scale(1.05)"; }}}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow="0 4px 20px rgba(124,58,237,0.35)"; e.currentTarget.style.transform="scale(1)"; }}
                            >
                                {isLoading
                                    ? <span style={{ width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin .8s linear infinite" }} />
                                    : playing
                                        ? <svg width="14" height="14" viewBox="0 0 14 14" fill="white"><rect x="2" y="1" width="4" height="12" rx="1.5"/><rect x="8" y="1" width="4" height="12" rx="1.5"/></svg>
                                        : <svg width="14" height="14" viewBox="0 0 14 14" fill="white" style={{marginLeft:2}}><polygon points="2,1 13,7 2,13"/></svg>
                                }
                            </button>

                            {/* Skip +10 */}
                            <button onClick={() => skip(10)} title="Forward 10 s"
                                style={{
                                    width: 32, height: 32, borderRadius: "50%",
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.09)",
                                    color: "#94a3b8", fontSize: 11, fontWeight: 700,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    cursor: "pointer", transition: "all 0.2s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.1)"; e.currentTarget.style.color="#fff"; }}
                                onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.color="#94a3b8"; }}
                            >+10</button>
                        </div>

                        {/* Volume */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"}
                                style={{ background:"none",border:"none",cursor:"pointer",color:"#64748b",fontSize:15,padding:0,transition:"color 0.15s",lineHeight:1 }}
                                onMouseEnter={e=>e.currentTarget.style.color="#fff"}
                                onMouseLeave={e=>e.currentTarget.style.color="#64748b"}
                            >
                                {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                            </button>
                            <input type="range" min="0" max="1" step="0.05"
                                value={muted ? 0 : volume}
                                onChange={changeVolume}
                                style={{ width: 72, cursor: "pointer" }}
                                className="accent-violet-500 h-1"
                            />
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes audioBar {
                    from { transform: scaleY(0.4); }
                    to   { transform: scaleY(1); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
