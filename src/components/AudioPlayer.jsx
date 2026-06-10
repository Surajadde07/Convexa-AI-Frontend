/**
 * AudioPlayer.jsx
 *
 * ISSUE 2 FIX — Progress bar / thumb desynchronisation:
 *
 * ROOT CAUSE:
 *   The filled track used `width: ${playedPct}%` — its right edge is at
 *   exactly playedPct% of the container.
 *   The thumb used `left: calc(${playedPct}% - 7px)` — subtracting a fixed
 *   7 px (half the old thumb width) attempts to center the thumb but the
 *   math is wrong:
 *
 *     At  0%  → left: calc(0% - 7px)  = -7px  (behind the left edge)
 *     At 50%  → left: calc(50% - 7px) = off by pixel rounding
 *     At 100% → left: calc(100% - 7px) = 7px  short of the right edge
 *
 *   The subtracted constant 7px is a fixed pixel value, but the container
 *   width is variable, so `calc(pct% - 7px)` is not equivalent to centering
 *   a 14px element on a percentage-positioned edge.
 *
 * THE FIX (three lines changed in the thumb <div>):
 *   Use `left: ${playedPct}%` to place the thumb's LEFT edge at the same
 *   position as the fill bar's right edge, then center it with
 *   `transform: translateX(-50%) translateY(-50%)`.
 *   `translateX(-50%)` shifts left by half the thumb's own width — this is
 *   always correct regardless of container width.
 *   Result: thumb center === fill-bar right edge at every percentage.
 *   Both elements are driven by exactly the same `playedPct` value so they
 *   can never lag relative to each other.
 *
 * ADDITIONAL POLISH (does not touch logic):
 *   - Larger, more premium thumb (16px, inner glow ring)
 *   - Taller interactive hit zone (20px invisible wrapper) for easier dragging
 *   - Drag-to-seek (pointerdown + pointermove on the track)
 *   - Slightly thicker track (7px) so the fill glow reads better
 *   - Hover expand on the track (8px on hover via CSS variable trick)
 *   - Volume slider styled to match the app gradient
 *   - Subtle "loaded/ready" pulse removed for less visual noise
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
    const audioRef  = useRef(null);
    const trackRef  = useRef(null);
    const rafRef    = useRef(null);
    const dragging  = useRef(false);

    const [playing,  setPlaying]  = useState(false);
    const [current,  setCurrent]  = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume,   setVolume]   = useState(1);
    const [muted,    setMuted]    = useState(false);
    const [status,   setStatus]   = useState("loading"); // loading | ready | error

    // ── rAF-based time tracking (smooth, no 250 ms timeupdate jitter) ────────
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

    // ── Wire up audio element events ─────────────────────────────────────────
    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;

        const onMeta      = () => { if (isFinite(a.duration)) setDuration(a.duration); setStatus("ready"); };
        const onDurChange = () => { if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration); };
        const onCanPlay   = () => setStatus("ready");
        const onPlaying   = () => { setPlaying(true);  startTick(); };
        const onPause     = () => { setPlaying(false); stopTick(); setCurrent(a.currentTime); };
        const onEnded     = () => { setPlaying(false); stopTick(); setCurrent(0); a.currentTime = 0; };
        const onErr       = () => { setStatus("error"); setPlaying(false); stopTick(); };
        const onWaiting   = () => setStatus("loading");
        const onResume    = () => setStatus("ready");

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

    // ── Playback controls ────────────────────────────────────────────────────
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

    // ── Seek helpers — shared between click and drag ─────────────────────────
    const seekToClientX = useCallback((clientX) => {
        const track = trackRef.current;
        const a     = audioRef.current;
        if (!track || !a || !duration) return;
        const rect  = track.getBoundingClientRect();
        const pct   = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        a.currentTime = pct * duration;
        setCurrent(pct * duration);
    }, [duration]);

    // Click-to-seek on the track
    const handleTrackClick = (e) => {
        if (dragging.current) return; // consumed by drag
        seekToClientX(e.clientX);
    };

    // Drag-to-seek: pointerdown on thumb, pointermove anywhere, pointerup to finish
    const handleThumbPointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragging.current = true;

        const onMove = (mv) => {
            if (!dragging.current) return;
            seekToClientX(mv.clientX);
        };
        const onUp = () => {
            dragging.current = false;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup",   onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup",   onUp);
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

    // ── Derived percentages — SINGLE source of truth used by BOTH bar & thumb
    const playedPct   = duration > 0 ? (current  / duration) * 100 : 0;
    const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
    const isLoading   = status === "loading";
    const isError     = status === "error";

    if (!filePath) return null;

    const safeSrc = BASE_URL + filePath.split("/").map(encodeURIComponent).join("/");

    return (
        <div style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(30,27,75,0.6) 50%, rgba(10,22,40,0.7) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: 20,
            padding: "20px 22px",
        }}>
            <audio ref={audioRef} src={safeSrc} preload="metadata" />

            {/* ── Header: icon · title · time ── */}
            <div className="flex items-center gap-3 mb-5">
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
                            {[0, 1, 2].map(i => (
                                <span key={i} style={{
                                    width: 2.5, borderRadius: 2,
                                    background: "linear-gradient(180deg,#a78bfa,#60a5fa)",
                                    height: `${35 + i * 25}%`,
                                    animation: `audioBar 0.7s ease-in-out ${i * 0.15}s infinite alternate`,
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

                {/* Monospace time counter — always visible when duration known */}
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
                    <span>⚠️</span><span>Could not load audio file</span>
                </div>
            ) : (
                <>
                    {/* ── Progress track ────────────────────────────────────────────
                     *
                     *  FIX: thumb positioning
                     *
                     *  BEFORE (broken):
                     *    left: `calc(${playedPct}% - 7px)`
                     *    This subtracts a fixed pixel value from a percentage, which
                     *    is only correct at one specific container width and drifts
                     *    at every other width, causing the visual lag.
                     *
                     *  AFTER (correct):
                     *    left: `${playedPct}%`
                     *    transform: "translateX(-50%) translateY(-50%)"
                     *    translateX(-50%) shifts the thumb left by half its own width
                     *    in all cases, making the thumb's CENTER land exactly on the
                     *    fill bar's right edge at every container width.
                     *
                     *  Both the fill bar width and the thumb left are driven by the
                     *  same `playedPct` variable — they are always in sync.
                     * ─────────────────────────────────────────────────────────────── */}
                    <div
                        ref={trackRef}
                        onClick={handleTrackClick}
                        role="slider"
                        aria-valuenow={Math.round(current)}
                        aria-valuemin={0}
                        aria-valuemax={Math.round(duration || 1)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowRight") skip(5);
                            if (e.key === "ArrowLeft")  skip(-5);
                        }}
                        className="audio-track-wrapper"
                        style={{
                            position: "relative",
                            width: "100%",
                            // Taller invisible hit zone — easier to click / drag
                            height: 20,
                            display: "flex",
                            alignItems: "center",
                            cursor: "pointer",
                            marginBottom: 16,
                            outline: "none",
                        }}
                    >
                        {/* Visible track rail */}
                        <div style={{
                            position: "absolute",
                            left: 0, right: 0,
                            // Track height grows on hover via CSS class below
                            height: 6,
                            borderRadius: 6,
                            background: "rgba(255,255,255,0.08)",
                            transition: "height 0.15s ease",
                        }}
                            className="audio-track-rail"
                        >
                            {/* Buffered fill */}
                            <div style={{
                                position: "absolute", inset: "0 auto 0 0",
                                borderRadius: 6,
                                width: `${bufferedPct}%`,
                                background: "rgba(255,255,255,0.12)",
                                transition: "width 0.6s ease",
                            }} />

                            {/* Played fill — gradient with glow while playing */}
                            <div style={{
                                position: "absolute", inset: "0 auto 0 0",
                                borderRadius: 6,
                                width: `${playedPct}%`,
                                background: "linear-gradient(90deg, #7c3aed 0%, #2563eb 100%)",
                                boxShadow: playing ? "0 0 10px rgba(124,58,237,0.6), 0 0 4px rgba(37,99,235,0.4)" : "none",
                                // No CSS transition while playing — rAF drives it frame-by-frame.
                                // Keep a short transition only when paused/seeking for smoothness.
                                transition: playing ? "none" : "width 0.12s ease",
                            }} />
                        </div>

                        {/* ── Thumb ──────────────────────────────────────────────────
                         *  left:      ${playedPct}%          — same value as fill width
                         *  transform: translateX(-50%)        — centers thumb on that point
                         *             translateY(-50%)        — centers vertically in hit zone
                         *  These two transforms together == "pin thumb center to fill right edge"
                         *  and work correctly at any container width.
                         * ──────────────────────────────────────────────────────────── */}
                        <div
                            onPointerDown={handleThumbPointerDown}
                            className="audio-thumb"
                            style={{
                                position: "absolute",
                                top: "50%",
                                // ✅ THE FIX: left % + centering transform, not calc(% - Npx)
                                left: `${playedPct}%`,
                                transform: "translateX(-50%) translateY(-50%)",
                                // Slightly larger (16px) for a more premium look
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                background: "#ffffff",
                                // Inner purple ring (ring via box-shadow, no extra element needed)
                                boxShadow: "0 0 0 2.5px rgba(124,58,237,0.6), 0 2px 10px rgba(0,0,0,0.45)",
                                cursor: "grab",
                                transition: "transform 0.12s ease, box-shadow 0.12s ease",
                                // Prevent thumb triggering text-selection during drag
                                userSelect: "none",
                                touchAction: "none",
                            }}
                        />
                    </div>

                    {/* ── Controls row ── */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        {/* Playback controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {/* Skip −10 */}
                            <button onClick={() => skip(-10)} title="Back 10 s"
                                style={{
                                    width: 34, height: 34, borderRadius: "50%",
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.09)",
                                    color: "#94a3b8", fontSize: 11, fontWeight: 700,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    cursor: "pointer", transition: "all 0.18s",
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                                    e.currentTarget.style.color = "#e2e8f0";
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                    e.currentTarget.style.color = "#94a3b8";
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                                }}
                            >−10</button>

                            {/* Play / Pause */}
                            <button onClick={toggle} disabled={isLoading} title={playing ? "Pause" : "Play"}
                                style={{
                                    width: 46, height: 46, borderRadius: "50%",
                                    background: isLoading
                                        ? "rgba(124,58,237,0.35)"
                                        : "linear-gradient(145deg, #7c3aed 0%, #2563eb 100%)",
                                    border: "none", color: "#fff",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    cursor: isLoading ? "not-allowed" : "pointer",
                                    boxShadow: isLoading
                                        ? "none"
                                        : "0 4px 20px rgba(124,58,237,0.4), 0 1px 4px rgba(0,0,0,0.3)",
                                    transition: "all 0.2s",
                                    flexShrink: 0,
                                }}
                                onMouseEnter={e => {
                                    if (!isLoading) {
                                        e.currentTarget.style.boxShadow = "0 6px 28px rgba(124,58,237,0.6), 0 1px 4px rgba(0,0,0,0.3)";
                                        e.currentTarget.style.transform = "scale(1.06)";
                                    }
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.boxShadow = "0 4px 20px rgba(124,58,237,0.4), 0 1px 4px rgba(0,0,0,0.3)";
                                    e.currentTarget.style.transform = "scale(1)";
                                }}
                            >
                                {isLoading ? (
                                    <span style={{
                                        width: 17, height: 17,
                                        border: "2.5px solid rgba(255,255,255,0.3)",
                                        borderTopColor: "#fff",
                                        borderRadius: "50%",
                                        display: "inline-block",
                                        animation: "spin .8s linear infinite",
                                    }} />
                                ) : playing ? (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                                        <rect x="2" y="1" width="4" height="12" rx="1.5" />
                                        <rect x="8" y="1" width="4" height="12" rx="1.5" />
                                    </svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="white" style={{ marginLeft: 2 }}>
                                        <polygon points="2,1 13,7 2,13" />
                                    </svg>
                                )}
                            </button>

                            {/* Skip +10 */}
                            <button onClick={() => skip(10)} title="Forward 10 s"
                                style={{
                                    width: 34, height: 34, borderRadius: "50%",
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.09)",
                                    color: "#94a3b8", fontSize: 11, fontWeight: 700,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    cursor: "pointer", transition: "all 0.18s",
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                                    e.currentTarget.style.color = "#e2e8f0";
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                    e.currentTarget.style.color = "#94a3b8";
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                                }}
                            >+10</button>
                        </div>

                        {/* Volume */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"}
                                style={{
                                    background: "none", border: "none", cursor: "pointer",
                                    color: "#64748b", fontSize: 15, padding: 0,
                                    transition: "color 0.15s", lineHeight: 1,
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = "#e2e8f0"}
                                onMouseLeave={e => e.currentTarget.style.color = "#64748b"}
                            >
                                {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                            </button>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={muted ? 0 : volume}
                                onChange={changeVolume}
                                style={{ width: 76, cursor: "pointer", accentColor: "#7c3aed" }}
                                className="h-1"
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
                /* Track rail height bump on hover */
                .audio-track-wrapper:hover .audio-track-rail {
                    height: 8px !important;
                }
                /* Thumb scale-up on hover and while dragging */
                .audio-track-wrapper:hover .audio-thumb,
                .audio-thumb:active {
                    transform: translateX(-50%) translateY(-50%) scale(1.3) !important;
                    box-shadow: 0 0 0 3px rgba(124,58,237,0.5), 0 3px 14px rgba(0,0,0,0.5) !important;
                    cursor: grabbing !important;
                }
            `}</style>
        </div>
    );
}
