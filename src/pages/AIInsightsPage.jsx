import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import api, { getUser } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";
import { Sidebar, THEMES } from "../components/Sidebar.jsx";
import {
    Brain, TrendingUp, TrendingDown, Target, ShieldAlert, Gauge, Flame,
    Menu, Sun, Moon, ArrowRight, ArrowUp, ArrowDown, MessageSquareWarning,
    Users, Lightbulb, CalendarCheck, Award, Sparkles, ChevronRight, CheckCircle2,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────── *
 * AI Insights — your personal coach. Every number on this page traces to  *
 * a real field from GET /api/dashboard/employee or                       *
 * GET /api/analytics/employee. "Coaching plan" and "communication tips"  *
 * are templated from those real numbers (see buildCoachingPlan /         *
 * dimensionTips below) — not a fabricated model call. When a real        *
 * /api/insights/coaching endpoint exists, swap those two functions for a *
 * fetch and this page's layout doesn't need to change.                   *
 * ────────────────────────────────────────────────────────────────────── */

const DIMENSIONS = [
    { key: "avgCommunication",        label: "Communication",       color: "#8b5cf6", Icon: MessageSquareWarning },
    { key: "avgProblemResolution",    label: "Problem Resolution",  color: "#3b82f6", Icon: Target },
    { key: "avgProfessionalism",      label: "Professionalism",     color: "#10b981", Icon: Award },
    { key: "avgCustomerSatisfaction", label: "Cust. Satisfaction",  color: "#f59e0b", Icon: Users },
];

const TIPS = {
    avgCommunication: [
        "Slow down during pricing and objection moments — pace often spikes right when clarity matters most.",
        "Summarize what the customer said before responding; it signals you're listening and catches misunderstandings early.",
    ],
    avgProblemResolution: [
        "State the next concrete step before the call ends — 'I'll send X by Friday' beats 'I'll follow up soon.'",
        "When a blocker comes up, name it explicitly rather than talking around it — customers trust clarity over optimism.",
    ],
    avgProfessionalism: [
        "Open with a short agenda ('today I want to cover X and Y') — it frames the whole call and reads as prepared.",
        "Avoid filler acknowledgements ('yeah yeah, right, totally') stacked back to back — they read as rushed on transcript.",
    ],
    avgCustomerSatisfaction: [
        "Ask one open question before pitching — 'what's prompting you to look at this now?' consistently lifts sentiment.",
        "Close by confirming the customer got what they came for, not just what you wanted to say.",
    ],
};

function recommendationIconFor(text) {
    if (/landed negative/i.test(text)) return { Icon: ShieldAlert, color: "#ef4444" };
    if (/Average QA score/i.test(text)) return { Icon: Gauge, color: "#f59e0b" };
    if (/lowest-scoring dimension/i.test(text)) return { Icon: Target, color: "#3b82f6" };
    return { Icon: Flame, color: "#10b981" };
}

function buildCoachingPlan(dims, weakest) {
    if (!weakest) return [];
    const tips = TIPS[weakest.key] || [];
    return [
        `Focus area this week: ${weakest.label} (currently averaging ${weakest.value?.toFixed(1) ?? "–"}/100).`,
        ...tips,
        "Revisit this page after your next 5 calls to see the average move.",
    ];
}

function SectionLabel({ icon: Icon, children, tone = "#8b5cf6" }) {
    return (
        <div className="flex items-center gap-2">
            {Icon && <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${tone}1c`, border: `1px solid ${tone}35` }}><Icon size={11} style={{ color: tone }} strokeWidth={2.5} /></div>}
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: tone }}>{children}</span>
        </div>
    );
}
function Panel({ children, className = "", style = {}, T }) {
    return <div className={`rounded-2xl p-5 sm:p-6 ${className}`} style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, ...style }}>{children}</div>;
}
function PanelHeader({ title, sub, right, T }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-5">
            <div><p className="text-sm font-bold tracking-tight" style={{ color: T.text }}>{title}</p>{sub && <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>{sub}</p>}</div>
            {right}
        </div>
    );
}
function Skeleton({ className = "", T }) {
    return <div className={`rounded-xl ${className}`} style={{ background: `linear-gradient(90deg, transparent 25%, ${T.panelHover} 50%, transparent 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />;
}

export default function AIInsightsPage() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [themeMode, setThemeMode] = useState(() => localStorage.getItem("convexa_theme") || "dark");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [range, setRange] = useState("30d");

    const [dashboardStats, setDashboardStats] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState(null);

    const [analyticsStats, setAnalyticsStats] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);

    const user = getUser();
    const T = THEMES[themeMode];
    const location = useLocation();

    const fetchDashboard = useCallback(async (r) => {
        setDashboardLoading(true); setDashboardError(null);
        try { const res = await api.get(`/api/dashboard/employee?range=${r}`); setDashboardStats(res.data); }
        catch (err) { console.error(err); setDashboardError("Unable to load coaching data right now."); }
        finally { setDashboardLoading(false); }
    }, []);
    const fetchAnalytics = useCallback(async (r) => {
        setAnalyticsLoading(true);
        try { const res = await api.get(`/api/analytics/employee?range=${r}`); setAnalyticsStats(res.data); }
        catch (err) { console.error(err); }
        finally { setAnalyticsLoading(false); }
    }, []);
    useEffect(() => { fetchDashboard(range); fetchAnalytics(range); }, [range, fetchDashboard, fetchAnalytics]);
    useEffect(() => { document.documentElement.style.colorScheme = themeMode; localStorage.setItem("convexa_theme", themeMode); }, [themeMode]);

    const handleLogout = () => logoutAndRedirect();
    const totalCalls = dashboardStats?.totalCalls ?? 0;
    const needsAttention = dashboardStats?.needsAttention ?? [];

    const dims = useMemo(() => DIMENSIONS.map(d => ({ ...d, value: dashboardStats?.[d.key] ?? null })), [dashboardStats]);
    const scored = dims.filter(d => d.value != null);
    const strongest = scored.length ? scored.reduce((a, b) => (b.value > a.value ? b : a)) : null;
    const weakest = scored.length ? scored.reduce((a, b) => (b.value < a.value ? b : a)) : null;

    const recommendations = (dashboardStats?.recommendations ?? []).map(text => ({ ...recommendationIconFor(text), text }));
    const coachingPlan = buildCoachingPlan(dims, weakest);
    const tips = weakest ? (TIPS[weakest.key] || []) : [];

    const topKeywords = analyticsStats?.topKeywords ?? [];
    const intentDist = analyticsStats?.buyingIntentDistribution ?? {};
    const intentTotal = Object.values(intentDist).reduce((a, b) => a + b, 0) || 1;
    const scoreTrendPct = analyticsStats?.scoreTrendPercent ?? null;
    const callsTrendPct = analyticsStats?.callsTrendPercent ?? null;

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>
            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={user}
                handleLogout={handleLogout} currentPath={location.pathname}
                needsAttentionCount={needsAttention.length} totalCalls={totalCalls} />

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="sticky top-0 z-30" style={{ background: T.headerBg, borderBottom: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>
                    <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
                        <div className="md:hidden flex items-center gap-2 flex-shrink-0"><img src={logo} alt="Convexa AI" className="h-6 w-auto" /></div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.28)" }}>
                                <Brain size={15} style={{ color: "#a78bfa" }} />
                            </div>
                            <div><p className="text-sm font-bold" style={{ color: T.text }}>AI Insights</p><p className="text-[10px]" style={{ color: T.textFaint }}>Your personal coach</p></div>
                        </div>
                        <div className="flex-1" />
                        <div className="hidden sm:flex items-center gap-1 rounded-xl p-1" style={{ background: T.panelHover }}>
                            {["7d", "30d", "all"].map(r => (
                                <button key={r} onClick={() => setRange(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                    style={range === r ? { background: "rgba(139,92,246,0.2)", color: "#c4b5fd" } : { color: T.textFaint }}>
                                    {r === "7d" ? "7D" : r === "30d" ? "30D" : "All"}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setThemeMode(m => m === "dark" ? "light" : "dark")} className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}>
                            {themeMode === "dark" ? <Sun size={14} style={{ color: T.textMuted }} /> : <Moon size={14} style={{ color: T.textMuted }} />}
                        </button>
                        <button onClick={() => setMobileMenuOpen(o => !o)} className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}><Menu size={16} style={{ color: T.textMuted }} /></button>
                    </div>
                </header>

                <main className="flex-1 px-4 sm:px-6 py-6 space-y-6 max-w-7xl w-full mx-auto">
                    {totalCalls === 0 && !dashboardLoading ? (
                        <Panel T={T} className="text-center py-16">
                            <Brain size={28} className="mx-auto mb-3" style={{ color: T.textFaint }} />
                            <p className="text-sm font-semibold" style={{ color: T.text }}>No coaching data yet</p>
                            <p className="text-xs mt-1" style={{ color: T.textFaint }}>Upload and analyse a few calls, then come back — I'll start coaching you here.</p>
                        </Panel>
                    ) : (
                        <>
                            {/* ── Strengths / Weaknesses ── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <Panel T={T} style={{ background: "rgba(16,185,129,0.035)", borderColor: "rgba(16,185,129,0.2)" }}>
                                    <SectionLabel icon={TrendingUp} tone="#10b981">Overall Strength</SectionLabel>
                                    {dashboardLoading ? <Skeleton T={T} className="h-16 mt-4" /> : strongest ? (
                                        <div className="mt-4 flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(16,185,129,0.14)" }}><strongest.Icon size={22} style={{ color: "#34d399" }} /></div>
                                            <div><p className="text-base font-black" style={{ color: T.text }}>{strongest.label}</p><p className="text-xs mt-0.5" style={{ color: T.textMuted }}>Averaging {strongest.value.toFixed(1)}/100 over this period — your most consistent dimension.</p></div>
                                        </div>
                                    ) : <p className="text-xs mt-3" style={{ color: T.textFaint }}>Not enough scored calls yet.</p>}
                                </Panel>
                                <Panel T={T} style={{ background: "rgba(239,68,68,0.035)", borderColor: "rgba(239,68,68,0.2)" }}>
                                    <SectionLabel icon={TrendingDown} tone="#ef4444">Overall Weakness</SectionLabel>
                                    {dashboardLoading ? <Skeleton T={T} className="h-16 mt-4" /> : weakest ? (
                                        <div className="mt-4 flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.14)" }}><weakest.Icon size={22} style={{ color: "#f87171" }} /></div>
                                            <div><p className="text-base font-black" style={{ color: T.text }}>{weakest.label}</p><p className="text-xs mt-0.5" style={{ color: T.textMuted }}>Averaging {weakest.value.toFixed(1)}/100 — your biggest opportunity right now.</p></div>
                                        </div>
                                    ) : <p className="text-xs mt-3" style={{ color: T.textFaint }}>Not enough scored calls yet.</p>}
                                </Panel>
                            </div>

                            {/* ── Skill trends (4 dimensions) ── */}
                            <Panel T={T}>
                                <PanelHeader T={T} title="Skill Trends" sub="Average QA dimension scores over the selected period" />
                                {dashboardLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} T={T} className="h-8" />)}</div> : (
                                    <div className="space-y-4">
                                        {dims.map(d => (
                                            <div key={d.key}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: T.text }}><d.Icon size={12} style={{ color: d.color }} />{d.label}</span>
                                                    <span className="text-xs font-black" style={{ color: T.text }}>{d.value != null ? d.value.toFixed(1) : "–"}</span>
                                                </div>
                                                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: T.panelHover }}>
                                                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${d.value ?? 0}%`, background: d.color }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Panel>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                {/* ── Coaching recommendations (straight from backend) ── */}
                                <Panel T={T}>
                                    <SectionLabel icon={Lightbulb} tone="#f59e0b">Coaching Recommendations</SectionLabel>
                                    <div className="mt-4 space-y-2.5">
                                        {dashboardLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} T={T} className="h-10" />)
                                        : recommendations.length === 0 ? <p className="text-xs" style={{ color: T.textFaint }}>Nothing flagged — keep it up.</p>
                                        : recommendations.map((r, i) => (
                                            <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: T.panelHover }}>
                                                <r.Icon size={14} style={{ color: r.color }} className="flex-shrink-0 mt-0.5" />
                                                <p className="text-xs leading-relaxed" style={{ color: T.textMuted }}>{r.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>

                                {/* ── AI-generated coaching plan ── */}
                                <Panel T={T} style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(37,99,235,0.05))", borderColor: "rgba(139,92,246,0.25)" }}>
                                    <SectionLabel icon={CalendarCheck} tone="#8b5cf6">This Week's Coaching Plan</SectionLabel>
                                    <div className="mt-4 space-y-2.5">
                                        {dashboardLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} T={T} className="h-8" />)
                                        : coachingPlan.length === 0 ? <p className="text-xs" style={{ color: T.textFaint }}>Analyse a few calls to unlock your plan.</p>
                                        : coachingPlan.map((step, i) => (
                                            <div key={i} className="flex items-start gap-2.5">
                                                <CheckCircle2 size={14} style={{ color: "#a78bfa" }} className="flex-shrink-0 mt-0.5" />
                                                <p className="text-xs leading-relaxed" style={{ color: T.text }}>{step}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                {/* ── Frequently occurring objections/topics ── */}
                                <Panel T={T}>
                                    <SectionLabel icon={MessageSquareWarning} tone="#ef4444">Frequently Mentioned Topics</SectionLabel>
                                    <div className="mt-4 space-y-2">
                                        {analyticsLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} T={T} className="h-6" />)
                                        : topKeywords.length === 0 ? <p className="text-xs" style={{ color: T.textFaint }}>No recurring topics detected yet.</p>
                                        : topKeywords.slice(0, 6).map((k, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs">
                                                <span style={{ color: T.text }}>{k.keyword}</span>
                                                <span className="font-bold px-2 py-0.5 rounded-full" style={{ background: T.panelHover, color: T.textMuted }}>{k.count}×</span>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>

                                {/* ── Customer behavior analysis (buying intent) ── */}
                                <Panel T={T}>
                                    <SectionLabel icon={Users} tone="#3b82f6">Customer Behavior</SectionLabel>
                                    <p className="text-[11px] mt-1" style={{ color: T.textFaint }}>Buying-intent distribution across analysed calls</p>
                                    <div className="mt-4 space-y-3">
                                        {analyticsLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} T={T} className="h-6" />)
                                        : Object.keys(intentDist).length === 0 ? <p className="text-xs" style={{ color: T.textFaint }}>No intent data yet.</p>
                                        : Object.entries(intentDist).map(([label, count]) => (
                                            <div key={label}>
                                                <div className="flex items-center justify-between mb-1 text-xs"><span style={{ color: T.text }}>{label}</span><span style={{ color: T.textMuted }}>{Math.round((count / intentTotal) * 100)}%</span></div>
                                                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: T.panelHover }}>
                                                    <div className="h-full rounded-full" style={{ width: `${(count / intentTotal) * 100}%`, background: "#3b82f6" }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </div>

                            {/* ── Communication tips ── */}
                            <Panel T={T}>
                                <SectionLabel icon={Sparkles} tone="#a78bfa">Communication Tips For You</SectionLabel>
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {tips.length === 0 ? <p className="text-xs" style={{ color: T.textFaint }}>Tips will appear here once a focus area is identified.</p>
                                    : tips.map((tip, i) => (
                                        <div key={i} className="flex items-start gap-2.5 p-3.5 rounded-xl" style={{ background: T.panelHover }}>
                                            <ChevronRight size={14} style={{ color: "#a78bfa" }} className="flex-shrink-0 mt-0.5" />
                                            <p className="text-xs leading-relaxed" style={{ color: T.textMuted }}>{tip}</p>
                                        </div>
                                    ))}
                                </div>
                            </Panel>

                            {/* ── Repeated review items ── */}
                            {needsAttention.length > 0 && (
                                <Panel T={T} style={{ background: "rgba(239,68,68,0.03)", borderColor: "rgba(239,68,68,0.18)" }}>
                                    <PanelHeader T={T} title="Conversations Flagged For Review" sub="Calls that landed below your usual bar this period" />
                                    <div className="space-y-2">
                                        {needsAttention.slice(0, 6).map(call => (
                                            <Link key={call.id} to={`/calls/${call.id}`} className="flex items-center justify-between p-3 rounded-xl transition-colors" style={{ background: T.panel, border: `1px solid ${T.panelBorder}` }}>
                                                <div className="min-w-0"><p className="text-xs font-semibold truncate" style={{ color: T.text }}>{call.fileName}</p><p className="text-[10px]" style={{ color: T.textFaint }}>{call.createdAt ? new Date(call.createdAt).toLocaleDateString() : ""}</p></div>
                                                <div className="flex items-center gap-2 flex-shrink-0">{call.overallScore != null && <span className="text-xs font-black" style={{ color: "#f87171" }}>{call.overallScore}</span>}<ArrowRight size={12} style={{ color: T.textFaint }} /></div>
                                            </Link>
                                        ))}
                                    </div>
                                </Panel>
                            )}

                            {/* ── Weekly improvement trend ── */}
                            <Panel T={T}>
                                <PanelHeader T={T} title="Weekly Improvement" sub="Score and volume trend vs. the first half of this period"
                                    right={<div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1 text-xs font-bold" style={{ color: scoreTrendPct >= 0 ? "#34d399" : "#f87171" }}>{scoreTrendPct >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />} {scoreTrendPct != null ? `${Math.abs(scoreTrendPct).toFixed(1)}% score` : "–"}</span>
                                        <span className="flex items-center gap-1 text-xs font-bold" style={{ color: callsTrendPct >= 0 ? "#34d399" : "#f87171" }}>{callsTrendPct >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />} {callsTrendPct != null ? `${Math.abs(callsTrendPct).toFixed(1)}% volume` : "–"}</span>
                                    </div>} />
                                <p className="text-xs" style={{ color: T.textMuted }}>
                                    {scoreTrendPct == null ? "Not enough data yet to compute a trend." : scoreTrendPct >= 0
                                        ? `Your average score is trending up ${Math.abs(scoreTrendPct).toFixed(1)}% — whatever changed recently, keep doing it.`
                                        : `Your average score dipped ${Math.abs(scoreTrendPct).toFixed(1)}% recently — worth reviewing your last few flagged calls above.`}
                                </p>
                            </Panel>
                        </>
                    )}
                </main>
            </div>

            <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        </div>
    );
}
