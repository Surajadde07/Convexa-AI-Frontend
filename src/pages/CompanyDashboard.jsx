import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import api, { getUser } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";
import { Sidebar } from "../components/Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import {
    SectionLabel, Panel, Skeleton, TrendBadge, KPICard, tooltipStyleFor, ScoreBadge,
    performerBadge, coachingBadge, PerformanceBadgePill,
} from "../components/CompanyUI.jsx";
import {
    Building2, Phone, Star, Smile, GraduationCap, TrendingUp,
    AlertTriangle, RefreshCw, ChevronDown, Sun, Moon,
    Menu, X, Trophy, Users, Search,
} from "lucide-react";

// Design-system primitives now imported from CompanyUI.jsx (see imports above)

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function CompanyDashboard() {
    const user = getUser();
    const location = useLocation();
    const { themeMode, toggleTheme, T } = useTheme();
    const navigate = useNavigate();

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    // Sprint 2.5 Feature 5: this one range now drives KPIs, the volume chart,
    // Top Performers, AND Needs Coaching — it used to affect only the chart.
    const [range, setRange] = useState("30d");
    const [search, setSearch] = useState(""); // Feature 4 — frontend-only filter, no backend search

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async (r) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/api/company/stats?range=${r}`);
            setStats(res.data);
        } catch (err) {
            console.error("Failed to fetch company stats:", err);
            setError("Failed to load company data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(range); }, [fetchStats, range]);

    const handleLogout = () => { logoutAndRedirect(); };

    const totalCalls = stats?.totalCalls ?? 0;
    const tooltipStyle = tooltipStyleFor(T);

    // Feature 4 — pure client-side filter, no backend search. Applies to
    // both tables from the same search box.
    const filteredTopPerformers = useMemo(() => {
        const list = stats?.topPerformers ?? [];
        if (!search.trim()) return list;
        const q = search.trim().toLowerCase();
        return list.filter(p => p.employeeName?.toLowerCase().includes(q));
    }, [stats, search]);

    const filteredNeedsCoaching = useMemo(() => {
        const list = stats?.needsCoaching ?? [];
        if (!search.trim()) return list;
        const q = search.trim().toLowerCase();
        return list.filter(p => p.employeeName?.toLowerCase().includes(q));
    }, [stats, search]);

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>

            <div className="fixed inset-0 pointer-events-none opacity-[0.018]"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
            <div className="fixed top-0 left-1/3 w-96 h-96 rounded-full pointer-events-none opacity-[0.045] blur-3xl"
                style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />

            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={user}
                handleLogout={handleLogout} currentPath={location.pathname}
                needsAttentionCount={0} totalCalls={totalCalls} />

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="sticky top-0 z-30" style={{ background: T.headerBg, borderBottom: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>
                    <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
                        <div className="md:hidden flex items-center gap-2 flex-shrink-0">
                            <img src={logo} alt="Convexa AI" className="h-6 w-auto" />
                        </div>

                        <div className="flex-1" />

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={toggleTheme}
                                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}
                                title="Toggle theme">
                                {themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
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

                            <button className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-all flex-shrink-0"
                                onClick={() => setMobileMenuOpen(o => !o)}
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}` }}
                                aria-label="Toggle navigation menu">
                                {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
                            </button>
                        </div>
                    </div>
                </header>

                {mobileMenuOpen && (
                    <>
                        <div className="md:hidden fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
                            onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
                        <div className="md:hidden fixed top-0 right-0 h-full w-72 z-50 flex flex-col"
                            style={{ background: "linear-gradient(160deg, rgba(10,8,32,0.99) 0%, rgba(8,18,40,0.99) 100%)", borderLeft: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(24px)" }}>
                            <div className="flex items-center justify-between px-5 h-16 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Navigation</span>
                                <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl transition-all" style={{ background: "rgba(255,255,255,0.05)" }} aria-label="Close menu">
                                    <X size={14} className="text-slate-400" />
                                </button>
                            </div>
                            <nav className="flex flex-col gap-1 p-4 flex-1">
                                {[
                                    { label: "Dashboard", path: "/dashboard", Icon: TrendingUp },
                                    { label: "Analytics", path: "/analytics", Icon: TrendingUp },
                                    { label: "Company", path: "/company", Icon: Building2 },
                                ].map(({ label, path, Icon }) => (
                                    <Link key={label} to={path} onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all"
                                        style={location.pathname === path
                                            ? { background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.09)" }
                                            : { color: "#64748b", border: "1px solid transparent" }}>
                                        <Icon size={17} strokeWidth={2} className="flex-shrink-0" />
                                        <span className="truncate">{label}</span>
                                    </Link>
                                ))}
                            </nav>
                        </div>
                    </>
                )}

                <main className="flex-1 min-w-0 px-4 sm:px-6 py-7 space-y-6">

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                    style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.25)" }}>
                                    Manager / Admin
                                </span>
                            </div>
                            <h1 className="text-2xl font-black tracking-tight" style={{ color: T.text }}>Company Dashboard</h1>
                            <p className="text-sm mt-1" style={{ color: T.textMuted }}>
                                Company-wide performance across {totalCalls} analysed call{totalCalls !== 1 ? "s" : ""}
                            </p>
                        </div>

                        {/* Feature 5 — one range control for KPIs, chart, Top Performers, and Needs Coaching */}
                        <div className="relative flex-shrink-0">
                            <select value={range} onChange={e => setRange(e.target.value)}
                                className="appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-semibold cursor-pointer outline-none"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}>
                                <option value="7d">Last 7 days</option>
                                <option value="30d">Last 30 days</option>
                                <option value="90d">Last 90 days</option>
                            </select>
                            <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.textFaint }} />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                            <span className="text-sm text-red-300">{error}</span>
                            <button onClick={() => fetchStats(range)} className="ml-auto flex items-center gap-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg font-semibold transition-colors text-red-200">
                                <RefreshCw className="w-3 h-3" /> Retry
                            </button>
                        </div>
                    )}

                    {!loading && totalCalls === 0 ? (
                        <div className="text-center py-24 rounded-3xl border border-dashed" style={{ background: T.panel, borderColor: T.panelBorder }}>
                            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
                                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
                                <Building2 className="w-7 h-7 text-violet-300" />
                            </div>
                            <h2 className="text-xl font-black mb-2" style={{ color: T.text }}>No company data yet</h2>
                            <p className="text-sm mb-6" style={{ color: T.textMuted }}>Once your team uploads calls, company-wide performance will show up here.</p>
                        </div>
                    ) : (
                        <>
                            {/* ── KPI ROW ── */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {loading ? (
                                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} T={T} className="h-32" />)
                                ) : (
                                    <>
                                        <KPICard label="Total Calls" value={stats.totalCalls} Icon={Phone} accent="#8b5cf6" T={T} />
                                        <KPICard label="Average Score" value={stats.avgScore} Icon={Star} accent="#f59e0b" T={T} />
                                        <KPICard label="Positive %" value={`${stats.positivePercent}%`} Icon={Smile} accent="#10b981" T={T} />
                                        <KPICard label="Coaching Needed" value={stats.coachingNeededCount} sub={`in the selected range`} Icon={GraduationCap} accent="#ef4444" T={T} />
                                    </>
                                )}
                            </div>

                            {/* ── CALL VOLUME ── */}
                            <Panel T={T}>
                                <SectionLabel icon={TrendingUp} tone="#a1a1aa">Call Volume</SectionLabel>
                                {loading ? <Skeleton T={T} className="h-56 mt-4" /> : !stats.callVolume?.length ? (
                                    <div className="flex items-center justify-center h-48 text-sm flex-col gap-2 mt-4" style={{ color: T.textFaint }}>
                                        <TrendingUp className="w-8 h-8 opacity-50" />
                                        <span>No calls in this range yet</span>
                                    </div>
                                ) : (
                                    <div className="mt-4">
                                        <ResponsiveContainer width="100%" height={260}>
                                            <BarChart data={stats.callVolume} barSize={range === "7d" ? 32 : range === "30d" ? 14 : 7}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={T.divider} vertical={false} />
                                                <XAxis dataKey="date" tick={{ fill: T.textFaint, fontSize: 10 }} axisLine={false} tickLine={false} />
                                                <YAxis allowDecimals={false} tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} />
                                                <Bar dataKey="callCount" name="Calls" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </Panel>

                            {/* ── SEARCH (Feature 4) — filters both tables below, frontend-only ── */}
                            <div className="relative max-w-sm">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.textFaint }} />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…"
                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                                    style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* ── TOP PERFORMERS ── */}
                                <Panel T={T}>
                                    <SectionLabel icon={Trophy} tone="#f59e0b">Top Performers</SectionLabel>
                                    {loading ? <Skeleton T={T} className="h-56 mt-4" /> : !filteredTopPerformers.length ? (
                                        <div className="flex items-center justify-center h-40 text-sm flex-col gap-2 mt-4" style={{ color: T.textFaint }}>
                                            <Users className="w-8 h-8 opacity-50" />
                                            <span>{search ? "No matching employees" : "No employee data in this range"}</span>
                                        </div>
                                    ) : (
                                        <div className="mt-4 overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr style={{ color: T.textFaint }} className="text-left text-[11px] uppercase tracking-wider">
                                                        <th className="pb-2 font-semibold">Employee</th>
                                                        <th className="pb-2 font-semibold text-right">Calls</th>
                                                        <th className="pb-2 font-semibold text-right">Avg Score</th>
                                                        <th className="pb-2 font-semibold text-right">Trend</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredTopPerformers.map(p => (
                                                        <tr key={p.employeeId}
                                                            onClick={() => navigate(`/w/${user?.companySlug || "default"}/company/employee/${p.employeeId}`)}
                                                            className="cursor-pointer transition-colors"
                                                            style={{ borderTop: `1px solid ${T.divider}` }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = T.panelHover; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                                            <td className="py-2.5 font-semibold" style={{ color: T.text }}>
                                                                <div className="flex items-center gap-2">
                                                                    {p.employeeName}
                                                                    <PerformanceBadgePill badge={performerBadge(p.avgScore)} />
                                                                </div>
                                                            </td>
                                                            <td className="py-2.5 text-right" style={{ color: T.textMuted }}>{p.callCount}</td>
                                                            <td className="py-2.5 text-right"><ScoreBadge score={p.avgScore} /></td>
                                                            <td className="py-2.5 text-right"><TrendBadge pct={p.trendPercent} /></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Panel>

                                {/* ── NEEDS COACHING ── */}
                                <Panel T={T}>
                                    <SectionLabel icon={GraduationCap} tone="#ef4444">Needs Coaching</SectionLabel>
                                    {loading ? <Skeleton T={T} className="h-56 mt-4" /> : !filteredNeedsCoaching.length ? (
                                        <div className="flex items-center justify-center h-40 text-sm flex-col gap-2 mt-4" style={{ color: T.textFaint }}>
                                            <Smile className="w-8 h-8 opacity-50" style={{ color: "#10b981" }} />
                                            <span>{search ? "No matching employees" : "Nobody is under the 65 threshold right now"}</span>
                                        </div>
                                    ) : (
                                        <div className="mt-4 overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr style={{ color: T.textFaint }} className="text-left text-[11px] uppercase tracking-wider">
                                                        <th className="pb-2 font-semibold">Employee</th>
                                                        <th className="pb-2 font-semibold">Primary Weakness</th>
                                                        <th className="pb-2 font-semibold text-right">Calls</th>
                                                        <th className="pb-2 font-semibold text-right">Avg Score</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredNeedsCoaching.map(p => (
                                                        <tr key={p.employeeId}
                                                            onClick={() => navigate(`/w/${user?.companySlug || "default"}/company/employee/${p.employeeId}`)}
                                                            className="cursor-pointer transition-colors"
                                                            style={{ borderTop: `1px solid ${T.divider}` }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = T.panelHover; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                                            <td className="py-2.5 font-semibold" style={{ color: T.text }}>
                                                                <div className="flex items-center gap-2">
                                                                    {p.employeeName}
                                                                    <PerformanceBadgePill badge={coachingBadge(p.avgScore)} />
                                                                </div>
                                                            </td>
                                                            <td className="py-2.5" style={{ color: T.textMuted }}>{p.primaryWeakness ?? "—"}</td>
                                                            <td className="py-2.5 text-right" style={{ color: T.textMuted }}>{p.callCount}</td>
                                                            <td className="py-2.5 text-right"><ScoreBadge score={p.avgScore} /></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Panel>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}
