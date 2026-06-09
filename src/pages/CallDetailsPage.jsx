import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import api from "../services/api.js";
import logo from "../assets/CONVEXA_AI_logo.png";
import AudioPlayer from "../components/AudioPlayer.jsx";
import { parseInsights } from "../utils/insightsFormatter.js";

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES  (same helpers used in Dashboard so output is consistent)
// ─────────────────────────────────────────────────────────────────────────────

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

function parseList(str) {
    if (!str) return [];
    return str
        .split(/,|\n/)
        .map(s => s.replace(/^[\s*\-•]+/, "").trim())
        .filter(Boolean);
}

const SENT_CONFIG = {
    POSITIVE: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", label: "Positive", emoji: "😊" },
    NEGATIVE: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: "Negative", emoji: "😔" },
    NEUTRAL: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "Neutral", emoji: "😐" },
};

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

// Highlight transcript search matches
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
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function CallDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [call, setCall]               = useState(null);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState(null);
    const [transcriptQuery, setTranscriptQuery] = useState("");
    const [activeTab, setActiveTab]     = useState("overview"); // overview | transcript | scores

    useEffect(() => {
        api.get(`/api/calls/${id}`)
            .then(r => setCall(r.data))
            .catch(() => setError("Could not load call details."))
            .finally(() => setLoading(false));
    }, [id]);

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
        { id: "overview",    label: "📋 Overview" },
        { id: "transcript",  label: "📝 Transcript" },
        { id: "scores",      label: "📊 Scores" },
    ];

    return (
        <div className="min-h-screen text-white"
            style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #0d0b2a 40%, #0a1628 100%)" }}>

            {/* Noise overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

            {/* ── NAV ─────────────────────────────────────────────────────────── */}
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

                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Link to="/dashboard" className="hover:text-violet-400 transition-colors">Dashboard</Link>
                        <span>/</span>
                        <Link to="/history" className="hover:text-violet-400 transition-colors">History</Link>
                        <span>/</span>
                        <span className="text-slate-300 truncate max-w-40">{call.fileName}</span>
                    </div>

                    <div className="ml-auto flex items-center gap-3">
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
                                ? new Date(call.createdAt).toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
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

                {/* ── AUDIO PLAYER ── */}
                <AudioPlayer filePath={call.filePath} fileName={call.fileName} />

                {/* ── TABS ── */}
                <div className="flex gap-1 p-1 rounded-2xl border border-white/8 bg-white/3 w-fit">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
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
                        {/* Summary */}
                        {call.summary && (
                            <div className="p-5 rounded-2xl border border-violet-500/20 bg-violet-500/5">
                                <p className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-3">📋 AI Summary</p>
                                <p className="text-sm text-slate-300 leading-relaxed">{call.summary}</p>
                            </div>
                        )}

                        {/* Strengths + Improvements */}
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

                        {/* AI Insights — structured sections */}
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
                        {/* Search bar */}
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
                                : <span className="text-slate-500 italic">No transcript available</span>
                            }
                        </div>
                    </div>
                )}

                {/* ── SCORES TAB ── */}
                {activeTab === "scores" && (
                    <div className="space-y-5">
                        {/* Overall score big display */}
                        {call.overallScore != null && (
                            <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl border border-violet-500/20 bg-violet-500/5">
                                <ScoreRing score={call.overallScore} size={100} stroke={8} color="#8b5cf6" />
                                <div>
                                    <p className="text-2xl font-black text-white">{call.overallScore} / 100</p>
                                    <p className="text-slate-400 text-sm mt-1">Overall Conversation Quality</p>
                                    {/* Progress bar */}
                                    <div className="w-64 h-2 rounded-full mt-3" style={{ background: "rgba(255,255,255,0.1)" }}>
                                        <div className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-700"
                                            style={{ width: `${call.overallScore}%` }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Dimension cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "Communication",     key: "communication",       color: "#8b5cf6" },
                                { label: "Problem Resolution", key: "problemResolution",  color: "#3b82f6" },
                                { label: "Professionalism",   key: "professionalism",     color: "#10b981" },
                                { label: "Cust. Satisfaction", key: "customerSatisfaction", color: "#f59e0b" },
                            ].map(({ label, key, color }) => (
                                <div key={key} className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/4 border border-white/8
                                    hover:border-white/15 transition-all">
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

                        {/* Radar-style comparison */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Score Breakdown</p>
                            <div className="space-y-3">
                                {[
                                    { label: "Overall",              val: call.overallScore,         color: "#8b5cf6" },
                                    { label: "Communication",        val: call.communication,        color: "#8b5cf6" },
                                    { label: "Problem Resolution",   val: call.problemResolution,    color: "#3b82f6" },
                                    { label: "Professionalism",      val: call.professionalism,      color: "#10b981" },
                                    { label: "Customer Satisfaction",val: call.customerSatisfaction, color: "#f59e0b" },
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
                    to   { transform: translateY(0);    opacity: 1; }
                }
            `}</style>
        </div>
    );
}
