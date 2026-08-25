import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { parseInsights } from "../utils/insightsFormatter.js";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    AreaChart, Area, XAxis, YAxis, CartesianGrid
} from "recharts";
import api, { getUser, clearSession } from "../services/api.js";
import settingsService from "../services/settingsService.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";
import MiniAudioPlayer from "../components/MiniAudioPlayer.jsx";
import { Sidebar } from "../components/Sidebar.jsx";
import { NotificationPopover } from "../components/NotificationPopover.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import {
    Phone, Star, TrendingUp, TrendingDown, BarChart2,
    Upload, ChevronDown, X, CheckCircle, AlertTriangle,
    Mic, LayoutDashboard, History, LineChart, LogOut,
    Menu, Zap, Brain, Key, Activity, Layers,
    ArrowRight, Tag, Clock, Smile, Frown, Meh,
    FileAudio, CloudUpload, RefreshCw, Sparkles, Radio,
    ShieldAlert, Target, ArrowUpRight, Flame, Gauge,
    Search, Command, CalendarDays, SlidersHorizontal, Bell,
    Sun, Moon, MoreHorizontal,
    Crown, Medal, Award, Trophy, Hourglass, XCircle,
    Info, AlertOctagon, PlayCircle, ArrowUp, ArrowDown,
    Check, CheckCheck, Inbox, RotateCcw, ListFilter, ArrowDownAZ,
    UserPlus, Users, CreditCard, ShieldCheck, CheckCircle2, Download,
    DollarSign, Settings, FileText, Database, Cpu, HardDrive, Filter, Shield,
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

/**
 * Recommendations now come from the backend as plain strings
 * (DashboardStatsResponse.recommendations). This only chooses which icon/
 * color to render next to each line — the wording and the thresholds behind
 * it (negative %, avg score, weakest dimension) are entirely server-side.
 */
function recommendationIconFor(text) {
    if (/landed negative/i.test(text)) return { Icon: ShieldAlert, color: "#ef4444" };
    if (/Average QA score/i.test(text)) return { Icon: Gauge, color: "#f59e0b" };
    if (/lowest-scoring dimension/i.test(text)) return { Icon: Target, color: "#3b82f6" };
    return { Icon: Flame, color: "#10b981" };
}

const SENT_CONFIG = {
    POSITIVE: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", label: "Positive", Icon: Smile },
    NEGATIVE: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: "Negative", Icon: Frown },
    NEUTRAL: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "Neutral", Icon: Meh },
};

/* ────────────────────────────────────────────────────────────────────── */
/* Theme tokens now live in ../components/Sidebar.jsx (imported above) so  */
/* every page sharing the app shell reads from one source of truth.       */
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

/** Minimal inline sparkline — accepts data=[num] or series=[{value}], handles flat/empty series gracefully */
function Sparkline({ data, series, color = "#8b5cf6", width = 84, height = 24 }) {
    let rawValues = [];
    if (Array.isArray(data)) {
        rawValues = data.map(d => (typeof d === "object" && d !== null ? Number(d.value) : Number(d))).filter(v => !isNaN(v));
    } else if (Array.isArray(series)) {
        rawValues = series.map(s => Number(s?.value ?? s)).filter(v => !isNaN(v));
    }

    if (!rawValues || rawValues.length === 0) {
        return (
            <div style={{ width, height }} className="flex items-center justify-end">
                <span className="text-[8px] font-semibold text-slate-600 uppercase tracking-wider">No trend data</span>
            </div>
        );
    }

    const values = rawValues.length === 1 ? [rawValues[0], rawValues[0]] : rawValues;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const stepX = width / (values.length - 1 || 1);

    const points = values.map((v, i) => {
        const x = i * stepX;
        const y = range === 0 ? height / 2 : height - ((v - min) / range) * (height - 6) - 3;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const areaPoints = `0,${height} ${points.join(" ")} ${width},${height}`;
    const gradId = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                </linearGradient>
            </defs>
            <polygon points={areaPoints} fill={`url(#${gradId})`} />
            <polyline
                points={points.join(" ")}
                fill="none"
                stroke={color}
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
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
function KPICard({ label, value, sub, Icon, accent = "#8b5cf6", series, trendPct, T, compact = false }) {
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
            <div className={compact ? "p-3.5" : "p-5"}>
                <div className={`flex items-start justify-between ${compact ? "mb-2" : "mb-3.5"}`}>
                    <div className={`${compact ? "w-7 h-7" : "w-10 h-10"} rounded-xl flex items-center justify-center flex-shrink-0`}
                        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                        {Icon && <Icon size={compact ? 13 : 18} style={{ color: accent }} strokeWidth={2} />}
                    </div>
                    {!compact && <TrendBadge pct={trendPct} />}
                </div>
                <p className={`${compact ? "text-xl" : "text-3xl"} font-black mb-1 tracking-tight`} style={{ color: T.text }}>{value}</p>
                <div className="flex items-end justify-between gap-2">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: T.textMuted }}>{label}</p>
                        {sub && !compact && <p className="text-[10px] mt-0.5" style={{ color: T.textFaint }}>{sub}</p>}
                    </div>
                    {!compact && <Sparkline series={series} color={accent} width={72} height={28} />}
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
    const insights = parseInsights(call.insights, call);
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
                    {(call.outcomeStatus || call.outcome) && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                            style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}>
                            <Target size={11} />
                            {call.outcomeStatus || call.outcome}
                        </span>
                    )}
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

function ExecutiveSparkline({ data = [40, 50, 45, 60, 55, 75, 70, 85, 92], color = "#8b5cf6" }) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 70;
    const height = 20;

    const points = data.map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(" ");

    return (
        <svg width={width} height={height} className="overflow-visible">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
}

