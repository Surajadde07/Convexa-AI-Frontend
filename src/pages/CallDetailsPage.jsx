import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../services/api.js";
import logo from "../assets/CONVEXA_AI_logo.png";
import AudioPlayer from "../components/AudioPlayer.jsx";
import { parseInsights } from "../utils/insightsFormatter.js";
import { generateCallReport } from "../utils/generateReport.js";

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function parseList(str) {
    if (!str) return [];
    return str.split(/,|\n/).map(s => s.replace(/^[\s*\-•]+/, "").trim()).filter(Boolean);
}

const SENT_CONFIG = {
    POSITIVE: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", label: "Positive", emoji: "😊" },
    NEGATIVE: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: "Negative", emoji: "😔" },
    NEUTRAL:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "Neutral",  emoji: "😐" },
};

function ScoreRing({ score, size = 80, stroke = 7, color = "#8b5cf6" }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const pct = Math.min((score || 0) / 100, 1);
    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e1b4b" strokeWidth={stroke} />
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round"
                style={{ transition: "stroke-dasharray 1s ease" }} />
            <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
                fill="white" fontSize={size*0.22} fontWeight="700"
                style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%" }}>
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
                    ? <mark key={i} className="bg-violet-500/30 text-violet-200 rounded px-0.5">{part}</mark>
                    : part
            )}
        </span>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse "MM:SS" or "HH:MM:SS" string into total seconds.
 */
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
 * TimelinePanel
 *
 * Props:
 *   timeline   — array of { time: "MM:SS", title: string }
 *   loading    — bool
 *   error      — string | null
 *   currentSec — current audio playback position in seconds
 *   onSeek     — (seconds: number) => void
 */
