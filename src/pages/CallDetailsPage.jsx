import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../services/api.js";
import logo from "../assets/CONVEXA_AI_logo.png";
import AudioPlayer from "../components/AudioPlayer.jsx";
import { parseInsights } from "../utils/insightsFormatter.js";
import { generateCallReport } from "../utils/generateReport.js";
import {
    Smile, Frown, Meh, Trophy, XCircle, RotateCcw, AlertTriangle,
    Hourglass, Circle, Target, ClipboardList, FileText, Clock,
    BarChart3, ArrowLeft, Phone, Lightbulb, CheckSquare, Check,
    Flag, CheckCircle, TrendingUp, MessageSquare, CheckCircle2,
    Zap, Brain, KeyRound, X, Sparkles, Download, Share2, RefreshCw,
    Search, Copy, CopyCheck, Gauge, ShieldAlert, Rocket,
    ThumbsUp, AlertOctagon, ListChecks, ChevronRight, Radio,
    FileBarChart, HeartHandshake, Compass,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES — unchanged business logic
// ─────────────────────────────────────────────────────────────────────────────

function parseList(str) {
    if (!str) return [];
    // Try JSON array parse first (new format)
    if (str.trim().startsWith("[")) {
        try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) {
                return parsed.map(s => String(s).trim()).filter(Boolean);
            }
        } catch {
            // fall through to legacy split
        }
    }
    // Legacy format: comma or newline separated string (old records)
    return str.split(/,|\n/).map(s => s.replace(/^[\s*\-•]+/, "").trim()).filter(Boolean);
}

const SENT_CONFIG = {
    POSITIVE: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", label: "Positive", icon: Smile },
    NEGATIVE: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: "Negative", icon: Frown },
    NEUTRAL:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "Neutral",  icon: Meh },
};

// ─────────────────────────────────────────────────────────────────────────────
// New-field utilities (outcome, action items, risk flags, etc.) — unchanged
// ─────────────────────────────────────────────────────────────────────────────

function parseJSONArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value; // already parsed (defensive)
    if (typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

const OUTCOME_CONFIG = {
    "Won":                  { color: "#10b981", bg: "rgba(16,185,129,0.14)",  border: "rgba(16,185,129,0.35)",  icon: Trophy },
    "Lost":                 { color: "#ef4444", bg: "rgba(239,68,68,0.14)",   border: "rgba(239,68,68,0.35)",   icon: XCircle },
    "Follow Up Required":   { color: "#f59e0b", bg: "rgba(245,158,11,0.14)",  border: "rgba(245,158,11,0.35)",  icon: RotateCcw },
    "Escalated":            { color: "#f97316", bg: "rgba(249,115,22,0.14)", border: "rgba(249,115,22,0.35)",  icon: AlertTriangle },
    "Pending":              { color: "#f59e0b", bg: "rgba(245,158,11,0.14)",  border: "rgba(245,158,11,0.35)",  icon: Hourglass },
};
const OUTCOME_FALLBACK = { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)", icon: Circle };

const INTENT_CONFIG = {
    "High":   { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
    "Medium": { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
    "Low":    { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
    "None":   { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)" },
    "N/A":    { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)" },
};
const INTENT_FALLBACK = INTENT_CONFIG["N/A"];

const RISK_SEVERITY_CONFIG = {
    High:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)"  },
    Medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
    Low:    { color: "#eab308", bg: "rgba(234,179,8,0.1)",  border: "rgba(234,179,8,0.3)"  },
};
const RISK_SEVERITY_FALLBACK = { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" };

/** Icon chosen for a parsed insight section by key — presentational only, replaces emoji. */
const INSIGHT_ICONS = {
    summary: ClipboardList, overview: ClipboardList, recommendation: Compass,
    recommendations: Compass, risk: ShieldAlert, risks: ShieldAlert,
    opportunity: Rocket, opportunities: Rocket, strength: ThumbsUp, strengths: ThumbsUp,
    improvement: Zap, improvements: Zap, trend: TrendingUp, trends: TrendingUp,
    performance: Gauge, sentiment: HeartHandshake, next: ArrowLeft, action: ListChecks,
};
function insightIcon(key) {
    const k = String(key || "").toLowerCase();
    return INSIGHT_ICONS[k] || Sparkles;
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN-SYSTEM PRIMITIVES — visual language shared with the Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, children, tone = "#8b5cf6" }) {
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

function GlassCard({ children, tone = "rgba(255,255,255,0.1)", bg = "rgba(255,255,255,0.05)", className = "", style = {} }) {
    return (
        <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${className}`}
            style={{ background: bg, borderColor: tone, ...style }}>
            {children}
        </div>
    );
}

function ScoreRing({ score, size = 80, stroke = 7, color = "#8b5cf6" }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const pct = Math.min((score || 0) / 100, 1);
    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
                style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 6px ${color}80)` }} />
            <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
                fill="white" fontSize={size * 0.22} fontWeight="800"
                style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%", fontFamily: "inherit" }}>
                {score ?? "–"}
            </text>
        </svg>
    );
}

function HighlightedText({ text, query }) {
    if (!query.trim()) return <span className="whitespace-pre-wrap">{text}</span>;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return (
        <span className="whitespace-pre-wrap">
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase()
                    ? <mark key={i} className="rounded px-0.5" style={{ background: "rgba(139,92,246,0.35)", color: "#e9d5ff" }}>{part}</mark>
                    : part
            )}
        </span>
    );
}