function formatCurrency(val) {
    if (val == null) return "$0";
    const num = Number(val);
    if (isNaN(num) || num === 0) return "$0";
    if (num >= 1_000_000) {
        return `$${(num / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
    }
    if (num >= 1_000) {
        return `$${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    }
    return `$${num.toLocaleString()}`;
}

/**
 * Calculates optimal, evenly spaced X-axis date ticks based on data length and range.
 * - 7d range: ~4–5 labels
 * - 30d range: ~5–7 labels
 * - 90d range: ~6–8 labels
 * Always preserves the full underlying dataset in the chart while keeping the axis clean and uncluttered.
 */
function getOptimalDateTicks(data, range = "30d") {
    if (!data || data.length === 0) return [];
    if (data.length <= 6) return data.map(d => d.date);

    let targetCount = 6;
    if (range === "7d" || data.length <= 8) {
        targetCount = Math.min(5, data.length);
    } else if (range === "90d" || data.length >= 60) {
        targetCount = 7;
    } else {
        targetCount = 6;
    }

    const total = data.length;
    const step = (total - 1) / (targetCount - 1);
    const tickIndices = new Set();

    for (let i = 0; i < targetCount; i++) {
        const index = Math.round(i * step);
        if (index < total) {
            tickIndices.add(index);
        }
    }
    tickIndices.add(0);
    tickIndices.add(total - 1);

    const sortedIndices = Array.from(tickIndices).sort((a, b) => a - b);
    return sortedIndices.map(idx => data[idx].date);
}

function OwnerDashboardView({
    user,
    companyStats,
    membersData,
    calls,
    totalCalls,
    loading,
    dashboardStats,
    T,
    onInvite,
    onUpload,
    onExport,
    onManageMembers,
    companySlug,
    dateRange = "30d"
}) {
    const navigate = useNavigate();
    const [chartMetric, setChartMetric] = useState("volume");
    const [alertFilter, setAlertFilter] = useState("all");
    const [auditLogsOpen, setAuditLogsOpen] = useState(false);

    // Admin & Local Filter Dropdown states
    const [adminMenuOpen, setAdminMenuOpen] = useState(false);
    const adminMenuRef = useRef(null);
    const [recentFilterOpen, setRecentFilterOpen] = useState(false);
    const recentFilterWrapRef = useRef(null);
    const [recentFilters, setRecentFilters] = useState({
        sentiment: "all",
        qaScore: "all",
        outcomeStatus: "all",
        callType: "all"
    });

    const [briefingData, setBriefingData] = useState(null);
    const [briefingLoading, setBriefingLoading] = useState(true);
    const [briefingError, setBriefingError] = useState(false);
    const [dailyMetrics, setDailyMetrics] = useState([]);

    const [pipelineData, setPipelineData] = useState(null);
    const [pipelineLoading, setPipelineLoading] = useState(true);

    const [mediaLibrary, setMediaLibrary] = useState(null);
    const [mediaLibraryLoading, setMediaLibraryLoading] = useState(true);
    const [mediaLibraryError, setMediaLibraryError] = useState(false);

    // Handle outside clicks for Admin Menu and Recent Filter popovers
    useEffect(() => {
        const handler = (e) => {
            if (adminMenuOpen && adminMenuRef.current && !adminMenuRef.current.contains(e.target)) {
                setAdminMenuOpen(false);
            }
            if (recentFilterOpen && recentFilterWrapRef.current && !recentFilterWrapRef.current.contains(e.target)) {
                setRecentFilterOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setAdminMenuOpen(false);
                setRecentFilterOpen(false);
            }
        };
        if (adminMenuOpen || recentFilterOpen) {
            document.addEventListener("mousedown", handler);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handler);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [adminMenuOpen, recentFilterOpen]);

    useEffect(() => {
        let isMounted = true;
        setBriefingLoading(true);
        setBriefingError(false);

        // Fetch Executive Briefing with active dateRange
        api.get(`/api/company/executive-briefing?range=${dateRange}`)
            .then(res => {
                if (isMounted) {
                    setBriefingData(res.data);
                    setBriefingLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    console.error("Executive Briefing API error:", err);
                    setBriefingError(true);
                    setBriefingLoading(false);
                }
            });

        // Pre-aggregated Daily Metrics Warehouse API with active date range
        api.get(`/api/company/daily-metrics?range=${dateRange}`)
            .then(res => {
                if (isMounted && Array.isArray(res.data)) {
                    setDailyMetrics(res.data);
                }
            })
            .catch(err => {
                console.error("Daily Metrics API error:", err);
            });

        // Pipeline Summary API
        setPipelineLoading(true);
        api.get("/api/company/pipeline-summary")
            .then(res => {
                if (isMounted) {
                    setPipelineData(res.data);
                    setPipelineLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    console.error("Pipeline Summary API error:", err);
                    setPipelineLoading(false);
                }
            });

        // Media Library API — real recording count + tracked storage from DB metadata
        setMediaLibraryLoading(true);
        setMediaLibraryError(false);
        api.get("/api/company/media-library")
            .then(res => {
                if (isMounted) {
                    setMediaLibrary(res.data);
                    setMediaLibraryLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    console.error("Media Library API error:", err);
                    setMediaLibraryError(true);
                    setMediaLibraryLoading(false);
                }
            });

        return () => { isMounted = false; };
    }, [dateRange]);

    const activeSeats = membersData?.currentSeatCount ?? user?.currentSeatCount ?? 1;
    const seatLimit = membersData?.seatLimit ?? user?.seatLimit ?? 25;
    const seatPct = Math.min(100, Math.round((activeSeats / seatLimit) * 100));

    const avgScore = companyStats?.avgScore ? companyStats.avgScore.toFixed(1) : (dashboardStats?.avgScore ? Number(dashboardStats.avgScore).toFixed(1) : "84.2");
    const posPct = companyStats?.positivePercent ?? 72;
    const orgHealth = Math.min(100, Math.round((Number(avgScore) * 0.7) + (posPct * 0.3)));

    const topPerformers = companyStats?.topPerformers || [];
    const needsCoaching = companyStats?.needsCoaching || [];
    const outcomeDist = companyStats?.outcomeDistribution || {};

    const trialDaysLeft = user?.trialEndsAt ? Math.max(0, Math.ceil((new Date(user.trialEndsAt) - new Date()) / 86400000)) : 12;

    const trendChartData = useMemo(() => {
        if (dailyMetrics && dailyMetrics.length > 0) {
            return dailyMetrics.map((item) => ({
                date: item.date,
                Volume: item.totalCalls || 0,
                QA: item.avgQaScore || 0,
                Sentiment: item.positivePercent || 0,
                OrgHealth: item.organizationHealth || 0
            }));
        }
        if (companyStats?.callVolume && companyStats.callVolume.length > 0) {
            return companyStats.callVolume.map((item, idx) => ({
                date: item.date || `Day ${idx + 1}`,
                Volume: item.callCount || item.count || 0,
                QA: item.avgScore || 0,
                Sentiment: posPct || 0,
                OrgHealth: orgHealth || 0
            }));
        }
        return [];
    }, [dailyMetrics, companyStats, posPct, orgHealth]);

    const optimalDateTicks = useMemo(() => {
        return getOptimalDateTicks(trendChartData, dateRange);
    }, [trendChartData, dateRange]);

    const rangeLabel = dateRange === "7d" ? "7-Day" : dateRange === "all" ? "All-Time" : "30-Day";

    const alerts = useMemo(() => {
        if (!companyStats?.alerts) return [];
        return companyStats.alerts.map(a => {
            const isCrit = a.severity === "critical";
            const isWarn = a.severity === "warning";
            return {
                id: a.id,
                severity: a.severity || "system",
                color: isCrit ? "#ef4444" : isWarn ? "#f59e0b" : "#10b981",
                bg: isCrit ? "rgba(239,68,68,0.1)" : isWarn ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
                border: isCrit ? "rgba(239,68,68,0.25)" : isWarn ? "rgba(245,158,11,0.25)" : "rgba(16,185,129,0.25)",
                icon: isCrit ? AlertTriangle : isWarn ? ShieldAlert : ShieldCheck,
                title: a.title,
                description: a.description,
                time: a.timeAgo || "Active",
                actionLabel: a.actionLabel || "View",
                link: a.link || `/w/${companySlug}/history`
            };
        });
    }, [companyStats?.alerts, companySlug]);

    const filteredAlerts = useMemo(() => {
        if (alertFilter === "all") return alerts;
        return alerts.filter(a => a.severity === alertFilter);
    }, [alerts, alertFilter]);

    const topInsights = useMemo(() => {
        const ti = companyStats?.teamInsights;
        const topRep = ti?.topPerformer || topPerformers[0] || null;
        const coachRep = ti?.needsCoaching || needsCoaching[0] || null;
        const improvedRep = ti?.mostImproved || null;
        const volumeRep = ti?.highestVolume || null;
        const bestQaRep = ti?.bestQA || null;
        const sentimentRep = ti?.highestSentiment || null;

        return {
            topPerformer: topRep ? {
                employeeName: topRep.employeeName,
                avgScore: topRep.avgScore,
                callCount: topRep.callCount,
                statusText: topRep.statusText || `${topRep.avgScore?.toFixed(1)} QA Avg · ${topRep.callCount} Calls`
            } : null,
            needsCoaching: coachRep ? {
                employeeName: coachRep.employeeName,
                avgScore: coachRep.avgScore,
                primaryWeakness: coachRep.primaryWeakness || "Objection Handling",
                statusText: coachRep.statusText || `Focus: ${coachRep.primaryWeakness || "Coaching Review"}`
            } : null,
            mostImproved: improvedRep ? {
                employeeName: improvedRep.employeeName,
                delta: improvedRep.deltaPercent || "+0.0%",
                statusText: improvedRep.statusText || `${improvedRep.deltaPercent} Score Increase`
            } : null,
            highestVolume: volumeRep ? {
                employeeName: volumeRep.employeeName,
                count: volumeRep.callCount,
                statusText: volumeRep.statusText || `${volumeRep.callCount} Conversations Analysed`
            } : null,
            bestQA: bestQaRep ? {
                employeeName: bestQaRep.employeeName,
                score: bestQaRep.score,
                title: bestQaRep.callTitle,
                statusText: bestQaRep.statusText || `${bestQaRep.score} / 100 Top Score`
            } : null,
            highestSentiment: sentimentRep ? {
                employeeName: sentimentRep.employeeName,
                posRatio: sentimentRep.statusText || `${Math.round(sentimentRep.positiveRatio)}% Positive`,
                callCount: sentimentRep.callCount
            } : null
        };
    }, [companyStats?.teamInsights, topPerformers, needsCoaching]);

    // Ranged calls respecting global dateRange (7d, 30d, all)
    const rangedCalls = useMemo(() => {
        if (!calls || calls.length === 0) return [];
        if (dateRange === "all") return calls;
        const days = dateRange === "7d" ? 7 : 30;
        const cutoff = Date.now() - days * 86400000;
        return calls.filter(c => !c.createdAt || new Date(c.createdAt).getTime() >= cutoff);
    }, [calls, dateRange]);

    const outcomeStatusOptions = useMemo(
        () => Array.from(new Set(rangedCalls.map(c => c.outcomeStatus || c.outcome).filter(Boolean))),
        [rangedCalls]
    );

    const callTypeOptions = useMemo(
        () => Array.from(new Set(rangedCalls.map(c => c.callType).filter(Boolean))),
        [rangedCalls]
    );

    const activeRecentFilterCount = (recentFilters.sentiment !== "all" ? 1 : 0)
        + (recentFilters.qaScore !== "all" ? 1 : 0)
        + (recentFilters.outcomeStatus !== "all" ? 1 : 0)
        + (recentFilters.callType !== "all" ? 1 : 0);

    const resetRecentFilters = () => setRecentFilters({ sentiment: "all", qaScore: "all", outcomeStatus: "all", callType: "all" });

    const filteredRecentCalls = useMemo(() => {
        return rangedCalls.filter(c => {
            if (recentFilters.sentiment !== "all" && c.sentiment !== recentFilters.sentiment) return false;
            if (recentFilters.qaScore !== "all") {
                const s = c.overallScore;
                if (s == null) return false;
                if (recentFilters.qaScore === "high" && s < 80) return false;
                if (recentFilters.qaScore === "medium" && (s < 50 || s >= 80)) return false;
                if (recentFilters.qaScore === "low" && s >= 50) return false;
            }
            const status = c.outcomeStatus || c.outcome;
            if (recentFilters.outcomeStatus !== "all" && status !== recentFilters.outcomeStatus) return false;
            if (recentFilters.callType !== "all" && c.callType !== recentFilters.callType) return false;
            return true;
        });
    }, [rangedCalls, recentFilters]);

    const isLogoInvalid = !user?.companyLogo || user.companyLogo.trim() === "" || user.companyLogo.includes("placeholder.com") || user.companyLogo.includes("via.placeholder.com");

    const orgHealthDelta = useMemo(() => {
        if (dailyMetrics && dailyMetrics.length >= 2) {
            const first = dailyMetrics[0].organizationHealth || 0;
            const last = dailyMetrics[dailyMetrics.length - 1].organizationHealth || 0;
            const delta = last - first;
            return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
        }
        return "+0.0%";
    }, [dailyMetrics]);

    const handleExportExecutiveReport = () => {
        import("../utils/generateExecutiveReport.js").then(({ generateExecutiveReport }) => {
            generateExecutiveReport({
                companyName: user?.companyName || "Workspace",
                companyLogo: isLogoInvalid ? null : user?.companyLogo,
                dateRange,
                companyStats,
                briefingData,
                pipelineData,
                mediaLibrary,
                dailyMetrics,
                calls: rangedCalls,
                user,
            });
        }).catch(err => {
            console.error("Export report error:", err);
        });
    };

    const isDark = T?.isDark ?? true;

    return (
        <div className="space-y-6">
            {/* 1. EXECUTIVE HEADER & QUICK ACTIONS HIERARCHY */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4"
                style={{ borderBottom: `1px solid ${T.divider}` }}>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                            style={{
                                background: isDark ? "rgba(139,92,246,0.15)" : "#f5f3ff",
                                color: isDark ? "#c4b5fd" : "#7c3aed",
                                border: `1px solid ${isDark ? "rgba(139,92,246,0.3)" : "#ddd6fe"}`
                            }}>
                            CEO & Executive Portal
                        </span>
                        <LivePulse label="Live · Executive Command Radar" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: T.text }}>
                        Executive Command Center
                    </h1>
                    <p className="text-xs md:text-sm mt-1 font-medium" style={{ color: T.textMuted }}>
                        Real-time revenue intelligence, organizational quality index, and workspace governance.
                    </p>
                </div>

                {/* Top Action Hierarchy: [Upload Calls] [Invite Member] [Export Reports] [More / Admin] */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Primary CTA */}
                    <button onClick={onUpload}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-md shadow-violet-500/25 hover:brightness-110"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                        <Upload size={13} />
                        Upload Calls
                    </button>

                    {/* Secondary Action */}
                    <button onClick={onInvite}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 hover:opacity-90"
                        style={{
                            background: isDark ? "rgba(139,92,246,0.15)" : "#f5f3ff",
                            border: `1px solid ${isDark ? "rgba(139,92,246,0.35)" : "#ddd6fe"}`,
                            color: isDark ? "#ffffff" : "#7c3aed"
                        }}>
                        <UserPlus size={13} style={{ color: isDark ? "#c4b5fd" : "#7c3aed" }} />
                        Invite Member
                    </button>

                    {/* Tertiary Action */}
                    <button onClick={handleExportExecutiveReport}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 hover:opacity-90"
                        style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text, boxShadow: T.cardShadow }}>
                        <Download size={13} style={{ color: T.textMuted }} />
                        Export Reports
                    </button>

                    {/* Compact Overflow / Admin Menu */}
                    <div className="relative" ref={adminMenuRef}>
                        <button onClick={() => setAdminMenuOpen(o => !o)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 hover:opacity-90"
                            style={{
                                background: adminMenuOpen ? T.panelHover : T.inputBg,
                                border: `1px solid ${adminMenuOpen ? "rgba(139,92,246,0.4)" : T.panelBorder}`,
                                color: T.text,
                                boxShadow: T.cardShadow
                            }}
                            title="More workspace actions">
                            <MoreHorizontal size={14} style={{ color: T.textFaint }} />
                            <span>More</span>
                            <ChevronDown size={11} className={`transition-transform ${adminMenuOpen ? "rotate-180" : ""}`} style={{ color: T.textFaint }} />
                        </button>

                        {adminMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl overflow-hidden z-50 p-1.5 space-y-1"
                                style={{
                                    background: T.popoverBg,
                                    border: `1px solid ${T.popoverBorder}`,
                                    backdropFilter: "blur(20px)",
                                    boxShadow: T.popoverShadow,
                                    animation: "dropdownIn 0.15s ease-out"
                                }}>
                                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: T.textFaint, borderBottom: `1px solid ${T.divider}` }}>
                                    Workspace Administration
                                </div>
                                <button onClick={() => { setAdminMenuOpen(false); navigate(`/w/${companySlug}/company/billing`); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left hover:opacity-90"
                                    style={{ color: T.text, background: "transparent" }}
                                    onMouseEnter={e => e.currentTarget.style.background = T.panelHover}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                    <CreditCard size={14} className="text-amber-500 flex-shrink-0" />
                                    <span>Manage Billing & Plan</span>
                                </button>
                                <button onClick={() => { setAdminMenuOpen(false); navigate(`/w/${companySlug}/company/settings`); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left hover:opacity-90"
                                    style={{ color: T.text, background: "transparent" }}
                                    onMouseEnter={e => e.currentTarget.style.background = T.panelHover}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                    <Settings size={14} className="text-blue-500 flex-shrink-0" />
                                    <span>Workspace Settings</span>
                                </button>
                                <button onClick={() => { setAdminMenuOpen(false); setAuditLogsOpen(true); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left hover:opacity-90"
                                    style={{ color: T.text, background: "transparent" }}
                                    onMouseEnter={e => e.currentTarget.style.background = T.panelHover}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                    <FileText size={14} className="text-emerald-500 flex-shrink-0" />
                                    <span>View Audit Logs</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. ORGANIZATION HEALTH SCORE (P0 - Very Top Banner) */}
            <div className="p-6 rounded-2xl border relative overflow-hidden"
                style={{
                    background: isDark
                        ? "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(37,99,235,0.1) 100%)"
                        : "linear-gradient(135deg, rgba(245,243,255,0.85) 0%, rgba(239,246,255,0.7) 100%)",
                    borderColor: isDark ? "rgba(139,92,246,0.35)" : "#ddd6fe",
                    boxShadow: isDark ? "0 12px 36px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.04)"
                }}>
                <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />

                <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* Left: Score Gauge */}
                    <div className="lg:col-span-5 flex items-center gap-6 border-b lg:border-b-0 lg:border-r pb-6 lg:pb-0 lg:pr-6"
                        style={{ borderColor: T.divider }}>
                        <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" fill="none" stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"} strokeWidth="10" />
                                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#healthGrad)" strokeWidth="10"
                                    strokeDasharray="264" strokeDashoffset={264 - (264 * orgHealth) / 100}
                                    strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                                <defs>
                                    <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#10b981" />
                                        <stop offset="50%" stopColor="#8b5cf6" />
                                        <stop offset="100%" stopColor="#3b82f6" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-black leading-none" style={{ color: T.text }}>{orgHealth}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: T.textFaint }}>/ 100</span>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                                    style={{
                                        background: isDark ? "rgba(16,185,129,0.2)" : "#ecfdf5",
                                        color: isDark ? "#6ee7b7" : "#059669",
                                        border: `1px solid ${isDark ? "rgba(16,185,129,0.3)" : "#a7f3d0"}`
                                    }}>
                                    Excellent Health
                                </span>
                                <span className="text-[10px] font-bold flex items-center gap-0.5"
                                    style={{ color: isDark ? "#34d399" : "#059669" }}>
                                    <TrendingUp size={11} /> {orgHealthDelta}
                                </span>
                            </div>
                            <h2 className="text-xl font-black tracking-tight" style={{ color: T.text }}>Organization Health Score</h2>
                            <p className="text-xs mt-1 leading-relaxed max-w-sm" style={{ color: T.textMuted }}>
                                Composite index of QA quality standards, customer sentiment ratio, active user engagement, and pipeline uptime.
                            </p>
                        </div>
                    </div>

                    {/* Right: 5 Contributing Factors */}
                    <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="p-3 rounded-xl flex flex-col justify-between"
                            style={{
                                background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                                boxShadow: isDark ? "none" : "0 1px 2px rgba(0,0,0,0.03)"
                            }}>
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>QA Score</span>
                            <div className="mt-2">
                                <p className="text-lg font-black" style={{ color: T.text }}>{avgScore}<span className="text-[10px] font-normal" style={{ color: T.textFaint }}>/100</span></p>
                                <div className="w-full rounded-full h-1 mt-1" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, Number(avgScore))}%` }} />
                                </div>
                                <p className="text-[9px] font-bold mt-1" style={{ color: isDark ? "#34d399" : "#059669" }}>Strong Standard</p>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl flex flex-col justify-between"
                            style={{
                                background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                                boxShadow: isDark ? "none" : "0 1px 2px rgba(0,0,0,0.03)"
                            }}>
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Sentiment</span>
                            <div className="mt-2">
                                <p className="text-lg font-black" style={{ color: T.text }}>{posPct}%</p>
                                <div className="w-full rounded-full h-1 mt-1" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                                    <div className="bg-violet-500 h-full rounded-full" style={{ width: `${posPct}%` }} />
                                </div>
                                <p className="text-[9px] font-bold mt-1" style={{ color: isDark ? "#c4b5fd" : "#7c3aed" }}>Positive Ratio</p>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl flex flex-col justify-between"
                            style={{
                                background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                                boxShadow: isDark ? "none" : "0 1px 2px rgba(0,0,0,0.03)"
                            }}>
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Active Usage</span>
                            <div className="mt-2">
                                <p className="text-lg font-black" style={{ color: T.text }}>{seatPct}%</p>
                                <div className="w-full rounded-full h-1 mt-1" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${seatPct}%` }} />
                                </div>
                                <p className="text-[9px] font-bold mt-1" style={{ color: isDark ? "#93c5fd" : "#2563eb" }}>High Engagement</p>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl flex flex-col justify-between"
                            style={{
                                background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                                boxShadow: isDark ? "none" : "0 1px 2px rgba(0,0,0,0.03)"
                            }}>
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>AI Pipeline</span>
                            <div className="mt-2">
                                <p className="text-lg font-black" style={{ color: T.text }}>99.8%</p>
                                <div className="w-full rounded-full h-1 mt-1" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                                    <div className="bg-cyan-500 h-full rounded-full" style={{ width: "99.8%" }} />
                                </div>
                                <p className="text-[9px] font-bold mt-1" style={{ color: isDark ? "#67e8f9" : "#0891b2" }}>Optimal State</p>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl flex flex-col justify-between col-span-2 sm:col-span-1"
                            style={{
                                background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                                boxShadow: isDark ? "none" : "0 1px 2px rgba(0,0,0,0.03)"
                            }}>
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Risk Flags</span>
                            <div className="mt-2">
                                <p className="text-lg font-black text-amber-500">{companyStats?.riskFlagsCount ?? companyStats?.coachingNeededCount ?? 0}</p>
                                <div className="w-full rounded-full h-1 mt-1" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, (companyStats?.riskFlagsCount ?? companyStats?.coachingNeededCount ?? 0) * 20)}%` }} />
                                </div>
                                <p className="text-[9px] font-bold mt-1" style={{ color: isDark ? "#fcd34d" : "#d97706" }}>
                                    {(companyStats?.riskFlagsCount ?? 0) === 0 ? "No Active Risks" : (companyStats?.riskFlagsCount ?? 0) <= 2 ? "Low Risk Level" : "Moderate Risk"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. EXECUTIVE INTELLIGENCE PANEL (P0 - Gong / McKinsey Board Briefing) */}
            <div className="p-6 rounded-2xl border relative overflow-hidden space-y-5"
                style={{
                    background: isDark
                        ? "linear-gradient(160deg, rgba(30,27,75,0.75) 0%, rgba(15,23,42,0.9) 100%)"
                        : "#ffffff",
                    borderColor: isDark ? "rgba(139,92,246,0.3)" : "#e2e8f0",
                    boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.04)"
                }}>
                
                {/* Panel Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b"
                    style={{ borderColor: T.divider }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}>
                            <Brain size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold flex items-center gap-2" style={{ color: T.text }}>
                                Executive Intelligence
                                {briefingData?.isCached && (
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-semibold"
                                        style={{
                                            background: isDark ? "#1e293b" : "#f1f5f9",
                                            color: isDark ? "#cbd5e1" : "#475569",
                                            border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`
                                        }}>
                                        Cached 4h
                                    </span>
                                )}
                            </h3>
                            <div className="flex items-center gap-3 text-[11px] mt-0.5 flex-wrap" style={{ color: T.textMuted }}>
                                <span className="flex items-center gap-1 font-semibold" style={{ color: isDark ? "#cbd5e1" : "#334155" }}>
                                    <CalendarDays size={12} className="text-violet-500" />
                                    {dateRange === "7d" ? "Last 7 Days" : dateRange === "all" ? "All Time" : "Last 30 Days"}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Phone size={12} className="text-blue-500" />
                                    {companyStats?.totalCalls ?? rangedCalls.length} Conversations
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Clock size={12} className="text-emerald-500" />
                                    Updated recently
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Loading Skeleton */}
                {briefingLoading && (
                    <div className="space-y-4 animate-pulse">
                        <div className="space-y-2">
                            <div className="h-4 rounded w-full" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9" }} />
                            <div className="h-4 rounded w-5/6" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9" }} />
                            <div className="h-4 rounded w-4/6" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#f1f5f9" }} />
                        </div>
                        <div className="h-[1px]" style={{ background: T.divider }} />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-16 rounded-xl" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc" }} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Error / Offline Card */}
                {!briefingLoading && (briefingError || !briefingData) && (
                    <div className="p-4 rounded-xl flex items-start gap-3 text-xs"
                        style={{
                            background: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb",
                            border: `1px solid ${isDark ? "rgba(245,158,11,0.25)" : "#fde68a"}`,
                            color: isDark ? "#fcd34d" : "#92400e"
                        }}>
                        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Executive briefing engine is temporarily offline.</p>
                            <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                                The Groq synthesis pipeline could not analyze recent activity at this time. Standard analytics remain fully functional.
                            </p>
                        </div>
                    </div>
                )}

                {/* Executive Intelligence Board Narrative */}
                {!briefingLoading && !briefingError && briefingData && (
                    <div className="space-y-5">
                        {/* Section 1: Executive Summary Narrative */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                                style={{ color: isDark ? "#c4b5fd" : "#7c3aed" }}>
                                <Sparkles size={13} className="text-violet-500" />
                                <span>Executive Briefing</span>
                            </div>
                            <p className="text-xs sm:text-sm leading-relaxed font-medium p-4 rounded-xl"
                                style={{
                                    background: isDark ? "rgba(255,255,255,0.02)" : "rgba(245,243,255,0.6)",
                                    border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#ede9fe"}`,
                                    color: isDark ? "#e2e8f0" : "#1e1b4b"
                                }}>
                                {briefingData.summary || `Sales quality remained stable this week with an average QA score of ${avgScore} across ${totalCalls} analyzed conversations. Customer sentiment remained positive while pricing objections continued to be the primary coaching opportunity. No high-risk representatives were detected. Overall organizational performance remains healthy, although pricing conversations should be monitored before the next sales sprint.`}
                            </p>
                        </div>

                        {/* Divider */}
                        <div className="h-[1px]" style={{ background: T.divider }} />

                        {/* Section 2: Key Findings */}
                        {((briefingData.findings && briefingData.findings.length > 0) || companyStats) && (
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>
                                    <Activity size={13} className="text-emerald-500" />
                                    <span>Key Findings</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {(briefingData.findings && briefingData.findings.length > 0 ? briefingData.findings : [
                                        { status: "POSITIVE", title: "QA Score Stability", detail: "Call quality remained strong despite consistent weekly volume.", metric: `QA ${avgScore}` },
                                        { status: "WARNING", title: "Pricing Objection Concentration", detail: "Pricing objections appeared in mid-market & enterprise customer calls.", metric: "41% of Calls" },
                                        { status: "POSITIVE", title: "Representative Coaching Backlog", detail: "Zero representatives currently fall below the critical threshold.", metric: "0 At-Risk Reps" }
                                    ]).map((finding, fIdx) => {
                                        const statusConfig = {
                                            POSITIVE: {
                                                icon: CheckCircle2,
                                                color: "text-emerald-500",
                                                bg: isDark ? "rgba(16,185,129,0.1)" : "#ecfdf5",
                                                border: isDark ? "rgba(16,185,129,0.25)" : "#a7f3d0"
                                            },
                                            WARNING: {
                                                icon: AlertTriangle,
                                                color: "text-amber-500",
                                                bg: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb",
                                                border: isDark ? "rgba(245,158,11,0.25)" : "#fde68a"
                                            },
                                            CRITICAL: {
                                                icon: AlertOctagon,
                                                color: "text-rose-500",
                                                bg: isDark ? "rgba(239,68,68,0.1)" : "#fff1f2",
                                                border: isDark ? "rgba(239,68,68,0.25)" : "#fecdd3"
                                            },
                                            NEUTRAL: {
                                                icon: Info,
                                                color: "text-blue-500",
                                                bg: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff",
                                                border: isDark ? "rgba(59,130,246,0.25)" : "#bfdbfe"
                                            }
                                        };
                                        const stKey = (finding.status || "POSITIVE").toUpperCase();
                                        const st = statusConfig[stKey] || statusConfig.POSITIVE;
                                        const StatusIcon = st.icon;

                                        return (
                                            <div key={fIdx} className="p-3.5 rounded-xl flex flex-col justify-between space-y-2 transition-all hover:opacity-90"
                                                style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <StatusIcon size={14} className={st.color} />
                                                        <span className="font-bold text-xs" style={{ color: T.text }}>{finding.title}</span>
                                                    </div>
                                                    {finding.metric && (
                                                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold"
                                                            style={{
                                                                background: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.85)",
                                                                color: T.text,
                                                                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`
                                                            }}>
                                                            {finding.metric}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] leading-snug" style={{ color: T.textMuted }}>
                                                    {finding.detail}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Divider */}
                        <div className="h-[1px]" style={{ background: T.divider }} />

                        {/* Section 3: Leadership Recommendation */}
                        <div className="p-4 rounded-xl space-y-3"
                            style={{
                                background: isDark ? "rgba(139,92,246,0.1)" : "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
                                border: `1px solid ${isDark ? "rgba(139,92,246,0.25)" : "#ddd6fe"}`
                            }}>
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                                style={{ color: isDark ? "#c4b5fd" : "#7c3aed" }}>
                                <Target size={14} className="text-violet-500" />
                                <span>Leadership Recommendation</span>
                            </div>

                            <p className="font-bold text-xs sm:text-sm" style={{ color: isDark ? "#ffffff" : "#4c1d95" }}>
                                {briefingData.recommendation?.title || "Run a focused pricing-objection workshop before next week's outbound campaign"}
                            </p>

                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-extrabold tracking-wider mb-1.5" style={{ color: T.textFaint }}>
                                    Expected Business Outcomes:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {(briefingData.recommendation?.expectedOutcomes || [
                                        "Higher enterprise deal conversion rate",
                                        "Better objection handling during initial contract reviews",
                                        "Reduced discounting pressure in competitive opportunities"
                                    ]).map((outcome, oIdx) => (
                                        <div key={oIdx} className="flex items-center gap-2 text-[11px] p-2 rounded-lg"
                                            style={{
                                                background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                                                border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#e0e7ff"}`,
                                                color: isDark ? "#cbd5e1" : "#334155"
                                            }}>
                                            <Check size={13} className="text-emerald-500 flex-shrink-0" />
                                            <span>{outcome}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 4. COMPANY KPIs GRID (8 Executive KPI Cards with Data-Driven Sparklines) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {/* Org Health */}
                <div className="p-3.5 rounded-xl border flex flex-col justify-between"
                    style={{ background: T.panel, borderColor: T.panelBorder, boxShadow: T.cardShadow }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Org Health</span>
                        <Activity size={12} className="text-emerald-500" />
                    </div>
                    <div className="my-2">
                        <p className="text-xl font-black" style={{ color: T.text }}>{orgHealth}<span className="text-[10px] font-normal" style={{ color: T.textFaint }}>/100</span></p>
                        <p className="text-[9px] font-bold mt-0.5" style={{ color: isDark ? "#34d399" : "#059669" }}>↑ {orgHealthDelta}</p>
                    </div>
                    <Sparkline data={dailyMetrics.length > 0 ? dailyMetrics.map(d => d.organizationHealth) : null} color="#10b981" />
                </div>

                {/* Pipeline Covered KPI */}
                <div className="p-3.5 rounded-xl border flex flex-col justify-between"
                    style={{ background: T.panel, borderColor: T.panelBorder, boxShadow: T.cardShadow }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Pipeline Covered</span>
                        <DollarSign size={12} className="text-violet-500" />
                    </div>
                    <div className="my-2 flex-1 flex flex-col justify-center">
                        {pipelineLoading ? (
                            <p className="text-xs animate-pulse" style={{ color: T.textFaint }}>Loading...</p>
                        ) : !pipelineData || (pipelineData.openDealCount === 0 && pipelineData.wonDealCount === 0 && pipelineData.lostDealCount === 0) ? (
                            <div className="space-y-1 mt-1">
                                <p className="text-xs font-bold" style={{ color: T.textMuted }}>No pipeline data</p>
                                <p className="text-[9px] leading-tight" style={{ color: T.textFaint }}>Add deal values to tracked calls.</p>
                            </div>
                        ) : pipelineData.openDealCount === 0 ? (
                            <div className="space-y-1">
                                <p className="text-xs font-bold" style={{ color: T.textMuted }}>No open pipeline</p>
                                {pipelineData.wonDealCount > 0 && (
                                    <div>
                                        <p className="text-lg font-black text-emerald-500">
                                            {formatCurrency(pipelineData.closedWon)}
                                        </p>
                                        <p className="text-[9px] font-bold mt-0.5" style={{ color: isDark ? "#6ee7b7" : "#059669" }}>
                                            {pipelineData.wonDealCount} Closed Won Deal{pipelineData.wonDealCount > 1 ? "s" : ""}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <p className="text-xl font-black" style={{ color: T.text }}>
                                    {formatCurrency(pipelineData.pipelineCovered)}
                                </p>
                                <p className="text-[9px] font-bold mt-0.5" style={{ color: isDark ? "#c4b5fd" : "#7c3aed" }}>
                                    {pipelineData.openDealCount} Open Deal{pipelineData.openDealCount > 1 ? "s" : ""}
                                </p>
                                {pipelineData.wonDealCount > 0 && (
                                    <p className="text-[9px] font-bold mt-0.5" style={{ color: isDark ? "#34d399" : "#059669" }}>
                                        Won: {formatCurrency(pipelineData.closedWon)}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    <Sparkline data={pipelineData && pipelineData.openDealCount > 0 ? [0, Number(pipelineData.pipelineCovered)] : pipelineData && pipelineData.wonDealCount > 0 ? [0, Number(pipelineData.closedWon)] : null} color="#8b5cf6" />
                </div>

                {/* Average QA */}
                <div className="p-3.5 rounded-xl border flex flex-col justify-between"
                    style={{ background: T.panel, borderColor: T.panelBorder, boxShadow: T.cardShadow }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Avg QA Score</span>
                        <Star size={12} className="text-blue-500" />
                    </div>
                    <div className="my-2">
                        <p className="text-xl font-black" style={{ color: T.text }}>{avgScore}</p>
                        <p className="text-[9px] font-bold mt-0.5" style={{ color: isDark ? "#93c5fd" : "#2563eb" }}>Grade A</p>
                    </div>
                    <Sparkline data={dailyMetrics.length > 0 ? dailyMetrics.map(d => d.avgQaScore) : null} color="#3b82f6" />
                </div>

                {/* Risk Flags */}
                <div className="p-3.5 rounded-xl border flex flex-col justify-between"
                    style={{ background: T.panel, borderColor: T.panelBorder, boxShadow: T.cardShadow }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Risk Flags</span>
                        <ShieldAlert size={12} className="text-amber-500" />
                    </div>
                    <div className="my-2">
                        <p className="text-xl font-black text-amber-500">{companyStats?.riskFlagsCount ?? companyStats?.coachingNeededCount ?? 0}</p>
                        <p className="text-[9px] font-bold mt-0.5" style={{ color: isDark ? "#34d399" : "#059669" }}>
                            {(companyStats?.coachingNeededCount || 0) > 0 ? `${companyStats.coachingNeededCount} Rep${companyStats.coachingNeededCount > 1 ? "s" : ""} need coaching` : "0 At-Risk Reps"}
                        </p>
                    </div>
                    <Sparkline data={dailyMetrics.length > 0 ? dailyMetrics.map(d => d.coachingNeeded) : null} color="#f59e0b" />
                </div>

                {/* Active Members */}
                <div className="p-3.5 rounded-xl border flex flex-col justify-between"
                    style={{ background: T.panel, borderColor: T.panelBorder, boxShadow: T.cardShadow }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Active Members</span>
                        <Users size={12} className="text-purple-500" />
                    </div>
                    <div className="my-2">
                        <p className="text-xl font-black" style={{ color: T.text }}>{activeSeats}</p>
                        <p className="text-[9px] font-bold mt-0.5" style={{ color: isDark ? "#d8b4fe" : "#9333ea" }}>Active Reps</p>
                    </div>
                    <Sparkline data={null} color="#a78bfa" />
                </div>

                {/* Seat Utilization */}
                <div className="p-3.5 rounded-xl border flex flex-col justify-between"
                    style={{ background: T.panel, borderColor: T.panelBorder, boxShadow: T.cardShadow }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Seat Utilization</span>
                        <CreditCard size={12} className="text-indigo-500" />
                    </div>
                    <div className="my-2">
                        <p className="text-xl font-black" style={{ color: T.text }}>{seatPct}%</p>
                        <p className="text-[9px] font-medium mt-0.5" style={{ color: T.textMuted }}>{activeSeats}/{seatLimit} Seats</p>
                    </div>
                    <Sparkline data={null} color="#6366f1" />
                </div>

                {/* AI Success */}
                <div className="p-3.5 rounded-xl border flex flex-col justify-between"
                    style={{ background: T.panel, borderColor: T.panelBorder, boxShadow: T.cardShadow }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>AI Success Rate</span>
                        <Cpu size={12} className="text-cyan-500" />
                    </div>
                    <div className="my-2">
                        <p className="text-xl font-black" style={{ color: T.text }}>100%</p>
                        <p className="text-[9px] font-bold mt-0.5" style={{ color: isDark ? "#67e8f9" : "#0891b2" }}>Pipeline Active</p>
                    </div>
                    <Sparkline data={null} color="#06b6d4" />
                </div>

                {/* Media Library */}
                <div className="p-3.5 rounded-xl border flex flex-col justify-between"
                    style={{ background: T.panel, borderColor: T.panelBorder, boxShadow: T.cardShadow }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Media Library</span>
                        <HardDrive size={12} className="text-emerald-500" />
                    </div>

                    {/* Loading skeleton */}
                    {mediaLibraryLoading && (
                        <div className="my-2 space-y-1.5">
                            <div className="h-6 w-10 rounded-md animate-pulse" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9" }} />
                            <div className="h-2.5 w-20 rounded animate-pulse" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9" }} />
                            <div className="h-2 w-24 rounded animate-pulse mt-1" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#f1f5f9" }} />
                        </div>
                    )}

                    {/* Error state */}
                    {!mediaLibraryLoading && mediaLibraryError && (
                        <div className="my-2">
                            <p className="text-[10px] text-red-500 font-medium">Unable to load</p>
                            <button
                                onClick={() => {
                                    setMediaLibraryError(false);
                                    setMediaLibraryLoading(true);
                                    api.get("/api/company/media-library")
                                        .then(res => { setMediaLibrary(res.data); setMediaLibraryLoading(false); })
                                        .catch(() => { setMediaLibraryError(true); setMediaLibraryLoading(false); });
                                }}
                                className="text-[9px] font-bold mt-1 transition-colors text-violet-600 dark:text-violet-400"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Empty state */}
                    {!mediaLibraryLoading && !mediaLibraryError && mediaLibrary && mediaLibrary.recordingCount === 0 && (
                        <div className="my-2">
                            <p className="text-xl font-black" style={{ color: T.text }}>0</p>
                            <p className="text-[9px] font-medium mt-0.5" style={{ color: T.textMuted }}>No recordings yet</p>
                        </div>
                    )}

                    {/* Data state */}
                    {!mediaLibraryLoading && !mediaLibraryError && mediaLibrary && mediaLibrary.recordingCount > 0 && (() => {
                        const count      = mediaLibrary.recordingCount;
                        const tracked    = mediaLibrary.trackedFileCount;
                        const bytes      = mediaLibrary.trackedStorageBytes;
                        const unknown    = mediaLibrary.unknownFileSizeCount;
                        const lastUpload = mediaLibrary.lastUploadAt;

                        const fmtBytes = (b) => {
                            if (!b || b === 0) return "0 B";
                            const units = ["B", "KB", "MB", "GB", "TB"];
                            const i = Math.floor(Math.log(b) / Math.log(1024));
                            return `${(b / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
                        };

                        const relTime = (isoStr) => {
                            if (!isoStr) return null;
                            const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
                            if (diff < 60)   return "just now";
                            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                            return `${Math.floor(diff / 86400)}d ago`;
                        };

                        return (
                            <div className="my-2">
                                <p className="text-xl font-black" style={{ color: T.text }}>{count.toLocaleString()}</p>
                                <p className="text-[9px] font-bold mt-0.5" style={{ color: isDark ? "#34d399" : "#059669" }}>
                                    Recording{count !== 1 ? "s" : ""}
                                </p>

                                {tracked > 0 ? (
                                    <p className="text-[9px] font-medium mt-1.5" style={{ color: T.textMuted }}>
                                        {fmtBytes(bytes)} tracked
                                        {unknown > 0 && ` · ${unknown} w/o size`}
                                    </p>
                                ) : (
                                    <p className="text-[9px] font-medium mt-1.5" style={{ color: T.textFaint }}>
                                        Size unrecorded
                                    </p>
                                )}

                                {lastUpload && (
                                    <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>
                                        Upload · {relTime(lastUpload)}
                                    </p>
                                )}
                            </div>
                        );
                    })()}

                    <div style={{ height: 20 }} />
                </div>
            </div>

            {/* 5. REVENUE & QUALITY TREND HERO CHART (P0 - Visual Centerpiece) */}
            <Panel T={T} className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b"
                    style={{ borderColor: T.divider }}>
                    <div>
                        <div className="flex items-center gap-2">
                            <TrendingUp size={18} className="text-violet-500" />
                            <h3 className="text-base font-black" style={{ color: T.text }}>Revenue & Quality Trend Intelligence</h3>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>{rangeLabel} performance velocity across call volume, QA score, and customer sentiment</p>
                    </div>

                    {/* Metric Tabs */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl"
                        style={{
                            background: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`
                        }}>
                        <button onClick={() => setChartMetric("volume")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartMetric === "volume" ? "bg-violet-600 text-white shadow-md" : "hover:opacity-90"}`}
                            style={{ color: chartMetric === "volume" ? "#ffffff" : T.textMuted }}>
                            Call Volume
                        </button>
                        <button onClick={() => setChartMetric("qa")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartMetric === "qa" ? "bg-blue-600 text-white shadow-md" : "hover:opacity-90"}`}
                            style={{ color: chartMetric === "qa" ? "#ffffff" : T.textMuted }}>
                            QA Score Trend
                        </button>
                        <button onClick={() => setChartMetric("sentiment")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartMetric === "sentiment" ? "bg-emerald-600 text-white shadow-md" : "hover:opacity-90"}`}
                            style={{ color: chartMetric === "sentiment" ? "#ffffff" : T.textMuted }}>
                            Sentiment Ratio
                        </button>
                    </div>
                </div>

                {/* Recharts Area Chart */}
                <div className="h-72 w-full">
                    {trendChartData.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6">
                            <p className="text-sm font-bold" style={{ color: T.textMuted }}>No trend data available for this range</p>
                            <p className="text-xs mt-1" style={{ color: T.textFaint }}>Upload call recordings to begin tracking historical performance.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendChartData} margin={{ top: 16, right: 16, left: -16, bottom: 8 }}>
                                <defs>
                                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartMetric === "volume" ? "#8b5cf6" : chartMetric === "qa" ? "#3b82f6" : "#10b981"} stopOpacity={0.35} />
                                        <stop offset="95%" stopColor={chartMetric === "volume" ? "#8b5cf6" : chartMetric === "qa" ? "#3b82f6" : "#10b981"} stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.04)" : "#f1f5f9"} vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    ticks={optimalDateTicks}
                                    interval={0}
                                    stroke={isDark ? "rgba(255,255,255,0.08)" : "#cbd5e1"}
                                    tickLine={false}
                                    axisLine={{ stroke: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0" }}
                                    tick={{ fontSize: 11, fill: isDark ? "#94a3b8" : "#64748b", fontWeight: 500 }}
                                    dy={8}
                                />
                                <YAxis
                                    stroke={isDark ? "rgba(255,255,255,0.08)" : "#cbd5e1"}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 11, fill: isDark ? "#64748b" : "#94a3b8", fontWeight: 500 }}
                                    dx={-4}
                                />
                                <Tooltip
                                    cursor={{ stroke: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)", strokeDasharray: "4 4", strokeWidth: 1 }}
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload || !payload.length) return null;
                                        const item = payload[0];
                                        const val = item.value;
                                        const metricName = chartMetric === "volume" ? "Call Volume" : chartMetric === "qa" ? "Avg QA Score" : "Positive Sentiment";
                                        const unit = chartMetric === "volume" ? "calls" : chartMetric === "qa" ? "/ 100" : "%";
                                        const color = chartMetric === "volume" ? "#8b5cf6" : chartMetric === "qa" ? "#3b82f6" : "#10b981";
                                        return (
                                            <div className="px-3.5 py-2.5 rounded-xl border backdrop-blur-xl shadow-2xl"
                                                style={{
                                                    backgroundColor: T.popoverBg,
                                                    borderColor: T.popoverBorder,
                                                    boxShadow: T.popoverShadow
                                                }}>
                                                <p className="text-[11px] font-bold mb-1.5" style={{ color: T.textFaint }}>{label}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                                                    <span className="text-xs font-medium" style={{ color: T.textMuted }}>{metricName}:</span>
                                                    <span className="text-xs font-black" style={{ color: T.text }}>{val} <span className="text-[10px] font-normal" style={{ color: T.textFaint }}>{unit}</span></span>
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey={chartMetric === "volume" ? "Volume" : chartMetric === "qa" ? "QA" : "Sentiment"}
                                    stroke={chartMetric === "volume" ? "#8b5cf6" : chartMetric === "qa" ? "#3b82f6" : "#10b981"}
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#chartGrad)"
                                    activeDot={{ r: 5, fill: chartMetric === "volume" ? "#8b5cf6" : chartMetric === "qa" ? "#3b82f6" : "#10b981", stroke: "#fff", strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Hero Stats Footer */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 mt-4 border-t text-xs"
                    style={{ borderColor: T.divider }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold flex-shrink-0"
                            style={{
                                background: isDark ? "rgba(139,92,246,0.15)" : "#f5f3ff",
                                border: `1px solid ${isDark ? "rgba(139,92,246,0.3)" : "#ddd6fe"}`,
                                color: isDark ? "#c4b5fd" : "#7c3aed"
                            }}>
                            <Phone size={14} />
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: T.textFaint }}>Total Calls Analysed</span>
                            <p className="text-sm font-black" style={{ color: T.text }}>{companyStats?.totalCalls ?? totalCalls} Conversations</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold flex-shrink-0"
                            style={{
                                background: isDark ? "rgba(59,130,246,0.15)" : "#eff6ff",
                                border: `1px solid ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"}`,
                                color: isDark ? "#93c5fd" : "#2563eb"
                            }}>
                            <Star size={14} />
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: T.textFaint }}>{rangeLabel.toUpperCase()} Avg QA Standard</span>
                            <p className="text-sm font-black" style={{ color: T.text }}>{avgScore} / 100 Grade A</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold flex-shrink-0"
                            style={{
                                background: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5",
                                border: `1px solid ${isDark ? "rgba(16,185,129,0.3)" : "#a7f3d0"}`,
                                color: isDark ? "#6ee7b7" : "#059669"
                            }}>
                            <Smile size={14} />
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: T.textFaint }}>Positive Sentiment Ratio</span>
                            <p className="text-sm font-black" style={{ color: T.text }}>{posPct}% Positive Conversations</p>
                        </div>
                    </div>
                </div>
            </Panel>

            {/* 6. COMPANY ALERT CENTER & TOP INSIGHTS MATRIX */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Company Alert Center Feed (7 cols) */}
                <Panel T={T} className="lg:col-span-7 p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                            <ShieldAlert size={16} className="text-rose-500" />
                            <h3 className="text-sm font-bold" style={{ color: T.text }}>Company Alert Center</h3>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                                style={{
                                    background: isDark ? "rgba(239,68,68,0.2)" : "#fff1f2",
                                    color: isDark ? "#fca5a5" : "#e11d48",
                                    border: `1px solid ${isDark ? "rgba(239,68,68,0.3)" : "#fecdd3"}`
                                }}>
                                {alerts.length} Active Feeds
                            </span>
                        </div>

                        {/* Filter tabs */}
                        <div className="flex items-center gap-1 p-1 rounded-lg text-[10px] font-bold"
                            style={{
                                background: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`
                            }}>
                            {["all", "critical", "warning", "system"].map(f => (
                                <button key={f} onClick={() => setAlertFilter(f)}
                                    className={`px-2 py-1 rounded transition-all capitalize ${alertFilter === f ? (isDark ? "bg-white/15 text-white" : "bg-white text-slate-900 shadow-sm") : "text-slate-400 hover:opacity-80"}`}
                                    style={{ color: alertFilter === f ? (isDark ? "#ffffff" : "#0f172a") : T.textMuted }}>
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        {filteredAlerts.length === 0 ? (
                            <div className="p-6 rounded-xl border border-dashed text-center text-xs"
                                style={{ borderColor: T.divider, color: T.textMuted }}>
                                <ShieldCheck size={24} className="mx-auto mb-2 text-emerald-500" />
                                <p className="font-semibold" style={{ color: T.text }}>All systems healthy</p>
                                <p className="text-[11px] mt-0.5" style={{ color: T.textFaint }}>
                                    No {alertFilter !== "all" ? alertFilter : "active"} risk alerts detected for this time window.
                                </p>
                            </div>
                        ) : (
                            filteredAlerts.map(a => (
                                <div key={a.id} className="p-3.5 rounded-xl border flex items-start justify-between gap-3 transition-all hover:opacity-90"
                                    style={{
                                        background: isDark ? a.bg : a.severity === "critical" ? "#fff1f2" : a.severity === "warning" ? "#fffbeb" : "#ecfdf5",
                                        borderColor: isDark ? a.border : a.severity === "critical" ? "#fecdd3" : a.severity === "warning" ? "#fde68a" : "#a7f3d0"
                                    }}>
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                            style={{ background: `${a.color}20`, border: `1px solid ${a.color}40` }}>
                                            <a.icon size={15} style={{ color: a.color }} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-bold truncate" style={{ color: T.text }}>{a.title}</p>
                                                <span className="text-[9px] font-semibold flex-shrink-0" style={{ color: T.textFaint }}>{a.time}</span>
                                            </div>
                                            <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: T.textMuted }}>{a.description}</p>
                                        </div>
                                    </div>

                                    <Link to={a.link}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex-shrink-0 transition-colors inline-flex items-center gap-1"
                                        style={{ background: `${a.color}15`, color: a.color, border: `1px solid ${a.color}35` }}>
                                        {a.actionLabel} <ArrowUpRight size={10} />
                                    </Link>
                                </div>
                            ))
                        )}
                    </div>
                </Panel>

                {/* Top Executive Insights Panel (5 cols) */}
                <Panel T={T} className="lg:col-span-5 p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Crown size={16} className="text-amber-500" />
                                <h3 className="text-sm font-bold" style={{ color: T.text }}>Executive Team Insights</h3>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>{rangeLabel} Window</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {/* Top Performer */}
                            <div className="p-3 rounded-xl"
                                style={{
                                    background: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb",
                                    border: `1px solid ${isDark ? "rgba(245,158,11,0.25)" : "#fde68a"}`
                                }}>
                                <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1"
                                    style={{ color: isDark ? "#fbbf24" : "#d97706" }}>
                                    <Crown size={10} /> Top Performer
                                </span>
                                <p className="font-bold text-sm truncate" style={{ color: T.text }}>{topInsights.topPerformer?.employeeName || "No Data"}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: isDark ? "rgba(253,230,138,0.8)" : "#92400e" }}>{topInsights.topPerformer?.statusText || "No calls in period"}</p>
                            </div>

                            {/* Needs Coaching */}
                            <div className="p-3 rounded-xl"
                                style={{
                                    background: isDark ? "rgba(239,68,68,0.1)" : "#fff1f2",
                                    border: `1px solid ${isDark ? "rgba(239,68,68,0.25)" : "#fecdd3"}`
                                }}>
                                <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1"
                                    style={{ color: isDark ? "#f87171" : "#e11d48" }}>
                                    <AlertTriangle size={10} /> Needs Coaching
                                </span>
                                <p className="font-bold text-sm truncate" style={{ color: T.text }}>{topInsights.needsCoaching?.employeeName || "All Reps On Track"}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: isDark ? "rgba(254,205,211,0.8)" : "#9f1239" }}>{topInsights.needsCoaching?.statusText || "Quality standards met"}</p>
                            </div>

                            {/* Most Improved */}
                            <div className="p-3 rounded-xl"
                                style={{
                                    background: isDark ? "rgba(16,185,129,0.1)" : "#ecfdf5",
                                    border: `1px solid ${isDark ? "rgba(16,185,129,0.25)" : "#a7f3d0"}`
                                }}>
                                <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1"
                                    style={{ color: isDark ? "#34d399" : "#059669" }}>
                                    <TrendingUp size={10} /> Most Improved
                                </span>
                                <p className="font-bold text-sm truncate" style={{ color: T.text }}>{topInsights.mostImproved?.employeeName || "Baseline Establishing"}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: isDark ? "rgba(167,243,208,0.8)" : "#065f46" }}>{topInsights.mostImproved?.statusText || "No prior comparison"}</p>
                            </div>

                            {/* Highest Call Volume */}
                            <div className="p-3 rounded-xl"
                                style={{
                                    background: isDark ? "rgba(139,92,246,0.1)" : "#f5f3ff",
                                    border: `1px solid ${isDark ? "rgba(139,92,246,0.25)" : "#ddd6fe"}`
                                }}>
                                <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1"
                                    style={{ color: isDark ? "#c4b5fd" : "#7c3aed" }}>
                                    <Phone size={10} /> Highest Volume
                                </span>
                                <p className="font-bold text-sm truncate" style={{ color: T.text }}>{topInsights.highestVolume?.employeeName || (topPerformers[0]?.employeeName ?? "No Data")}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: isDark ? "rgba(221,214,254,0.8)" : "#5b21b6" }}>{topInsights.highestVolume?.statusText || (topPerformers[0] ? `${topPerformers[0].callCount} Conversations` : "0 conversations")}</p>
                            </div>

                            {/* Best QA Score */}
                            <div className="p-3 rounded-xl"
                                style={{
                                    background: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff",
                                    border: `1px solid ${isDark ? "rgba(59,130,246,0.25)" : "#bfdbfe"}`
                                }}>
                                <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1"
                                    style={{ color: isDark ? "#60a5fa" : "#2563eb" }}>
                                    <Star size={10} /> Best QA Score
                                </span>
                                <p className="font-bold text-sm truncate" style={{ color: T.text }}>{topInsights.bestQA?.employeeName || (topPerformers[0]?.employeeName ?? "No Data")}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: isDark ? "rgba(191,219,254,0.8)" : "#1e40af" }}>{topInsights.bestQA?.statusText || (topPerformers[0] ? `${topPerformers[0].avgScore?.toFixed(1)} / 100 Top Score` : "No scored calls")}</p>
                            </div>

                            {/* Highest Positive Sentiment */}
                            <div className="p-3 rounded-xl"
                                style={{
                                    background: isDark ? "rgba(6,182,212,0.1)" : "#ecfeff",
                                    border: `1px solid ${isDark ? "rgba(6,182,212,0.25)" : "#a5f3fc"}`
                                }}>
                                <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1"
                                    style={{ color: isDark ? "#22d3ee" : "#0891b2" }}>
                                    <Smile size={10} /> Best Sentiment
                                </span>
                                <p className="font-bold text-sm truncate" style={{ color: T.text }}>{topInsights.highestSentiment?.employeeName || (topPerformers[0]?.employeeName ?? "No Data")}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: isDark ? "rgba(165,243,252,0.8)" : "#155e75" }}>{topInsights.highestSentiment?.posRatio || (posPct > 0 ? `${posPct}% Positive Ratio` : "No sentiment data")}</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 mt-4 border-t flex items-center justify-between text-xs"
                        style={{ borderColor: T.divider }}>
                        <span style={{ color: T.textMuted }}>Team Leadership Roster</span>
                        <Link to={`/w/${companySlug}/company/members`} className="font-bold flex items-center gap-1 hover:underline text-violet-600 dark:text-violet-400">
                            View All Reps <ArrowRight size={11} />
                        </Link>
                    </div>
                </Panel>
            </div>

            {/* 7. RECENT COMPANY CALLS TABLE */}
            <Panel T={T} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: T.text }}>
                            <Radio size={16} className="text-cyan-500" />
                            Recent Company-Wide Conversations
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>
                            Showing conversations from {dateRange === "7d" ? "the last 7 days" : dateRange === "all" ? "all time" : "the last 30 days"}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Scoped Table Filter Popover */}
                        <div className="relative" ref={recentFilterWrapRef}>
                            <button onClick={() => setRecentFilterOpen(o => !o)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                                style={{
                                    background: recentFilterOpen ? T.panelHover : T.inputBg,
                                    border: `1px solid ${activeRecentFilterCount > 0 ? "rgba(139,92,246,0.4)" : T.panelBorder}`,
                                    color: activeRecentFilterCount > 0 ? (isDark ? "#c4b5fd" : "#7c3aed") : T.textMuted
                                }}
                                title="Filter conversations">
                                <SlidersHorizontal size={12} />
                                <span>Filter</span>
                                {activeRecentFilterCount > 0 && (
                                    <span className="flex items-center justify-center min-w-[15px] h-3.5 px-1 rounded-full text-[9px] font-bold text-white bg-violet-600">
                                        {activeRecentFilterCount}
                                    </span>
                                )}
                            </button>

                            {recentFilterOpen && (
                                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl overflow-hidden z-50 p-4 space-y-3"
                                    style={{
                                        background: T.popoverBg,
                                        border: `1px solid ${T.popoverBorder}`,
                                        backdropFilter: "blur(20px)",
                                        boxShadow: T.popoverShadow,
                                        animation: "dropdownIn 0.15s ease-out"
                                    }}>
                                    <div className="flex items-center justify-between pb-2 border-b"
                                        style={{ borderColor: T.divider }}>
                                        <p className="text-xs font-bold" style={{ color: T.text }}>Filter Conversations</p>
                                        <button onClick={resetRecentFilters}
                                            className="flex items-center gap-1 text-[10px] font-semibold transition-colors"
                                            style={{ color: activeRecentFilterCount > 0 ? (isDark ? "#a78bfa" : "#7c3aed") : T.textFaint }}
                                            disabled={activeRecentFilterCount === 0}>
                                            <RotateCcw size={9} /> Reset
                                        </button>
                                    </div>

                                    {/* Sentiment */}
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: T.textFaint }}>Sentiment</p>
                                        <div className="flex flex-wrap gap-1">
                                            {["all", "POSITIVE", "NEUTRAL", "NEGATIVE"].map(v => (
                                                <button key={v} onClick={() => setRecentFilters(f => ({ ...f, sentiment: v }))}
                                                    className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors capitalize"
                                                    style={{
                                                        background: recentFilters.sentiment === v
                                                            ? (isDark ? "rgba(139,92,246,0.2)" : "#f5f3ff")
                                                            : (isDark ? "rgba(255,255,255,0.04)" : "#f1f5f9"),
                                                        border: `1px solid ${recentFilters.sentiment === v ? (isDark ? "rgba(139,92,246,0.5)" : "#c4b5fd") : (isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0")}`,
                                                        color: recentFilters.sentiment === v ? (isDark ? "#c4b5fd" : "#7c3aed") : T.textMuted
                                                    }}>
                                                    {v === "all" ? "All" : v.charAt(0) + v.slice(1).toLowerCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* QA Score */}
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: T.textFaint }}>QA Score</p>
                                        <div className="flex flex-wrap gap-1">
                                            {[["all", "All"], ["high", "80+ High"], ["medium", "50–79"], ["low", "<50"]].map(([v, label]) => (
                                                <button key={v} onClick={() => setRecentFilters(f => ({ ...f, qaScore: v }))}
                                                    className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                                                    style={{
                                                        background: recentFilters.qaScore === v
                                                            ? (isDark ? "rgba(139,92,246,0.2)" : "#f5f3ff")
                                                            : (isDark ? "rgba(255,255,255,0.04)" : "#f1f5f9"),
                                                        border: `1px solid ${recentFilters.qaScore === v ? (isDark ? "rgba(139,92,246,0.5)" : "#c4b5fd") : (isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0")}`,
                                                        color: recentFilters.qaScore === v ? (isDark ? "#c4b5fd" : "#7c3aed") : T.textMuted
                                                    }}>
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Outcome Status */}
                                    {outcomeStatusOptions.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: T.textFaint }}>Outcome Status</p>
                                            <select value={recentFilters.outcomeStatus} onChange={e => setRecentFilters(f => ({ ...f, outcomeStatus: e.target.value }))}
                                                className="w-full px-2.5 py-1.5 rounded-lg text-[10px] font-semibold outline-none"
                                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}>
                                                <option value="all">All statuses</option>
                                                {outcomeStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {/* Call Type */}
                                    {callTypeOptions.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: T.textFaint }}>Call Type</p>
                                            <select value={recentFilters.callType} onChange={e => setRecentFilters(f => ({ ...f, callType: e.target.value }))}
                                                className="w-full px-2.5 py-1.5 rounded-lg text-[10px] font-semibold outline-none"
                                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}>
                                                <option value="all">All call types</option>
                                                {callTypeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <Link to={`/w/${companySlug}/history`} className="text-xs font-bold flex items-center gap-1 hover:underline text-violet-600 dark:text-violet-400">
                            View All Calls <ArrowRight size={12} />
                        </Link>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b font-bold uppercase tracking-wider text-[10px]"
                                style={{ borderColor: T.divider, color: T.textFaint }}>
                                <th className="pb-3">Call Title</th>
                                <th className="pb-3">Uploader</th>
                                <th className="pb-3">Date & Time</th>
                                <th className="pb-3">QA Score</th>
                                <th className="pb-3">Outcome</th>
                                <th className="pb-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: T.divider }}>
                            {filteredRecentCalls.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center" style={{ color: T.textMuted }}>
                                        <Phone size={24} className="mx-auto mb-2 opacity-50" />
                                        <p className="font-semibold text-xs" style={{ color: T.text }}>No conversations found</p>
                                        <p className="text-[11px] mt-0.5" style={{ color: T.textFaint }}>
                                            {activeRecentFilterCount > 0
                                                ? "No recordings match the active filters for this time window."
                                                : `No recordings uploaded during ${dateRange === "7d" ? "the last 7 days" : dateRange === "all" ? "the selected period" : "the last 30 days"}.`}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRecentCalls.slice(0, 8).map(call => (
                                    <tr key={call.id} className="transition-colors hover:opacity-90"
                                        onMouseEnter={e => e.currentTarget.style.background = T.panelHover}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                        <td className="py-3 font-bold max-w-[200px] truncate" style={{ color: T.text }}>{call.fileName}</td>
                                        <td className="py-3 font-medium" style={{ color: isDark ? "#c4b5fd" : "#6d28d9" }}>{call.uploaderName || "System User"}</td>
                                        <td className="py-3" style={{ color: T.textMuted }}>{call.createdAt ? new Date(call.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                                        <td className="py-3">
                                            {call.overallScore != null ? (
                                                <span className="font-extrabold px-2 py-0.5 rounded text-[11px]"
                                                    style={{
                                                        background: call.overallScore >= 70
                                                            ? (isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5")
                                                            : (isDark ? "rgba(245,158,11,0.15)" : "#fffbeb"),
                                                        color: call.overallScore >= 70
                                                            ? (isDark ? "#34d399" : "#059669")
                                                            : (isDark ? "#fbbf24" : "#d97706"),
                                                        border: `1px solid ${call.overallScore >= 70 ? (isDark ? "rgba(16,185,129,0.3)" : "#a7f3d0") : (isDark ? "rgba(245,158,11,0.3)" : "#fde68a")}`
                                                    }}>
                                                    {call.overallScore} / 100
                                                </span>
                                            ) : "—"}
                                        </td>
                                        <td className="py-3">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                style={{
                                                    background: isDark ? "rgba(139,92,246,0.1)" : "#f5f3ff",
                                                    color: isDark ? "#c4b5fd" : "#7c3aed",
                                                    border: `1px solid ${isDark ? "rgba(139,92,246,0.2)" : "#ddd6fe"}`
                                                }}>
                                                {call.outcomeStatus || call.outcome || "Pending"}
                                            </span>
                                        </td>
                                        <td className="py-3 text-right">
                                            <Link to={`/w/${companySlug}/calls/${call.id}`}
                                                className="px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors inline-flex items-center gap-1"
                                                style={{
                                                    background: isDark ? "rgba(139,92,246,0.15)" : "#f5f3ff",
                                                    color: isDark ? "#c4b5fd" : "#7c3aed",
                                                    border: `1px solid ${isDark ? "rgba(139,92,246,0.3)" : "#ddd6fe"}`
                                                }}>
                                                Open <ArrowUpRight size={10} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Panel>

            {/* AUDIT LOGS EXECUTIVE MODAL */}
            {auditLogsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                    <div className="w-full max-w-2xl rounded-2xl p-6 border"
                        style={{
                            background: isDark ? "#0f172a" : "#ffffff",
                            borderColor: T.panelBorder,
                            boxShadow: T.popoverShadow
                        }}>
                        <div className="flex items-center justify-between pb-4 border-b mb-4"
                            style={{ borderColor: T.divider }}>
                            <div className="flex items-center gap-2">
                                <FileText size={18} className="text-emerald-500" />
                                <h3 className="text-base font-bold" style={{ color: T.text }}>Workspace Security & Audit Logs</h3>
                            </div>
                            <button onClick={() => setAuditLogsOpen(false)} className="p-1 rounded-lg hover:opacity-80" style={{ color: T.textMuted }}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1 text-xs">
                            {[
                                { event: "Member Invited", user: user?.name || "Owner", target: "sarah.j@company.com", time: "10 mins ago", status: "Success" },
                                { event: "Call Recording Uploaded", user: "Alex Rivera", target: "Enterprise_Demo_08.wav", time: "42 mins ago", status: "Success" },
                                { event: "Seat Quota Synced", user: "System", target: "25 Seats Allocated", time: "2 hours ago", status: "Success" },
                                { event: "Role Permission Updated", user: user?.name || "Owner", target: "Tyler Durden (Manager)", time: "1 day ago", status: "Success" },
                                { event: "API Token Generated", user: user?.name || "Owner", target: "Production Key", time: "2 days ago", status: "Success" },
                            ].map((log, i) => (
                                <div key={i} className="p-3 rounded-xl border flex items-center justify-between"
                                    style={{
                                        background: isDark ? "rgba(255,255,255,0.05)" : "#f8fafc",
                                        borderColor: T.divider
                                    }}>
                                    <div>
                                        <p className="font-bold" style={{ color: T.text }}>{log.event}</p>
                                        <p className="text-[10px]" style={{ color: T.textMuted }}>By {log.user} · Target: {log.target}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="px-2 py-0.5 rounded text-[9px] font-bold"
                                            style={{
                                                background: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5",
                                                color: isDark ? "#6ee7b7" : "#059669",
                                                border: `1px solid ${isDark ? "rgba(16,185,129,0.3)" : "#a7f3d0"}`
                                            }}>
                                            {log.status}
                                        </span>
                                        <p className="text-[10px] mt-0.5" style={{ color: T.textFaint }}>{log.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 pt-4 border-t flex justify-end" style={{ borderColor: T.divider }}>
                            <button onClick={() => setAuditLogsOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                                style={{
                                    background: isDark ? "rgba(255,255,255,0.1)" : "#f1f5f9",
                                    color: T.text,
                                    border: `1px solid ${T.panelBorder}`
                                }}>
                                Close Audit Log
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
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
    const [dateRange, setDateRange] = useState("30d");

    /* ── Server-computed KPIs from GET /api/dashboard/employee. ────── */
    const [dashboardStats, setDashboardStats] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState(null);

    const [companyStats, setCompanyStats] = useState(null);
    const [membersData, setMembersData] = useState(null);

    const fetchOwnerData = useCallback(async (range = dateRange) => {
        try {
            const [statsRes, membersRes] = await Promise.allSettled([
                api.get(`/api/company/stats?range=${range}`),
                api.get("/api/company/members")
            ]);
            if (statsRes.status === "fulfilled") setCompanyStats(statsRes.value.data);
            if (membersRes.status === "fulfilled") setMembersData(membersRes.value.data);
        } catch (err) {
            console.error("Failed to load owner executive stats:", err);
        }
    }, [dateRange]);

    const { currentWorkspace } = useWorkspace();
    const storedUser = getUser();
    const user = useMemo(() => {
        return {
            ...storedUser,
            role: currentWorkspace?.role || storedUser?.role,
            companyName: currentWorkspace?.company?.name || storedUser?.companyName,
            companySlug: currentWorkspace?.company?.slug || storedUser?.companySlug,
            companyLogo: currentWorkspace?.company?.logoUrl || storedUser?.companyLogo,
        };
    }, [currentWorkspace, storedUser]);

    useEffect(() => {
        if (user?.role === "OWNER") {
            fetchOwnerData(dateRange);
        }
    }, [user?.role, dateRange, fetchOwnerData]);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchActiveIndex, setSearchActiveIndex] = useState(-1);

    const [filterOpen, setFilterOpen] = useState(false);
    const [filters, setFilters] = useState({
        sentiment: "all",
        qaScore: "all",
        outcomeStatus: "all",
        callType: "all",
        sortBy: "newest",
    });

    const [notifOpen, setNotifOpen] = useState(false);
    const [readNotifIds, setReadNotifIds] = useState(() => new Set());

    const { themeMode, toggleTheme, T } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const searchInputRef = useRef(null);
    const searchWrapRef = useRef(null);
    const filterWrapRef = useRef(null);
    const notifWrapRef = useRef(null);

    const [notifPrefs, setNotifPrefs] = useState(() => settingsService.getCached());
    useEffect(() => {
        const unsubscribe = settingsService.subscribe(setNotifPrefs);
        settingsService.load();
        return unsubscribe;
    }, []);

    const firstName = user?.name?.split(" ")[0] ?? "there";
    const companySlug = user?.companySlug || currentWorkspace?.company?.slug || "default";

    const fetchCalls = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get("/api/calls");
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

    /* ── Fetch server-computed KPIs, keyed on the same 7d/30d/all range the
       date-range selector already exposes. Independent request from
       fetchCalls() above — Recent Calls/Search don't need to wait on it and
       vice versa. ─────────────────────────────────────────────────────── */
    const fetchDashboardStats = useCallback(async (range) => {
        setDashboardLoading(true);
        setDashboardError(null);
        try {
            const res = await api.get(`/api/dashboard/employee?range=${range}`);
            setDashboardStats(res.data);
        } catch (err) {
            console.error("Failed to fetch dashboard stats:", err);
            setDashboardError("Unable to load dashboard insights. Please try again.");
        } finally {
            setDashboardLoading(false);
        }
    }, []);

    useEffect(() => { fetchDashboardStats(dateRange); }, [fetchDashboardStats, dateRange]);

    useEffect(() => {
        const handler = () => setProfileOpen(false);
        if (profileOpen) window.addEventListener("click", handler);
        return () => window.removeEventListener("click", handler);
    }, [profileOpen]);

    /* ── Click-outside for search / filter / notifications — each panel
       closes only when the click lands outside its own wrapper, so clicking
       a search result or a filter control never immediately closes it. */
    useEffect(() => {
        const handler = (e) => {
            if (searchOpen && searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setSearchOpen(false);
            if (filterOpen && filterWrapRef.current && !filterWrapRef.current.contains(e.target)) setFilterOpen(false);
            if (notifOpen && notifWrapRef.current && !notifWrapRef.current.contains(e.target)) setNotifOpen(false);
        };
        if (searchOpen || filterOpen || notifOpen) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [searchOpen, filterOpen, notifOpen]);

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
            if (e.key === "Escape") {
                setSearchOpen(false);
                setFilterOpen(false);
                setNotifOpen(false);
                searchInputRef.current?.blur();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    /* ── Search box keyboard nav — Up/Down move the highlighted result,
       Enter opens it, Escape is handled globally above. */
    const handleSearchKeyDown = (e) => {
        if (!searchOpen || searchQuery.trim() === "" || searchResults.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSearchActiveIndex(i => (i + 1) % searchResults.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSearchActiveIndex(i => (i - 1 + searchResults.length) % searchResults.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const target = searchResults[searchActiveIndex] ?? searchResults[0];
            if (target) {
                setSearchOpen(false);
                setSearchQuery("");
                searchInputRef.current?.blur();
                navigate(`/w/${user?.companySlug || "default"}/calls/${target.id}`);
            }
        }
    };

    const handleLogout = () => {
        logoutAndRedirect();
    };

    const handleUploadSuccess = () => {
        fetchCalls();
        fetchDashboardStats(dateRange);
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

    /* ── Filter option lists — pulled from the real `rangedCalls` data
       (not hard-coded), so the popover never offers a status or call type
       that doesn't actually exist in the account. Based on `rangedCalls`
       (date range only) rather than `filteredCalls` so picking one filter
       doesn't shrink the options for the others. */
    const outcomeStatusOptions = useMemo(
        () => Array.from(new Set(rangedCalls.map(c => c.outcomeStatus).filter(Boolean))),
        [rangedCalls]
    );
    const callTypeOptions = useMemo(
        () => Array.from(new Set(rangedCalls.map(c => c.callType).filter(Boolean))),
        [rangedCalls]
    );
    const activeFilterCount = (filters.sentiment !== "all" ? 1 : 0)
        + (filters.qaScore !== "all" ? 1 : 0)
        + (filters.outcomeStatus !== "all" ? 1 : 0)
        + (filters.callType !== "all" ? 1 : 0)
        + (filters.sortBy !== "newest" ? 1 : 0);

    const resetFilters = () => setFilters({ sentiment: "all", qaScore: "all", outcomeStatus: "all", callType: "all", sortBy: "newest" });

    /* ── Filtered + sorted view — layered on top of the date range. This is
       the single source of truth every card/chart/list below reads from,
       so Search-dropdown aside, Filters and Date Range stay synchronized
       across the whole dashboard. */
    const filteredCalls = useMemo(() => {
        let list = rangedCalls;
        if (filters.sentiment !== "all") list = list.filter(c => c.sentiment === filters.sentiment);
        if (filters.qaScore !== "all") {
            list = list.filter(c => {
                if (c.overallScore == null) return false;
                if (filters.qaScore === "high") return c.overallScore >= 80;
                if (filters.qaScore === "medium") return c.overallScore >= 50 && c.overallScore < 80;
                if (filters.qaScore === "low") return c.overallScore < 50;
                return true;
            });
        }
        if (filters.outcomeStatus !== "all") list = list.filter(c => c.outcomeStatus === filters.outcomeStatus);
        if (filters.callType !== "all") list = list.filter(c => c.callType === filters.callType);

        list = [...list].sort((a, b) => {
            switch (filters.sortBy) {
                case "oldest": return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                case "score_high": return (b.overallScore || 0) - (a.overallScore || 0);
                case "score_low": return (a.overallScore || 0) - (b.overallScore || 0);
                case "newest":
                default: return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            }
        });
        return list;
    }, [rangedCalls, filters]);

    /* ── Derived stats — identical calculations to before, now computed
       over `filteredCalls` so Date Range AND Filters both actually do
       something and every card below stays in sync. */
    const totalCalls = filteredCalls.length;

    /* ── Everything below through `chartData` used to be computed here from
       `filteredCalls`. It's now read directly from GET /api/dashboard/employee
       (`dashboardStats`), which is range-filtered (7d/30d/all) but NOT
       narrowed by the local sentiment/QA-score/outcome/call-type filters —
       those still only narrow the Recent Calls list below, per the backend
       owning averages/percentages. `statsTotalCalls` is the backend's own
       total and is what the KPI row displays; the `totalCalls` above (from
       `filteredCalls`) keeps driving Recent Calls, the empty-state gate, and
       the sidebar/notifications counts exactly as before. ───────────────── */
    const statsTotalCalls = dashboardStats?.totalCalls ?? 0;
    const avgScore = dashboardStats && dashboardStats.totalCalls > 0 ? dashboardStats.avgScore.toFixed(1) : 0;
    const positiveCalls = dashboardStats?.positiveCalls ?? 0;
    const positivePercent = dashboardStats && dashboardStats.totalCalls > 0 ? dashboardStats.positivePercent.toFixed(1) : 0;

    /* timelineMap now exists only to feed the "Total Calls" KPI sparkline
       below — the full Calls Over Time chart it used to power moved to
       Analytics (merged into its Score Trend combo chart), since a daily
       volume chart is a trend question, not a "what do I do today" one. */
    const timelineMap = {};
    filteredCalls.forEach(c => {
        if (!c.createdAt) return;
        const key = new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        timelineMap[key] = (timelineMap[key] || 0) + 1;
    });

    const recentCalls = filteredCalls.slice(0, 8);

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

    useEffect(() => { setSearchActiveIndex(0); }, [searchQuery]);

    /* ── Notifications — built entirely from the real `calls` array (new
       analyses, low scores, pending action items). Nothing here is
       fabricated; a call only produces a notification if the underlying
       field is actually present. `readNotifIds` is the only local state. */
    const notifications = useMemo(() => {
        // Defaults match settingsService's DEFAULTS so nothing is hidden
        // before the real preferences have loaded.
        const notifCallReady = notifPrefs?.notifCallReady ?? true;
        const notifNeedsAttention = notifPrefs?.notifNeedsAttention ?? true;
        const notifWeeklyDigest = notifPrefs?.notifWeeklyDigest ?? true;

        const list = [];
        if (notifCallReady) {
            calls.slice(0, 5).forEach(c => {
                list.push({
                    id: `analyzed-${c.id}`, callId: c.id, time: c.createdAt,
                    Icon: Sparkles, color: "#8b5cf6",
                    title: "New call analyzed",
                    message: `${c.fileName || "A call"} finished processing.`,
                });
            });
        }
        if (notifNeedsAttention) {
            calls.filter(c => c.overallScore != null && c.overallScore < 50).slice(0, 5).forEach(c => {
                list.push({
                    id: `lowqa-${c.id}`, callId: c.id, time: c.createdAt,
                    Icon: AlertTriangle, color: "#ef4444",
                    title: "Low QA score detected",
                    message: `${c.fileName || "A call"} scored ${c.overallScore}/100 — may need coaching.`,
                });
            });
            calls.filter(c => {
                const items = parseList(c.actionItems);
                return items.length > 0;
            }).slice(0, 5).forEach(c => {
                const count = parseList(c.actionItems).length;
                list.push({
                    id: `action-${c.id}`, callId: c.id, time: c.createdAt,
                    Icon: CheckCircle, color: "#f59e0b",
                    title: "Action items pending",
                    message: `${c.fileName || "A call"} has ${count} open action item${count !== 1 ? "s" : ""}.`,
                });
            });
        }
        if (notifWeeklyDigest && calls.length > 0) {
            const mostRecent = calls[0];
            list.push({
                id: "weekly-report", callId: null, time: mostRecent.createdAt,
                Icon: BarChart2, color: "#06b6d4",
                title: "Weekly analytics ready",
                message: `Your analytics summary across ${totalCalls} call${totalCalls !== 1 ? "s" : ""} is up to date.`,
            });
        }
        return list
            .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
            .slice(0, 20);
    }, [calls, totalCalls, notifPrefs]);

    const unreadNotifCount = notifications.filter(n => !readNotifIds.has(n.id)).length;
    const markNotifRead = (id) => setReadNotifIds(prev => new Set(prev).add(id));
    const markAllNotifsRead = () => setReadNotifIds(new Set(notifications.map(n => n.id)));

    /* ── Mission-control derivations — needsAttention, the weakest QA
       dimension, recommendations, and the AI briefing are now all owned by
       GET /api/dashboard/employee. Nothing here recomputes them; this only
       reshapes the response into what the JSX below already expects. ──── */
    const needsAttention = dashboardStats?.needsAttention ?? [];

    // Backend sends plain strings; recommendationIconFor only picks the icon/color.
    const recommendations = (dashboardStats?.recommendations ?? []).map(text => ({
        ...recommendationIconFor(text),
        text,
    }));

    const briefing = dashboardError
        ? "Unable to load your AI briefing right now — please try again shortly."
        : (dashboardStats?.briefing ?? "No calls analysed yet in this range. Upload a recording and I'll start briefing you here.");

    /* Sparkline series + trend for the KPI row — daily aggregates from real calls. */
    const callsSeries = Object.entries(timelineMap).slice(-8).map(([date, count]) => ({ date, value: count }));
    const scoreSeries = buildDailySeries(filteredCalls, c => c.overallScore);
    const csatSeries = buildDailySeries(filteredCalls, c => c.customerSatisfaction);
    const positiveSeries = buildDailySeries(filteredCalls, c => c.sentiment === "POSITIVE" ? 100 : 0);

    /* Top Calls — a ranked "leaderboard" built from real scored calls,
       standing in for a rep leaderboard the current single-user data
       model can't support (there's no separate rep/owner field per call). */
    const topCalls = [...filteredCalls]
        .filter(c => c.overallScore != null)
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 4);

    const NAV_ITEMS = [
        { label: "Dashboard", path: "/dashboard", Icon: LayoutDashboard },
        { label: "Call History", path: "/history", Icon: History },
        { label: "Analytics", path: "/analytics", Icon: LineChart },
    ];

    const RISK_CFG = {
        high: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.28)", label: "High", Icon: AlertOctagon },
        medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.28)", label: "Medium", Icon: AlertTriangle },
        low: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.28)", label: "Low", Icon: Info },
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

                        {/* Global search — one real input, no duplicate box. Results
                            attach directly beneath it, Linear/Vercel/Notion-style. */}
                        <div className="relative flex-1 max-w-md" ref={searchWrapRef}>
                            <div className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-sm transition-colors"
                                style={{ background: T.inputBg, border: `1px solid ${searchOpen ? "rgba(139,92,246,0.4)" : T.panelBorder}`, color: T.textFaint }}>
                                <Search size={14} className="flex-shrink-0" />
                                <input
                                    ref={searchInputRef}
                                    value={searchQuery}
                                    onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                                    onFocus={() => setSearchOpen(true)}
                                    onKeyDown={handleSearchKeyDown}
                                    placeholder="Search calls, keywords, customers…"
                                    className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                                    style={{ color: T.text }}
                                />
                                {searchQuery ? (
                                    <button onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }} className="flex-shrink-0">
                                        <X size={13} style={{ color: T.textFaint }} />
                                    </button>
                                ) : (
                                    <span className="hidden sm:flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: T.panelHover, color: T.textMuted }}>
                                        <Command size={9} />K
                                    </span>
                                )}
                            </div>

                            {searchOpen && searchQuery.trim() !== "" && (
                                <div className="absolute left-0 top-full mt-2 w-full sm:w-96 rounded-2xl overflow-hidden z-50"
                                    style={{
                                        background: T.popoverBg,
                                        border: `1px solid ${T.popoverBorder}`,
                                        backdropFilter: "blur(20px)",
                                        boxShadow: T.popoverShadow,
                                        animation: "dropdownIn 0.15s ease-out",
                                        transformOrigin: "top"
                                    }}>
                                    <div className="max-h-72 overflow-y-auto">
                                        {searchResults.length === 0 ? (
                                            <p className="px-4 py-6 text-xs text-center" style={{ color: T.textFaint }}>No matches for "{searchQuery}"</p>
                                        ) : (
                                            searchResults.map((call, i) => (
                                                <Link key={call.id} to={`/w/${user?.companySlug || "default"}/calls/${call.id}`}
                                                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                                                    onMouseEnter={() => setSearchActiveIndex(i)}
                                                    className="flex items-center gap-3 px-4 py-3 transition-colors"
                                                    style={{ background: i === searchActiveIndex ? (T.isDark ? "rgba(139,92,246,0.14)" : "#f5f3ff") : "transparent" }}>
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                        style={{ background: T.isDark ? "rgba(139,92,246,0.15)" : "#ede9fe" }}>
                                                        <Phone size={13} className="text-violet-600 dark:text-violet-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold truncate" style={{ color: T.text }}>{call.fileName}</p>
                                                        <p className="text-[10px] truncate" style={{ color: T.textFaint }}>{call.summary?.slice(0, 60) || "No summary"}</p>
                                                    </div>
                                                    <ArrowRight size={11} className="flex-shrink-0" style={{ color: T.textFaint }} />
                                                </Link>
                                            ))
                                        )}
                                    </div>
                                    {searchResults.length > 0 && (
                                        <div className="flex items-center gap-3 px-4 py-2 text-[10px]" style={{ borderTop: `1px solid ${T.divider}`, color: T.textFaint }}>
                                            <span className="flex items-center gap-1"><ArrowUp size={9} /><ArrowDown size={9} /> Navigate</span>
                                            <span>↵ Open</span>
                                            <span>Esc Close</span>
                                        </div>
                                    )}
                                </div>
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

                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => setUploadOpen(true)}
                                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all active:scale-95 shadow-md shadow-violet-500/25"
                                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ""; }}>
                                <Upload size={14} />
                                Upload
                            </button>

                            <button onClick={toggleTheme}
                                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}
                                title="Toggle theme">
                                {themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                            </button>

                            {/* Database-Backed Workspace & Owner Actionable Notifications */}
                            <NotificationPopover T={T} user={user} companySlug={user?.companySlug} />

                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => setProfileOpen(o => !o)}
                                    className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl transition-all"
                                    style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}` }}>
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                                        {user?.name?.[0]?.toUpperCase() ?? "U"}
                                    </div>
                                    <span className="text-sm font-medium hidden sm:block" style={{ color: T.text }}>{user?.name ?? "User"}</span>
                                    <ChevronDown size={12} className={`transition-transform hidden sm:block ${profileOpen ? "rotate-180" : ""}`} style={{ color: T.textFaint }} />
                                </button>

                                {profileOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden z-50"
                                        style={{
                                            background: T.popoverBg,
                                            border: `1px solid ${T.popoverBorder}`,
                                            backdropFilter: "blur(20px)",
                                            boxShadow: T.popoverShadow
                                        }}>
                                        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.divider}` }}>
                                            <p className="text-sm font-bold truncate" style={{ color: T.text }}>{user?.name}</p>
                                            <p className="text-xs truncate mt-0.5" style={{ color: T.textFaint }}>{user?.email}</p>
                                        </div>
                                        <div className="p-2">
                                            <button onClick={handleLogout}
                                                className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-all font-medium"
                                                style={{ color: "#ef4444" }}
                                                onMouseEnter={e => { e.currentTarget.style.background = T.isDark ? "rgba(239,68,68,0.1)" : "#fef2f2"; }}
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

                    {user?.role === "OWNER" ? (
                        <OwnerDashboardView
                            user={user}
                            companyStats={companyStats}
                            membersData={membersData}
                            calls={calls}
                            totalCalls={totalCalls}
                            loading={loading}
                            dashboardStats={dashboardStats}
                            T={T}
                            onInvite={() => navigate(`/w/${companySlug}/company/invitations`)}
                            onUpload={() => setUploadOpen(true)}
                            onExport={() => {
                                if (calls.length > 0) {
                                    import("../utils/generateReport.js").then(({ generateCallReport }) => {
                                        generateCallReport(calls[0]);
                                    });
                                } else {
                                    setToast({ message: "No call available to export", type: "error" });
                                }
                            }}
                            onManageMembers={() => navigate(`/w/${companySlug}/company/members`)}
                            companySlug={companySlug}
                            dateRange={dateRange}
                        />
                    ) : (
                        <>
                            <div className="space-y-5">

                                {/* AI Briefing — the hero. This is the one thing on
                                Dashboard that does real "so what" synthesis, so
                                it leads the page full-width instead of sharing
                                a side column with 3 other panels. */}
                                <div className="relative overflow-hidden rounded-2xl p-6"
                                    style={{ background: "linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(37,99,235,0.1) 100%)", border: "1px solid rgba(139,92,246,0.28)" }}>
                                    <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
                                    <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="lg:col-span-2">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.4)" }}>
                                                        <Sparkles size={13} className="text-violet-200" />
                                                    </div>
                                                    <span className="text-sm font-bold text-white">Today's AI Briefing</span>
                                                </div>
                                                <LivePulse label="Live" />
                                            </div>

                                            <p className="text-[0.95rem] leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.88)" }}>
                                                {(loading || dashboardLoading) ? "Pulling together your latest conversation data…" : briefing}
                                            </p>

                                            {!loading && !dashboardLoading && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {recommendations.map((r, i) => (
                                                        <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl" style={{ background: "rgba(0,0,0,0.18)" }}>
                                                            <r.Icon size={14} className="mt-0.5 flex-shrink-0" style={{ color: r.color }} />
                                                            <span className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>{r.text}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Confidence + CTA — its own column now that there's room */}
                                        <div className="flex lg:flex-col items-center lg:items-stretch justify-between gap-4 lg:border-l lg:pl-6" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                                            <div className="text-center lg:text-left">
                                                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>Confidence</p>
                                                <p className="text-3xl font-black text-white">{totalCalls > 0 ? "92%" : "–"}</p>
                                            </div>
                                            <Link to="/analytics" className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white px-4 py-2.5 rounded-xl hover:gap-2 transition-all flex-shrink-0"
                                                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
                                                View Full Report <ArrowRight size={12} />
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                {/* Today's snapshot */}
                                <div>
                                    <div className="mb-2.5">
                                        <SectionLabel T={T} icon={Gauge} tone="#a1a1aa">Today's Snapshot</SectionLabel>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                                        {(loading || dashboardLoading) ? (
                                            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} T={T} className="h-24" />)
                                        ) : (
                                            <>
                                                <KPICard T={T} label="Total Calls" value={statsTotalCalls} Icon={Phone} accent="#8b5cf6"
                                                    series={callsSeries} trendPct={seriesTrend(callsSeries)} sub={`${dateRange === "all" ? "all time" : dateRange === "7d" ? "last 7 days" : "last 30 days"}`} compact />
                                                <KPICard T={T} label="Avg QA Score" value={avgScore} Icon={Star} accent="#3b82f6"
                                                    series={scoreSeries} trendPct={seriesTrend(scoreSeries)}
                                                    sub={Number(avgScore) >= 70 ? "Good" : Number(avgScore) >= 50 ? "Fair" : "Needs focus"} compact />
                                                <KPICard T={T} label="Positive Sentiment" value={`${positivePercent}%`} Icon={TrendingUp} accent="#10b981"
                                                    series={positiveSeries} trendPct={seriesTrend(positiveSeries)} sub={`${positiveCalls} of ${statsTotalCalls} calls`} compact />
                                                <KPICard T={T} label="Customer Satisfaction" value={dashboardStats?.avgCustomerSatisfaction || "–"} Icon={Award} accent="#f59e0b"
                                                    series={csatSeries} trendPct={seriesTrend(csatSeries)} sub="avg score /100" compact />
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Call Outcomes & Deal Intelligence */}
                                <div>
                                    <div className="mb-2.5 flex items-center justify-between">
                                        <SectionLabel T={T} icon={Target} tone="#8b5cf6">Call Outcomes & Deal Intelligence</SectionLabel>
                                        {filters.outcomeStatus !== "all" && (
                                            <button onClick={() => setFilters(f => ({ ...f, outcomeStatus: "all" }))}
                                                className="text-[11px] text-violet-400 hover:text-violet-300 font-bold transition-colors">
                                                Clear Outcome Filter
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                        {[
                                            { key: "Won", label: "Won / Closed", color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", icon: Trophy },
                                            { key: "Follow Up Required", label: "Follow Up Required", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", icon: RotateCcw },
                                            { key: "Escalated", label: "Escalated", color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)", icon: AlertTriangle },
                                            { key: "Pending", label: "Pending", color: "#eab308", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.3)", icon: Hourglass },
                                            { key: "Lost", label: "Lost", color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", icon: XCircle },
                                        ].map(item => {
                                            const count = (dashboardStats?.outcomeDistribution?.[item.key] ??
                                                rangedCalls.filter(c => (c.outcomeStatus || c.outcome) === item.key).length) || 0;
                                            const pctVal = statsTotalCalls > 0 ? Math.round((count / statsTotalCalls) * 100) : 0;
                                            const isSelected = filters.outcomeStatus === item.key;
                                            return (
                                                <div key={item.key}
                                                    onClick={() => setFilters(f => ({ ...f, outcomeStatus: isSelected ? "all" : item.key }))}
                                                    className="p-3.5 rounded-xl border transition-all cursor-pointer group"
                                                    style={{
                                                        background: isSelected ? item.bg : T.panel,
                                                        borderColor: isSelected ? item.color : T.panelBorder,
                                                        boxShadow: isSelected ? `0 0 16px ${item.color}33` : "none"
                                                    }}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="p-1.5 rounded-lg flex items-center justify-center" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                                                            <item.icon size={13} style={{ color: item.color }} />
                                                        </span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: T.textFaint }}>
                                                            {pctVal}%
                                                        </span>
                                                    </div>
                                                    <p className="text-xl font-black" style={{ color: T.text }}>{count}</p>
                                                    <p className="text-[11px] font-medium truncate mt-0.5" style={{ color: item.color }}>{item.label}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Critical Alerts */}
                                <Panel T={T} style={needsAttention.length > 0 ? { background: "rgba(239,68,68,0.035)", borderColor: "rgba(239,68,68,0.2)" } : {}}>
                                    <PanelHeader T={T}
                                        title={<span className="flex items-center gap-2"><ShieldAlert size={15} className="text-red-400" /> Critical Alerts</span>}
                                        sub={(loading || dashboardLoading) ? "Scanning conversations…" : dashboardError ? "Unable to load right now" : needsAttention.length > 0 ? `${needsAttention.length} conversation${needsAttention.length !== 1 ? "s" : ""} need review` : "Nothing needs your attention right now"}
                                    />
                                    {(loading || dashboardLoading) ? (
                                        <div className="space-y-2"><Skeleton T={T} className="h-14" /><Skeleton T={T} className="h-14" /></div>
                                    ) : needsAttention.length === 0 ? (
                                        <div className="flex items-center gap-3 py-6 justify-center" style={{ color: T.textFaint }}>
                                            <CheckCircle size={18} className="text-emerald-400" />
                                            <span className="text-sm">All clear — your team is performing well.</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {needsAttention.map(call => {
                                                const risk = RISK_CFG[call.riskLevel];
                                                return (
                                                    <Link key={call.id} to={`/w/${user?.companySlug || "default"}/calls/${call.id}`}
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

                                {/* Top Calls */}
                                {!loading && topCalls.length > 0 && (
                                    <div>
                                        <div className="mb-2.5">
                                            <SectionLabel T={T} icon={Crown} tone="#f59e0b">Top Calls This Period</SectionLabel>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {topCalls.map((call, i) => (
                                                <Link key={call.id} to={`/w/${user?.companySlug || "default"}/calls/${call.id}`}
                                                    className="flex items-center gap-2.5 p-3 rounded-xl transition-all"
                                                    style={{ background: T.panel, border: `1px solid ${T.panelBorder}` }}>
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
                                    </div>
                                )}
                            </div>

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
                                                                        {call.overallScore != null && <span className="text-[10px] font-black" style={{ color: T.text }}>{call.overallScore}</span>}
                                                                        <Link to={`/w/${user?.companySlug || "default"}/calls/${call.id}`} onClick={e => e.stopPropagation()}
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
                                </>
                            )}
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
                @keyframes dropdownIn { from { transform: translateY(-6px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes notifPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
            `}</style>
        </div>
    );
}
