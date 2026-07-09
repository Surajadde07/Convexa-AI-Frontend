import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import api, { getUser } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";
import { Sidebar, THEMES } from "../components/Sidebar.jsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
    ClipboardList, Menu, Sun, Moon, ArrowUp, ArrowDown, Award, Target,
    MessageSquareWarning, Users, TrendingUp, TrendingDown, Scale, GitCompare,
    X, Smile, Frown, Meh, CheckCircle2, XCircle,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────── *
 * Scorecards — every call scored against the same 4-dimension QA rubric  *
 * your backend already computes. Aggregate averages come from            *
 * GET /api/dashboard/employee; the per-call list and history come from   *
 * GET /api/calls/my-calls. Per-call dimension breakdowns aren't returned *
 * by the API yet (only the aggregate averages are) — rows below show     *
 * overallScore/sentiment/outcome per call, which is everything the       *
 * backend currently exposes at that granularity. Extend CallRecord with  *
 * per-call dimension scores to unlock a full per-call rubric breakdown.  *
 * ────────────────────────────────────────────────────────────────────── */

const DIMENSIONS = [
    { key: "avgCommunication",        label: "Communication",       weight: "25%", color: "#8b5cf6", Icon: MessageSquareWarning, desc: "Clarity, pacing, active listening." },
    { key: "avgProblemResolution",    label: "Problem Resolution",  weight: "25%", color: "#3b82f6", Icon: Target,               desc: "Concrete next steps, follow-through." },
    { key: "avgProfessionalism",      label: "Professionalism",     weight: "25%", color: "#10b981", Icon: Award,                desc: "Structure, tone, preparedness." },
    { key: "avgCustomerSatisfaction", label: "Cust. Satisfaction",  weight: "25%", color: "#f59e0b", Icon: Users,                desc: "Sentiment and outcome of the call." },
];

const SENT_CONFIG = {
    POSITIVE: { color: "#10b981", Icon: Smile },
    NEGATIVE: { color: "#ef4444", Icon: Frown },
    NEUTRAL:  { color: "#f59e0b", Icon: Meh },
};

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
    return <div className="flex items-start justify-between gap-3 mb-5"><div><p className="text-sm font-bold tracking-tight" style={{ color: T.text }}>{title}</p>{sub && <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>{sub}</p>}</div>{right}</div>;
}
function Skeleton({ className = "", T }) {
    return <div className={`rounded-xl ${className}`} style={{ background: `linear-gradient(90deg, transparent 25%, ${T.panelHover} 50%, transparent 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />;
}
function ScoreRing({ score, size = 90, stroke = 8, color = "#8b5cf6", track = "rgba(255,255,255,0.06)", textColor = "white" }) {
    const r = (size - stroke) / 2, circ = 2 * Math.PI * r, pct = Math.min((score || 0) / 100, 1);
    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 6px ${color}80)` }} />
            <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill={textColor} fontSize={size * 0.22} fontWeight="800" style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%" }}>{score ?? "–"}</text>
        </svg>
    );
}

