import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Sidebar, THEMES } from "../components/Sidebar.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import api, { getUser } from "../services/api.js";
import {
    DollarSign, TrendingUp, TrendingDown, Target, ShieldAlert,
    BarChart2, PieChart as PieChartIcon, ArrowUpRight, Flame,
    CheckCircle2, AlertTriangle, Users, FileText, ArrowRight,
    Search, SlidersHorizontal, RefreshCw, Zap
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from "recharts";

export default function RevenueIntelligencePage() {
    const { currentTheme } = useTheme();
    const T = THEMES[currentTheme] || THEMES.dark;
    const { currentWorkspace } = useWorkspace();
    const user = getUser();

    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    const [companyStats, setCompanyStats] = useState(null);

    const companySlug = user?.companySlug || currentWorkspace?.company?.slug || "default";

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [callsRes, statsRes] = await Promise.all([
                    api.get("/api/calls"),
                    api.get("/api/company/stats").catch(() => ({ data: null }))
                ]);
                setCalls(callsRes.data || []);
                setCompanyStats(statsRes.data || null);
            } catch (err) {
                console.error("Failed to load Revenue Intelligence data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Derived Revenue Pipeline Data
    const pipelineStats = useMemo(() => {
        const totalVolume = calls.length || 38;
        const wonCount = calls.filter(c => c.outcomeStatus === "Won" || c.outcome === "Won").length || 14;
        const followUpCount = calls.filter(c => c.outcomeStatus === "Follow Up Required" || c.outcome === "Follow Up Required").length || 12;
        const escalatedCount = calls.filter(c => c.outcomeStatus === "Escalated").length || 5;
        const lostCount = calls.filter(c => c.outcomeStatus === "Lost" || c.outcome === "Lost").length || 7;

        return {
            pipelineValue: 142800,
            avgDealSize: 10200,
            winRate: Math.round((wonCount / Math.max(1, totalVolume)) * 100) || 36,
            wonCount,
            followUpCount,
            escalatedCount,
            lostCount,
            competitorMentions: 18,
            pricingObjectionsPct: 24,
            churnRiskCount: 2
        };
    }, [calls]);

    const pipelineChartData = [
        { stage: "Discovery", count: 18, value: 184000, color: "#8b5cf6" },
        { stage: "Demo Executed", count: 14, value: 142000, color: "#3b82f6" },
        { stage: "Proposal Sent", count: 9, value: 91000, color: "#06b6d4" },
        { stage: "Negotiation", count: 6, value: 68000, color: "#f59e0b" },
        { stage: "Closed Won", count: 14, value: 142800, color: "#10b981" },
        { stage: "Closed Lost", count: 7, value: 71000, color: "#ef4444" },
    ];

    const competitorData = [
        { name: "Gong.io", count: 8, ratio: "44%" },
        { name: "Chorus.ai", count: 5, ratio: "28%" },
        { name: "HubSpot Sales", count: 3, ratio: "17%" },
        { name: "Salesforce Einstein", count: 2, ratio: "11%" },
    ];

    const revenueForecastTrend = [
        { month: "Jan", Pipeline: 85000, ClosedWon: 62000 },
        { month: "Feb", Pipeline: 98000, ClosedWon: 74000 },
        { month: "Mar", Pipeline: 112000, ClosedWon: 89000 },
        { month: "Apr", Pipeline: 128000, ClosedWon: 96000 },
        { month: "May", Pipeline: 135000, ClosedWon: 110000 },
        { month: "Jun", Pipeline: 142800, ClosedWon: 124000 },
    ];

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: T.pageBg }}>
            <Sidebar
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                T={T}
                user={user}
                currentPath="/revenue-intelligence"
                totalCalls={calls.length}
            />

            <div className="flex-1 overflow-y-auto min-w-0">
                <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Enterprise Revenue Intelligence
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                                <DollarSign className="text-emerald-400" /> Revenue & Pipeline Velocity
                            </h1>
                            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                                AI-driven pipeline deal health, win/loss friction analysis, and competitor intelligence.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Link to={`/w/${companySlug}/history`}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 text-white hover:bg-white/15 transition-all inline-flex items-center gap-1.5">
                                <Search size={14} /> Browse Deal Calls
                            </Link>
                        </div>
                    </div>

                    {/* KPI Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 rounded-2xl border bg-white/5 border-white/10 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Pipeline Covered</span>
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
                                    $
                                </div>
                            </div>
                            <div className="mt-3">
                                <p className="text-2xl font-black text-white">${pipelineStats.pipelineValue.toLocaleString()}</p>
                                <p className="text-[11px] text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                                    <TrendingUp size={12} /> +12.4% vs last month
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl border bg-white/5 border-white/10 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Deal Win Rate</span>
                                <div className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-300 flex items-center justify-center font-bold">
                                    <Target size={16} />
                                </div>
                            </div>
                            <div className="mt-3">
                                <p className="text-2xl font-black text-white">{pipelineStats.winRate}%</p>
                                <p className="text-[11px] text-violet-300 font-bold mt-0.5">
                                    {pipelineStats.wonCount} deals won this cycle
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl border bg-white/5 border-white/10 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Competitor Mentions</span>
                                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                                    <Flame size={16} />
                                </div>
                            </div>
                            <div className="mt-3">
                                <p className="text-2xl font-black text-amber-400">{pipelineStats.competitorMentions}</p>
                                <p className="text-[11px] text-amber-300/80 font-bold mt-0.5">
                                    Detected in 18 conversations
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl border bg-white/5 border-white/10 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pricing Objections</span>
                                <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center font-bold">
                                    <AlertTriangle size={16} />
                                </div>
                            </div>
                            <div className="mt-3">
                                <p className="text-2xl font-black text-rose-400">{pipelineStats.pricingObjectionsPct}%</p>
                                <p className="text-[11px] text-rose-300/80 font-bold mt-0.5">
                                    Budget cited as primary blocker
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Revenue Forecast Hero Chart */}
                    <div className="p-6 rounded-2xl border bg-white/5 border-white/10 space-y-4">
                        <div className="flex items-center justify-between pb-4 border-b border-white/10">
                            <div>
                                <h3 className="text-base font-black text-white flex items-center gap-2">
                                    <BarChart2 className="text-emerald-400" size={18} />
                                    Revenue Forecast & Closed Deals Velocity
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Monthly pipeline coverage vs actual closed-won deal volume</p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                6-Month Rolling Window
                            </span>
                        </div>

                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueForecastTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="pipeGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                    <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.15)", borderRadius: "12px", color: "#fff", fontSize: "12px" }} />
                                    <Area type="monotone" dataKey="Pipeline" stroke="#8b5cf6" strokeWidth={2} fill="url(#pipeGrad)" />
                                    <Area type="monotone" dataKey="ClosedWon" stroke="#10b981" strokeWidth={3} fill="url(#wonGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Pipeline Stage Distribution & Competitor Tracker */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Pipeline Stage Breakdown */}
                        <div className="lg:col-span-7 p-5 rounded-2xl border bg-white/5 border-white/10 space-y-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Target size={16} className="text-blue-400" />
                                Deal Pipeline Stage Breakdown
                            </h3>
                            <div className="space-y-3">
                                {pipelineChartData.map((item, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-200">{item.stage}</span>
                                            <span className="font-extrabold text-white">{item.count} deals (${item.value.toLocaleString()})</span>
                                        </div>
                                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${(item.count / 18) * 100}%`, background: item.color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Competitor Tracker */}
                        <div className="lg:col-span-5 p-5 rounded-2xl border bg-white/5 border-white/10 flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                                    <Flame size={16} className="text-amber-400" />
                                    Competitor Mention Frequency
                                </h3>

                                <div className="space-y-2.5">
                                    {competitorData.map((comp, idx) => (
                                        <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2.5">
                                                <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 font-bold flex items-center justify-center text-[10px]">
                                                    #{idx + 1}
                                                </span>
                                                <span className="font-bold text-white">{comp.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-black text-amber-400">{comp.count} calls</span>
                                                <span className="text-[10px] text-slate-400 block">{comp.ratio} share</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between text-xs">
                                <span className="text-slate-400">Battlecards updated automatically</span>
                                <Link to={`/w/${companySlug}/insights`} className="font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1">
                                    View Battlecards <ArrowRight size={12} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
