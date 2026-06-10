import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import api, { getUser, clearSession } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function parseList(str) {
    if (!str) return [];
    return str.split(/,|\n/).map(s => s.replace(/^[\s*\-•]+/, "").trim()).filter(Boolean);
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

function Skeleton({ className = "" }) {
    return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} />;
}

const SENT_COLORS  = { POSITIVE: "#10b981", NEUTRAL: "#f59e0b", NEGATIVE: "#ef4444" };
const CHART_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6"];

const tooltipStyle = {
    background: "rgba(13,11,42,0.97)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "13px",
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
    const user = getUser();
    const [calls, setCalls]       = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(null);
    const [profileOpen, setProfileOpen] = useState(false);

    const fetchCalls = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get("/api/calls/my-calls");
            setCalls(res.data);
        } catch {
            setError("Failed to load analytics data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCalls(); }, [fetchCalls]);

    useEffect(() => {
        const h = () => setProfileOpen(false);
        if (profileOpen) window.addEventListener("click", h);
        return () => window.removeEventListener("click", h);
    }, [profileOpen]);

    const handleLogout = () => { logoutAndRedirect(); };

    // ── Derived data ─────────────────────────────────────────────────────────
    const total        = calls.length;
    const avgScore     = total > 0 ? (calls.reduce((s, c) => s + (c.overallScore || 0), 0) / total).toFixed(1) : 0;
    const positive     = calls.filter(c => c.sentiment === "POSITIVE").length;
    const negative     = calls.filter(c => c.sentiment === "NEGATIVE").length;
    const neutral      = calls.filter(c => c.sentiment === "NEUTRAL").length;

    const avgQA = (key) => total > 0
        ? Math.round(calls.reduce((s, c) => s + (c[key] || 0), 0) / total)
        : 0;

    // Sentiment pie
    const sentimentData = [
        { name: "Positive", value: positive },
        { name: "Neutral",  value: neutral  },
        { name: "Negative", value: negative },
    ].filter(d => d.value > 0);

    // Calls per day (last 30 days)
    const dayMap = {};
    calls.forEach(c => {
        if (!c.createdAt) return;
        const d = new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        dayMap[d] = (dayMap[d] || 0) + 1;
    });
    const callsPerDay = Object.entries(dayMap)
        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
        .slice(-20)
        .map(([date, count]) => ({ date, calls: count }));

    // Score trend over time
    const scoreTrend = [...calls]
        .filter(c => c.overallScore != null && c.createdAt)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(-20)
        .map((c, i) => ({
            idx: i + 1,
            score: c.overallScore,
            name: c.fileName?.slice(0, 12),
        }));

    // Score distribution histogram (buckets 0-9,10-19,...,90-100)
    const scoreHist = Array.from({ length: 10 }, (_, i) => ({
        range: `${i * 10}–${i * 10 + 9}`,
        count: calls.filter(c => c.overallScore >= i * 10 && c.overallScore < (i + 1) * 10).length,
    }));

    // Top keywords
    const allKw = calls.flatMap(c => parseList(c.keywords));
    const kwFreq = {};
    allKw.forEach(k => { kwFreq[k] = (kwFreq[k] || 0) + 1; });
    const topKw = Object.entries(kwFreq).sort((a, b) => b[1] - a[1]).slice(0, 15);

    // Avg QA dims bar
    const qaDims = [
        { key: "communication",       label: "Communication",     color: "#8b5cf6" },
        { key: "problemResolution",   label: "Problem Resolution", color: "#3b82f6" },
        { key: "professionalism",     label: "Professionalism",    color: "#10b981" },
        { key: "customerSatisfaction",label: "Cust. Satisfaction", color: "#f59e0b" },
    ].map(d => ({ ...d, value: avgQA(d.key) }));

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen text-white"
            style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #0d0b2a 40%, #0a1628 100%)" }}>

            <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

            {/* NAV */}
            <header className="sticky top-0 z-40 border-b border-white/8 backdrop-blur-xl"
                style={{ background: "rgba(10,10,26,0.88)" }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
                    <Link to="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
                        <img src={logo} alt="Convexa AI" className="h-7 w-auto" />
                        <span className="text-base font-black tracking-tight hidden sm:block">
                            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Convexa</span>
                            <span className="text-white ml-1">AI</span>
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-1">
                        {[
                            { label: "Dashboard",    path: "/dashboard"  },
                            { label: "Call History", path: "/history"    },
                            { label: "Analytics",    path: "/analytics"  },
                        ].map(({ label, path }) => (
                            <Link key={label} to={path}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                                    ${window.location.pathname === path
                                        ? "bg-white/10 text-white"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                                {label}
                            </Link>
                        ))}
                    </nav>

                    <div className="relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setProfileOpen(o => !o)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold">
                                {user?.name?.[0]?.toUpperCase() ?? "U"}
                            </div>
                            <span className="text-sm font-medium hidden sm:block">{user?.name ?? "User"}</span>
                        </button>
                        {profileOpen && (
                            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-white/10 bg-slate-900/98 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
                                <div className="px-4 py-3 border-b border-white/8">
                                    <p className="text-sm font-bold text-white">{user?.name}</p>
                                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                                </div>
                                <div className="p-2">
                                    <button onClick={handleLogout}
                                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all">
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

                <div>
                    <h1 className="text-2xl font-black text-white">Analytics</h1>
                    <p className="text-slate-400 text-sm mt-1">Insights from {total} analysed calls</p>
                </div>

                {error && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300">
                        <span>⚠️</span><span className="text-sm">{error}</span>
                        <button onClick={fetchCalls} className="ml-auto text-xs bg-red-500/20 px-3 py-1 rounded-lg">Retry</button>
                    </div>
                )}

                {!loading && total === 0 ? (
                    <div className="text-center py-24 rounded-3xl border border-white/8 border-dashed"
                        style={{ background: "rgba(255,255,255,0.015)" }}>
                        <div className="text-6xl mb-4">📊</div>
                        <h2 className="text-xl font-black text-white mb-2">No analytics yet</h2>
                        <p className="text-slate-400 text-sm mb-6">Upload and analyse calls to see your analytics here.</p>
                        <Link to="/dashboard"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm
                                bg-gradient-to-r from-violet-600 to-blue-600 text-white
                                hover:from-violet-500 hover:to-blue-500 transition-all">
                            Go to Dashboard
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* ── KPI CARDS ── */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
                            ) : (
                                <>
                                    {[
                                        { icon: "📞", label: "Total Calls",    value: total,           accent: "#8b5cf6" },
                                        { icon: "⭐", label: "Avg QA Score",   value: avgScore,        accent: "#3b82f6" },
                                        { icon: "😊", label: "Positive Calls", value: positive,        accent: "#10b981" },
                                        { icon: "😔", label: "Negative Calls", value: negative,        accent: "#ef4444" },
                                    ].map(({ icon, label, value, accent }) => (
                                        <div key={label}
                                            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5
                                                hover:border-white/20 transition-all">
                                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                style={{ background: `radial-gradient(ellipse at 20% 20%, ${accent}18 0%, transparent 70%)` }} />
                                            <span className="text-2xl">{icon}</span>
                                            <p className="text-3xl font-black text-white mt-2">{value}</p>
                                            <p className="text-xs text-slate-400 font-medium">{label}</p>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* ── CHARTS ROW 1 ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Sentiment pie */}
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Sentiment Distribution</p>
                                {loading ? <Skeleton className="h-56" /> : (
                                    <div className="flex flex-col gap-5">
                                        <ResponsiveContainer width="100%" height={200}>
                                            <PieChart>
                                                <Pie data={sentimentData} dataKey="value" nameKey="name"
                                                    cx="50%" cy="50%" outerRadius={85} innerRadius={50}
                                                    paddingAngle={3} labelLine={false}>
                                                    {sentimentData.map((entry) => (
                                                        <Cell key={entry.name}
                                                            fill={SENT_COLORS[entry.name.toUpperCase()] || "#8b5cf6"}
                                                            style={{ outline: "none" }} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={tooltipStyle} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { label: "Positive", val: positive, color: "#10b981" },
                                                { label: "Neutral",  val: neutral,  color: "#f59e0b" },
                                                { label: "Negative", val: negative, color: "#ef4444" },
                                            ].map(({ label, val, color }) => (
                                                <div key={label} className="text-center p-2.5 rounded-xl bg-white/4 border border-white/8">
                                                    <p className="text-lg font-black" style={{ color }}>{val}</p>
                                                    <p className="text-xs text-slate-500">{label}</p>
                                                    <p className="text-xs font-semibold text-white mt-0.5">
                                                        {total > 0 ? ((val / total) * 100).toFixed(1) : 0}%
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Avg QA dimensions */}
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Avg QA Dimensions</p>
                                {loading ? <Skeleton className="h-56" /> : (
                                    <div className="space-y-4">
                                        <div className="flex justify-around">
                                            {qaDims.map(d => (
                                                <div key={d.key} className="flex flex-col items-center gap-1.5">
                                                    <ScoreRing score={d.value} size={64} stroke={5} color={d.color} />
                                                    <p className="text-xs text-slate-500 text-center max-w-16 leading-tight">{d.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Bar comparison */}
                                        <ResponsiveContainer width="100%" height={100}>
                                            <BarChart data={qaDims} barSize={28}>
                                                <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} />
                                                <YAxis domain={[0, 100]} hide />
                                                <Tooltip contentStyle={tooltipStyle} />
                                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                    {qaDims.map(d => (
                                                        <Cell key={d.key} fill={d.color} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── CHARTS ROW 2 ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Score trend */}
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Score Trend</p>
                                {loading ? <Skeleton className="h-56" /> : scoreTrend.length < 2 ? (
                                    <div className="flex items-center justify-center h-48 text-slate-500 text-sm flex-col gap-2">
                                        <span className="text-3xl">📈</span>
                                        <span>Need more calls for trend data</span>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={scoreTrend}>
                                            <defs>
                                                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="idx" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: "Call #", position: "insideBottom", fill: "#64748b", fontSize: 10 }} />
                                            <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Score"]} />
                                            <Area type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2.5}
                                                fill="url(#scoreGrad)" dot={{ fill: "#8b5cf6", r: 4, strokeWidth: 0 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            {/* Calls per day */}
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Calls Per Day</p>
                                {loading ? <Skeleton className="h-56" /> : callsPerDay.length < 2 ? (
                                    <div className="flex items-center justify-center h-48 text-slate-500 text-sm flex-col gap-2">
                                        <span className="text-3xl">📅</span>
                                        <span>Upload more calls to see daily activity</span>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={callsPerDay} barSize={20}>
                                            <defs>
                                                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#8b5cf6" />
                                                    <stop offset="100%" stopColor="#3b82f6" />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Bar dataKey="calls" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* ── SCORE DISTRIBUTION ── */}
                        {!loading && calls.some(c => c.overallScore != null) && (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Score Distribution</p>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={scoreHist} barSize={32}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="range" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                            {scoreHist.map((entry, i) => {
                                                const mid = i * 10 + 5;
                                                const color = mid >= 70 ? "#10b981" : mid >= 50 ? "#f59e0b" : "#ef4444";
                                                return <Cell key={i} fill={color} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* ── KEYWORD CLOUD ── */}
                        {!loading && topKw.length > 0 && (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Top Keywords</p>

                                <div className="flex flex-wrap gap-2 mb-6">
                                    {topKw.map(([kw, cnt], i) => {
                                        const opacity = 0.45 + ((topKw.length - i) / topKw.length) * 0.55;
                                        return (
                                            <span key={kw}
                                                className="px-3 py-1.5 rounded-full font-semibold border cursor-default transition-all hover:scale-105"
                                                style={{
                                                    background: `rgba(139,92,246,${opacity * 0.13})`,
                                                    borderColor: `rgba(139,92,246,${opacity * 0.35})`,
                                                    color: `rgba(196,181,253,${opacity})`,
                                                    fontSize: `${0.7 + (opacity - 0.45) * 0.35}rem`,
                                                }}>
                                                {kw} <span className="opacity-50 text-xs">×{cnt}</span>
                                            </span>
                                        );
                                    })}
                                </div>

                                <div className="space-y-2.5">
                                    {topKw.slice(0, 10).map(([kw, cnt]) => (
                                        <div key={kw} className="flex items-center gap-3">
                                            <span className="w-32 text-xs text-slate-300 font-medium truncate text-right">{kw}</span>
                                            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/8">
                                                <div className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-700"
                                                    style={{ width: `${(cnt / topKw[0][1]) * 100}%` }} />
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

            <footer className="border-t border-white/6 mt-12 py-5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <span className="text-xs text-slate-600">© 2026 Convexa AI</span>
                    <span className="text-xs text-slate-700">Powered by Whisper · Ollama · Qwen 2.5</span>
                </div>
            </footer>
        </div>
    );
}