/** Small stat chip used across the hero and metadata rows. */
function StatChip({ icon: Icon, label, value, color = "#94a3b8" }) {
    if (value == null || value === "") return null;
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
            {Icon && <Icon size={13} style={{ color }} strokeWidth={2.25} />}
            <div className="leading-tight">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="text-xs font-bold text-slate-200">{value}</p>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION TIMELINE — logic unchanged, visuals refreshed
// ─────────────────────────────────────────────────────────────────────────────

function parseTime(ts) {
    if (!ts) return 0;
    const parts = String(ts).split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
}

const PHASE_COLORS = [
    "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b",
    "#ec4899", "#06b6d4", "#f97316", "#a3e635",
];

/**
 * TimelinePanel — unchanged props/behavior.
 */
function TimelinePanel({ timeline, loading, error, currentSec, onSeek }) {
    const activeIdx = timeline.reduce((acc, seg, i) => {
        const s = parseTime(seg.time);
        return s <= currentSec ? i : acc;
    }, 0);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
                <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
                <p className="text-slate-400 text-xs">Building timeline…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2.5 p-4 rounded-xl border border-red-500/20 bg-red-500/8">
                <AlertTriangle className="text-red-400 w-5 h-5 flex-shrink-0" />
                <div>
                    <p className="text-sm text-red-400 font-semibold">Timeline unavailable</p>
                    <p className="text-xs text-slate-500 mt-0.5">{error}</p>
                </div>
            </div>
        );
    }

    if (!timeline || timeline.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500 text-sm">
                <ClipboardList className="w-8 h-8" />
                <span>No timeline generated</span>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-[22px] top-3 bottom-3 w-px"
                style={{ background: "linear-gradient(180deg, rgba(139,92,246,0.5) 0%, rgba(59,130,246,0.2) 100%)" }} />

            <div className="space-y-1">
                {timeline.map((seg, i) => {
                    const isActive  = i === activeIdx;
                    const isPast    = i < activeIdx;
                    const color     = PHASE_COLORS[i % PHASE_COLORS.length];
                    const startSec  = parseTime(seg.time);

                    const nextSec = i + 1 < timeline.length ? parseTime(timeline[i + 1].time) : null;
                    const durSec  = nextSec !== null ? nextSec - startSec : null;
                    const durFmt  = durSec !== null
                        ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, "0")}`
                        : null;

                    return (
                        <button
                            key={i}
                            onClick={() => onSeek(startSec)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group
                                ${isActive
                                    ? "bg-violet-500/15 border border-violet-500/30 shadow-sm"
                                    : "border border-transparent hover:bg-white/5 hover:border-white/8"}`}
                        >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-all
                                ${isActive ? "shadow-lg" : ""}`}
                                style={{
                                    background: isActive ? color : isPast ? `${color}40` : "rgba(255,255,255,0.06)",
                                    border: `1.5px solid ${isActive ? color : isPast ? `${color}60` : "rgba(255,255,255,0.12)"}`,
                                    boxShadow: isActive ? `0 0 10px ${color}60` : "none",
                                }}>
                                {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                                        style={{ background: color }} />
                                )}
                            </div>

                            <span className="text-xs font-mono font-bold flex-shrink-0 w-10"
                                style={{ color: isActive ? color : isPast ? `${color}80` : "#475569" }}>
                                {seg.time}
                            </span>

                            <span className={`text-sm font-medium flex-1 min-w-0 truncate transition-colors
                                ${isActive ? "text-white" : isPast ? "text-slate-500" : "text-slate-400 group-hover:text-slate-200"}`}>
                                {seg.title}
                            </span>

                            {durFmt && (
                                <span className="text-xs text-slate-600 font-mono flex-shrink-0">{durFmt}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function CallDetailsPage() {
    const { id }        = useParams();
    const navigate      = useNavigate();

    const [call, setCall]               = useState(null);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState(null);
    const [transcriptQuery, setTranscriptQuery] = useState("");
    const [activeTab, setActiveTab]     = useState("overview");

    // ── Timeline state (unchanged) ─────────────────────────────────────────
    const [timeline, setTimeline]           = useState([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineError, setTimelineError] = useState(null);

    // ── Audio player seek bridge ───────────────────────────────────────────
    const seekRef = useRef(null);

    // ── PDF report state ───────────────────────────────────────────────────
    const [reportLoading, setReportLoading] = useState(false);

    // ── Audio current time (lifted from AudioPlayer via callback) ──────────
    const [audioCurrentSec, setAudioCurrentSec] = useState(0);

    // ── Presentation-only additions: do not affect data, routing, or API ───
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedTranscript, setCopiedTranscript] = useState(false);

    useEffect(() => {
        api.get(`/api/calls/${id}`)
            .then(r => {
                const data = r.data;
                setCall(data);

                if (data.timeline) {
                    try {
                        const parsed = JSON.parse(data.timeline);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setTimeline(parsed);
                        } else {
                            setTimeline(buildFallbackTimeline(data.transcript));
                        }
                    } catch {
                        setTimeline(buildFallbackTimeline(data.transcript));
                    }
                } else {
                    setTimeline(buildFallbackTimeline(data.transcript));
                }
            })
            .catch(() => setError("Could not load call details."))
            .finally(() => setLoading(false));
    }, [id]);

    /**
     * Fallback timeline generator — unchanged from the original implementation.
     */
    function buildFallbackTimeline(transcript) {
        if (!transcript) return [];

        const PHASES = [
            { keywords: ["hello","hi","good morning","good afternoon","good evening","welcome","how can i"], title: "Greeting" },
            { keywords: ["problem","issue","trouble","not working","error","complaint","concern","unable"], title: "Customer Problem" },
            { keywords: ["let me check","looking into","verify","account","searching"], title: "Investigation" },
            { keywords: ["solution","can help","i can","fix","resolve","offer","provide","discount","waive"], title: "Solution Discussion" },
            { keywords: ["payment","billing","charge","invoice","refund","credit"], title: "Payment / Billing" },
            { keywords: ["escalat","transfer","supervisor","manager"], title: "Escalation" },
            { keywords: ["anything else","is there anything","satisfied","happy","resolved","closed"], title: "Call Closure" },
        ];

        const words    = transcript.split(/\s+/);
        const WPM      = 150;
        const timeline = [];
        let   lastIdx  = -1;

        PHASES.forEach(phase => {
            const phaseWords = phase.keywords;
            for (let wi = 0; wi < words.length; wi++) {
                const chunk = words.slice(wi, wi + 6).join(" ").toLowerCase();
                if (phaseWords.some(kw => chunk.includes(kw))) {
                    if (wi > lastIdx + 30) {
                        const totalSec = Math.round((wi / WPM) * 60);
                        const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
                        const ss = String(totalSec % 60).padStart(2, "0");
                        timeline.push({ time: `${mm}:${ss}`, title: phase.title });
                        lastIdx = wi;
                        break;
                    }
                }
            }
        });

        if (timeline.length === 0 || timeline[0].time !== "00:00") {
            timeline.unshift({ time: "00:00", title: "Opening" });
        }

        return timeline;
    }

    // ── Download PDF report (unchanged) ────────────────────────────────────
    const handleDownloadReport = async () => {
        if (!call) return;
        setReportLoading(true);
        try {
            const { generateCallReport } = await import("../utils/generateReport.js");
            generateCallReport(call);
        } catch (err) {
            console.error("Report generation failed:", err);
            alert("Could not generate report. Please make sure jsPDF is installed:\n\nnpm install jspdf");
        } finally {
            setReportLoading(false);
        }
    };

    // ── Presentation-only: copy the current page URL to the clipboard ──────
    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 1800);
        } catch {
            /* clipboard unavailable — no-op */
        }
    };

    // ── Presentation-only: copy the raw transcript text ─────────────────────
    const handleCopyTranscript = async () => {
        if (!call?.transcript) return;
        try {
            await navigator.clipboard.writeText(call.transcript);
            setCopiedTranscript(true);
            setTimeout(() => setCopiedTranscript(false), 1800);
        } catch {
            /* clipboard unavailable — no-op */
        }
    };

    // ── Tab change handler (unchanged) ─────────────────────────────────────
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
    };

    // ── Seek the AudioPlayer to a given second (unchanged) ─────────────────
    const handleTimelineSeek = (seconds) => {
        if (seekRef.current) {
            seekRef.current(seconds);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white"
                style={{ background: "linear-gradient(160deg, #05060A 0%, #0B1020 45%, #070912 100%)" }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Loading call details…</p>
                </div>
            </div>
        );
    }

    if (error || !call) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white"
                style={{ background: "linear-gradient(160deg, #05060A 0%, #0B1020 45%, #070912 100%)" }}>
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 mb-4 mx-auto text-amber-400" />
                    <p className="text-slate-300 mb-4">{error || "Call not found"}</p>
                    <button onClick={() => navigate(-1)}
                        className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all">
                        Go back
                    </button>
                </div>
            </div>
        );
    }

    const sentCfg    = SENT_CONFIG[call.sentiment] || SENT_CONFIG.NEUTRAL;
    const SentIcon   = sentCfg.icon;
    const strengths  = parseList(call.strengths);
    const improvements = parseList(call.improvements);
    const keywords   = parseList(call.keywords);
    const insights   = parseInsights(call.insights);
    const outcomeCfg = call.outcomeStatus ? (OUTCOME_CONFIG[call.outcomeStatus] || OUTCOME_FALLBACK) : null;

    const TABS = [
        { id: "overview",    label: "Overview",   icon: ClipboardList, tone: "#8b5cf6" },
        { id: "transcript",  label: "Transcript", icon: FileText,      tone: "#3b82f6" },
        { id: "timeline",    label: "Timeline",   icon: Clock,         tone: "#06b6d4" },
        { id: "scores",      label: "Analytics",  icon: BarChart3,     tone: "#10b981" },
    ];

    return (
        <div className="min-h-screen text-white"
            style={{ background: "linear-gradient(160deg, #05060A 0%, #0B1020 45%, #070912 100%)" }}>

            <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

            {/* ── NAV ── */}
            <header className="sticky top-0 z-40 border-b border-white/8 backdrop-blur-xl"
                style={{ background: "rgba(5,6,10,0.82)" }}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
                    <Link to="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 mr-2">
                        <img src={logo} alt="Convexa AI" className="h-7 w-auto" />
                        <span className="text-base font-black tracking-tight hidden sm:block">
                            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Convexa</span>
                            <span className="text-white ml-1">AI</span>
                        </span>
                    </Link>

                    <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 min-w-0 flex-1">
                        <Link to="/dashboard" className="hover:text-violet-400 transition-colors">Dashboard</Link>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
                        <Link to="/history" className="hover:text-violet-400 transition-colors">History</Link>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
                        <span className="text-slate-300 truncate max-w-[120px] sm:max-w-[160px] md:max-w-xs">{call.fileName}</span>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={handleCopyLink}
                            title="Copy link to this call"
                            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all
                                border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 active:scale-95">
                            {copiedLink ? <CopyCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                            <span className="hidden md:inline">{copiedLink ? "Link copied" : "Share"}</span>
                        </button>

                        <button
                            onClick={handleDownloadReport}
                            disabled={reportLoading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95
                                disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 2px 16px rgba(124,58,237,0.3)" }}>
                            {reportLoading ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span className="hidden sm:inline">Generating…</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Export PDF</span>
                                </>
                            )}
                        </button>

                        <button onClick={() => navigate(-1)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400
                                hover:text-white hover:bg-white/8 border border-white/8 transition-all">
                            <ArrowLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Back</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

                {/* ── HERO ── */}
                <div className="relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-7"
                    style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(59,130,246,0.08) 55%, rgba(6,182,212,0.06) 100%)" }}>
                    <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none"
                        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)" }} />

                    <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
                        <div className="flex items-start gap-4 min-w-0 flex-1">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0"
                                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 8px 24px rgba(124,58,237,0.35)" }}>
                                {call.fileName?.[0]?.toUpperCase() ?? "C"}
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                        style={{ background: "rgba(139,92,246,0.15)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.25)" }}>
                                        Call Command Center
                                    </span>
                                    {call.sentiment && (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                                            style={{ background: sentCfg.bg, color: sentCfg.color, border: `1px solid ${sentCfg.border}` }}>
                                            <SentIcon className="w-3.5 h-3.5" /> {sentCfg.label}
                                        </span>
                                    )}
                                    {outcomeCfg && call.outcomeStatus && (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                                            style={{ background: outcomeCfg.bg, color: outcomeCfg.color, border: `1px solid ${outcomeCfg.border}` }}>
                                            <outcomeCfg.icon className="w-3.5 h-3.5" /> {call.outcomeStatus}
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-xl md:text-2xl font-black text-white truncate">{call.fileName}</h1>
                                <p className="text-sm text-slate-400 mt-1">
                                    {call.createdAt
                                        ? new Date(call.createdAt).toLocaleString("en-US", {
                                            weekday: "long", year: "numeric", month: "long",
                                            day: "numeric", hour: "2-digit", minute: "2-digit",
                                          })
                                        : "Unknown date"}
                                </p>

                                <div className="flex flex-wrap gap-2 mt-3.5">
                                    <StatChip icon={Phone} label="Call Type" value={call.callType} color="#60a5fa" />
                                    {call.buyingIntent && (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                                            style={{ background: (INTENT_CONFIG[call.buyingIntent] || INTENT_FALLBACK).bg, borderColor: (INTENT_CONFIG[call.buyingIntent] || INTENT_FALLBACK).border }}>
                                            <Lightbulb size={13} style={{ color: (INTENT_CONFIG[call.buyingIntent] || INTENT_FALLBACK).color }} />
                                            <div className="leading-tight">
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Buying Intent</p>
                                                <p className="text-xs font-bold" style={{ color: (INTENT_CONFIG[call.buyingIntent] || INTENT_FALLBACK).color }}>{call.buyingIntent}</p>
                                            </div>
                                        </div>
                                    )}
                                    {call.confidence != null && (
                                        <StatChip icon={Target} label="AI Confidence" value={`${Math.max(0, Math.min(100, call.confidence))}%`}
                                            color={call.confidence >= 80 ? "#34d399" : call.confidence >= 50 ? "#fbbf24" : "#f87171"} />
                                    )}
                                </div>
                            </div>
                        </div>

                        {call.overallScore != null && (
                            <div className="flex items-center gap-4 flex-shrink-0 lg:pl-6 lg:border-l lg:border-white/10">
                                <div className="flex flex-col items-center">
                                    <ScoreRing score={call.overallScore} size={84} stroke={6} color="#8b5cf6" />
                                    <p className="text-xs text-slate-400 mt-1.5 font-semibold">Overall Score</p>
                                </div>
                                <button
                                    title="Re-analyze this call (coming soon)"
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all
                                        border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 cursor-default">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Re-analyze</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── AUDIO PLAYER ── */}
                <div className="rounded-2xl border border-white/10 p-4 sm:p-5" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-center gap-2 mb-3">
                        <SectionLabel icon={Radio} tone="#06b6d4">Call Recording</SectionLabel>
                    </div>
                    <AudioPlayerWithBridge
                        cloudinaryUrl={call.cloudinaryUrl}
                        fileName={call.fileName}
                        seekRef={seekRef}
                        onTimeUpdate={setAudioCurrentSec}
                    />
                </div>

                {/* ── TABS ── */}
                <div className="overflow-x-auto pb-1 -mb-1">
                    <div className="flex gap-1 p-1 rounded-2xl border border-white/8 bg-white/3 w-fit min-w-full sm:min-w-0 backdrop-blur-xl">
                        {TABS.map(tab => {
                            const active = activeTab === tab.id;
                            return (
                                <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                                    className="relative px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0"
                                    style={{
                                        color: active ? "#fff" : "#94a3b8",
                                        background: active ? "rgba(255,255,255,0.1)" : "transparent",
                                    }}>
                                    <span className="inline-flex items-center gap-1.5">
                                        <tab.icon className="w-3.5 h-3.5" style={{ color: active ? tab.tone : undefined }} />
                                        {tab.label}
                                    </span>
                                    {active && (
                                        <span className="absolute left-3 right-3 -bottom-[3px] h-[2px] rounded-full"
                                            style={{ background: tab.tone, boxShadow: `0 0 8px ${tab.tone}` }} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── OVERVIEW TAB ── */}
                {activeTab === "overview" && (
                    <div className="space-y-5">
                        {call.summary && (
                            <GlassCard tone="rgba(139,92,246,0.25)" bg="linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.05))" className="p-5">
                                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-2xl pointer-events-none"
                                    style={{ background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)" }} />
                                <div className="relative flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.3)" }}>
                                        <Brain className="w-4 h-4 text-violet-300" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <SectionLabel icon={Sparkles} tone="#a78bfa">AI Executive Summary</SectionLabel>
                                        <p className="text-sm text-slate-200 leading-relaxed mt-3">{call.summary}</p>
                                    </div>
                                </div>
                            </GlassCard>
                        )}

                        {/* ── DEAL INTELLIGENCE ── */}
                        {(call.outcomeStatus || call.callType || call.buyingIntent || call.confidence != null) && (
                            <GlassCard className="p-5">
                                <SectionLabel icon={FileBarChart} tone="#60a5fa">Deal Intelligence</SectionLabel>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 flex-wrap mt-4">
                                    {call.outcomeStatus && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Outcome</p>
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border"
                                                style={{ background: outcomeCfg.bg, color: outcomeCfg.color, borderColor: outcomeCfg.border }}>
                                                <outcomeCfg.icon className="w-3.5 h-3.5" strokeWidth={2.5} />
                                                {call.outcomeStatus}
                                            </span>
                                        </div>
                                    )}

                                    {(call.callType || call.buyingIntent) && (
                                        <div className="flex items-center gap-5 flex-wrap">
                                            {call.callType && (
                                                <div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                        <Phone className="w-3.5 h-3.5" /> Call Type
                                                    </p>
                                                    <span className="text-sm font-semibold text-slate-200">{call.callType}</span>
                                                </div>
                                            )}
                                            {call.buyingIntent && (
                                                <div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                        <Lightbulb className="w-3.5 h-3.5" /> Buying Intent
                                                    </p>
                                                    <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full border"
                                                        style={{
                                                            background: (INTENT_CONFIG[call.buyingIntent] || INTENT_FALLBACK).bg,
                                                            color: (INTENT_CONFIG[call.buyingIntent] || INTENT_FALLBACK).color,
                                                            borderColor: (INTENT_CONFIG[call.buyingIntent] || INTENT_FALLBACK).border,
                                                        }}>
                                                        {call.buyingIntent}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {call.confidence != null && (
                                        <div className="flex-1 min-w-[180px] sm:max-w-xs sm:ml-auto">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Target className="w-3.5 h-3.5" /> AI Confidence
                                                </p>
                                                <span className="text-xs font-bold" style={{ color: call.confidence >= 80 ? "#10b981" : call.confidence >= 50 ? "#f59e0b" : "#ef4444" }}>
                                                    {Math.max(0, Math.min(100, call.confidence))}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                                                <div className="h-2 rounded-full transition-all duration-700"
                                                    style={{ width: `${Math.max(0, Math.min(100, call.confidence))}%`, background: call.confidence >= 80 ? "#10b981" : call.confidence >= 50 ? "#f59e0b" : "#ef4444" }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </GlassCard>
                        )}

                        {/* ── ACTION ITEMS + RISK FLAGS ── */}
                        {(() => {
                            const actionItems = parseJSONArray(call.actionItems);
                            const riskFlags   = parseJSONArray(call.riskFlags);
                            if (actionItems.length === 0 && riskFlags.length === 0) return null;

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {actionItems.length > 0 && (
                                        <GlassCard className="p-5">
                                            <SectionLabel icon={CheckSquare} tone="#a1a1aa">Action Items</SectionLabel>
                                            <ul className="space-y-2.5 mt-4">
                                                {actionItems.map((item, i) => {
                                                    const title     = typeof item === "string" ? item : item?.title;
                                                    const completed = typeof item === "object" && !!item?.completed;
                                                    return (
                                                        <li key={i} className="flex items-start gap-2.5">
                                                            <span className={`mt-0.5 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center text-xs font-bold border
                                                                ${completed
                                                                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                                                    : "bg-white/5 border-white/15 text-slate-500"}`}>
                                                                {completed ? <Check className="w-3.5 h-3.5" /> : ""}
                                                            </span>
                                                            <span className={`text-sm leading-snug ${completed ? "text-slate-500 line-through" : "text-slate-300"}`}>
                                                                {title || "—"}
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </GlassCard>
                                    )}

                                    <GlassCard tone="rgba(245,158,11,0.2)" bg="rgba(245,158,11,0.05)" className="p-5">
                                        <SectionLabel icon={Flag} tone="#fbbf24">Risk Flags</SectionLabel>
                                        {riskFlags.length > 0 ? (
                                            <ul className="space-y-2.5 mt-4">
                                                {riskFlags.map((flag, i) => {
                                                    const severity = typeof flag === "object" ? flag?.severity : null;
                                                    const message  = typeof flag === "string" ? flag : flag?.message;
                                                    const cfg = RISK_SEVERITY_CONFIG[severity] || RISK_SEVERITY_FALLBACK;
                                                    return (
                                                        <li key={i} className="flex items-start gap-2.5 p-3 rounded-xl border"
                                                            style={{ background: cfg.bg, borderColor: cfg.border }}>
                                                            <AlertTriangle className="mt-0.5 flex-shrink-0 w-4 h-4" style={{ color: cfg.color }} />
                                                            <div className="min-w-0">
                                                                {severity && (
                                                                    <span className="block text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: cfg.color }}>
                                                                        {severity} risk
                                                                    </span>
                                                                )}
                                                                <span className="text-sm text-slate-300 leading-snug">{message || "—"}</span>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <div className="flex items-center gap-2.5 py-4 text-slate-500 text-sm mt-2">
                                                <CheckCircle className="text-emerald-400 w-4 h-4" />
                                                <span>No active risks detected.</span>
                                            </div>
                                        )}
                                    </GlassCard>
                                </div>
                            );
                        })()}

                        {/* ── FOLLOW-UP SUGGESTIONS ── */}
                        {(() => {
                            const suggestions = parseJSONArray(call.followUpSuggestions);
                            if (suggestions.length === 0) return null;
                            return (
                                <GlassCard tone="rgba(59,130,246,0.2)" bg="rgba(59,130,246,0.05)" className="p-5">
                                    <SectionLabel icon={Lightbulb} tone="#60a5fa">Follow-Up Suggestions</SectionLabel>
                                    <div className="space-y-2.5 mt-4">
                                        {suggestions.map((s, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl border border-blue-500/15 bg-blue-500/5">
                                                <Lightbulb className="flex-shrink-0 mt-0.5 w-4 h-4 text-blue-400" />
                                                <span className="text-sm text-slate-300 leading-relaxed">{s}</span>
                                            </div>
                                        ))}
                                    </div>
                                </GlassCard>
                            );
                        })()}

                        {/* ── BUYING SIGNALS + OBJECTIONS ── */}
                        {(() => {
                            const buyingSignals = parseJSONArray(call.buyingSignals);
                            const objections    = parseJSONArray(call.objections);
                            if (buyingSignals.length === 0 && objections.length === 0) return null;

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {buyingSignals.length > 0 && (
                                        <GlassCard tone="rgba(16,185,129,0.2)" bg="rgba(16,185,129,0.05)" className="p-5">
                                            <SectionLabel icon={TrendingUp} tone="#34d399">Buying Signals</SectionLabel>
                                            <div className="flex flex-wrap gap-2 mt-4">
                                                {buyingSignals.map((sig, i) => (
                                                    <span key={i}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
                                                        style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)", color: "#6ee7b7" }}>
                                                        <Check className="text-emerald-400 w-3.5 h-3.5" />
                                                        {sig}
                                                    </span>
                                                ))}
                                            </div>
                                        </GlassCard>
                                    )}

                                    {objections.length > 0 && (
                                        <GlassCard className="p-5">
                                            <SectionLabel icon={MessageSquare} tone="#a1a1aa">Objections</SectionLabel>
                                            <ul className="space-y-2.5 mt-4">
                                                {objections.map((obj, i) => {
                                                    const text     = typeof obj === "string" ? obj : obj?.objection;
                                                    const resolved = typeof obj === "object" && !!obj?.resolved;
                                                    return (
                                                        <li key={i} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-white/8 bg-white/4">
                                                            <span className="text-sm text-slate-300 leading-snug min-w-0">{text || "—"}</span>
                                                            <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border
                                                                ${resolved
                                                                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                                                    : "bg-red-500/15 border-red-500/30 text-red-400"}`}>
                                                                {resolved
                                                                    ? <><Check className="w-3 h-3" /> Resolved</>
                                                                    : <><X className="w-3 h-3" /> Unresolved</>}
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </GlassCard>
                                    )}
                                </div>
                            );
                        })()}

                        {(strengths.length > 0 || improvements.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {strengths.length > 0 && (
                                    <GlassCard tone="rgba(16,185,129,0.2)" bg="rgba(16,185,129,0.05)" className="p-5">
                                        <SectionLabel icon={CheckCircle2} tone="#34d399">Strengths</SectionLabel>
                                        <ul className="space-y-2.5 mt-4">
                                            {strengths.map((s, i) => (
                                                <li key={i} className="flex items-start gap-2.5">
                                                    <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 flex-shrink-0
                                                        flex items-center justify-center text-emerald-400 text-xs font-bold"><Check className="w-3 h-3" /></span>
                                                    <span className="text-sm text-slate-300 leading-snug">{s}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </GlassCard>
                                )}
                                {improvements.length > 0 && (
                                    <GlassCard tone="rgba(245,158,11,0.2)" bg="rgba(245,158,11,0.05)" className="p-5">
                                        <SectionLabel icon={Zap} tone="#fbbf24">Improvements</SectionLabel>
                                        <ul className="space-y-2.5 mt-4">
                                            {improvements.map((s, i) => (
                                                <li key={i} className="flex items-start gap-2.5">
                                                    <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/20 flex-shrink-0
                                                        flex items-center justify-center text-amber-400 text-xs font-bold">
                                                        <AlertOctagon className="w-3 h-3" />
                                                    </span>
                                                    <span className="text-sm text-slate-300 leading-snug">{s}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </GlassCard>
                                )}
                            </div>
                        )}

                        {insights.length > 0 && (
                            <GlassCard tone="rgba(59,130,246,0.2)" bg="rgba(59,130,246,0.05)" className="p-5">
                                <SectionLabel icon={Brain} tone="#60a5fa">AI Insights</SectionLabel>
                                {insights[0]?.bullets ? (
                                    <ul className="space-y-2.5 mt-4">
                                        {insights[0].bullets.map((line, i) => (
                                            <li key={i} className="flex items-start gap-2.5">
                                                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                                <span className="text-sm text-slate-300 leading-relaxed">{line}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="space-y-2.5 mt-4">
                                        {insights.map(section => {
                                            const Icon = insightIcon(section.key);
                                            return (
                                                <div key={section.key}
                                                    className="flex items-start gap-3 p-3.5 rounded-xl border"
                                                    style={{ background: section.bg, borderColor: section.border }}>
                                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                                        style={{ background: `${section.color}22`, border: `1px solid ${section.color}45` }}>
                                                        <Icon className="w-3.5 h-3.5" style={{ color: section.color }} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold uppercase tracking-wide mb-1"
                                                            style={{ color: section.color }}>{section.label}</p>
                                                        <p className="text-sm text-slate-300 leading-relaxed">
                                                            {section.value || <span className="text-slate-600 italic">—</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </GlassCard>
                        )}

                        {keywords.length > 0 && (
                            <GlassCard className="p-5">
                                <SectionLabel icon={KeyRound} tone="#a1a1aa">Keywords</SectionLabel>
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {keywords.map((kw, i) => (
                                        <span key={i}
                                            className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-105 cursor-default"
                                            style={{ background: "rgba(139,92,246,0.12)", borderColor: "rgba(139,92,246,0.3)", color: "rgb(196,181,253)" }}>
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </GlassCard>
                        )}
                    </div>
                )}

                {/* ── TRANSCRIPT TAB ── */}
                {activeTab === "transcript" && (
                    <GlassCard>
                        <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-white/8">
                            <SectionLabel icon={FileText} tone="#60a5fa">Transcript</SectionLabel>
                            <div className="flex-1 relative">
                                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search transcript…"
                                    value={transcriptQuery}
                                    onChange={e => setTranscriptQuery(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-9 py-2 text-sm text-white
                                        placeholder-slate-600 focus:outline-none focus:border-violet-500/40 focus:bg-white/8 transition-all"
                                />
                                {transcriptQuery && (
                                    <button onClick={() => setTranscriptQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <button onClick={handleCopyTranscript} disabled={!call.transcript}
                                title="Copy transcript"
                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all
                                    border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-40">
                                {copiedTranscript ? <CopyCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                <span className="hidden sm:inline">{copiedTranscript ? "Copied" : "Copy"}</span>
                            </button>
                        </div>
                        <div className="p-5 max-h-[60vh] overflow-y-auto text-sm text-slate-300 leading-relaxed font-mono"
                            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.4) transparent" }}>
                            {call.transcript
                                ? <HighlightedText text={call.transcript} query={transcriptQuery} />
                                : <span className="text-slate-500 italic">No transcript available</span>}
                        </div>
                    </GlassCard>
                )}

                {/* ── TIMELINE TAB ── */}
                {activeTab === "timeline" && (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                        <GlassCard className="lg:col-span-2 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <SectionLabel icon={Clock} tone="#22d3ee">Conversation Timeline</SectionLabel>
                                {timeline.length > 0 && (
                                    <span className="text-xs text-violet-400 font-bold px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
                                        {timeline.length} phases
                                    </span>
                                )}
                            </div>
                            <TimelinePanel
                                timeline={timeline}
                                loading={timelineLoading}
                                error={timelineError}
                                currentSec={audioCurrentSec}
                                onSeek={handleTimelineSeek}
                            />
                        </GlassCard>

                        <GlassCard className="lg:col-span-3 p-5">
                            <SectionLabel icon={ClipboardList} tone="#a1a1aa">Transcript at Selected Phase</SectionLabel>
                            <div className="mt-4">
                                {timeline.length > 0 ? (
                                    <PhaseTranscript
                                        transcript={call.transcript}
                                        timeline={timeline}
                                        currentSec={audioCurrentSec}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm gap-2">
                                        <Clock className="w-8 h-8" />
                                        <span>Select a phase from the timeline</span>
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </div>
                )}

                {/* ── SCORES / ANALYTICS TAB ── */}
                {activeTab === "scores" && (
                    <div className="space-y-5">
                        {call.overallScore != null && (
                            <GlassCard tone="rgba(139,92,246,0.25)" bg="rgba(139,92,246,0.06)" className="p-6">
                                <div className="flex flex-col sm:flex-row items-center gap-6">
                                    <ScoreRing score={call.overallScore} size={100} stroke={8} color="#8b5cf6" />
                                    <div className="flex-1">
                                        <p className="text-2xl font-black text-white">{call.overallScore} / 100</p>
                                        <p className="text-slate-400 text-sm mt-1">Overall Conversation Quality</p>
                                        <div className="w-full max-w-xs h-2 rounded-full mt-3" style={{ background: "rgba(255,255,255,0.1)" }}>
                                            <div className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-700"
                                                style={{ width: `${call.overallScore}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "Communication",      key: "communication",       color: "#8b5cf6", icon: MessageSquare },
                                { label: "Problem Resolution", key: "problemResolution",   color: "#3b82f6", icon: CheckSquare },
                                { label: "Professionalism",    key: "professionalism",     color: "#10b981", icon: ThumbsUp },
                                { label: "Cust. Satisfaction", key: "customerSatisfaction",color: "#f59e0b", icon: Smile },
                            ].map(({ label, key, color, icon: Icon }) => (
                                <div key={key} className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/4 border border-white/8 hover:border-white/15 transition-all">
                                    <div className="flex items-center gap-1.5 self-start">
                                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                                    </div>
                                    <ScoreRing score={call[key]} size={76} stroke={6} color={color} />
                                    <div className="text-center">
                                        <p className="text-xs text-slate-400 font-medium leading-tight">{label}</p>
                                        {call[key] != null && (
                                            <div className="w-full mt-2 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                                                <div className="h-1 rounded-full transition-all duration-700"
                                                    style={{ width: `${call[key]}%`, background: color }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <GlassCard className="p-5">
                            <SectionLabel icon={Gauge} tone="#a1a1aa">Score Breakdown</SectionLabel>
                            <div className="space-y-3 mt-4">
                                {[
                                    { label: "Overall",               val: call.overallScore,         color: "#8b5cf6" },
                                    { label: "Communication",         val: call.communication,        color: "#8b5cf6" },
                                    { label: "Problem Resolution",    val: call.problemResolution,    color: "#3b82f6" },
                                    { label: "Professionalism",       val: call.professionalism,      color: "#10b981" },
                                    { label: "Customer Satisfaction", val: call.customerSatisfaction, color: "#f59e0b" },
                                ].map(({ label, val, color }) => (
                                    <div key={label} className="flex items-center gap-3">
                                        <span className="w-28 sm:w-40 text-xs text-slate-400 text-right flex-shrink-0">{label}</span>
                                        <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                                            <div className="h-2 rounded-full transition-all duration-700"
                                                style={{ width: `${val || 0}%`, background: color }} />
                                        </div>
                                        <span className="w-8 text-xs font-bold text-white text-right">{val ?? "–"}</span>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    </div>
                )}
            </main>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(24px); opacity: 0; }
                    to   { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIOPLAYER BRIDGE — unchanged
// ─────────────────────────────────────────────────────────────────────────────

function AudioPlayerWithBridge({ cloudinaryUrl, fileName, seekRef, onTimeUpdate }) {
    const probeRef = useRef(null);

    useEffect(() => {
        seekRef.current = (seconds) => {
            if (!cloudinaryUrl) return;
            const expected = cloudinaryUrl.toLowerCase();
            const allAudio = Array.from(document.querySelectorAll("audio"));
            const target   = allAudio.find(a => {
                try { return new URL(a.src).href.toLowerCase() === expected; } catch { return false; }
            }) || allAudio[0];

            if (target) {
                target.currentTime = seconds;
                target.play().catch(() => {});
            }
        };
    }, [cloudinaryUrl, seekRef]);

    useEffect(() => {
        let raf;
        function poll() {
            if (!cloudinaryUrl) return;
            const expected = cloudinaryUrl.toLowerCase();
            const allAudio = Array.from(document.querySelectorAll("audio"));
            const target   = allAudio.find(a => {
                try { return new URL(a.src).href.toLowerCase() === expected; } catch { return false; }
            }) || allAudio[0];

            if (target) onTimeUpdate(target.currentTime || 0);
            raf = requestAnimationFrame(poll);
        }
        raf = requestAnimationFrame(poll);
        return () => cancelAnimationFrame(raf);
    }, [cloudinaryUrl, onTimeUpdate]);

    return <AudioPlayer cloudinaryUrl={cloudinaryUrl} fileName={fileName} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE TRANSCRIPT — unchanged
// ─────────────────────────────────────────────────────────────────────────────

function PhaseTranscript({ transcript, timeline, currentSec }) {
    if (!transcript || !timeline.length) return null;

    const activeIdx = timeline.reduce((acc, seg, i) => {
        const s = parseTime(seg.time);
        return s <= currentSec ? i : acc;
    }, 0);

    const seg     = timeline[activeIdx];
    const color   = PHASE_COLORS[activeIdx % PHASE_COLORS.length];

    const startPct = parseTime(seg.time) / Math.max(parseTime(timeline[timeline.length - 1].time) + 120, 1);
    const endSeg   = timeline[activeIdx + 1];
    const endPct   = endSeg
        ? parseTime(endSeg.time) / Math.max(parseTime(timeline[timeline.length - 1].time) + 120, 1)
        : 1;

    const charStart = Math.floor(startPct * transcript.length);
    const charEnd   = Math.floor(endPct   * transcript.length);
    const snippet   = transcript.slice(charStart, charEnd).trim();

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse"
                    style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <span className="text-sm font-bold text-white">{seg.title}</span>
                <span className="text-xs font-mono text-slate-500">{seg.time}</span>
            </div>
            <div className="rounded-xl bg-white/4 border border-white/8 p-4 max-h-72 overflow-y-auto text-sm text-slate-300 leading-relaxed font-mono"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.4) transparent" }}>
                {snippet || <span className="text-slate-600 italic">Transcript not available for this section</span>}
            </div>
        </div>
    );
}
