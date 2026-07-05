import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { parseInsights } from "../utils/insightsFormatter.js";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import api, { getUser, clearSession } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";
import MiniAudioPlayer from "../components/MiniAudioPlayer.jsx";
import {
    Phone, Star, TrendingUp, TrendingDown, BarChart2,
    Upload, ChevronDown, X, CheckCircle, AlertTriangle,
    Mic, LayoutDashboard, History, LineChart, LogOut,
    Menu, Zap, Brain, Key, Activity, Layers,
    ArrowRight, Tag, Clock, Smile, Frown, Meh,
    FileAudio, CloudUpload, RefreshCw, Sparkles, Radio,
    ShieldAlert, Target, ArrowUpRight, Flame, Gauge,
    Search, Command, CalendarDays, SlidersHorizontal, Bell,
    Sun, Moon, ChevronsLeft, ChevronsRight, MoreHorizontal,
    Crown, Medal, Award, BookOpen, ClipboardList, FileText,
    Settings, Info, AlertOctagon, PlayCircle, ArrowUp, ArrowDown,
} from "lucide-react";


/** Strip markdown symbols and return clean plain-text bullet array */
function parseMarkdownToBullets(text) {
    if (!text) return [];
    return text
        .split(/\n|(?<=\.)\s{2,}/)
        .map(line =>
            line
                .replace(/^[\s*\-•>#]+/, "")
                .replace(/\*\*(.*?)\*\*/g, "$1")
                .replace(/\*(.*?)\*/g, "$1")
                .replace(/`(.*?)`/g, "$1")
                .replace(/#+\s?/g, "")
                .trim()
        )
        .filter(line => line.length > 3);
}

/** Parse comma-separated or newline-separated list to array */
function parseList(str) {
    if (!str) return [];
    if (str.trim().startsWith("[")) {
        try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) {
                return parsed.map(s => String(s).trim()).filter(Boolean);
            }
        } catch {
        }
    }
    return str.split(/,|\n/).map(s => s.replace(/^[\s*\-•]+/, "").trim()).filter(Boolean);
}

const SENT_CONFIG = {
    POSITIVE: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", label: "Positive", Icon: Smile },
    NEGATIVE: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: "Negative", Icon: Frown },
    NEUTRAL:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "Neutral",  Icon: Meh },
};

/* ────────────────────────────────────────────────────────────────────── */
/* Theme tokens — a real (if intentionally scoped) light/dark toggle.     */
/* Covers the app shell, sidebar, header and panels. Modals (Upload,      */
/* Toast) and the call-detail drill-down keep a fixed dark chrome, the    */
/* way Superhuman/Raycast keep certain overlay surfaces theme-independent.*/
/* ────────────────────────────────────────────────────────────────────── */
const THEMES = {
    dark: {
        pageBg: "linear-gradient(160deg, #05060A 0%, #0B1020 45%, #070912 100%)",
        sidebarBg: "rgba(8,9,18,0.92)",
        headerBg: "rgba(5,6,10,0.82)",
        panel: "rgba(255,255,255,0.025)",
        panelBorder: "rgba(255,255,255,0.07)",
        panelHover: "rgba(255,255,255,0.045)",
        inputBg: "rgba(255,255,255,0.04)",
        text: "#f8fafc",
        textMuted: "#94a3b8",
        textFaint: "#475569",
        divider: "rgba(255,255,255,0.06)",
    },
    light: {
        pageBg: "linear-gradient(160deg, #f8f9fc 0%, #eef0f7 45%, #f4f5fb 100%)",
        sidebarBg: "rgba(255,255,255,0.9)",
        headerBg: "rgba(255,255,255,0.85)",
        panel: "rgba(17,24,39,0.025)",
        panelBorder: "rgba(17,24,39,0.08)",
        panelHover: "rgba(17,24,39,0.045)",
        inputBg: "rgba(17,24,39,0.04)",
        text: "#0f172a",
        textMuted: "#475569",
        textFaint: "#94a3b8",
        divider: "rgba(17,24,39,0.07)",
    },
};

/* ────────────────────────────────────────────────────────────────────── */
/* Small data helpers — everything here reads only from the `calls` array */
/* already returned by GET /api/calls/my-calls. No new endpoints, no      */
/* fabricated numbers: days with no calls simply don't appear.            */
/* ────────────────────────────────────────────────────────────────────── */

/** Group calls by day and average a numeric selector across that day. */
function buildDailySeries(calls, selector, days = 8) {
    const byDay = {};
    calls.forEach(c => {
        if (!c.createdAt) return;
        const key = new Date(c.createdAt).toISOString().slice(0, 10);
        const v = selector(c);
        if (v == null) return;
        if (!byDay[key]) byDay[key] = [];
        byDay[key].push(v);
    });
    const sortedDays = Object.keys(byDay).sort();
    return sortedDays.slice(-days).map(day => {
        const vals = byDay[day];
        return { date: day, value: vals.reduce((a, b) => a + b, 0) / vals.length };
    });
}

/** Compare the second half of a series against the first half to get a rough trend %. */
function seriesTrend(series) {
    if (series.length < 2) return null;
    const mid = Math.ceil(series.length / 2);
    const first = series.slice(0, mid).reduce((s, p) => s + p.value, 0) / mid;
    const second = series.slice(mid).reduce((s, p) => s + p.value, 0) / (series.length - mid || 1);
    if (first === 0) return null;
    return ((second - first) / first) * 100;
}

function timeAgo(dateStr) {
    if (!dateStr) return "";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    return `${days}d ago`;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Design-system primitives                                               */
/* ────────────────────────────────────────────────────────────────────── */

function SectionLabel({ icon: Icon, children, tone = "#8b5cf6", T }) {
    return (
        <div className="flex items-center gap-2">
            {Icon && (
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: `${tone}1c`, border: `1px solid ${tone}35` }}>
                    <Icon size={11} style={{ color: tone }} strokeWidth={2.5} />
                </div>
            )}
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: tone }}>{children}</span>
        </div>
    );
}

function Panel({ children, className = "", padded = true, style = {}, T }) {
    return (
        <div className={`rounded-2xl ${padded ? "p-5 sm:p-6" : ""} ${className}`}
            style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, ...style }}>
            {children}
        </div>
    );
}

function PanelHeader({ title, sub, right, T }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-5">
            <div>
                <p className="text-sm font-bold tracking-tight" style={{ color: T.text }}>{title}</p>
                {sub && <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>{sub}</p>}
            </div>
            {right}
        </div>
    );
}

function LivePulse({ label = "Live" }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.28)", color: "#34d399" }}>
            <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "#34d399" }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#34d399" }} />
            </span>
            {label}
        </span>
    );
}

function Skeleton({ className = "", T }) {
    const base = T?.panelHover ?? "rgba(255,255,255,0.08)";
    return (
        <div className={`rounded-xl ${className}`}
            style={{ background: `linear-gradient(90deg, transparent 25%, ${base} 50%, transparent 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
    );
}

function ScoreRing({ score, size = 80, stroke = 7, color = "#8b5cf6", track = "rgba(255,255,255,0.06)", textColor = "white" }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const pct = Math.min((score || 0) / 100, 1);
    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
                style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 6px ${color}80)` }} />
            <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
                fill={textColor} fontSize={size * 0.22} fontWeight="800"
                style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%", fontFamily: "inherit" }}>
                {score ?? "–"}
            </text>
        </svg>
    );
}

/** Minimal inline sparkline — no chart-library overhead for a 40px strip. */
function Sparkline({ series, color = "#8b5cf6", width = 96, height = 32 }) {
    if (!series || series.length < 2) {
        return <div style={{ width, height }} className="flex items-center" >
            <div className="w-full h-px" style={{ background: `${color}30` }} />
        </div>;
    }
    const values = series.map(p => p.value);
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const stepX = width / (values.length - 1);
    const points = values.map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    });
    const areaPoints = `0,${height} ${points.join(" ")} ${width},${height}`;
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <defs>
                <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={areaPoints} fill={`url(#spark-${color.replace("#", "")})`} />
            <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.75"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function TrendBadge({ pct }) {
    if (pct == null || Number.isNaN(pct)) {
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: "#64748b", background: "rgba(148,163,184,0.1)" }}>–</span>;
    }
    const up = pct >= 0;
    const color = up ? "#34d399" : "#f87171";
    return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ color, background: `${color}18` }}>
            {up ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
            {Math.abs(pct).toFixed(1)}%
        </span>
    );
}