export default function ScorecardsPage() {
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [dashboardStats, setDashboardStats] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(true);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [themeMode, setThemeMode] = useState(() => localStorage.getItem("convexa_theme") || "dark");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [range, setRange] = useState("30d");

    const [compareIds, setCompareIds] = useState([]);
    const [compareOpen, setCompareOpen] = useState(false);

    const user = getUser();
    const T = THEMES[themeMode];
    const location = useLocation();

    const fetchCalls = useCallback(async () => {
        setLoading(true); setError(null);
        try { const res = await api.get("/api/calls/my-calls"); setCalls([...res.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))); }
        catch (err) { console.error(err); setError("Failed to load scorecards."); }
        finally { setLoading(false); }
    }, []);
    const fetchDashboard = useCallback(async (r) => {
        setDashboardLoading(true);
        try { const res = await api.get(`/api/dashboard/employee?range=${r}`); setDashboardStats(res.data); }
        catch (err) { console.error(err); }
        finally { setDashboardLoading(false); }
    }, []);
    useEffect(() => { fetchCalls(); }, [fetchCalls]);
    useEffect(() => { fetchDashboard(range); }, [range, fetchDashboard]);
    useEffect(() => { document.documentElement.style.colorScheme = themeMode; localStorage.setItem("convexa_theme", themeMode); }, [themeMode]);

    const handleLogout = () => logoutAndRedirect();

    const rangedCalls = useMemo(() => {
        if (range === "all") return calls;
        const days = range === "7d" ? 7 : 30;
        const cutoff = Date.now() - days * 86400000;
        return calls.filter(c => !c.createdAt || new Date(c.createdAt).getTime() >= cutoff);
    }, [calls, range]);

    const scoredCalls = rangedCalls.filter(c => c.overallScore != null);
    const avgScore = scoredCalls.length ? (scoredCalls.reduce((s, c) => s + c.overallScore, 0) / scoredCalls.length) : null;
    const bestScore = scoredCalls.length ? Math.max(...scoredCalls.map(c => c.overallScore)) : null;
    const worstScore = scoredCalls.length ? Math.min(...scoredCalls.map(c => c.overallScore)) : null;

    /* Score improvement: second half of the ranged period vs. first half. */
    const scoreDelta = useMemo(() => {
        const withDates = [...scoredCalls].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        if (withDates.length < 2) return null;
        const mid = Math.ceil(withDates.length / 2);
        const first = withDates.slice(0, mid).reduce((s, c) => s + c.overallScore, 0) / mid;
        const second = withDates.slice(mid).reduce((s, c) => s + c.overallScore, 0) / (withDates.length - mid || 1);
        if (first === 0) return null;
        return ((second - first) / first) * 100;
    }, [scoredCalls]);

    const historySeries = useMemo(() =>
        [...scoredCalls].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(c => ({
            date: c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
            score: c.overallScore,
        })), [scoredCalls]);

    const dims = DIMENSIONS.map(d => ({ ...d, value: dashboardStats?.[d.key] ?? null }));

    const toggleCompare = (id) => {
        setCompareIds(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            if (prev.length >= 2) return [prev[1], id];
            return [...prev, id];
        });
    };
    const compareCalls = compareIds.map(id => calls.find(c => c.id === id)).filter(Boolean);

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>
            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={user}
                handleLogout={handleLogout} currentPath={location.pathname}
                needsAttentionCount={(dashboardStats?.needsAttention ?? []).length} totalCalls={calls.length} />

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="sticky top-0 z-30" style={{ background: T.headerBg, borderBottom: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>
                    <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
                        <div className="md:hidden flex items-center gap-2 flex-shrink-0"><img src={logo} alt="Convexa AI" className="h-6 w-auto" /></div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.28)" }}><ClipboardList size={15} style={{ color: "#a78bfa" }} /></div>
                            <div><p className="text-sm font-bold" style={{ color: T.text }}>Scorecards</p><p className="text-[10px]" style={{ color: T.textFaint }}>{scoredCalls.length} scored call{scoredCalls.length !== 1 ? "s" : ""}</p></div>
                        </div>
                        <div className="flex-1" />
                        {compareIds.length > 0 && (
                            <button onClick={() => setCompareOpen(true)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl" style={{ background: "rgba(139,92,246,0.15)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}>
                                <GitCompare size={13} /> Compare ({compareIds.length}/2)
                            </button>
                        )}
                        <div className="hidden sm:flex items-center gap-1 rounded-xl p-1" style={{ background: T.panelHover }}>
                            {["7d", "30d", "all"].map(r => (
                                <button key={r} onClick={() => setRange(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={range === r ? { background: "rgba(139,92,246,0.2)", color: "#c4b5fd" } : { color: T.textFaint }}>{r === "7d" ? "7D" : r === "30d" ? "30D" : "All"}</button>
                            ))}
                        </div>
                        <button onClick={() => setThemeMode(m => m === "dark" ? "light" : "dark")} className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}>{themeMode === "dark" ? <Sun size={14} style={{ color: T.textMuted }} /> : <Moon size={14} style={{ color: T.textMuted }} />}</button>
                        <button onClick={() => setMobileMenuOpen(o => !o)} className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}><Menu size={16} style={{ color: T.textMuted }} /></button>
                    </div>
                </header>

                <main className="flex-1 px-4 sm:px-6 py-6 space-y-6 max-w-7xl w-full mx-auto">
                    {/* ── Average score summary ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Panel T={T} className="flex items-center gap-4">
                            <ScoreRing score={avgScore != null ? Math.round(avgScore) : null} size={64} stroke={6} color="#8b5cf6" track={T.panelHover} textColor={T.text} />
                            <div><p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Average</p><p className="text-lg font-black" style={{ color: T.text }}>{avgScore != null ? avgScore.toFixed(1) : "–"}</p></div>
                        </Panel>
                        <Panel T={T}>
                            <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: T.textFaint }}><TrendingUp size={11} /> Best</p>
                            <p className="text-2xl font-black mt-1" style={{ color: "#34d399" }}>{bestScore ?? "–"}</p>
                        </Panel>
                        <Panel T={T}>
                            <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: T.textFaint }}><TrendingDown size={11} /> Lowest</p>
                            <p className="text-2xl font-black mt-1" style={{ color: "#f87171" }}>{worstScore ?? "–"}</p>
                        </Panel>
                        <Panel T={T}>
                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Improvement</p>
                            <p className="text-2xl font-black mt-1 flex items-center gap-1" style={{ color: scoreDelta == null ? T.textFaint : scoreDelta >= 0 ? "#34d399" : "#f87171" }}>
                                {scoreDelta == null ? "–" : <>{scoreDelta >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}{Math.abs(scoreDelta).toFixed(1)}%</>}
                            </p>
                        </Panel>
                    </div>

                    {/* ── QA Rubric ── */}
                    <Panel T={T}>
                        <PanelHeader T={T} title="QA Rubric" sub="Every call is scored across four equally-weighted dimensions" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {dims.map(d => (
                                <div key={d.key} className="p-4 rounded-xl" style={{ background: T.panelHover }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="flex items-center gap-2 text-xs font-bold" style={{ color: T.text }}><d.Icon size={13} style={{ color: d.color }} />{d.label}</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${d.color}1c`, color: d.color }}>{d.weight}</span>
                                    </div>
                                    <p className="text-[11px] mb-2.5" style={{ color: T.textFaint }}>{d.desc}</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.panel }}><div className="h-full rounded-full" style={{ width: `${d.value ?? 0}%`, background: d.color }} /></div>
                                        <span className="text-xs font-black flex-shrink-0" style={{ color: T.text }}>{d.value != null ? d.value.toFixed(1) : "–"}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    {/* ── Score history ── */}
                    <Panel T={T}>
                        <PanelHeader T={T} title="Score History" sub="Overall score for every analysed call, in order" />
                        {loading ? <Skeleton T={T} className="h-56" /> : historySeries.length < 2 ? (
                            <p className="text-xs py-10 text-center" style={{ color: T.textFaint }}>Not enough scored calls yet to chart a trend.</p>
                        ) : (
                            <div style={{ height: 220 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={historySeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={T.divider} vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.textFaint }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: T.textFaint }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ background: themeMode === "dark" ? "#0b0f1e" : "#fff", border: `1px solid ${T.panelBorder}`, borderRadius: 10, fontSize: 12 }} />
                                        <Line type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 2.5, fill: "#8b5cf6" }} activeDot={{ r: 5 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </Panel>

                    {/* ── Historical scorecards list ── */}
                    <Panel T={T}>
                        <PanelHeader T={T} title="Historical Scorecards" sub="Select up to two calls to compare side by side" />
                        {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} T={T} className="h-14" />)}</div>
                        : error ? <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>
                        : scoredCalls.length === 0 ? <p className="text-xs" style={{ color: T.textFaint }}>No scored calls in this range yet.</p>
                        : (
                            <div className="space-y-1.5">
                                {scoredCalls.map(call => {
                                    const cfg = SENT_CONFIG[call.sentiment] || SENT_CONFIG.NEUTRAL;
                                    const SIcon = cfg.Icon;
                                    const checked = compareIds.includes(call.id);
                                    return (
                                        <div key={call.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors" style={{ background: checked ? "rgba(139,92,246,0.1)" : T.panelHover, border: `1px solid ${checked ? "rgba(139,92,246,0.35)" : "transparent"}` }}>
                                            <button onClick={() => toggleCompare(call.id)} className="flex-shrink-0">
                                                {checked ? <CheckCircle2 size={16} style={{ color: "#8b5cf6" }} /> : <div className="w-4 h-4 rounded-full" style={{ border: `1.5px solid ${T.textFaint}` }} />}
                                            </button>
                                            <Link to={`/calls/${call.id}`} className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate" style={{ color: T.text }}>{call.customerName || call.fileName}</p>
                                                <p className="text-[10px]" style={{ color: T.textFaint }}>{call.createdAt ? new Date(call.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""} · {call.outcome || "No outcome logged"}</p>
                                            </Link>
                                            <SIcon size={13} style={{ color: cfg.color }} className="flex-shrink-0" />
                                            <span className="text-sm font-black w-8 text-right flex-shrink-0" style={{ color: T.text }}>{call.overallScore}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Panel>
                </main>
            </div>

            {/* ── Comparison modal ── */}
            {compareOpen && compareCalls.length === 2 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)" }} onClick={() => setCompareOpen(false)}>
                    <div className="w-full max-w-2xl rounded-3xl p-6 sm:p-8" style={{ background: themeMode === "dark" ? "rgba(10,10,26,0.98)" : "#fff", border: `1px solid ${T.panelBorder}` }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <SectionLabel icon={Scale} tone="#8b5cf6">Call Comparison</SectionLabel>
                            <button onClick={() => setCompareOpen(false)}><X size={16} style={{ color: T.textFaint }} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                            {compareCalls.map(call => {
                                const cfg = SENT_CONFIG[call.sentiment] || SENT_CONFIG.NEUTRAL;
                                const SIcon = cfg.Icon;
                                return (
                                    <div key={call.id} className="rounded-2xl p-4" style={{ background: T.panelHover }}>
                                        <p className="text-xs font-bold truncate" style={{ color: T.text }}>{call.customerName || call.fileName}</p>
                                        <p className="text-[10px] mb-4" style={{ color: T.textFaint }}>{call.createdAt ? new Date(call.createdAt).toLocaleDateString() : ""}</p>
                                        <ScoreRing score={call.overallScore} size={80} color="#8b5cf6" track={T.panel} textColor={T.text} />
                                        <div className="mt-4 space-y-2 text-xs">
                                            <div className="flex items-center justify-between"><span style={{ color: T.textFaint }}>Sentiment</span><span className="flex items-center gap-1 font-semibold" style={{ color: cfg.color }}><SIcon size={12} />{call.sentiment || "–"}</span></div>
                                            <div className="flex items-center justify-between"><span style={{ color: T.textFaint }}>Outcome</span><span className="font-semibold text-right" style={{ color: T.text }}>{call.outcome || "–"}</span></div>
                                            <div className="flex items-center justify-between"><span style={{ color: T.textFaint }}>Type</span><span className="font-semibold" style={{ color: T.text }}>{call.callType || "–"}</span></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold" style={{ color: compareCalls[0].overallScore >= compareCalls[1].overallScore ? "#34d399" : "#f87171" }}>
                            {compareCalls[0].overallScore === compareCalls[1].overallScore ? "Both calls scored identically" : `${Math.abs(compareCalls[0].overallScore - compareCalls[1].overallScore)} point difference`}
                        </div>
                    </div>
                </div>
            )}

            <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        </div>
    );
}
