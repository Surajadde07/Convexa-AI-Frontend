import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { parseInsights } from "../utils/insightsFormatter.js";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import api, { getUser, clearSession } from "../services/api.js";
import logo from "../assets/CONVEXA_AI_logo.png";
import MiniAudioPlayer from "../components/MiniAudioPlayer.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** Strip markdown symbols and return clean plain-text bullet array */
function parseMarkdownToBullets(text) {
    if (!text) return [];
    return text
        .split(/\n|(?<=\.)\s{2,}/)
        .map(line =>
            line
                .replace(/^[\s*\-•>#]+/, "")   // leading *, -, •, >, #
                .replace(/\*\*(.*?)\*\*/g, "$1") // **bold**
                .replace(/\*(.*?)\*/g, "$1")     // *italic*
                .replace(/`(.*?)`/g, "$1")       // `code`
                .replace(/#+\s?/g, "")           // ### headings
                .trim()
        )
        .filter(line => line.length > 3);
}

/** Parse comma-separated or newline-separated list to array */
function parseList(str) {
    if (!str) return [];
    return str
        .split(/,|\n/)
        .map(s => s.replace(/^[\s*\-•]+/, "").trim())
        .filter(Boolean);
}

const SENT_CONFIG = {
    POSITIVE: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", label: "Positive", emoji: "😊" },
    NEGATIVE: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  label: "Negative", emoji: "😔" },
    NEUTRAL:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "Neutral",  emoji: "😐" },
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }) {
    return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} />;
}

function ScoreRing({ score, size = 80, stroke = 7, color = "#8b5cf6" }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const pct = Math.min((score || 0) / 100, 1);
    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e1b4b" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
                style={{ transition: "stroke-dasharray 1s ease" }} />
            <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
                fill="white" fontSize={size * 0.22} fontWeight="700"
                style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%" }}>
                {score ?? "–"}
            </text>
        </svg>
    );
}

function StatCard({ label, value, sub, icon, accent = "#8b5cf6", delay = 0 }) {
    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5
            hover:border-white/20 hover:bg-white/8 transition-all duration-300"
            style={{ animationDelay: `${delay}ms` }}>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(ellipse at 20% 20%, ${accent}18 0%, transparent 70%)` }} />
            <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{icon}</span>
                {sub && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${accent}22`, color: accent }}>
                        {sub}
                    </span>
                )}
            </div>
            <p className="text-3xl font-black text-white mb-0.5">{value}</p>
            <p className="text-xs text-slate-400 font-medium">{label}</p>
        </div>
    );
}

