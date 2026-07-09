import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ComposedChart, Line,
} from "recharts";
import api, { getUser } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";
import { Sidebar, THEMES } from "../components/Sidebar.jsx";
import {
    Phone, Star, Smile, Frown, TrendingUp, BarChart3,
    AlertTriangle, RefreshCw, KeyRound, Gauge, Target,
    ArrowUp, ArrowDown, ShieldAlert, ShieldCheck, Rocket, Lightbulb,
    Flame, ChevronDown, CalendarDays, Download, SlidersHorizontal,
    Brain, Search, Command, X, Menu, Sun, Moon, Bell,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — unchanged business logic
// ─────────────────────────────────────────────────────────────────────────────

function parseList(str) {
    if (!str) return [];
    return str.split(/,|\n/).map(s => s.replace(/^[\s*\-•]+/, "").trim()).filter(Boolean);
}

function ScoreRing({ score, size = 80, stroke = 7, color = "#8b5cf6", track = "rgba(255,255,255,0.06)", textColor = "white" }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const pct = Math.min((score || 0) / 100, 1);
    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
                style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 6px ${color}80)` }} />
            <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
                fill={textColor} fontSize={size * 0.22} fontWeight="800"
                style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%", fontFamily: "inherit" }}>
                {score ?? "–"}
            </text>
        </svg>
    );
}

function Skeleton({ className = "", T }) {
    const base = T?.panelHover ?? "rgba(255,255,255,0.08)";
    return (
        <div className={`rounded-xl ${className}`}
            style={{ background: `linear-gradient(90deg, transparent 25%, ${base} 50%, transparent 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
    );
}

const SENT_COLORS  = { POSITIVE: "#10b981", NEUTRAL: "#f59e0b", NEGATIVE: "#ef4444" };

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN-SYSTEM PRIMITIVES — identical shapes to the Dashboard's, theme-aware
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

function Panel({ children, className = "", style = {}, T }) {
    return (
        <div className={`rounded-2xl p-5 sm:p-6 ${className}`}
            style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, ...style }}>
            {children}
        </div>
    );
}

