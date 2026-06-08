import { useEffect, useRef, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

function fmt(s) {
    if (!isFinite(s) || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Full AudioPlayer — used on CallDetailsPage.
 * Props:
 *   filePath  — stored path e.g. "/audio/recording.mp3"
 *   fileName  — display label
 */
export default function AudioPlayer({ filePath, fileName }) {
    const audioRef       = useRef(null);
    const progressRef    = useRef(null);
    const [playing, setPlaying]   = useState(false);
    const [current, setCurrent]   = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume]     = useState(1);
    const [muted, setMuted]       = useState(false);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(false);

    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        const onLoaded = () => { setDuration(a.duration); setLoading(false); };
        const onTime   = () => setCurrent(a.currentTime);
        const onEnded  = () => setPlaying(false);
        const onErr    = () => { setError(true); setLoading(false); };
        a.addEventListener("loadedmetadata", onLoaded);
        a.addEventListener("timeupdate", onTime);
        a.addEventListener("ended", onEnded);
        a.addEventListener("error", onErr);
        return () => {
            a.removeEventListener("loadedmetadata", onLoaded);
            a.removeEventListener("timeupdate", onTime);
            a.removeEventListener("ended", onEnded);
            a.removeEventListener("error", onErr);
        };
    }, []);

    const toggle = async () => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) { a.pause(); setPlaying(false); }
        else { await a.play(); setPlaying(true); }
    };

    const seek = (e) => {
        const bar = progressRef.current;
        if (!bar || !duration) return;
        const rect = bar.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audioRef.current.currentTime = pct * duration;
    };

    const skip = (delta) => {
        const a = audioRef.current;
        if (!a) return;
        a.currentTime = Math.max(0, Math.min(duration, a.currentTime + delta));
    };

    const changeVolume = (e) => {
        const v = Number(e.target.value);
        setVolume(v);
        audioRef.current.volume = v;
        if (v > 0) setMuted(false);
    };

    const toggleMute = () => {
        const a = audioRef.current;
        if (!a) return;
        a.muted = !muted;
        setMuted(!muted);
    };

    const pct = duration > 0 ? (current / duration) * 100 : 0;

    if (!filePath) return null;

    const src = `${BASE_URL}${filePath}`;

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Title row */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-lg flex-shrink-0">
                    🎙️
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{fileName || "Recording"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {loading ? "Loading…" : error ? "Audio unavailable" : `${fmt(duration)} total`}
                    </p>
                </div>
                {!loading && !error && (
                    <span className="text-xs text-slate-500 font-mono">{fmt(current)} / {fmt(duration)}</span>
                )}
            </div>

            {error ? (
                <div className="text-center py-4 text-sm text-slate-500">
                    ⚠️ Could not load audio file
                </div>
            ) : (
                <>
                    {/* Progress bar */}
                    <div
                        ref={progressRef}
                        onClick={seek}
                        className="group relative w-full h-2 rounded-full cursor-pointer mb-4"
                        style={{ background: "rgba(255,255,255,0.1)" }}>
                        {/* Buffered / filled */}
                        <div
                            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all"
                            style={{ width: `${pct}%` }} />
                        {/* Thumb */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ left: `calc(${pct}% - 7px)` }} />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {/* Skip back */}
                            <button onClick={() => skip(-10)}
                                title="Back 10s"
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/8
                                    flex items-center justify-center text-slate-400 hover:text-white transition-all text-xs font-bold">
                                −10
                            </button>

                            {/* Play / Pause */}
                            <button onClick={toggle} disabled={loading}
                                className="w-11 h-11 rounded-full flex items-center justify-center transition-all
                                    bg-gradient-to-br from-violet-600 to-blue-600 text-white text-base
                                    hover:from-violet-500 hover:to-blue-500 hover:shadow-lg hover:shadow-violet-500/30
                                    disabled:opacity-40 disabled:cursor-not-allowed active:scale-95">
                                {loading ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : playing ? "⏸" : "▶"}
                            </button>

                            {/* Skip forward */}
                            <button onClick={() => skip(10)}
                                title="Forward 10s"
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/8
                                    flex items-center justify-center text-slate-400 hover:text-white transition-all text-xs font-bold">
                                +10
                            </button>
                        </div>

                        {/* Volume */}
                        <div className="flex items-center gap-2">
                            <button onClick={toggleMute}
                                className="text-slate-400 hover:text-white transition-colors text-base w-6 text-center">
                                {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                            </button>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={muted ? 0 : volume}
                                onChange={changeVolume}
                                className="w-20 h-1 accent-violet-500 cursor-pointer"
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