/** Toast notification */
function Toast({ message, type = "success", onDismiss }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 4000);
        return () => clearTimeout(t);
    }, [onDismiss]);
    const colors = type === "success"
        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
        : "bg-red-500/20 border-red-500/40 text-red-300";
    return (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl ${colors}`}
            style={{ animation: "slideUp 0.3s ease" }}>
            <span className="text-xl">{type === "success" ? "✅" : "⚠️"}</span>
            <span className="text-sm font-semibold">{message}</span>
            <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">✕</button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD MODAL
// ─────────────────────────────────────────────────────────────────────────────

function UploadModal({ onClose, onSuccess }) {
    const [dragging, setDragging] = useState(false);
    const [file, setFile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [state, setState] = useState("idle"); // idle | uploading | success | error
    const [phase, setPhase] = useState("uploading"); // uploading | analyzing | saving
    const [errorMsg, setErrorMsg] = useState("");
    const inputRef = useRef();

    // Maps upload byte-progress to a phase label the user can follow.
    // onUploadProgress fires while bytes travel to the server (0→100%).
    // After bytes are sent the connection stays open while the server runs
    // Whisper + AI analysis + DB save — we show "Analyzing" during that wait.
    const PHASE_LABELS = {
        uploading:  "Uploading audio…",
        analyzing:  "Analyzing conversation…",
        saving:     "Saving results…",
    };
    const PHASE_SUBS = {
        uploading:  "Sending file to server",
        analyzing:  "Whisper is transcribing · AI is scoring",
        saving:     "Writing to database",
    };

    const handleFile = (f) => {
        if (!f) return;
        const validExt = /\.(mp3|wav|m4a|ogg|webm|flac|mp4)$/i.test(f.name);
        const validType = ["audio/mpeg","audio/wav","audio/mp4","audio/ogg","audio/webm","audio/flac","video/mp4"].includes(f.type);
        if (!validExt && !validType) {
            setErrorMsg("Please upload an audio file (mp3, wav, m4a, flac, ogg…)");
            setState("error");
            return;
        }
        setFile(f);
        setState("idle");
        setErrorMsg("");
    };

    const handleUpload = async () => {
        if (!file) return;
        setState("uploading");
        setPhase("uploading");
        setProgress(0);
        const form = new FormData();
        form.append("audio", file);
        try {
            // ─── FIX 1: timeout: 0 overrides the global 15 s limit for this
            // request only. Whisper + AI analysis can take 60-180+ seconds
            // depending on audio length. Without this, axios throws ECONNABORTED
            // after 15 s even though the backend is still processing and will
            // eventually return 200 OK — causing the false "Upload Failed" error.
            await api.post("/api/calls/upload", form, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 0, // unlimited — backend controls when it responds
                onUploadProgress: (e) => {
                    // ─── FIX 2: track byte-upload progress separately from
                    // server processing. Once bytes finish (100%) we switch to
                    // the "analyzing" phase so the user sees useful feedback
                    // instead of a stuck bar while the server works.
                    const pct = e.total
                        ? Math.round((e.loaded * 100) / e.total)
                        : 0;
                    setProgress(pct);
                    if (pct >= 100) {
                        setPhase("analyzing");
                    }
                },
            });
            // Server responded — briefly show "saving" before success screen
            setPhase("saving");
            await new Promise(r => setTimeout(r, 600));
            setState("success");
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1800);
        } catch (err) {
            // Distinguish timeout (shouldn't happen now) from real server errors
            const isTimeout = err.code === "ECONNABORTED";
            const serverMsg = typeof err.response?.data === "string"
                ? err.response.data
                : err.response?.data?.message;
            setErrorMsg(
                isTimeout
                    ? "Request timed out. The server may still be processing — please refresh in a moment."
                    : serverMsg || "Upload failed. Please try again."
            );
            setState("error");
        }
    };

    // Close on backdrop click
    const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
            onClick={handleBackdrop}>
            <div className="relative w-full max-w-lg rounded-3xl border border-white/15 p-8"
                style={{ background: "linear-gradient(135deg, rgba(13,11,42,0.98) 0%, rgba(10,22,40,0.98) 100%)" }}
                onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-black text-white">Upload Call Recording</h2>
                        <p className="text-sm text-slate-400 mt-1">mp3 · wav · m4a · flac · ogg · webm</p>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center
                            text-slate-400 hover:text-white transition-all text-sm">
                        ✕
                    </button>
                </div>

                {state === "success" ? (
                    <div className="flex flex-col items-center py-12 gap-4">
                        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center"
                            style={{ boxShadow: "0 0 40px rgba(16,185,129,0.3)" }}>
                            <span className="text-4xl">✅</span>
                        </div>
                        <div className="text-center">
                            <p className="text-emerald-400 font-bold text-lg">Upload Successful!</p>
                            <p className="text-slate-400 text-sm mt-1">AI is analysing your call…</p>
                        </div>
                        <div className="w-full bg-white/8 rounded-full h-1.5 mt-2">
                            <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 w-full
                                animate-pulse" />
                        </div>
                    </div>
                ) : state === "uploading" ? (
                    <div className="py-10 space-y-5">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-full border-2 border-violet-500/30 border-t-violet-400
                                animate-spin flex items-center justify-center">
                                <span className="text-2xl">🎙️</span>
                            </div>
                            <p className="text-white font-semibold">{PHASE_LABELS[phase]}</p>
                            <p className="text-slate-400 text-sm">{PHASE_SUBS[phase]}</p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>{file?.name}</span>
                                <span className="text-violet-400 font-bold">
                                    {phase === "uploading" ? `${progress}%` : phase === "analyzing" ? "Processing…" : "Saving…"}
                                </span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                <div className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-300"
                                    style={{ width: phase === "uploading" ? `${progress}%` : phase === "analyzing" ? "90%" : "100%" }} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Drop zone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                            onClick={() => inputRef.current?.click()}
                            className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
                                ${dragging ? "border-violet-400 bg-violet-500/10 scale-[1.02]" : "border-white/15 hover:border-violet-500/50 hover:bg-violet-500/5"}
                                ${file ? "border-violet-500/50 bg-violet-500/5" : ""}`}>
                            <input ref={inputRef} type="file"
                                accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg"
                                className="hidden"
                                onChange={(e) => handleFile(e.target.files[0])} />

                            {file ? (
                                <div className="space-y-2">
                                    <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center text-3xl mx-auto">🎵</div>
                                    <p className="text-white font-bold text-sm truncate px-4">{file.name}</p>
                                    <p className="text-slate-400 text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB · Click to change</p>
                                    <span className="inline-block mt-1 text-xs text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">
                                        Ready to upload
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mx-auto">
                                        ☁️
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold">Drop your audio file here</p>
                                        <p className="text-slate-500 text-sm mt-1">or click to browse files</p>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                                        {["mp3", "wav", "m4a", "flac", "ogg"].map(ext => (
                                            <span key={ext} className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/8">
                                                .{ext}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {state === "error" && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3 border border-red-500/20">
                                <span>⚠️</span>
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className="flex gap-3 mt-5">
                            <button onClick={onClose}
                                className="flex-1 py-3 rounded-xl font-semibold text-sm border border-white/10
                                    bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all">
                                Cancel
                            </button>
                            <button onClick={handleUpload} disabled={!file}
                                className="flex-2 w-full py-3 rounded-xl font-bold text-sm transition-all duration-200
                                    bg-gradient-to-r from-violet-600 to-blue-600 text-white
                                    disabled:opacity-30 disabled:cursor-not-allowed
                                    hover:from-violet-500 hover:to-blue-500 hover:shadow-lg hover:shadow-violet-500/30
                                    active:scale-95">
                                {file ? "🚀 Analyse Call" : "Select a file first"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SENTIMENT PIE – redesigned
// ─────────────────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#10b981", "#f59e0b", "#ef4444"]; // positive, neutral, negative

function SentimentChart({ data, total }) {
    if (total === 0) {
        return (
            <div className="flex items-center justify-center h-56 text-slate-500 text-sm">
                No sentiment data yet
            </div>
        );
    }

    const chartData = data.filter(d => d.value > 0);

    const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        if (percent < 0.05) return null;
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
                fontSize={12} fontWeight="700">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const { name, value } = payload[0];
        const cfg = SENT_CONFIG[name.toUpperCase()] || {};
        return (
            <div className="px-4 py-3 rounded-xl border backdrop-blur-xl text-sm"
                style={{ background: "rgba(13,11,42,0.95)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}>
                <p style={{ color: cfg.color }} className="font-bold">{cfg.emoji} {name}</p>
                <p className="text-slate-300 mt-0.5">{value} call{value !== 1 ? "s" : ""} · {((value / total) * 100).toFixed(1)}%</p>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-4">
            <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={88}
                        innerRadius={52}
                        paddingAngle={3}
                        labelLine={false}
                        label={<CustomLabel />}>
                        {chartData.map((entry, i) => {
                            const idx = ["Positive", "Neutral", "Negative"].indexOf(entry.name);
                            return (
                                <Cell key={entry.name}
                                    fill={CHART_COLORS[idx >= 0 ? idx : i]}
                                    style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))", outline: "none" }} />
                            );
                        })}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2">
                {data.map(({ name, value }, i) => {
                    const pct = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
                    const cfg = SENT_CONFIG[name.toUpperCase()];
                    return (
                        <div key={name}
                            className="flex flex-col items-center gap-1.5 p-3 rounded-xl border"
                            style={{ background: cfg.bg, borderColor: cfg.border }}>
                            <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[i] }} />
                            <span className="text-xs font-bold text-white">{pct}%</span>
                            <span className="text-xs text-slate-400">{name}</span>
                            <span className="text-xs font-semibold" style={{ color: cfg.color }}>{value} calls</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALL DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────

function CallDetailPanel({ call }) {
    const [transcriptExpanded, setTranscriptExpanded] = useState(false);
    if (!call) return null;

    const sentCfg = SENT_CONFIG[call.sentiment] || SENT_CONFIG.NEUTRAL;
    const strengths   = parseList(call.strengths);
    const improvements = parseList(call.improvements);
    const keywords    = parseList(call.keywords);
    const insights    = parseInsights(call.insights);
    const TRANSCRIPT_PREVIEW = 600;
    const longTranscript = call.transcript && call.transcript.length > TRANSCRIPT_PREVIEW;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/8">
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-white truncate">{call.fileName}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {call.createdAt ? new Date(call.createdAt).toLocaleString("en-US", {
                            weekday: "short", month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit"
                        }) : "Unknown date"}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    {call.sentiment && (
                        <span className="text-sm font-bold px-3 py-1.5 rounded-full"
                            style={{ background: sentCfg.bg, color: sentCfg.color, border: `1px solid ${sentCfg.border}` }}>
                            {sentCfg.emoji} {sentCfg.label}
                        </span>
                    )}
                    {call.overallScore != null && (
                        <div className="flex flex-col items-center">
                            <ScoreRing score={call.overallScore} size={60} stroke={5} color="#8b5cf6" />
                            <span className="text-xs text-slate-500 mt-0.5">Overall</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary */}
            {call.summary && (
                <div className="p-4 rounded-2xl border border-violet-500/20 bg-violet-500/5">
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">📋 Summary</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{call.summary}</p>
                </div>
            )}

            {/* Transcript */}
            {call.transcript && (
                <div className="rounded-2xl border border-white/10 bg-white/3">
                    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/8">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">📝 Transcript</p>
                        {longTranscript && (
                            <button onClick={() => setTranscriptExpanded(e => !e)}
                                className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors
                                    bg-violet-500/10 hover:bg-violet-500/20 px-3 py-1 rounded-full border border-violet-500/20">
                                {transcriptExpanded ? "Collapse ↑" : "Read more ↓"}
                            </button>
                        )}
                    </div>
                    <div className={`px-4 py-4 overflow-y-auto transition-all duration-500 ${transcriptExpanded ? "max-h-96" : "max-h-40"}`}
                        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.4) transparent" }}>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
                            {transcriptExpanded || !longTranscript
                                ? call.transcript
                                : call.transcript.slice(0, TRANSCRIPT_PREVIEW) + "…"}
                        </p>
                    </div>
                </div>
            )}

            {/* Strengths + Improvements side by side */}
            {(strengths.length > 0 || improvements.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {strengths.length > 0 && (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">✅ Strengths</p>
                            <ul className="space-y-2">
                                {strengths.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 flex-shrink-0
                                            flex items-center justify-center text-emerald-400 text-xs font-bold">
                                            ✓
                                        </span>
                                        <span className="text-sm text-slate-300 leading-snug">{s}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {improvements.length > 0 && (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">⚡ Improvements</p>
                            <ul className="space-y-2">
                                {improvements.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/20 flex-shrink-0
                                            flex items-center justify-center text-amber-400 text-xs font-bold">
                                            !
                                        </span>
                                        <span className="text-sm text-slate-300 leading-snug">{s}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* AI Insights — structured sections */}
            {insights.length > 0 && (
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">🧠 AI Insights</p>
                    {insights[0]?.bullets ? (
                        // Fallback: no canonical labels found — render as bullets
                        <ul className="space-y-2">
                            {insights[0].bullets.map((line, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                    <span className="text-sm text-slate-300 leading-relaxed">{line}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        // Structured: render each section as a labelled row
                        <div className="space-y-2.5">
                            {insights.map(section => (
                                <div key={section.key}
                                    className="flex items-start gap-3 p-3 rounded-xl border"
                                    style={{ background: section.bg, borderColor: section.border }}>
                                    <span className="text-base flex-shrink-0 mt-0.5">{section.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold uppercase tracking-wide mb-0.5"
                                            style={{ color: section.color }}>
                                            {section.label}
                                        </p>
                                        <p className="text-sm text-slate-300 leading-relaxed">
                                            {section.value || <span className="text-slate-600 italic">—</span>}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Keywords */}
            {keywords.length > 0 && (
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">🔑 Keywords</p>
                    <div className="flex flex-wrap gap-2">
                        {keywords.map((kw, i) => (
                            <span key={i}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-105 cursor-default"
                                style={{
                                    background: "rgba(139,92,246,0.12)",
                                    borderColor: "rgba(139,92,246,0.3)",
                                    color: "rgb(196,181,253)",
                                }}>
                                {kw}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* QA Score breakdown */}
            {(call.communication || call.professionalism || call.problemResolution || call.customerSatisfaction) && (
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">📊 QA Dimensions</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: "Communication",    key: "communication",        color: "#8b5cf6" },
                            { label: "Problem Resolution", key: "problemResolution",  color: "#3b82f6" },
                            { label: "Professionalism",  key: "professionalism",      color: "#10b981" },
                            { label: "Cust. Satisfaction", key: "customerSatisfaction", color: "#f59e0b" },
                        ].map(({ label, key, color }) => (
                            <div key={key} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/4 border border-white/8">
                                <ScoreRing score={call[key]} size={60} stroke={5} color={color} />
                                <p className="text-xs text-slate-400 text-center font-medium leading-tight">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const [calls, setCalls]               = useState([]);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState(null);
    const [profileOpen, setProfileOpen]   = useState(false);
    const [uploadOpen, setUploadOpen]     = useState(false);
    const [selectedCall, setSelectedCall] = useState(null);
    const [toast, setToast]               = useState(null);
    const [playingId, setPlayingId]       = useState(null); // mini audio player

    const user      = getUser();
    const firstName = user?.name?.split(" ")[0] ?? "there";

    const fetchCalls = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get("/api/calls/my-calls");
            const sorted = [...res.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setCalls(sorted);
            // Auto-select most recent call if none selected
            setSelectedCall(prev => prev ? sorted.find(c => c.id === prev.id) || sorted[0] : sorted[0]);
        } catch (err) {
            console.error("Failed to fetch calls:", err);
            setError("Failed to load calls. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCalls(); }, [fetchCalls]);

    // Close profile dropdown on outside click
    useEffect(() => {
        const handler = () => setProfileOpen(false);
        if (profileOpen) window.addEventListener("click", handler);
        return () => window.removeEventListener("click", handler);
    }, [profileOpen]);

    const handleLogout = () => { clearSession(); window.location.href = "/login"; };

    const handleUploadSuccess = () => {
        fetchCalls();
        setToast({ message: "Call uploaded & analysed successfully!", type: "success" });
    };

    // ── Analytics ─────────────────────────────────────────────────────────────
    const totalCalls     = calls.length;
    const positiveCalls  = calls.filter(c => c.sentiment === "POSITIVE").length;
    const negativeCalls  = calls.filter(c => c.sentiment === "NEGATIVE").length;
    const neutralCalls   = calls.filter(c => c.sentiment === "NEUTRAL").length;
    const avgScore       = totalCalls > 0 ? (calls.reduce((s, c) => s + (c.overallScore || 0), 0) / totalCalls).toFixed(1) : 0;
    const bestScore      = totalCalls > 0 ? Math.max(...calls.map(c => c.overallScore || 0)) : 0;
    const positivePercent = totalCalls > 0 ? ((positiveCalls / totalCalls) * 100).toFixed(1) : 0;
    const negativePercent = totalCalls > 0 ? ((negativeCalls / totalCalls) * 100).toFixed(1) : 0;
    const neutralPercent  = totalCalls > 0 ? ((neutralCalls  / totalCalls) * 100).toFixed(1) : 0;

    const sentimentCounts = { POSITIVE: positiveCalls, NEGATIVE: negativeCalls, NEUTRAL: neutralCalls };
    const dominantSentiment = totalCalls > 0
        ? Object.keys(sentimentCounts).reduce((a, b) => sentimentCounts[a] > sentimentCounts[b] ? a : b)
        : null;

    const chartData = [
        { name: "Positive", value: positiveCalls },
        { name: "Neutral",  value: neutralCalls  },
        { name: "Negative", value: negativeCalls },
    ];

    // Timeline
    const timelineMap = {};
    calls.forEach(c => {
        if (!c.createdAt) return;
        const d = new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        timelineMap[d] = (timelineMap[d] || 0) + 1;
    });
    const timelineData = Object.entries(timelineMap).slice(-10).map(([date, count]) => ({ date, calls: count }));

    // Keywords
    const allKeywords = calls.flatMap(c => c.keywords ? c.keywords.split(",") : []).map(k => k.trim()).filter(Boolean);
    const kwFreq = {};
    allKeywords.forEach(k => { kwFreq[k] = (kwFreq[k] || 0) + 1; });
    const topKeywords = Object.entries(kwFreq).sort((a, b) => b[1] - a[1]).slice(0, 12);

    // Avg QA scores
    const avgQA = (key) => totalCalls > 0
        ? Math.round(calls.reduce((s, c) => s + (c[key] || 0), 0) / calls.length)
        : 0;

    const recentCalls = calls.slice(0, 8);

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen text-white"
            style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #0d0b2a 40%, #0a1628 100%)" }}>

            {/* Noise texture */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

            {/* ── NAV ─────────────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-40 border-b border-white/8 backdrop-blur-xl"
                style={{ background: "rgba(10,10,26,0.88)" }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                        <img src={logo} alt="Convexa AI" className="h-7 w-auto" />
                        <span className="text-base font-black tracking-tight hidden sm:block">
                            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Convexa</span>
                            <span className="text-white ml-1">AI</span>
                        </span>
                    </div>

                    {/* Nav links */}
                    <nav className="hidden md:flex items-center gap-1">
                        {[
                            { label: "Dashboard",    path: "/dashboard"  },
                            { label: "Call History", path: "/history"    },
                            { label: "Analytics",    path: "/analytics"  },
                        ].map(({ label, path }) => (
                            <Link key={label} to={path}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                                    ${path === "/dashboard"
                                        ? "bg-white/10 text-white"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                                {label}
                            </Link>
                        ))}
                    </nav>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setUploadOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm
                                bg-gradient-to-r from-violet-600 to-blue-600 text-white
                                hover:from-violet-500 hover:to-blue-500 transition-all
                                hover:shadow-lg hover:shadow-violet-500/30 active:scale-95">
                            <span className="text-base">+</span>
                            <span className="hidden sm:inline">Upload</span>
                        </button>

                        {/* Profile */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => setProfileOpen(o => !o)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10
                                    bg-white/5 hover:bg-white/10 transition-all">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500
                                    flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {user?.name?.[0]?.toUpperCase() ?? "U"}
                                </div>
                                <span className="text-sm font-medium hidden sm:block">{user?.name ?? "User"}</span>
                                <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {profileOpen && (
                                <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-white/10
                                    bg-slate-900/98 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
                                    <div className="px-4 py-3 border-b border-white/8">
                                        <p className="text-sm font-bold text-white">{user?.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                                    </div>
                                    <div className="p-2">
                                        <button onClick={handleLogout}
                                            className="w-full text-left px-3 py-2 text-sm text-red-400
                                                hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all">
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

                {/* ── ERROR BANNER ── */}
                {error && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300">
                        <span>⚠️</span>
                        <span className="text-sm">{error}</span>
                        <button onClick={fetchCalls} className="ml-auto text-xs bg-red-500/20 hover:bg-red-500/30 px-3 py-1 rounded-lg">
                            Retry
                        </button>
                    </div>
                )}

                {/* ── HERO SECTION ── */}
                <section className="relative overflow-hidden rounded-3xl border border-white/10 p-7 md:p-10"
                    style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(59,130,246,0.09) 100%)" }}>
                    <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "radial-gradient(ellipse at 0% 50%, rgba(139,92,246,0.15) 0%, transparent 55%), radial-gradient(ellipse at 100% 50%, rgba(59,130,246,0.12) 0%, transparent 55%)" }} />
                    {/* Glow orbs */}
                    <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none"
                        style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
                    <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-15 blur-3xl pointer-events-none"
                        style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />

                    <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                            <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">
                                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                            </p>
                            <h1 className="text-3xl md:text-4xl font-black text-white">
                                Welcome back, {firstName} 👋
                            </h1>
                            <p className="text-slate-400 mt-2 text-base max-w-lg">
                                {totalCalls === 0
                                    ? "Upload your first call recording to get AI-powered conversation intelligence."
                                    : `You have ${totalCalls} call${totalCalls !== 1 ? "s" : ""} analysed.${dominantSentiment ? ` Dominant sentiment: ${SENT_CONFIG[dominantSentiment]?.emoji} ${dominantSentiment}.` : ""}`}
                            </p>
                        </div>

                        <div className="flex items-center gap-5 flex-shrink-0">
                            {loading ? (
                                <Skeleton className="w-20 h-20 rounded-full" />
                            ) : (
                                <div className="flex flex-col items-center">
                                    <ScoreRing score={Math.round(avgScore)} size={76} stroke={6} />
                                    <p className="text-xs text-slate-400 mt-1 font-medium">Avg Score</p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { v: totalCalls, l: "Calls" },
                                    { v: `${positivePercent}%`, l: "Positive" },
                                    { v: bestScore, l: "Best Score" },
                                    { v: `${negativePercent}%`, l: "Negative" },
                                ].map(({ v, l }) => (
                                    <div key={l} className="text-center px-4 py-2.5 rounded-xl bg-white/5 border border-white/8">
                                        <p className="text-lg font-black text-white">{loading ? "–" : v}</p>
                                        <p className="text-xs text-slate-500 font-medium">{l}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── STAT CARDS ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
                    ) : (
                        <>
                            <StatCard label="Total Calls"  value={totalCalls}  icon="📞" accent="#8b5cf6" />
                            <StatCard label="Avg QA Score" value={avgScore}    icon="⭐" accent="#3b82f6"
                                sub={Number(avgScore) >= 70 ? "Good" : Number(avgScore) >= 50 ? "Fair" : "Low"} />
                            <StatCard label="Positive %"   value={`${positivePercent}%`} icon="😊" accent="#10b981" />
                            <StatCard label="Negative %"   value={`${negativePercent}%`} icon="😔" accent="#ef4444" />
                        </>
                    )}
                </div>

                {/* Sentiment progress bar */}
                {totalCalls > 0 && !loading && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Sentiment Breakdown</p>
                        <div className="w-full h-3 rounded-full overflow-hidden flex gap-0.5"
                            style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div style={{ width: `${positivePercent}%`, background: "#10b981", transition: "width 1s ease" }} className="rounded-l-full" />
                            <div style={{ width: `${neutralPercent}%`,  background: "#f59e0b", transition: "width 1s ease" }} />
                            <div style={{ width: `${negativePercent}%`, background: "#ef4444", transition: "width 1s ease" }} className="rounded-r-full" />
                        </div>
                        <div className="flex flex-wrap gap-4 mt-3">
                            {[["#10b981","Positive",positivePercent],["#f59e0b","Neutral",neutralPercent],["#ef4444","Negative",negativePercent]].map(([c,l,v]) => (
                                <div key={l} className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                                    <span className="text-xs text-slate-400">{l}</span>
                                    <span className="text-xs font-bold text-white">{v}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── EMPTY STATE ── */}
                {!loading && totalCalls === 0 && (
                    <div className="text-center py-24 rounded-3xl border border-white/8 border-dashed"
                        style={{ background: "rgba(255,255,255,0.015)" }}>
                        <div className="text-7xl mb-5">🎙️</div>
                        <h2 className="text-2xl font-black text-white mb-2">No calls yet</h2>
                        <p className="text-slate-400 max-w-md mx-auto mb-7 text-sm">
                            Upload your first customer call recording. Our AI will transcribe it, score it, and surface actionable insights automatically.
                        </p>
                        <button onClick={() => setUploadOpen(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm
                                bg-gradient-to-r from-violet-600 to-blue-600 text-white
                                hover:from-violet-500 hover:to-blue-500 transition-all
                                hover:shadow-xl hover:shadow-violet-500/30 active:scale-95">
                            🚀 Upload First Call
                        </button>
                        <div className="flex flex-wrap justify-center gap-3 mt-8 text-xs text-slate-500">
                            {["🎵 Whisper Transcription","🧠 AI Analysis","📊 QA Scoring","🔑 Keyword Extraction"].map(t => (
                                <span key={t} className="px-3 py-1.5 rounded-full border border-white/8 bg-white/3">{t}</span>
                            ))}
                        </div>
                    </div>
                )}

                {totalCalls > 0 && (
                    <>
                        {/* ── CHARTS ROW ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Sentiment donut – redesigned */}
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Sentiment Distribution</p>
                                    <span className="text-xs text-violet-400 font-bold px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
                                        {totalCalls} calls
                                    </span>
                                </div>
                                {loading
                                    ? <Skeleton className="h-56" />
                                    : <SentimentChart data={chartData} total={totalCalls} />
                                }
                            </div>

                            {/* Timeline */}
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Call Activity Timeline</p>
                                {loading ? (
                                    <Skeleton className="h-56" />
                                ) : timelineData.length < 2 ? (
                                    <div className="flex flex-col items-center justify-center h-56 text-slate-500 text-sm gap-2">
                                        <span className="text-3xl">📈</span>
                                        <span>Upload more calls to see the timeline</span>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <AreaChart data={timelineData}>
                                            <defs>
                                                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.35} />
                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip contentStyle={{ background: "#0d0b2a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "13px" }} />
                                            <Area type="monotone" dataKey="calls" stroke="#8b5cf6" strokeWidth={2.5}
                                                fill="url(#areaGrad)" dot={{ fill: "#8b5cf6", r: 4, strokeWidth: 0 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* ── AVG QA DIMENSIONS ── */}
                        {calls.some(c => c.communication || c.professionalism) && (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Average QA Dimensions</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: "Communication",       key: "communication",       color: "#8b5cf6" },
                                        { label: "Problem Resolution",  key: "problemResolution",   color: "#3b82f6" },
                                        { label: "Professionalism",     key: "professionalism",     color: "#10b981" },
                                        { label: "Cust. Satisfaction",  key: "customerSatisfaction",color: "#f59e0b" },
                                    ].map(({ label, key, color }) => (
                                        <div key={key} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-all">
                                            <ScoreRing score={avgQA(key)} size={72} stroke={6} color={color} />
                                            <p className="text-xs text-slate-400 text-center font-medium leading-tight">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── RECENT CALLS + DETAIL SPLIT ── */}
                        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">

                            {/* Call list */}
                            <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Recent Calls</p>
                                    <span className="text-xs text-violet-400 font-bold px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
                                        {totalCalls} total
                                    </span>
                                </div>

                                {loading ? (
                                    <div className="space-y-3">
                                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {recentCalls.map(call => {
                                            const cfg = SENT_CONFIG[call.sentiment] || SENT_CONFIG.NEUTRAL;
                                            const isSelected = selectedCall?.id === call.id;
                                            return (
                                                <div key={call.id}
                                                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all group
                                                        ${isSelected
                                                            ? "border-violet-500/40 bg-violet-500/10"
                                                            : "border-white/6 bg-white/2 hover:bg-white/5 hover:border-white/12"}`}>
                                                    {/* Mini audio button */}
                                                    <MiniAudioPlayer
                                                        filePath={call.filePath}
                                                        playingId={playingId}
                                                        callId={call.id}
                                                        onPlay={setPlayingId}
                                                        onStop={() => setPlayingId(null)}
                                                    />
                                                    {/* Info — clickable to select */}
                                                    <button
                                                        onClick={() => setSelectedCall(call)}
                                                        className="flex-1 min-w-0 text-left">
                                                        <p className="text-sm font-semibold text-white truncate">{call.fileName}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {call.createdAt ? new Date(call.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Unknown"}
                                                        </p>
                                                    </button>
                                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                        {call.sentiment && (
                                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                                                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                                                {cfg.emoji}
                                                            </span>
                                                        )}
                                                        {call.overallScore != null && (
                                                            <span className="text-xs font-black text-white">{call.overallScore}</span>
                                                        )}
                                                        <Link to={`/calls/${call.id}`}
                                                            onClick={e => e.stopPropagation()}
                                                            className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors">
                                                            View →
                                                        </Link>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Call detail */}
                            <div className="xl:col-span-3 rounded-2xl border border-white/10 bg-white/5 p-6 min-h-64">
                                {loading ? (
                                    <div className="space-y-4">
                                        <Skeleton className="h-8 w-2/3" />
                                        <Skeleton className="h-24" />
                                        <Skeleton className="h-32" />
                                    </div>
                                ) : selectedCall ? (
                                    <CallDetailPanel call={selectedCall} />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm gap-2">
                                        <span className="text-3xl">👆</span>
                                        <span>Select a call to see details</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── KEYWORD INTELLIGENCE ── */}
                        {topKeywords.length > 0 && (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Keyword Intelligence</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{Object.keys(kwFreq).length} unique keywords across all calls</p>
                                    </div>
                                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                        AI Extracted
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-6">
                                    {topKeywords.map(([kw, cnt], i) => {
                                        const opacity = 0.45 + ((topKeywords.length - i) / topKeywords.length) * 0.55;
                                        return (
                                            <span key={kw}
                                                className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all hover:scale-105 cursor-default"
                                                style={{
                                                    background: `rgba(139,92,246,${opacity * 0.13})`,
                                                    borderColor: `rgba(139,92,246,${opacity * 0.35})`,
                                                    color: `rgba(196,181,253,${opacity})`,
                                                    fontSize: `${0.72 + (opacity - 0.45) * 0.35}rem`,
                                                }}>
                                                {kw} <span className="opacity-55 text-xs">×{cnt}</span>
                                            </span>
                                        );
                                    })}
                                </div>

                                <div className="space-y-2.5">
                                    {topKeywords.slice(0, 8).map(([kw, cnt]) => (
                                        <div key={kw} className="flex items-center gap-3">
                                            <span className="w-28 text-xs text-slate-300 font-medium truncate text-right">{kw}</span>
                                            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/8">
                                                <div className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-700"
                                                    style={{ width: `${(cnt / topKeywords[0][1]) * 100}%` }} />
                                            </div>
                                            <span className="w-5 text-xs text-slate-500 font-bold">{cnt}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* ── FOOTER ── */}
            <footer className="border-t border-white/6 mt-12 py-5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <span className="text-xs text-slate-600">© 2026 Convexa AI · Conversation Intelligence Platform</span>
                    <span className="text-xs text-slate-700">Powered by Whisper · Ollama · Qwen 2.5</span>
                </div>
            </footer>

            {/* ── UPLOAD MODAL ── */}
            {uploadOpen && (
                <UploadModal
                    onClose={() => setUploadOpen(false)}
                    onSuccess={handleUploadSuccess}
                />
            )}

            {/* ── TOAST ── */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onDismiss={() => setToast(null)}
                />
            )}

            {/* ── ANIMATION KEYFRAMES ── */}
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(24px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
            `}</style>
        </div>
    );
}