/** Premium KPI card: value, sparkline, trend, icon, gradient accent — all from real data. */
function KPICard({ label, value, sub, Icon, accent = "#8b5cf6", series, trendPct, T }) {
    return (
        <div className="group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-default"
            style={{ background: T.panel, borderColor: T.panelBorder }}
            onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${accent}55`;
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = `0 12px 32px ${accent}1c`;
            }}
            onMouseLeave={e => {
                e.currentTarget.style.borderColor = T.panelBorder;
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "";
            }}>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 15% 0%, ${accent}14 0%, transparent 60%)` }} />
            <div className="p-5">
                <div className="flex items-start justify-between mb-3.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                        {Icon && <Icon size={18} style={{ color: accent }} strokeWidth={2} />}
                    </div>
                    <TrendBadge pct={trendPct} />
                </div>
                <p className="text-3xl font-black mb-1 tracking-tight" style={{ color: T.text }}>{value}</p>
                <div className="flex items-end justify-between gap-2">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: T.textMuted }}>{label}</p>
                        {sub && <p className="text-[10px] mt-0.5" style={{ color: T.textFaint }}>{sub}</p>}
                    </div>
                    <Sparkline series={series} color={accent} width={72} height={28} />
                </div>
            </div>
        </div>
    );
}

/** Toast notification */
function Toast({ message, type = "success", onDismiss }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 4000);
        return () => clearTimeout(t);
    }, [onDismiss]);
    const isSuccess = type === "success";
    return (
        <div className="fixed bottom-6 right-6 left-6 sm:left-auto z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl"
            style={{
                background: isSuccess ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                borderColor: isSuccess ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)",
                animation: "slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                boxShadow: isSuccess ? "0 8px 32px rgba(16,185,129,0.2)" : "0 8px 32px rgba(239,68,68,0.2)",
            }}>
            {isSuccess
                ? <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
                : <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />}
            <span className="text-sm font-semibold" style={{ color: isSuccess ? "#6ee7b7" : "#fca5a5" }}>{message}</span>
            <button onClick={onDismiss} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
                <X size={14} className="text-white" />
            </button>
        </div>
    );
}