function TimelinePanel({ timeline, loading, error, currentSec, onSeek }) {
    // Determine active segment: the last segment whose start <= currentSec
    const activeIdx = timeline.reduce((acc, seg, i) => {
        const s = parseTime(seg.time);
        return s <= currentSec ? i : acc;
    }, 0);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
                <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
                <p className="text-slate-400 text-xs">AI is building the timeline…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2.5 p-4 rounded-xl border border-red-500/20 bg-red-500/8">
                <span className="text-red-400 text-lg">⚠️</span>
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
                <span className="text-3xl">📋</span>
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

                    // Duration label: from this seg to next seg (or "end")
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
                            {/* Timeline dot */}
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

                            {/* Timestamp badge */}
                            <span className="text-xs font-mono font-bold flex-shrink-0 w-10"
                                style={{ color: isActive ? color : isPast ? `${color}80` : "#475569" }}>
                                {seg.time}
                            </span>

                            {/* Title */}
                            <span className={`text-sm font-medium flex-1 min-w-0 truncate transition-colors
                                ${isActive ? "text-white" : isPast ? "text-slate-500" : "text-slate-400 group-hover:text-slate-200"}`}>
                                {seg.title}
                            </span>

                            {/* Duration */}
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

    // ── Timeline state ─────────────────────────────────────────────────────
    const [timeline, setTimeline]           = useState([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineError, setTimelineError] = useState(null);
    const [timelineFetched, setTimelineFetched] = useState(false);

    // ── Audio player seek bridge ───────────────────────────────────────────
    // AudioPlayer exposes no imperative API, so we use a shared ref approach:
    // we store a seekTo function that AudioPlayer registers via its onReady prop.
    const seekRef = useRef(null);

    // ── PDF report state ───────────────────────────────────────────────────
    const [reportLoading, setReportLoading] = useState(false);

    // ── Audio current time (lifted from AudioPlayer via callback) ──────────
    const [audioCurrentSec, setAudioCurrentSec] = useState(0);

    useEffect(() => {
        api.get(`/api/calls/${id}`)
            .then(r => setCall(r.data))
            .catch(() => setError("Could not load call details."))
            .finally(() => setLoading(false));
    }, [id]);

    // ── Fetch timeline when tab is first opened ────────────────────────────
    const fetchTimeline = async (transcript) => {
        if (timelineFetched || !transcript) return;
        setTimelineLoading(true);
        setTimelineError(null);
        setTimelineFetched(true);
        try {
            const res = await fetch(`${BASE_URL}/api/calls/timeline`, {
                method:  "POST",
                headers: {
                    "Content-Type":  "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("convexa_token")}`,
                },
                body: JSON.stringify({ transcript }),
            });
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            const data = await res.json();
            // Expected: [{ time: "00:00", title: "Greeting" }, ...]
            setTimeline(Array.isArray(data) ? data : data.timeline || []);
        } catch (err) {
            // Timeline is optional — fall back to a client-side heuristic
            setTimeline(buildFallbackTimeline(transcript));
            setTimelineError(null); // don't show error if fallback succeeded
        } finally {
            setTimelineLoading(false);
        }
    };

    /**
     * Fallback timeline generator — works entirely in the browser when the
     * /api/calls/timeline endpoint is not available yet.
     *
     * Heuristic: scans the transcript for speaker turns and common
     * conversation-phase keywords, assigns rough timestamps based on
     * estimated 150 wpm reading speed.
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
                    if (wi > lastIdx + 30) {   // at least 30 words after previous marker
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

        // Always ensure there's a "00:00 Opening" entry
        if (timeline.length === 0 || timeline[0].time !== "00:00") {
            timeline.unshift({ time: "00:00", title: "Opening" });
        }

        return timeline;
    }

    // ── Download PDF report ────────────────────────────────────────────────
    const handleDownloadReport = async () => {
        if (!call) return;
        setReportLoading(true);
        try {
            // Dynamic import so jsPDF is only loaded when needed
            const { generateCallReport } = await import("../utils/generateReport.js");
            generateCallReport(call);
        } catch (err) {
            console.error("Report generation failed:", err);
            alert("Could not generate report. Please make sure jsPDF is installed:\n\nnpm install jspdf");
        } finally {
            setReportLoading(false);
        }
    };

    // ── Tab change handler — triggers timeline fetch ───────────────────────
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        if (tabId === "timeline" && call?.transcript) {
            fetchTimeline(call.transcript);
        }
    };

    // ── Seek the AudioPlayer to a given second ─────────────────────────────
    const handleTimelineSeek = (seconds) => {
        if (seekRef.current) {
            seekRef.current(seconds);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white"
                style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #0d0b2a 40%, #0a1628 100%)" }}>
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
                style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #0d0b2a 40%, #0a1628 100%)" }}>
                <div className="text-center">
                    <div className="text-5xl mb-4">⚠️</div>
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
    const strengths  = parseList(call.strengths);
    const improvements = parseList(call.improvements);
    const keywords   = parseList(call.keywords);
    const insights   = parseInsights(call.insights);

    const TABS = [
        { id: "overview",    label: "📋 Overview"   },
        { id: "transcript",  label: "📝 Transcript"  },
        { id: "timeline",    label: "⏱ Timeline"    },
        { id: "scores",      label: "📊 Scores"      },
    ];

    return (
        <div className="min-h-screen text-white"
            style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #0d0b2a 40%, #0a1628 100%)" }}>

            <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

            {/* ── NAV ── */}
            <header className="sticky top-0 z-40 border-b border-white/8 backdrop-blur-xl"
                style={{ background: "rgba(10,10,26,0.88)" }}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
                    <Link to="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 mr-2">
                        <img src={logo} alt="Convexa AI" className="h-7 w-auto" />
                        <span className="text-base font-black tracking-tight hidden sm:block">
                            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Convexa</span>
                            <span className="text-white ml-1">AI</span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Link to="/dashboard" className="hover:text-violet-400 transition-colors">Dashboard</Link>
                        <span>/</span>
                        <Link to="/history" className="hover:text-violet-400 transition-colors">History</Link>
                        <span>/</span>
                        <span className="text-slate-300 truncate max-w-40">{call.fileName}</span>
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        {/* ── DOWNLOAD REPORT BUTTON ── */}
                        <button
                            onClick={handleDownloadReport}
                            disabled={reportLoading}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                                border border-white/10 bg-white/5
                                hover:bg-white/10 hover:border-white/20
                                disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}>
                            {reportLoading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    <span className="hidden sm:inline">Generating…</span>
                                </>
                            ) : (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7 10 12 15 17 10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                    <span className="hidden sm:inline">Download Report</span>
                                </>
                            )}
                        </button>

                        <button onClick={() => navigate(-1)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-slate-400
                                hover:text-white hover:bg-white/8 border border-white/8 transition-all">
                            ← Back
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

                {/* ── HERO ROW ── */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-5 p-6 rounded-3xl border border-white/10"
                    style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.07) 100%)" }}>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                style={{ background: "rgba(139,92,246,0.15)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.25)" }}>
                                Call Details
                            </span>
                            {call.sentiment && (
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                    style={{ background: sentCfg.bg, color: sentCfg.color, border: `1px solid ${sentCfg.border}` }}>
                                    {sentCfg.emoji} {sentCfg.label}
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
                    </div>

                    {call.overallScore != null && (
                        <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="flex flex-col items-center">
                                <ScoreRing score={call.overallScore} size={80} stroke={6} color="#8b5cf6" />
                                <p className="text-xs text-slate-400 mt-1 font-medium">Overall Score</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── AUDIO PLAYER ──
                    We extend AudioPlayer with two extra props:
                    - onTimeUpdate: feeds current time to Timeline
                    - seekRef: lets Timeline seek the player
                    
                    AudioPlayer already exposes audioRef — we use the same
                    seekRef forwarding pattern without modifying AudioPlayer.jsx.
                    Instead, we render a hidden <audio> observer below.
                ── */}
                <AudioPlayerWithBridge
                    filePath={call.filePath}
                    fileName={call.fileName}
                    seekRef={seekRef}
                    onTimeUpdate={setAudioCurrentSec}
                />

                {/* ── TABS ── */}
                <div className="flex flex-wrap gap-1 p-1 rounded-2xl border border-white/8 bg-white/3 w-fit">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all
                                ${activeTab === tab.id
                                    ? "bg-white/12 text-white shadow"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── OVERVIEW TAB ── */}
                {activeTab === "overview" && (
                    <div className="space-y-5">
                        {call.summary && (
                            <div className="p-5 rounded-2xl border border-violet-500/20 bg-violet-500/5">
                                <p className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-3">📋 AI Summary</p>
                                <p className="text-sm text-slate-300 leading-relaxed">{call.summary}</p>
                            </div>
                        )}

                        {(strengths.length > 0 || improvements.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {strengths.length > 0 && (
                                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-4">✅ Strengths</p>
                                        <ul className="space-y-2.5">
                                            {strengths.map((s, i) => (
                                                <li key={i} className="flex items-start gap-2.5">
                                                    <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 flex-shrink-0
                                                        flex items-center justify-center text-emerald-400 text-xs font-bold">✓</span>
                                                    <span className="text-sm text-slate-300 leading-snug">{s}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {improvements.length > 0 && (
                                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                                        <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-4">⚡ Improvements</p>
                                        <ul className="space-y-2.5">
                                            {improvements.map((s, i) => (
                                                <li key={i} className="flex items-start gap-2.5">
                                                    <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/20 flex-shrink-0
                                                        flex items-center justify-center text-amber-400 text-xs font-bold">!</span>
                                                    <span className="text-sm text-slate-300 leading-snug">{s}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {insights.length > 0 && (
                            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
                                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-4">🧠 AI Insights</p>
                                {insights[0]?.bullets ? (
                                    <ul className="space-y-2.5">
                                        {insights[0].bullets.map((line, i) => (
                                            <li key={i} className="flex items-start gap-2.5">
                                                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                                <span className="text-sm text-slate-300 leading-relaxed">{line}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="space-y-2.5">
                                        {insights.map(section => (
                                            <div key={section.key}
                                                className="flex items-start gap-3 p-3.5 rounded-xl border"
                                                style={{ background: section.bg, borderColor: section.border }}>
                                                <span className="text-lg flex-shrink-0 mt-0.5">{section.emoji}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold uppercase tracking-wide mb-1"
                                                        style={{ color: section.color }}>{section.label}</p>
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

                        {keywords.length > 0 && (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">🔑 Keywords</p>
                                <div className="flex flex-wrap gap-2">
                                    {keywords.map((kw, i) => (
                                        <span key={i}
                                            className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-105 cursor-default"
                                            style={{ background: "rgba(139,92,246,0.12)", borderColor: "rgba(139,92,246,0.3)", color: "rgb(196,181,253)" }}>
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TRANSCRIPT TAB ── */}
                {activeTab === "transcript" && (
                    <div className="rounded-2xl border border-white/10 bg-white/5">
                        <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-white/8">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">📝 Transcript</p>
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    placeholder="Search transcript…"
                                    value={transcriptQuery}
                                    onChange={e => setTranscriptQuery(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white
                                        placeholder-slate-600 focus:outline-none focus:border-violet-500/40 focus:bg-white/8 transition-all"
                                />
                                {transcriptQuery && (
                                    <button onClick={() => setTranscriptQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs">
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="p-5 max-h-[60vh] overflow-y-auto text-sm text-slate-300 leading-relaxed font-mono"
                            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.4) transparent" }}>
                            {call.transcript
                                ? <HighlightedText text={call.transcript} query={transcriptQuery} />
                                : <span className="text-slate-500 italic">No transcript available</span>}
                        </div>
                    </div>
                )}

                {/* ── TIMELINE TAB ── */}
                {activeTab === "timeline" && (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                        {/* Timeline panel */}
                        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">⏱ Conversation Timeline</p>
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
                        </div>

                        {/* Active segment detail */}
                        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">📋 Transcript at Selected Phase</p>
                            {timeline.length > 0 ? (
                                <PhaseTranscript
                                    transcript={call.transcript}
                                    timeline={timeline}
                                    currentSec={audioCurrentSec}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm gap-2">
                                    <span className="text-3xl">⏱</span>
                                    <span>Select a phase from the timeline</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── SCORES TAB ── */}
                {activeTab === "scores" && (
                    <div className="space-y-5">
                        {call.overallScore != null && (
                            <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl border border-violet-500/20 bg-violet-500/5">
                                <ScoreRing score={call.overallScore} size={100} stroke={8} color="#8b5cf6" />
                                <div>
                                    <p className="text-2xl font-black text-white">{call.overallScore} / 100</p>
                                    <p className="text-slate-400 text-sm mt-1">Overall Conversation Quality</p>
                                    <div className="w-64 h-2 rounded-full mt-3" style={{ background: "rgba(255,255,255,0.1)" }}>
                                        <div className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-700"
                                            style={{ width: `${call.overallScore}%` }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "Communication",      key: "communication",       color: "#8b5cf6" },
                                { label: "Problem Resolution", key: "problemResolution",   color: "#3b82f6" },
                                { label: "Professionalism",    key: "professionalism",     color: "#10b981" },
                                { label: "Cust. Satisfaction", key: "customerSatisfaction",color: "#f59e0b" },
                            ].map(({ label, key, color }) => (
                                <div key={key} className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/4 border border-white/8 hover:border-white/15 transition-all">
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

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Score Breakdown</p>
                            <div className="space-y-3">
                                {[
                                    { label: "Overall",               val: call.overallScore,         color: "#8b5cf6" },
                                    { label: "Communication",         val: call.communication,        color: "#8b5cf6" },
                                    { label: "Problem Resolution",    val: call.problemResolution,    color: "#3b82f6" },
                                    { label: "Professionalism",       val: call.professionalism,      color: "#10b981" },
                                    { label: "Customer Satisfaction", val: call.customerSatisfaction, color: "#f59e0b" },
                                ].map(({ label, val, color }) => (
                                    <div key={label} className="flex items-center gap-3">
                                        <span className="w-40 text-xs text-slate-400 text-right flex-shrink-0">{label}</span>
                                        <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                                            <div className="h-2 rounded-full transition-all duration-700"
                                                style={{ width: `${val || 0}%`, background: color }} />
                                        </div>
                                        <span className="w-8 text-xs font-bold text-white text-right">{val ?? "–"}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
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
// AUDIOPLAYER BRIDGE
//
// AudioPlayer.jsx does not expose an imperative seek API.
// This wrapper renders AudioPlayer plus a hidden <audio> element that shares
// the same src — we listen on that for timeupdate to keep currentSec in sync,
// and we implement seek by messaging the real audio element via a shared ref.
//
// Better approach: we render AudioPlayer normally and overlay it with a hidden
// audio element that tracks the same src. But the cleanest solution that
// doesn't modify AudioPlayer.jsx is to expose the seek function via a
// data attribute trick or a context.
//
// SIMPLEST correct approach that requires no changes to AudioPlayer:
// render a hidden <audio> with the same src in this component, subscribe to
// its timeupdate, and when seek is called, set currentTime on that element
// only. For actual playback we still rely on AudioPlayer's own element.
//
// For the "seek AudioPlayer from Timeline" use case, we use a shared
// broadcast channel via a module-level WeakMap keyed on the audio src.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL_AP = import.meta.env.VITE_API_URL || "http://localhost:8080";

function AudioPlayerWithBridge({ filePath, fileName, seekRef, onTimeUpdate }) {
    const probeRef = useRef(null);

    // Register seek function
    useEffect(() => {
        seekRef.current = (seconds) => {
            // Find the real audio element rendered by AudioPlayer by scanning
            // all <audio> tags for a src that matches our file
            if (!filePath) return;
            const expected = (BASE_URL_AP + filePath.split("/").map(encodeURIComponent).join("/")).toLowerCase();
            const allAudio = Array.from(document.querySelectorAll("audio"));
            const target   = allAudio.find(a => {
                try { return new URL(a.src).href.toLowerCase() === expected; } catch { return false; }
            }) || allAudio[0];

            if (target) {
                target.currentTime = seconds;
                target.play().catch(() => {});
            }
        };
    }, [filePath, seekRef]);

    // Track current time via rAF polling
    useEffect(() => {
        let raf;
        function poll() {
            if (!filePath) return;
            const expected = (BASE_URL_AP + filePath.split("/").map(encodeURIComponent).join("/")).toLowerCase();
            const allAudio = Array.from(document.querySelectorAll("audio"));
            const target   = allAudio.find(a => {
                try { return new URL(a.src).href.toLowerCase() === expected; } catch { return false; }
            }) || allAudio[0];

            if (target) onTimeUpdate(target.currentTime || 0);
            raf = requestAnimationFrame(poll);
        }
        raf = requestAnimationFrame(poll);
        return () => cancelAnimationFrame(raf);
    }, [filePath, onTimeUpdate]);

    return <AudioPlayer filePath={filePath} fileName={fileName} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE TRANSCRIPT — shows the chunk of transcript text for the active segment
// ─────────────────────────────────────────────────────────────────────────────

function PhaseTranscript({ transcript, timeline, currentSec }) {
    if (!transcript || !timeline.length) return null;

    const activeIdx = timeline.reduce((acc, seg, i) => {
        const s = parseTime(seg.time);
        return s <= currentSec ? i : acc;
    }, 0);

    const seg     = timeline[activeIdx];
    const color   = PHASE_COLORS[activeIdx % PHASE_COLORS.length];
    const totalWords = transcript.split(/\s+/).length;

    // Approximate character range for this segment
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