/** Minimal inline sparkline — mirrors the Dashboard's implementation. */
function Sparkline({ series, color = "#8b5cf6", width = 72, height = 28 }) {
    if (!series || series.length < 2) {
        return <div style={{ width, height }} className="flex items-center">
            <div className="w-full h-px" style={{ background: `${color}30` }} />
        </div>;
    }
    const min = Math.min(...series), max = Math.max(...series);
    const range = max - min || 1;
    const stepX = width / (series.length - 1);
    const points = series.map((v, i) => {
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

/** Premium KPI card — icon, sparkline, trend, all derived from the local `calls` array. */
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
                    <Sparkline series={series} color={accent} />
                </div>
            </div>
        </div>
    );
}

const tooltipStyleFor = (T) => ({
    background: T.sidebarBg,
    border: `1px solid ${T.panelBorder}`,
    borderRadius: "12px",
    color: T.text,
    fontSize: "13px",
});

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
    const user = getUser();
    const location = useLocation();

    const [calls, setCalls]       = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    /* ── Presentation-only UI state — identical pattern to the Dashboard.
       None of this touches data fetching, routing, or business logic; it only
       changes how the already-fetched `calls` are displayed. ────────────── */
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [themeMode, setThemeMode] = useState("dark");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [dateRange, setDateRange] = useState("30d"); // 7d | 30d | all — now also the range sent to the backend
    const T = THEMES[themeMode];
    const searchInputRef = useRef(null);

    /* ── Server-computed analytics (GET /api/analytics/employee): totals,
       trend %, daily series, top keywords, and buying-intent distribution.
       `calls` (via /api/calls/my-calls) is still fetched for Search and for
       the two widgets the backend doesn't cover yet — Score Distribution and
       Risk Analysis, which need raw per-call scores, not aggregates. ───── */
    const [analyticsStats, setAnalyticsStats] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [analyticsError, setAnalyticsError] = useState(null);

    /* ── GET /api/dashboard/employee, reused here only for its per-dimension
       QA averages (avgCommunication/avgProblemResolution/avgProfessionalism/
       avgCustomerSatisfaction) and needs-attention count — the analytics
       endpoint doesn't carry those, and Dashboard already owns that math. */
    const [dashboardStats, setDashboardStats] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(true);

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

    const fetchAnalyticsStats = useCallback(async (range) => {
        setAnalyticsLoading(true);
        setAnalyticsError(null);
        try {
            const res = await api.get(`/api/analytics/employee?range=${range}`);
            setAnalyticsStats(res.data);
        } catch (err) {
            console.error("Failed to fetch analytics stats:", err);
            setAnalyticsError("Failed to load analytics data.");
        } finally {
            setAnalyticsLoading(false);
        }
    }, []);

    const fetchDashboardStats = useCallback(async (range) => {
        setDashboardLoading(true);
        try {
            const res = await api.get(`/api/dashboard/employee?range=${range}`);
            setDashboardStats(res.data);
        } catch (err) {
            console.error("Failed to fetch dashboard stats:", err);
        } finally {
            setDashboardLoading(false);
        }
    }, []);

    useEffect(() => { fetchCalls(); }, [fetchCalls]);
    useEffect(() => { fetchAnalyticsStats(dateRange); }, [fetchAnalyticsStats, dateRange]);
    useEffect(() => { fetchDashboardStats(dateRange); }, [fetchDashboardStats, dateRange]);

    useEffect(() => {
        const h = () => setProfileOpen(false);
        if (profileOpen) window.addEventListener("click", h);
        return () => window.removeEventListener("click", h);
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

    /* Cmd+K / Ctrl+K opens the command search — same shortcut as the Dashboard. */
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

    const handleLogout = () => { logoutAndRedirect(); };

    /* ── Date-range filter — purely a client-side view over the already
       fetched `calls`, identical in spirit to the Dashboard's. ─────────── */
    const rangedCalls = useMemo(() => {
        if (dateRange === "all") return calls;
        const days = dateRange === "7d" ? 7 : 30;
        const cutoff = Date.now() - days * 86400000;
        return calls.filter(c => !c.createdAt || new Date(c.createdAt).getTime() >= cutoff);
    }, [calls, dateRange]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return calls.filter(c =>
            c.fileName?.toLowerCase().includes(q) ||
            c.keywords?.toLowerCase().includes(q) ||
            c.summary?.toLowerCase().includes(q)
        ).slice(0, 6);
    }, [calls, searchQuery]);

    // ── Derived data — now read directly from GET /api/analytics/employee
    // (analyticsStats) and GET /api/dashboard/employee (dashboardStats),
    // instead of being recomputed here from the raw `calls`/`rangedCalls`
    // list. Score Distribution and Risk Analysis are the two exceptions:
    // neither backend endpoint buckets per-call scores, so those two still
    // read `rangedCalls` directly (noted again at their definitions below).
    const total    = analyticsStats?.totalCalls ?? 0;
    const avgScore = analyticsStats && analyticsStats.totalCalls > 0 ? analyticsStats.avgScore.toFixed(1) : 0;

    // Raw counts aren't in AnalyticsResponse (only percentages are) — these
    // three lines reconstruct display counts from the backend's own
    // percentages rather than reclassifying sentiment client-side.
    const positivePct = analyticsStats?.positivePercent ?? 0;
    const negativePct = analyticsStats?.negativePercent ?? 0;
    const positive = Math.round((positivePct / 100) * total);
    const negative = Math.round((negativePct / 100) * total);
    const neutral  = Math.max(0, total - positive - negative);

    const sentimentData = [
        { name: "Positive", value: positive },
        { name: "Neutral",  value: neutral  },
        { name: "Negative", value: negative },
    ].filter(d => d.value > 0);

    const formatShortDate = (isoDay) =>
        new Date(`${isoDay}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

    // Volume + Score merged into one series — these used to be two separate
    // charts (Score Trend, Calls Per Day) sharing the same x-axis (day) with
    // no new information between them. One combo chart, dual axis, instead.
    const volumeScoreTrend = (analyticsStats?.dailySeries ?? [])
        .slice(-20)
        .map(d => ({ date: formatShortDate(d.date), calls: d.callCount, score: d.avgScore }));

    // Score Distribution needs each call's individual score, which neither
    // backend endpoint returns (both only return aggregates) — kept as the
    // one histogram still computed from the raw calls list.
    const scoreHist = Array.from({ length: 10 }, (_, i) => ({
        range: `${i * 10}–${i * 10 + 9}`,
        count: rangedCalls.filter(c => c.overallScore >= i * 10 && c.overallScore < (i + 1) * 10).length,
    }));

    const topKw = (analyticsStats?.topKeywords ?? []).map(k => [k.keyword, k.count]);

    const qaDims = [
        { key: "communication",        label: "Communication",      color: "#8b5cf6", value: dashboardStats?.avgCommunication ?? 0 },
        { key: "problemResolution",    label: "Problem Resolution", color: "#3b82f6", value: dashboardStats?.avgProblemResolution ?? 0 },
        { key: "professionalism",      label: "Professionalism",    color: "#10b981", value: dashboardStats?.avgProfessionalism ?? 0 },
        { key: "customerSatisfaction", label: "Cust. Satisfaction", color: "#f59e0b", value: dashboardStats?.avgCustomerSatisfaction ?? 0 },
    ];

    // seriesTrend() is gone — the backend already computed these two trend
    // percentages (same "second half vs first half" definition it always used).
    const callsSeries = volumeScoreTrend.map(d => d.calls);
    const scoreSeries = volumeScoreTrend.map(d => d.score);
    const callsTrendPct = analyticsStats?.callsTrendPercent ?? null;
    const scoreTrendPct = analyticsStats?.scoreTrendPercent ?? null;

    // Risk Analysis needs the same per-call score buckets as Score
    // Distribution above, for the same reason — kept on rangedCalls.
    const highRisk = rangedCalls.filter(c => c.overallScore != null && c.overallScore < 50).length;
    const medRisk  = rangedCalls.filter(c => c.overallScore != null && c.overallScore >= 50 && c.overallScore < 75).length;
    const lowRisk  = rangedCalls.filter(c => c.overallScore != null && c.overallScore >= 75).length;
    const scoredTotal = highRisk + medRisk + lowRisk;

    const intentCounts = analyticsStats?.buyingIntentDistribution ?? {};

    /* Needs-attention count — sourced from the same GET /api/dashboard/employee
       list the Dashboard renders, so the sidebar badge reads identically on
       both pages instead of two independent client-side classifications. */
    const needsAttentionCount = dashboardStats?.needsAttention?.length ?? 0;

    const tooltipStyle = tooltipStyleFor(T);

    // ── Render ────────────────────────────────────────────────────────────────
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
                needsAttentionCount={needsAttentionCount} totalCalls={total} />

            <div className="flex-1 min-w-0 flex flex-col">
                {/* ── TOP BAR — identical structure to the Dashboard's ── */}
                <header className="sticky top-0 z-30" style={{ background: T.headerBg, borderBottom: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>
                    <div className="px-4 sm:px-6 h-16 flex items-center gap-3">

                        {/* Mobile logo (sidebar is desktop-only) */}
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

                            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}
                                title="Export analytics (coming soon)">
                                <Download size={13} />
                                Export
                            </button>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => setThemeMode(m => m === "dark" ? "light" : "dark")}
                                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}
                                title="Toggle theme">
                                {themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                            </button>

                            <button className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}
                                title={`${needsAttentionCount} calls need attention`}>
                                <Bell size={15} />
                                {needsAttentionCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: "#ef4444" }}>
                                        {needsAttentionCount}
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

                {/* ── MOBILE NAV DRAWER — identical structure to the Dashboard's ── */}
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
                                    { label: "Dashboard", path: "/dashboard", Icon: BarChart3, desc: "Overview & recent calls" },
                                    { label: "Call History", path: "/history", Icon: Gauge, desc: "Browse all recordings" },
                                    { label: "Analytics", path: "/analytics", Icon: TrendingUp, desc: "Trends & insights" },
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

                    {/* ── PAGE HEADER ── */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                    style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.25)" }}>
                                    Executive Intelligence
                                </span>
                            </div>
                            <h1 className="text-2xl font-black tracking-tight" style={{ color: T.text }}>Analytics</h1>
                            <p className="text-sm mt-1" style={{ color: T.textMuted }}>Insights from {total} analysed call{total !== 1 ? "s" : ""}</p>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                            <span className="text-sm text-red-300">{error}</span>
                            <button onClick={fetchCalls} className="ml-auto flex items-center gap-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg font-semibold transition-colors text-red-200">
                                <RefreshCw className="w-3 h-3" /> Retry
                            </button>
                        </div>
                    )}

                    {analyticsError && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                            <span className="text-sm text-red-300">{analyticsError}</span>
                            <button onClick={() => fetchAnalyticsStats(dateRange)} className="ml-auto flex items-center gap-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg font-semibold transition-colors text-red-200">
                                <RefreshCw className="w-3 h-3" /> Retry
                            </button>
                        </div>
                    )}

                    {!loading && !analyticsLoading && total === 0 ? (
                        <div className="text-center py-24 rounded-3xl border border-dashed" style={{ background: T.panel, borderColor: T.panelBorder }}>
                            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
                                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
                                <BarChart3 className="w-7 h-7 text-violet-300" />
                            </div>
                            <h2 className="text-xl font-black mb-2" style={{ color: T.text }}>No analytics yet</h2>
                            <p className="text-sm mb-6" style={{ color: T.textMuted }}>Upload and analyse calls to see your analytics here.</p>
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
                            <div>
                                <div className="mb-3"><SectionLabel icon={Gauge} tone="#8b5cf6">Key Metrics — This Period</SectionLabel></div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {(loading || analyticsLoading) ? (
                                        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} T={T} className="h-32" />)
                                    ) : (
                                        <>
                                            <KPICard T={T} label="Total Calls" value={total} Icon={Phone} accent="#8b5cf6"
                                                series={callsSeries} trendPct={callsTrendPct} sub={callsTrendPct == null ? "Analysed conversations" : "vs. earlier this period"} />
                                            <KPICard T={T} label="Avg QA Score" value={avgScore} Icon={Star} accent="#3b82f6"
                                                series={scoreSeries} trendPct={scoreTrendPct} sub={scoreTrendPct == null ? "Out of 100" : "vs. earlier this period"} />
                                            <KPICard T={T} label="Positive Calls" value={positive} Icon={Smile} accent="#10b981"
                                                series={scoreSeries} trendPct={null} sub={`${positivePct.toFixed(1)}% of this period`} />
                                            <KPICard T={T} label="Negative Calls" value={negative} Icon={Frown} accent="#ef4444"
                                                series={scoreSeries} trendPct={null} sub={`${negativePct.toFixed(1)}% of this period`} />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* ── CHARTS ROW 1 ── */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Panel T={T}>
                                    <SectionLabel icon={Smile} tone="#a1a1aa">Sentiment Distribution</SectionLabel>
                                    {(loading || analyticsLoading) ? <Skeleton T={T} className="h-56 mt-4" /> : (
                                        <div className="flex flex-col gap-5 mt-4">
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
                                                    <div key={label} className="text-center p-2.5 rounded-xl" style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}>
                                                        <p className="text-lg font-black" style={{ color }}>{val}</p>
                                                        <p className="text-xs" style={{ color: T.textFaint }}>{label}</p>
                                                        <p className="text-xs font-semibold mt-0.5" style={{ color: T.text }}>
                                                            {total > 0 ? ((val / total) * 100).toFixed(1) : 0}%
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </Panel>

                                <Panel T={T}>
                                    <SectionLabel icon={Target} tone="#a1a1aa">Avg QA Dimensions</SectionLabel>
                                    {(loading || dashboardLoading) ? <Skeleton T={T} className="h-56 mt-4" /> : (
                                        <div className="mt-4">
                                            <ResponsiveContainer width="100%" height={200}>
                                                <BarChart data={qaDims} barSize={36}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={T.divider} vertical={false} />
                                                    <XAxis dataKey="label" tick={{ fill: T.textFaint, fontSize: 10 }} axisLine={false} tickLine={false} />
                                                    <YAxis domain={[0, 100]} tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
                                                    <Tooltip contentStyle={tooltipStyle} />
                                                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                                        {qaDims.map(d => (
                                                            <Cell key={d.key} fill={d.color} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </Panel>
                            </div>

                            {/* Volume + Score, merged into one combo chart — previously two
                                separate time-series (Score Trend, Calls Per Day) sharing the
                                same x-axis with no distinct insight between them. */}
                            <Panel T={T}>
                                <SectionLabel icon={TrendingUp} tone="#a1a1aa">Volume & Score Trend</SectionLabel>
                                {(loading || analyticsLoading) ? <Skeleton T={T} className="h-56 mt-4" /> : volumeScoreTrend.length < 2 ? (
                                    <div className="flex items-center justify-center h-48 text-sm flex-col gap-2 mt-4" style={{ color: T.textFaint }}>
                                        <TrendingUp className="w-8 h-8 opacity-50" />
                                        <span>Need more calls across more days for a trend</span>
                                    </div>
                                ) : (
                                    <div className="mt-4">
                                        <ResponsiveContainer width="100%" height={260}>
                                            <ComposedChart data={volumeScoreTrend}>
                                                <defs>
                                                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#8b5cf6" />
                                                        <stop offset="100%" stopColor="#3b82f6" />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke={T.divider} vertical={false} />
                                                <XAxis dataKey="date" tick={{ fill: T.textFaint, fontSize: 10 }} axisLine={false} tickLine={false} />
                                                <YAxis yAxisId="calls" allowDecimals={false} tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
                                                <YAxis yAxisId="score" orientation="right" domain={[0, 100]} tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} />
                                                <Bar yAxisId="calls" dataKey="calls" name="Calls" fill="url(#barGrad)" radius={[4, 4, 0, 0]} barSize={20} />
                                                <Line yAxisId="score" type="monotone" dataKey="score" name="Avg Score" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 3.5, strokeWidth: 0 }} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                        <div className="flex items-center justify-center gap-5 mt-2">
                                            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: T.textFaint }}><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#8b5cf6" }} /> Call volume</span>
                                            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: T.textFaint }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} /> Avg QA score</span>
                                        </div>
                                    </div>
                                )}
                            </Panel>

                            {/* ── SCORE DISTRIBUTION ── */}
                            {!loading && rangedCalls.some(c => c.overallScore != null) && (
                                <Panel T={T}>
                                    <SectionLabel icon={BarChart3} tone="#a1a1aa">Score Distribution</SectionLabel>
                                    <div className="mt-4">
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart data={scoreHist} barSize={18}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={T.divider} />
                                                <XAxis dataKey="range" tick={{ fill: T.textFaint, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                                                <YAxis allowDecimals={false} tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
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
                                </Panel>
                            )}

                            {/* ── RISK ANALYSIS (derived purely from overallScore already loaded) ── */}
                            {!loading && scoredTotal > 0 && (
                                <div>
                                    <div className="mb-3"><SectionLabel icon={ShieldAlert} tone="#f59e0b">Risk Analysis</SectionLabel></div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {[
                                            { label: "High Risk",   sub: "Score below 50",     count: highRisk, color: "#ef4444", Icon: ShieldAlert },
                                            { label: "Medium Risk", sub: "Score 50–74",        count: medRisk,  color: "#f59e0b", Icon: AlertTriangle },
                                            { label: "Low Risk",    sub: "Score 75 and above", count: lowRisk,  color: "#10b981", Icon: ShieldCheck },
                                        ].map(({ label, sub, count, color, Icon }) => (
                                            <div key={label} className="rounded-2xl border p-5" style={{ background: `${color}0d`, borderColor: `${color}30` }}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
                                                        <Icon className="w-4 h-4" style={{ color }} />
                                                    </div>
                                                    <span className="text-2xl font-black" style={{ color: T.text }}>{count}</span>
                                                </div>
                                                <p className="text-sm font-bold" style={{ color }}>{label}</p>
                                                <p className="text-xs mt-0.5" style={{ color: T.textFaint }}>{sub}</p>
                                                <div className="w-full h-1.5 rounded-full mt-3" style={{ background: T.panelHover }}>
                                                    <div className="h-1.5 rounded-full transition-all duration-700"
                                                        style={{ width: `${scoredTotal > 0 ? (count / scoredTotal) * 100 : 0}%`, background: color }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── BUYING INTENT (only rendered if data is present on calls) ── */}
                            {!loading && !analyticsLoading && Object.keys(intentCounts).length > 0 && (
                                <div>
                                    <div className="mb-3"><SectionLabel icon={Rocket} tone="#34d399">Buying Intent</SectionLabel></div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {Object.entries(intentCounts)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([intent, count]) => {
                                                const color = intent === "High" ? "#10b981" : intent === "Medium" ? "#f59e0b" : intent === "Low" ? "#f97316" : "#94a3b8";
                                                return (
                                                    <div key={intent} className="rounded-2xl border p-4" style={{ background: `${color}0d`, borderColor: `${color}30` }}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Lightbulb className="w-3.5 h-3.5" style={{ color }} />
                                                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{intent}</span>
                                                        </div>
                                                        <p className="text-2xl font-black" style={{ color: T.text }}>{count}</p>
                                                        <p className="text-xs mt-0.5" style={{ color: T.textFaint }}>
                                                            {total > 0 ? ((count / total) * 100).toFixed(1) : 0}% of calls
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {/* ── AI INSIGHTS PANEL — generated only from real, already-loaded stats ── */}
                            {!loading && !analyticsLoading && total > 0 && (
                                <div className="rounded-2xl border p-6 relative overflow-hidden"
                                    style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.05))", borderColor: "rgba(139,92,246,0.25)" }}>
                                    <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl pointer-events-none"
                                        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)" }} />
                                    <div className="relative">
                                        <div className="flex items-center justify-between mb-5">
                                            <SectionLabel icon={Brain} tone="#a78bfa">AI Executive Insights</SectionLabel>
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                                                style={{ background: "rgba(139,92,246,0.15)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}>
                                                Generated by Convexa AI
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex items-start gap-3 p-4 rounded-xl" style={{ border: `1px solid ${T.panelBorder}`, background: T.panelHover }}>
                                                <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-400 mb-1">Performance Summary</p>
                                                    <p className="text-sm leading-relaxed" style={{ color: T.textMuted }}>
                                                        Average QA score sits at <span className="font-bold" style={{ color: T.text }}>{avgScore}</span> across {total} calls,
                                                        with <span className="font-bold" style={{ color: T.text }}>{positivePct.toFixed(0)}%</span> landing on a positive sentiment.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 p-4 rounded-xl" style={{ border: `1px solid ${T.panelBorder}`, background: T.panelHover }}>
                                                <Flame className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wide text-amber-400 mb-1">Top Trend</p>
                                                    <p className="text-sm leading-relaxed" style={{ color: T.textMuted }}>
                                                        {scoreTrendPct == null
                                                            ? "Not enough recent calls yet to establish a score trend."
                                                            : scoreTrendPct >= 0
                                                                ? <>Scores are trending <span className="font-bold" style={{ color: T.text }}>up {scoreTrendPct.toFixed(1)}%</span> over the most recent calls.</>
                                                                : <>Scores are trending <span className="font-bold" style={{ color: T.text }}>down {Math.abs(scoreTrendPct).toFixed(1)}%</span> over the most recent calls.</>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 p-4 rounded-xl" style={{ border: `1px solid ${T.panelBorder}`, background: T.panelHover }}>
                                                <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wide text-red-400 mb-1">Risk</p>
                                                    <p className="text-sm leading-relaxed" style={{ color: T.textMuted }}>
                                                        {scoredTotal > 0
                                                            ? <><span className="font-bold" style={{ color: T.text }}>{highRisk}</span> call{highRisk === 1 ? "" : "s"} scored below 50 and may need review.</>
                                                            : "No scored calls yet to flag risk."}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 p-4 rounded-xl" style={{ border: `1px solid ${T.panelBorder}`, background: T.panelHover }}>
                                                <Rocket className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wide text-violet-400 mb-1">Opportunity</p>
                                                    <p className="text-sm leading-relaxed" style={{ color: T.textMuted }}>
                                                        {topKw.length > 0
                                                            ? <>"<span className="font-bold" style={{ color: T.text }}>{topKw[0][0]}</span>" is your most frequent keyword — worth building talk tracks around.</>
                                                            : "Upload more calls to surface keyword opportunities."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── KEYWORD CLOUD ── */}
                            {!loading && !analyticsLoading && topKw.length > 0 && (
                                <Panel T={T}>
                                    <SectionLabel icon={KeyRound} tone="#a1a1aa">Top Keywords</SectionLabel>

                                    <div className="flex flex-wrap gap-2 mb-6 mt-4">
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
                                                <span className="w-20 sm:w-32 text-xs font-medium truncate text-right" style={{ color: T.textMuted }}>{kw}</span>
                                                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.panelHover }}>
                                                    <div className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-700"
                                                        style={{ width: `${(cnt / topKw[0][1]) * 100}%` }} />
                                                </div>
                                                <span className="w-5 text-xs font-bold" style={{ color: T.textFaint }}>{cnt}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            )}
                        </>
                    )}
                </main>

                <footer className="mt-4" style={{ borderTop: `1px solid ${T.divider}` }}>
                    <div className="px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: T.textFaint }}>© 2026 Convexa AI · Conversation Intelligence Platform</span>
                        <span className="text-xs" style={{ color: T.textFaint, opacity: 0.6 }}>Powered by Whisper · Ollama · Qwen 2.5</span>
                    </div>
                </footer>
            </div>

            <style>{`
                @keyframes drawerSlideIn {
                    from { transform: translateX(100%); }
                    to   { transform: translateX(0); }
                }
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
}