function UploadModal({ onClose, onSuccess }) {
    const [dragging, setDragging] = useState(false);
    const [file, setFile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [state, setState] = useState("idle");
    const [phase, setPhase] = useState("uploading");
    const [errorMsg, setErrorMsg] = useState("");
    const inputRef = useRef();

    const PHASE_LABELS = {
        uploading: "Uploading audio…",
        analyzing: "Analyzing conversation…",
        saving: "Saving results…",
    };
    const PHASE_SUBS = {
        uploading: "Sending file to server",
        analyzing: "Whisper is transcribing · AI is scoring",
        saving: "Writing to database",
    };

    const handleFile = (f) => {
        if (!f) return;
        const validExt = /\.(mp3|wav|m4a|ogg|webm|flac|mp4)$/i.test(f.name);
        const validType = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg", "audio/webm", "audio/flac", "video/mp4"].includes(f.type);
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
            await api.post("/api/calls/upload", form, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 0,
                onUploadProgress: (e) => {
                    const pct = e.total
                        ? Math.round((e.loaded * 100) / e.total)
                        : 0;
                    setProgress(pct);
                    if (pct >= 100) {
                        setPhase("analyzing");
                    }
                },
            });
            setPhase("saving");
            await new Promise(r => setTimeout(r, 600));
            setState("success");
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1800);
        } catch (err) {
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

    const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)" }}
            onClick={handleBackdrop}>
            <div className="relative w-full max-w-lg rounded-3xl border overflow-hidden"
                style={{
                    background: "linear-gradient(145deg, rgba(13,11,42,0.99) 0%, rgba(10,18,40,0.99) 100%)",
                    borderColor: "rgba(255,255,255,0.1)",
                    boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1)",
                    animation: "modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                }}
                onClick={(e) => e.stopPropagation()}>

                <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, #8b5cf6, #3b82f6, #06b6d4)" }} />

                <div className="p-6 sm:p-8">
                    <div className="flex items-start justify-between mb-7">
                        <div>
                            <div className="flex items-center gap-2.5 mb-1.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)" }}>
                                    <Mic size={15} className="text-violet-400" />
                                </div>
                                <h2 className="text-lg font-black text-white tracking-tight">Upload Call Recording</h2>
                            </div>
                            <p className="text-xs text-slate-500 ml-10">mp3 · wav · m4a · flac · ogg · webm</p>
                        </div>
                        <button onClick={onClose}
                            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
                            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}>
                            <X size={14} className="text-slate-400" />
                        </button>
                    </div>

                    {state === "success" ? (
                        <div className="flex flex-col items-center py-12 gap-5">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center"
                                style={{ background: "rgba(16,185,129,0.15)", boxShadow: "0 0 40px rgba(16,185,129,0.25)", border: "1px solid rgba(16,185,129,0.3)" }}>
                                <CheckCircle size={36} className="text-emerald-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-emerald-400 font-bold text-lg">Upload Successful!</p>
                                <p className="text-slate-400 text-sm mt-1">AI is analysing your call…</p>
                            </div>
                            <div className="w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", height: "3px" }}>
                                <div className="h-full rounded-full animate-pulse"
                                    style={{ background: "linear-gradient(90deg, #10b981, #06b6d4)", width: "100%" }} />
                            </div>
                        </div>
                    ) : state === "uploading" ? (
                        <div className="py-10 space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative w-16 h-16">
                                    <div className="w-16 h-16 rounded-full animate-spin"
                                        style={{ border: "2px solid rgba(139,92,246,0.2)", borderTopColor: "#8b5cf6" }} />
                                    <div className="absolute inset-2 rounded-full flex items-center justify-center"
                                        style={{ background: "rgba(139,92,246,0.1)" }}>
                                        <Mic size={20} className="text-violet-400" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-white font-bold">{PHASE_LABELS[phase]}</p>
                                    <p className="text-slate-400 text-sm mt-0.5">{PHASE_SUBS[phase]}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span className="truncate max-w-[60%] font-medium">{file?.name}</span>
                                    <span className="font-bold" style={{ color: "#8b5cf6" }}>
                                        {phase === "uploading" ? `${progress}%` : phase === "analyzing" ? "Processing…" : "Saving…"}
                                    </span>
                                </div>
                                <div className="w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)", height: "4px" }}>
                                    <div className="h-full rounded-full transition-all duration-300"
                                        style={{
                                            width: phase === "uploading" ? `${progress}%` : phase === "analyzing" ? "90%" : "100%",
                                            background: "linear-gradient(90deg, #8b5cf6, #3b82f6)",
                                        }} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                                onClick={() => inputRef.current?.click()}
                                className="relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-300"
                                style={{
                                    borderColor: dragging ? "rgba(139,92,246,0.7)" : file ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.1)",
                                    background: dragging ? "rgba(139,92,246,0.08)" : file ? "rgba(139,92,246,0.05)" : "rgba(255,255,255,0.02)",
                                    transform: dragging ? "scale(1.01)" : "",
                                }}>
                                <input ref={inputRef} type="file"
                                    accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg"
                                    className="hidden"
                                    onChange={(e) => handleFile(e.target.files[0])} />

                                {file ? (
                                    <div className="space-y-3">
                                        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
                                            style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                                            <FileAudio size={24} className="text-violet-400" />
                                        </div>
                                        <p className="text-white font-bold text-sm truncate px-4">{file.name}</p>
                                        <p className="text-slate-400 text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB · Click to change</p>
                                        <span className="inline-block mt-1 text-xs text-violet-300 px-3 py-1 rounded-full"
                                            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
                                            Ready to upload
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                                            <CloudUpload size={28} className="text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="text-white font-semibold">Drop your audio file here</p>
                                            <p className="text-slate-500 text-sm mt-1">or click to browse files</p>
                                        </div>
                                        <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                                            {["mp3", "wav", "m4a", "flac", "ogg"].map(ext => (
                                                <span key={ext} className="text-[10px] text-slate-600 px-2.5 py-1 rounded-full font-medium tracking-wide"
                                                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                                    .{ext}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {state === "error" && (
                                <div className="mt-3 flex items-center gap-2.5 text-sm rounded-xl px-4 py-3"
                                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                                    <AlertTriangle size={15} className="text-red-400 flex-shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <div className="flex gap-3 mt-6">
                                <button onClick={onClose}
                                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
                                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#94a3b8" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                                    Cancel
                                </button>
                                <button onClick={handleUpload} disabled={!file}
                                    className="flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 text-white disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                                    style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: file ? "0 4px 20px rgba(124,58,237,0.35)" : "none" }}>
                                    <Upload size={15} />
                                    {file ? "Analyse Call" : "Select a file first"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}


const CHART_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

function SentimentChart({ data, total, T }) {
    if (total === 0) {
        return (
            <div className="flex items-center justify-center h-56 text-sm" style={{ color: T.textMuted }}>
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
                <p style={{ color: cfg.color }} className="font-bold">{name}</p>
                <p className="text-slate-300 mt-0.5">{value} call{value !== 1 ? "s" : ""} · {((value / total) * 100).toFixed(1)}%</p>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-5">
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

            <div className="grid grid-cols-3 gap-2">
                {data.map(({ name, value }, i) => {
                    const pct = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
                    const cfg = SENT_CONFIG[name.toUpperCase()];
                    return (
                        <div key={name}
                            className="flex flex-col items-center gap-1.5 p-3 rounded-xl border"
                            style={{ background: cfg.bg, borderColor: cfg.border }}>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i] }} />
                            <span className="text-sm font-black text-white">{pct}%</span>
                            <span className="text-[10px] text-slate-400 font-medium">{name}</span>
                            <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{value} calls</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


function CallDetailPanel({ call }) {
    const [transcriptExpanded, setTranscriptExpanded] = useState(false);
    if (!call) return null;

    const sentCfg = SENT_CONFIG[call.sentiment] || SENT_CONFIG.NEUTRAL;
    const SentIcon = sentCfg.Icon;
    const strengths = parseList(call.strengths);
    const improvements = parseList(call.improvements);
    const keywords = parseList(call.keywords);
    const insights = parseInsights(call.insights);
    const TRANSCRIPT_PREVIEW = 600;
    const longTranscript = call.transcript && call.transcript.length > TRANSCRIPT_PREVIEW;

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-white truncate leading-tight">{call.fileName}</h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <Clock size={11} />
                        {call.createdAt ? new Date(call.createdAt).toLocaleString("en-US", {
                            weekday: "short", month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit"
                        }) : "Unknown date"}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    {call.sentiment && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                            style={{ background: sentCfg.bg, color: sentCfg.color, border: `1px solid ${sentCfg.border}` }}>
                            <SentIcon size={11} />
                            {sentCfg.label}
                        </span>
                    )}
                    {call.overallScore != null && (
                        <div className="flex flex-col items-center">
                            <ScoreRing score={call.overallScore} size={56} stroke={4.5} color="#8b5cf6" />
                            <span className="text-[10px] text-slate-500 mt-0.5 font-medium">Score</span>
                        </div>
                    )}
                </div>
            </div>

            {call.summary && (
                <div className="p-4 rounded-xl" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}>
                    <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Layers size={10} />
                        Summary
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">{call.summary}</p>
                </div>
            )}

            {call.transcript && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center justify-between px-4 pt-3.5 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Activity size={10} />
                            Transcript
                        </p>
                        {longTranscript && (
                            <button onClick={() => setTranscriptExpanded(e => !e)}
                                className="text-[10px] text-violet-400 hover:text-violet-300 font-bold transition-colors px-2.5 py-1 rounded-full"
                                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                                {transcriptExpanded ? "Collapse" : "Read more"}
                            </button>
                        )}
                    </div>
                    <div className={`px-4 py-3.5 overflow-y-auto transition-all duration-500 ${transcriptExpanded ? "max-h-96" : "max-h-36"}`}
                        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.4) transparent" }}>
                        <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap font-mono">
                            {transcriptExpanded || !longTranscript
                                ? call.transcript
                                : call.transcript.slice(0, TRANSCRIPT_PREVIEW) + "…"}
                        </p>
                    </div>
                </div>
            )}

            {(strengths.length > 0 || improvements.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {strengths.length > 0 && (
                        <div className="rounded-xl p-4" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.18)" }}>
                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <CheckCircle size={10} />
                                Strengths
                            </p>
                            <ul className="space-y-2">
                                {strengths.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                                            style={{ background: "rgba(16,185,129,0.15)" }}>
                                            <CheckCircle size={9} className="text-emerald-400" />
                                        </span>
                                        <span className="text-xs text-slate-300 leading-snug">{s}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {improvements.length > 0 && (
                        <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.18)" }}>
                            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <Zap size={10} />
                                Improvements
                            </p>
                            <ul className="space-y-2">
                                {improvements.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                                            style={{ background: "rgba(245,158,11,0.15)" }}>
                                            <AlertTriangle size={9} className="text-amber-400" />
                                        </span>
                                        <span className="text-xs text-slate-300 leading-snug">{s}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {insights.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.18)" }}>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Brain size={10} />
                        AI Insights
                    </p>
                    {insights[0]?.bullets ? (
                        <ul className="space-y-2">
                            {insights[0].bullets.map((line, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                                    <span className="text-xs text-slate-300 leading-relaxed">{line}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="space-y-2">
                            {insights.map(section => (
                                <div key={section.key}
                                    className="flex items-start gap-3 p-3 rounded-lg border"
                                    style={{ background: section.bg, borderColor: section.border }}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5"
                                            style={{ color: section.color }}>
                                            {section.label}
                                        </p>
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            {section.value || <span className="text-slate-600 italic">—</span>}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {keywords.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Key size={10} />
                        Keywords
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {keywords.map((kw, i) => (
                            <span key={i}
                                className="px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all hover:scale-105 cursor-default"
                                style={{
                                    background: "rgba(139,92,246,0.1)",
                                    borderColor: "rgba(139,92,246,0.25)",
                                    color: "rgb(196,181,253)",
                                }}>
                                {kw}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {(call.communication || call.professionalism || call.problemResolution || call.customerSatisfaction) && (
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <BarChart2 size={10} />
                        QA Dimensions
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {[
                            { label: "Communication", key: "communication", color: "#8b5cf6" },
                            { label: "Problem Resolution", key: "problemResolution", color: "#3b82f6" },
                            { label: "Professionalism", key: "professionalism", color: "#10b981" },
                            { label: "Cust. Satisfaction", key: "customerSatisfaction", color: "#f59e0b" },
                        ].map(({ label, key, color }) => (
                            <div key={key} className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
                                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                                <ScoreRing score={call[key]} size={56} stroke={4.5} color={color} />
                                <p className="text-[10px] text-slate-500 text-center font-medium leading-tight">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}


/* ────────────────────────────────────────────────────────────────────── */
/* Sidebar                                                                 */
/* ────────────────────────────────────────────────────────────────────── */
function Sidebar({ collapsed, setCollapsed, T, user, handleLogout, currentPath, needsAttentionCount, totalCalls }) {
    const REAL_ITEMS = [
        { label: "Dashboard", path: "/dashboard", Icon: LayoutDashboard },
        { label: "Call History", path: "/history", Icon: History },
        { label: "Analytics", path: "/analytics", Icon: LineChart },
    ];
    const SOON_ITEMS = [
        { label: "Library", Icon: BookOpen },
        { label: "AI Insights", Icon: Brain },
        { label: "Scorecards", Icon: ClipboardList },
        { label: "Reports", Icon: FileText },
        { label: "Keywords", Icon: Key },
        { label: "Settings", Icon: Settings },
    ];

    return (
        <aside className={`hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 transition-all duration-300 z-40 ${collapsed ? "w-[76px]" : "w-64"}`}
            style={{ background: T.sidebarBg, borderRight: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>

            <div className={`h-16 flex items-center flex-shrink-0 ${collapsed ? "justify-center px-0" : "justify-between px-5"}`}
                style={{ borderBottom: `1px solid ${T.divider}` }}>
                {!collapsed && (
                    <div className="flex items-center gap-2.5 min-w-0">
                        <img src={logo} alt="Convexa AI" className="h-6 w-auto flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-black tracking-tight truncate" style={{ color: T.text }}>Convexa AI</p>
                            <p className="text-[10px] truncate" style={{ color: T.textFaint }}>Conversation Intelligence</p>
                        </div>
                    </div>
                )}
                {collapsed && <img src={logo} alt="Convexa AI" className="h-6 w-auto" />}
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
                {REAL_ITEMS.map(({ label, path, Icon }) => {
                    const active = currentPath === path;
                    return (
                        <Link key={label} to={path} title={collapsed ? label : undefined}
                            className={`relative flex items-center gap-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${collapsed ? "justify-center px-0 py-3" : "px-3.5 py-2.5"}`}
                            style={active
                                ? { background: "rgba(139,92,246,0.14)", color: "#c4b5fd", boxShadow: "inset 0 0 0 1px rgba(139,92,246,0.35), 0 0 20px rgba(139,92,246,0.12)" }
                                : { color: T.textMuted }}
                            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = T.panelHover; e.currentTarget.style.color = T.text; } }}
                            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMuted; } }}>
                            {active && !collapsed && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full" style={{ background: "#8b5cf6" }} />
                            )}
                            <Icon size={17} strokeWidth={2} className="flex-shrink-0" />
                            {!collapsed && <span className="truncate">{label}</span>}
                            {!collapsed && label === "Dashboard" && needsAttentionCount > 0 && (
                                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.18)", color: "#f87171" }}>
                                    {needsAttentionCount}
                                </span>
                            )}
                        </Link>
                    );
                })}

                {!collapsed && (
                    <p className="px-3.5 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textFaint }}>Coming soon</p>
                )}
                {SOON_ITEMS.map(({ label, Icon }) => (
                    <div key={label} title={collapsed ? `${label} — coming soon` : undefined}
                        className={`flex items-center gap-3 rounded-xl text-sm font-medium cursor-not-allowed opacity-40 ${collapsed ? "justify-center px-0 py-3" : "px-3.5 py-2.5"}`}
                        style={{ color: T.textMuted }}>
                        <Icon size={17} strokeWidth={2} className="flex-shrink-0" />
                        {!collapsed && <span className="truncate flex-1">{label}</span>}
                        {!collapsed && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: T.panelHover }}>Soon</span>}
                    </div>
                ))}
            </nav>

            <div className="flex-shrink-0 p-3 space-y-3" style={{ borderTop: `1px solid ${T.divider}` }}>
                {!collapsed ? (
                    <div className="rounded-2xl p-4 relative overflow-hidden"
                        style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.16), rgba(37,99,235,0.1))", border: "1px solid rgba(139,92,246,0.28)" }}>
                        <Sparkles size={14} className="text-violet-300 mb-2" />
                        <p className="text-xs font-bold" style={{ color: T.text }}>Upgrade to Pro</p>
                        <p className="text-[10px] mt-1 leading-relaxed" style={{ color: T.textMuted }}>Unlock advanced AI insights, custom scorecards and more.</p>
                        <button className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg text-white transition-transform active:scale-95"
                            style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                            Upgrade Now <ArrowRight size={11} />
                        </button>
                        <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>{totalCalls} call{totalCalls !== 1 ? "s" : ""} analysed on the Free plan</p>
                    </div>
                ) : (
                    <button className="w-full flex items-center justify-center py-2.5 rounded-xl" title="Upgrade to Pro"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                        <Sparkles size={15} className="text-white" />
                    </button>
                )}

                <div className={`flex items-center gap-2.5 rounded-xl p-2 ${collapsed ? "justify-center" : ""}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                        {user?.name?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    {!collapsed && (
                        <>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate" style={{ color: T.text }}>{user?.name ?? "User"}</p>
                                <p className="text-[10px] truncate" style={{ color: T.textFaint }}>Admin</p>
                            </div>
                            <button onClick={handleLogout} title="Sign out" className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                                style={{ color: T.textFaint }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = T.textFaint; e.currentTarget.style.background = "transparent"; }}>
                                <LogOut size={13} />
                            </button>
                        </>
                    )}
                </div>

                <button onClick={() => setCollapsed(c => !c)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
                    style={{ color: T.textFaint }}
                    onMouseEnter={e => e.currentTarget.style.color = T.textMuted}
                    onMouseLeave={e => e.currentTarget.style.color = T.textFaint}>
                    {collapsed ? <ChevronsRight size={13} /> : <><ChevronsLeft size={13} /> Collapse</>}
                </button>
            </div>
        </aside>
    );
}


export default function DashboardPage() {
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [selectedCall, setSelectedCall] = useState(null);
    const [toast, setToast] = useState(null);
    const [playingId, setPlayingId] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    /* ── New: presentation-only UI state. None of this touches data
       fetching, routing, or the state above — it only changes how the
       already-fetched `calls` are displayed. ─────────────────────────── */
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [themeMode, setThemeMode] = useState("dark");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [dateRange, setDateRange] = useState("30d"); // 7d | 30d | all — filters the local `calls` array only
    const [chartGranularity, setChartGranularity] = useState("Daily"); // Daily | Weekly
    const T = THEMES[themeMode];
    const location = useLocation();
    const searchInputRef = useRef(null);

    const user = getUser();
    const firstName = user?.name?.split(" ")[0] ?? "there";

    const fetchCalls = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get("/api/calls/my-calls");
            const sorted = [...res.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setCalls(sorted);
            setSelectedCall(prev => prev ? sorted.find(c => c.id === prev.id) || sorted[0] : sorted[0]);
        } catch (err) {
            console.error("Failed to fetch calls:", err);
            setError("Failed to load calls. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCalls(); }, [fetchCalls]);

    useEffect(() => {
        const handler = () => setProfileOpen(false);
        if (profileOpen) window.addEventListener("click", handler);
        return () => window.removeEventListener("click", handler);
    }, [profileOpen]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") setMobileMenuOpen(false); };
        if (mobileMenuOpen) {
            document.addEventListener("keydown", onKey);
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [mobileMenuOpen]);

    /* ⌘K / Ctrl+K opens the command search — a real, additive keyboard shortcut. */
    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 10);
            }
            if (e.key === "Escape") setSearchOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const handleLogout = () => {
        logoutAndRedirect();
    };

    const handleUploadSuccess = () => {
        fetchCalls();
        setToast({ message: "Call uploaded & analysed successfully!", type: "success" });
    };

    /* ── Date-range filter — purely a client-side view over the already
       fetched `calls`. No new requests are made. ───────────────────────── */
    const rangedCalls = useMemo(() => {
        if (dateRange === "all") return calls;
        const days = dateRange === "7d" ? 7 : 30;
        const cutoff = Date.now() - days * 86400000;
        return calls.filter(c => !c.createdAt || new Date(c.createdAt).getTime() >= cutoff);
    }, [calls, dateRange]);

    /* ── Derived stats — identical calculations to before, now computed
       over `rangedCalls` so the date-range selector actually does something. */
    const totalCalls = rangedCalls.length;
    const positiveCalls = rangedCalls.filter(c => c.sentiment === "POSITIVE").length;
    const negativeCalls = rangedCalls.filter(c => c.sentiment === "NEGATIVE").length;
    const neutralCalls = rangedCalls.filter(c => c.sentiment === "NEUTRAL").length;
    const avgScore = totalCalls > 0 ? (rangedCalls.reduce((s, c) => s + (c.overallScore || 0), 0) / totalCalls).toFixed(1) : 0;
    const bestScore = totalCalls > 0 ? Math.max(...rangedCalls.map(c => c.overallScore || 0)) : 0;
    const positivePercent = totalCalls > 0 ? ((positiveCalls / totalCalls) * 100).toFixed(1) : 0;
    const negativePercent = totalCalls > 0 ? ((negativeCalls / totalCalls) * 100).toFixed(1) : 0;
    const neutralPercent = totalCalls > 0 ? ((neutralCalls / totalCalls) * 100).toFixed(1) : 0;

    const sentimentCounts = { POSITIVE: positiveCalls, NEGATIVE: negativeCalls, NEUTRAL: neutralCalls };
    const dominantSentiment = totalCalls > 0
        ? Object.keys(sentimentCounts).reduce((a, b) => sentimentCounts[a] > sentimentCounts[b] ? a : b)
        : null;

    const chartData = [
        { name: "Positive", value: positiveCalls },
        { name: "Neutral", value: neutralCalls },
        { name: "Negative", value: negativeCalls },
    ];

    const timelineMap = {};
    rangedCalls.forEach(c => {
        if (!c.createdAt) return;
        let key;
        if (chartGranularity === "Weekly") {
            const d = new Date(c.createdAt);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            key = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        } else {
            key = new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
        timelineMap[key] = (timelineMap[key] || 0) + 1;
    });

    const timelineData = Object.entries(timelineMap).slice(-12).map(([date, count]) => ({ date, calls: count }));

    const allKeywords = rangedCalls.flatMap(c => c.keywords ? c.keywords.split(",") : []).map(k => k.trim()).filter(Boolean);
    const kwFreq = {};
    allKeywords.forEach(k => { kwFreq[k] = (kwFreq[k] || 0) + 1; });
    const topKeywords = Object.entries(kwFreq).sort((a, b) => b[1] - a[1]).slice(0, 12);

    const avgQA = (key) => totalCalls > 0
        ? Math.round(rangedCalls.reduce((s, c) => s + (c[key] || 0), 0) / rangedCalls.length)
        : 0;

    const recentCalls = rangedCalls.slice(0, 8);

    /* ── Search — filters the real `calls` array by filename/keywords/summary. */
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return calls.filter(c =>
            c.fileName?.toLowerCase().includes(q) ||
            c.keywords?.toLowerCase().includes(q) ||
            c.summary?.toLowerCase().includes(q)
        ).slice(0, 6);
    }, [calls, searchQuery]);

    /* ── Mission-control derivations — all computed from `rangedCalls`,
       zero new endpoints. ───────────────────────────────────────────── */
    const needsAttention = rangedCalls
        .filter(c => c.sentiment === "NEGATIVE" || (c.overallScore != null && c.overallScore < 50))
        .slice(0, 6)
        .map(c => {
            let risk = "medium";
            if ((c.overallScore != null && c.overallScore < 35) || (c.sentiment === "NEGATIVE" && c.overallScore != null && c.overallScore < 50)) risk = "high";
            else if (c.sentiment === "NEGATIVE" || (c.overallScore != null && c.overallScore < 50)) risk = "medium";
            else risk = "low";
            return { ...c, _risk: risk };
        });

    const qaDims = [
        { label: "Communication", key: "communication", color: "#8b5cf6" },
        { label: "Problem Resolution", key: "problemResolution", color: "#3b82f6" },
        { label: "Professionalism", key: "professionalism", color: "#10b981" },
        { label: "Cust. Satisfaction", key: "customerSatisfaction", color: "#f59e0b" },
    ];
    const weakestDim = totalCalls > 0
        ? qaDims.reduce((a, b) => (avgQA(a.key) || 100) <= (avgQA(b.key) || 100) ? a : b)
        : null;

    const radarData = qaDims.map(d => ({ dimension: d.label, score: avgQA(d.key) }));

    const recommendations = [];
    if (totalCalls > 0) {
        if (Number(negativePercent) >= 20) {
            recommendations.push({ Icon: ShieldAlert, color: "#ef4444", text: `${negativeCalls} call${negativeCalls !== 1 ? "s" : ""} landed negative — review them for coaching opportunities before they repeat.` });
        }
        if (Number(avgScore) < 65) {
            recommendations.push({ Icon: Gauge, color: "#f59e0b", text: `Average QA score is ${avgScore}. Aim for 70+ by tightening up the weakest dimension below.` });
        }
        if (weakestDim && avgQA(weakestDim.key) < 70) {
            recommendations.push({ Icon: Target, color: "#3b82f6", text: `${weakestDim.label} is your lowest-scoring dimension at ${avgQA(weakestDim.key)}/100 — focus here first.` });
        }
        if (recommendations.length === 0) {
            recommendations.push({ Icon: Flame, color: "#10b981", text: `Strong stretch — sentiment and QA scores are healthy across ${totalCalls} analysed call${totalCalls !== 1 ? "s" : ""}.` });
        }
    }

    const briefing = totalCalls === 0
        ? "No calls analysed yet in this range. Upload a recording and I'll start briefing you here."
        : `${totalCalls} call${totalCalls !== 1 ? "s" : ""} analysed, averaging a ${avgScore} QA score. ` +
          `Sentiment is running mostly ${SENT_CONFIG[dominantSentiment]?.label.toLowerCase() ?? "neutral"}` +
          `${needsAttention.length > 0 ? `, with ${needsAttention.length} conversation${needsAttention.length !== 1 ? "s" : ""} that need${needsAttention.length === 1 ? "s" : ""} your attention.` : ", and nothing urgent is waiting on you."}`;

    /* Sparkline series + trend for the KPI row — daily aggregates from real calls. */
    const callsSeries = Object.entries(timelineMap).slice(-8).map(([date, count]) => ({ date, value: count }));
    const scoreSeries = buildDailySeries(rangedCalls, c => c.overallScore);
    const csatSeries = buildDailySeries(rangedCalls, c => c.customerSatisfaction);
    const positiveSeries = buildDailySeries(rangedCalls, c => c.sentiment === "POSITIVE" ? 100 : 0);

    /* Top Calls — a ranked "leaderboard" built from real scored calls,
       standing in for a rep leaderboard the current single-user data
       model can't support (there's no separate rep/owner field per call). */
    const topCalls = [...rangedCalls]
        .filter(c => c.overallScore != null)
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 4);

    const NAV_ITEMS = [
        { label: "Dashboard", path: "/dashboard", Icon: LayoutDashboard },
        { label: "Call History", path: "/history", Icon: History },
        { label: "Analytics", path: "/analytics", Icon: LineChart },
    ];

    const RISK_CFG = {
        high:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.28)",  label: "High",   Icon: AlertOctagon },
        medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.28)", label: "Medium", Icon: AlertTriangle },
        low:    { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.28)", label: "Low",    Icon: Info },
    };

    const MEDALS = ["#fbbf24", "#94a3b8", "#c2703d", "#64748b"];

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>

            <div className="fixed inset-0 pointer-events-none opacity-[0.018]"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
            <div className="fixed top-0 left-1/3 w-96 h-96 rounded-full pointer-events-none opacity-[0.045] blur-3xl"
                style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
            <div className="fixed bottom-0 right-1/4 w-80 h-80 rounded-full pointer-events-none opacity-[0.035] blur-3xl"
                style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />

            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={user}
                handleLogout={handleLogout} currentPath={location.pathname}
                needsAttentionCount={needsAttention.length} totalCalls={totalCalls} />

            <div className="flex-1 min-w-0 flex flex-col">
                {/* ── TOP BAR ── */}
                <header className="sticky top-0 z-30" style={{ background: T.headerBg, borderBottom: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>
                    <div className="px-4 sm:px-6 h-16 flex items-center gap-3">

                        {/* Mobile logo + hamburger (sidebar is desktop-only) */}
                        <div className="md:hidden flex items-center gap-2 flex-shrink-0">
                            <img src={logo} alt="Convexa AI" className="h-6 w-auto" />
                        </div>

                        {/* Global search */}
                        <div className="relative flex-1 max-w-md">
                            <button onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 10); }}
                                className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-sm transition-colors"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textFaint }}>
                                <Search size={14} className="flex-shrink-0" />
                                <span className="flex-1 text-left truncate">Search calls, keywords, customers…</span>
                                <span className="hidden sm:flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: T.panelHover, color: T.textMuted }}>
                                    <Command size={9} />K
                                </span>
                            </button>

                            {searchOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
                                    <div className="absolute left-0 top-full mt-2 w-full sm:w-96 rounded-2xl overflow-hidden z-50"
                                        style={{ background: "rgba(10,10,26,0.98)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                                        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                                            <Search size={14} className="text-slate-500" />
                                            <input ref={searchInputRef} autoFocus value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                placeholder="Search calls, keywords, summaries…"
                                                className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none" />
                                            {searchQuery && (
                                                <button onClick={() => setSearchQuery("")}><X size={13} className="text-slate-500" /></button>
                                            )}
                                        </div>
                                        <div className="max-h-72 overflow-y-auto">
                                            {searchQuery.trim() === "" ? (
                                                <p className="px-4 py-6 text-xs text-slate-600 text-center">Start typing to search your calls</p>
                                            ) : searchResults.length === 0 ? (
                                                <p className="px-4 py-6 text-xs text-slate-600 text-center">No matches for "{searchQuery}"</p>
                                            ) : (
                                                searchResults.map(call => (
                                                    <Link key={call.id} to={`/calls/${call.id}`}
                                                        onClick={() => setSearchOpen(false)}
                                                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.15)" }}>
                                                            <Phone size={13} className="text-violet-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-white truncate">{call.fileName}</p>
                                                            <p className="text-[10px] text-slate-500 truncate">{call.summary?.slice(0, 60) || "No summary"}</p>
                                                        </div>
                                                        <ArrowRight size={11} className="text-slate-600 flex-shrink-0" />
                                                    </Link>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
                            {/* Date range */}
                            <div className="relative">
                                <select value={dateRange} onChange={e => setDateRange(e.target.value)}
                                    className="appearance-none pl-8 pr-8 py-2 rounded-xl text-xs font-semibold cursor-pointer outline-none"
                                    style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}>
                                    <option value="7d">Last 7 days</option>
                                    <option value="30d">Last 30 days</option>
                                    <option value="all">All time</option>
                                </select>
                                <CalendarDays size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.textFaint }} />
                                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.textFaint }} />
                            </div>

                            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}
                                title="Filters (coming soon)">
                                <SlidersHorizontal size={13} />
                                Filter
                            </button>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => setUploadOpen(true)}
                                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all active:scale-95"
                                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 2px 16px rgba(124,58,237,0.3)" }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(124,58,237,0.5)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 16px rgba(124,58,237,0.3)"; e.currentTarget.style.transform = ""; }}>
                                <Upload size={14} />
                                Upload
                            </button>

                            <button onClick={() => setThemeMode(m => m === "dark" ? "light" : "dark")}
                                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}
                                title="Toggle theme">
                                {themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                            </button>

                            <button className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}
                                title={`${needsAttention.length} calls need attention`}>
                                <Bell size={15} />
                                {needsAttention.length > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: "#ef4444" }}>
                                        {needsAttention.length}
                                    </span>
                                )}
                            </button>

                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => setProfileOpen(o => !o)}
                                    className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl transition-all"
                                    style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}` }}>
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                                        {user?.name?.[0]?.toUpperCase() ?? "U"}
                                    </div>
                                    <span className="text-sm font-medium hidden sm:block" style={{ color: T.textMuted }}>{user?.name ?? "User"}</span>
                                    <ChevronDown size={12} className={`transition-transform hidden sm:block ${profileOpen ? "rotate-180" : ""}`} style={{ color: T.textFaint }} />
                                </button>

                                {profileOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden z-50"
                                        style={{ background: "rgba(10,10,26,0.98)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                                        <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                                            <p className="text-sm font-bold text-white">{user?.name}</p>
                                            <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
                                        </div>
                                        <div className="p-2">
                                            <button onClick={handleLogout}
                                                className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-all"
                                                style={{ color: "#f87171" }}
                                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                                <LogOut size={13} />
                                                Sign out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-all flex-shrink-0"
                                onClick={() => setMobileMenuOpen(o => !o)}
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}` }}
                                aria-label="Toggle navigation menu">
                                {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
                            </button>
                        </div>
                    </div>
                </header>

                {/* ── MOBILE NAV DRAWER ── */}
                {mobileMenuOpen && (
                    <>
                        <div className="md:hidden fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
                            onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
                        <div className="md:hidden fixed top-0 right-0 h-full w-72 z-50 flex flex-col"
                            style={{ background: "linear-gradient(160deg, rgba(10,8,32,0.99) 0%, rgba(8,18,40,0.99) 100%)", borderLeft: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(24px)", animation: "drawerSlideIn 0.25s cubic-bezier(0.32, 0.72, 0, 1)" }}>
                            <div className="flex items-center justify-between px-5 h-16 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Navigation</span>
                                <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl transition-all" style={{ background: "rgba(255,255,255,0.05)" }} aria-label="Close menu">
                                    <X size={14} className="text-slate-400" />
                                </button>
                            </div>
                            <nav className="flex flex-col gap-1 p-4 flex-1">
                                {[
                                    { label: "Dashboard", path: "/dashboard", Icon: LayoutDashboard, desc: "Overview & recent calls" },
                                    { label: "Call History", path: "/history", Icon: History, desc: "Browse all recordings" },
                                    { label: "Analytics", path: "/analytics", Icon: LineChart, desc: "Trends & insights" },
                                ].map(({ label, path, Icon, desc }) => (
                                    <Link key={label} to={path} onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all group"
                                        style={location.pathname === path
                                            ? { background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.09)" }
                                            : { color: "#64748b", border: "1px solid transparent" }}>
                                        <Icon size={17} strokeWidth={2} className="flex-shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate">{label}</span>
                                            <span className="text-xs font-normal text-slate-600">{desc}</span>
                                        </div>
                                        {location.pathname === path && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />}
                                    </Link>
                                ))}
                            </nav>
                            <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                                        {user?.name?.[0]?.toUpperCase() ?? "U"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{user?.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <main className="flex-1 min-w-0 px-4 sm:px-6 py-7 space-y-6">

                    {error && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                            <span className="text-sm text-red-300">{error}</span>
                            <button onClick={fetchCalls} className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg transition-all" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}>
                                <RefreshCw size={11} />
                                Retry
                            </button>
                        </div>
                    )}

                    {/* ── Greeting row ── */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="text-2xl md:text-[1.7rem] font-black tracking-tight flex items-center gap-2" style={{ color: T.text }}>
                                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName}
                            </h1>
                            <p className="text-sm mt-1" style={{ color: T.textMuted }}>Here's what's happening with your conversations today.</p>
                        </div>
                        <LivePulse label="Live · updated just now" />
                    </div>

                    {/* ══════════════════════════════════════════════════
                        EMPTY STATE
                        ══════════════════════════════════════════════════ */}
                    {!loading && totalCalls === 0 && (
                        <div className="text-center py-24 rounded-3xl border-dashed relative overflow-hidden" style={{ background: T.panel, border: `1px dashed ${T.panelBorder}` }}>
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
                                <svg width="400" height="120" viewBox="0 0 400 120" fill="none">
                                    {[...Array(40)].map((_, i) => {
                                        const h = 20 + Math.sin(i * 0.7) * 30 + Math.sin(i * 0.3) * 15;
                                        return <rect key={i} x={i * 10 + 5} y={(120 - h) / 2} width="5" height={h} rx="2.5" fill="#8b5cf6" />;
                                    })}
                                </svg>
                            </div>
                            <div className="relative">
                                <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                                    <Mic size={36} className="text-violet-400" />
                                </div>
                                <h2 className="text-xl font-black mb-2" style={{ color: T.text }}>No calls in this range</h2>
                                <p className="max-w-md mx-auto mb-7 text-sm leading-relaxed" style={{ color: T.textMuted }}>
                                    Upload your first customer call recording, or widen the date range above. Our AI will transcribe it, score it, and surface actionable insights automatically.
                                </p>
                                <button onClick={() => setUploadOpen(true)}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
                                    style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 4px 24px rgba(124,58,237,0.35)" }}>
                                    <Upload size={15} />
                                    Upload First Call
                                </button>
                                <div className="flex flex-wrap justify-center gap-2 mt-8">
                                    {[{ icon: Mic, label: "Whisper Transcription" }, { icon: Brain, label: "AI Analysis" }, { icon: BarChart2, label: "QA Scoring" }, { icon: Tag, label: "Keyword Extraction" }].map(({ icon: Icon, label }) => (
                                        <span key={label} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ border: `1px solid ${T.panelBorder}`, background: T.panel, color: T.textFaint }}>
                                            <Icon size={10} />
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════
                        MAIN 12-COL EXECUTIVE GRID
                        ══════════════════════════════════════════════════ */}
                    {(loading || totalCalls > 0) && (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">

                            {/* ── LEFT COLUMN (8/12) ── */}
                            <div className="xl:col-span-8 space-y-5">

                                {/* KPI row */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                                    {loading ? (
                                        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} T={T} className="h-36" />)
                                    ) : (
                                        <>
                                            <KPICard T={T} label="Total Calls" value={totalCalls} Icon={Phone} accent="#8b5cf6"
                                                series={callsSeries} trendPct={seriesTrend(callsSeries)} sub={`${dateRange === "all" ? "all time" : dateRange === "7d" ? "last 7 days" : "last 30 days"}`} />
                                            <KPICard T={T} label="Avg QA Score" value={avgScore} Icon={Star} accent="#3b82f6"
                                                series={scoreSeries} trendPct={seriesTrend(scoreSeries)}
                                                sub={Number(avgScore) >= 70 ? "Good" : Number(avgScore) >= 50 ? "Fair" : "Needs focus"} />
                                            <KPICard T={T} label="Positive Sentiment" value={`${positivePercent}%`} Icon={TrendingUp} accent="#10b981"
                                                series={positiveSeries} trendPct={seriesTrend(positiveSeries)} sub={`${positiveCalls} of ${totalCalls} calls`} />
                                            <KPICard T={T} label="Customer Satisfaction" value={avgQA("customerSatisfaction") || "–"} Icon={Award} accent="#f59e0b"
                                                series={csatSeries} trendPct={seriesTrend(csatSeries)} sub="avg score /100" />
                                        </>
                                    )}
                                </div>

                                {/* Hero analytics chart */}
                                <Panel T={T}>
                                    <PanelHeader T={T} title="Calls Over Time" sub="Upload & analysis volume"
                                        right={
                                            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${T.panelBorder}` }}>
                                                {["Daily", "Weekly"].map(g => (
                                                    <button key={g} onClick={() => setChartGranularity(g)}
                                                        className="px-3 py-1.5 text-xs font-semibold transition-colors"
                                                        style={g === chartGranularity
                                                            ? { background: "rgba(139,92,246,0.18)", color: "#c4b5fd" }
                                                            : { background: "transparent", color: T.textFaint }}>
                                                        {g}
                                                    </button>
                                                ))}
                                            </div>
                                        }
                                    />
                                    {loading ? (
                                        <Skeleton T={T} className="h-64" />
                                    ) : timelineData.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-64 text-sm gap-2" style={{ color: T.textFaint }}>
                                            <Activity size={28} />
                                            <span>Upload more calls to see the timeline</span>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={260}>
                                            <AreaChart data={timelineData}>
                                                <defs>
                                                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke={T.divider} />
                                                <XAxis dataKey="date" tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                <Tooltip contentStyle={{ background: "#0a0a1f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff", fontSize: "12px" }} />
                                                <Area type="monotone" dataKey="calls" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#areaGrad)"
                                                    dot={{ fill: "#8b5cf6", r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5.5, strokeWidth: 2, stroke: "#0a0a1f" }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </Panel>

                                {/* Critical Alerts */}
                                <Panel T={T} style={needsAttention.length > 0 ? { background: "rgba(239,68,68,0.035)", borderColor: "rgba(239,68,68,0.2)" } : {}}>
                                    <PanelHeader T={T}
                                        title={<span className="flex items-center gap-2"><ShieldAlert size={15} className="text-red-400" /> Critical Alerts</span>}
                                        sub={loading ? "Scanning conversations…" : needsAttention.length > 0 ? `${needsAttention.length} conversation${needsAttention.length !== 1 ? "s" : ""} need review` : "Nothing needs your attention right now"}
                                    />
                                    {loading ? (
                                        <div className="space-y-2"><Skeleton T={T} className="h-14" /><Skeleton T={T} className="h-14" /></div>
                                    ) : needsAttention.length === 0 ? (
                                        <div className="flex items-center gap-3 py-6 justify-center" style={{ color: T.textFaint }}>
                                            <CheckCircle size={18} className="text-emerald-400" />
                                            <span className="text-sm">All clear — your team is performing well.</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {needsAttention.map(call => {
                                                const risk = RISK_CFG[call._risk];
                                                return (
                                                    <Link key={call.id} to={`/calls/${call.id}`}
                                                        className="flex items-center gap-3 p-3.5 rounded-xl transition-all group"
                                                        style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}
                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${risk.color}55`; }}
                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.panelBorder; }}>
                                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: risk.bg, border: `1px solid ${risk.border}` }}>
                                                            <risk.Icon size={16} style={{ color: risk.color }} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold truncate" style={{ color: T.text }}>{call.fileName}</p>
                                                            <p className="text-xs truncate" style={{ color: T.textFaint }}>
                                                                {call.overallScore != null ? `Scored ${call.overallScore}/100` : "Negative sentiment"} · {timeAgo(call.createdAt)}
                                                            </p>
                                                        </div>
                                                        <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: risk.bg, color: risk.color }}>
                                                            {risk.label}
                                                        </span>
                                                        <ArrowUpRight size={13} className="flex-shrink-0 transition-colors" style={{ color: T.textFaint }} />
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </Panel>
                            </div>

                            {/* ── RIGHT COLUMN (4/12) ── */}
                            <div className="xl:col-span-4 space-y-5">

                                {/* AI Summary — the centerpiece */}
                                <div className="relative overflow-hidden rounded-2xl p-5"
                                    style={{ background: "linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(37,99,235,0.1) 100%)", border: "1px solid rgba(139,92,246,0.28)" }}>
                                    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
                                    <div className="relative">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.4)" }}>
                                                    <Sparkles size={13} className="text-violet-200" />
                                                </div>
                                                <span className="text-sm font-bold text-white">Today's AI Summary</span>
                                            </div>
                                            <LivePulse label="Live" />
                                        </div>

                                        <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.85)" }}>
                                            {loading ? "Pulling together your latest conversation data…" : briefing}
                                        </p>

                                        {!loading && (
                                            <div className="space-y-2 mb-4">
                                                {recommendations.map((r, i) => (
                                                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl" style={{ background: "rgba(0,0,0,0.18)" }}>
                                                        <r.Icon size={14} className="mt-0.5 flex-shrink-0" style={{ color: r.color }} />
                                                        <span className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>{r.text}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Confidence</span>
                                                <span className="text-xs font-black text-white">{totalCalls > 0 ? "92%" : "–"}</span>
                                            </div>
                                            <Link to="/analytics" className="flex items-center gap-1 text-xs font-bold text-white hover:gap-1.5 transition-all">
                                                View Full Report <ArrowRight size={12} />
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                {/* Performance Radar */}
                                <Panel T={T}>
                                    <PanelHeader T={T} title="Performance Overview" sub="Average across QA dimensions" />
                                    {loading ? (
                                        <Skeleton T={T} className="h-56" />
                                    ) : (
                                        <div className="flex flex-col items-center">
                                            <ResponsiveContainer width="100%" height={200}>
                                                <RadarChart data={radarData} outerRadius="72%">
                                                    <PolarGrid stroke={T.divider} />
                                                    <PolarAngleAxis dataKey="dimension" tick={{ fill: T.textFaint, fontSize: 9.5 }} />
                                                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                                                    <Radar dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.35}
                                                        strokeWidth={2} dot={{ r: 3, fill: "#8b5cf6" }} />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                            <div className="flex items-center gap-4 mt-2">
                                                <ScoreRing score={Number(avgScore)} size={64} stroke={5} textColor={themeMode === "dark" ? "white" : "#0f172a"} />
                                                <div>
                                                    <p className="text-2xl font-black" style={{ color: T.text }}>{avgScore}</p>
                                                    <p className="text-[10px] font-medium" style={{ color: T.textMuted }}>Overall Score</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Panel>

                                {/* Top Calls — stands in for a rep leaderboard (no per-rep data in this model) */}
                                <Panel T={T}>
                                    <PanelHeader T={T} title="Top Calls" sub="Highest-scoring conversations" />
                                    {loading ? (
                                        <div className="space-y-2"><Skeleton T={T} className="h-14" /><Skeleton T={T} className="h-14" /></div>
                                    ) : topCalls.length === 0 ? (
                                        <p className="text-sm text-center py-6" style={{ color: T.textFaint }}>No scored calls yet</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {topCalls.map((call, i) => (
                                                <Link key={call.id} to={`/calls/${call.id}`}
                                                    className="flex items-center gap-3 p-3 rounded-xl transition-all"
                                                    style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}>
                                                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${MEDALS[i]}22`, border: `1px solid ${MEDALS[i]}55` }}>
                                                        {i === 0 ? <Crown size={13} style={{ color: MEDALS[i] }} /> : <Medal size={12} style={{ color: MEDALS[i] }} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold truncate" style={{ color: T.text }}>{call.fileName}</p>
                                                        <p className="text-[10px] truncate" style={{ color: T.textFaint }}>{timeAgo(call.createdAt)}</p>
                                                    </div>
                                                    <span className="text-sm font-black flex-shrink-0" style={{ color: "#8b5cf6" }}>{call.overallScore}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </Panel>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════
                        RECENT CALLS INBOX + DETAIL PANE (full width)
                        ══════════════════════════════════════════════════ */}
                    {totalCalls > 0 && (
                        <>
                            <div>
                                <div className="mb-3">
                                    <SectionLabel T={T} icon={Radio} tone="#06b6d4">Recent Conversations</SectionLabel>
                                </div>
                                <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
                                    <Panel T={T} className="xl:col-span-2" style={{ padding: "1.25rem" }}>
                                        <PanelHeader T={T} title="Recent Calls" sub="Click to preview details"
                                            right={<span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}>{totalCalls} total</span>}
                                        />
                                        {loading ? (
                                            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} T={T} className="h-16" />)}</div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {recentCalls.map(call => {
                                                    const cfg = SENT_CONFIG[call.sentiment] || SENT_CONFIG.NEUTRAL;
                                                    const SIcon = cfg.Icon;
                                                    const isSelected = selectedCall?.id === call.id;
                                                    return (
                                                        <div key={call.id}
                                                            className="w-full flex items-center gap-2 sm:gap-2.5 p-3 rounded-xl transition-all duration-200 group cursor-pointer"
                                                            style={{ background: isSelected ? "rgba(139,92,246,0.1)" : T.panelHover, border: isSelected ? "1px solid rgba(139,92,246,0.35)" : `1px solid ${T.panelBorder}` }}>
                                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 text-white"
                                                                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                                                                {call.fileName?.[0]?.toUpperCase() ?? "C"}
                                                            </div>
                                                            <MiniAudioPlayer
                                                                cloudinaryUrl={call.cloudinaryUrl}
                                                                playingId={playingId}
                                                                callId={call.id}
                                                                onPlay={setPlayingId}
                                                                onStop={() => setPlayingId(null)}
                                                            />
                                                            <button onClick={() => setSelectedCall(call)} className="flex-1 min-w-0 text-left">
                                                                <p className="text-xs font-semibold truncate" style={{ color: T.text }}>{call.fileName}</p>
                                                                <p className="text-[10px] mt-0.5" style={{ color: T.textFaint }}>
                                                                    {call.createdAt ? new Date(call.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Unknown"}
                                                                </p>
                                                            </button>
                                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                                {call.sentiment && (
                                                                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                                                        <SIcon size={8} />
                                                                    </span>
                                                                )}
                                                                {call.overallScore != null && <span className="text-[10px] font-black" style={{ color: T.text }}>{call.overallScore}</span>}
                                                                <Link to={`/calls/${call.id}`} onClick={e => e.stopPropagation()}
                                                                    className="flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-300 font-semibold transition-colors">
                                                                    View <ArrowRight size={9} />
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </Panel>

                                    <div className="xl:col-span-3 rounded-2xl p-5 min-h-64 overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.panelBorder}` }}>
                                        {loading ? (
                                            <div className="space-y-4"><Skeleton T={T} className="h-8 w-2/3" /><Skeleton T={T} className="h-20" /><Skeleton T={T} className="h-28" /></div>
                                        ) : selectedCall ? (
                                            <CallDetailPanel call={selectedCall} />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-48 text-sm gap-3" style={{ color: T.textFaint }}>
                                                <Phone size={32} />
                                                <span>Select a call to see details</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sentiment + Keyword Intelligence */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <Panel T={T}>
                                    <PanelHeader T={T} title="Sentiment Distribution" sub="Across all analysed calls"
                                        right={<span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}>{totalCalls} calls</span>}
                                    />
                                    {loading ? <Skeleton T={T} className="h-56" /> : <SentimentChart data={chartData} total={totalCalls} T={T} />}
                                </Panel>

                                {topKeywords.length > 0 && (
                                    <Panel T={T}>
                                        <PanelHeader T={T} title="Keyword Intelligence" sub={`${Object.keys(kwFreq).length} unique keywords`}
                                            right={<span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa" }}>AI Extracted</span>}
                                        />
                                        <div className="flex flex-wrap gap-2">
                                            {topKeywords.slice(0, 10).map(([kw, cnt], i) => {
                                                const opacity = 0.45 + ((topKeywords.length - i) / topKeywords.length) * 0.55;
                                                return (
                                                    <span key={kw} className="px-3 py-1.5 rounded-full font-semibold border transition-all hover:scale-105 cursor-default"
                                                        style={{ background: `rgba(139,92,246,${opacity * 0.12})`, borderColor: `rgba(139,92,246,${opacity * 0.3})`, color: `rgba(196,181,253,${opacity})`, fontSize: `${0.68 + (opacity - 0.45) * 0.3}rem` }}>
                                                        {kw} <span className="opacity-50 text-[10px]">×{cnt}</span>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </Panel>
                                )}
                            </div>
                        </>
                    )}
                </main>

                <footer className="mt-4" style={{ borderTop: `1px solid ${T.divider}` }}>
                    <div className="px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: T.textFaint }}>© 2026 Convexa AI · Conversation Intelligence Platform</span>
                        <span className="text-xs" style={{ color: T.textFaint, opacity: 0.6 }}>Powered by Whisper · Groq · Llama 3.3</span>
                    </div>
                </footer>
            </div>

            {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onSuccess={handleUploadSuccess} />}
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <style>{`
                @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes drawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
                @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                @keyframes modalIn { from { transform: scale(0.94) translateY(12px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
            `}</style>
        </div>
    );
}
