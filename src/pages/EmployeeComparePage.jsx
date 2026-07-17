import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Users, ChevronRight, ChevronDown, Scale, TrendingUp, Sparkles, AlertTriangle, RefreshCw, Star } from "lucide-react";
import { Sidebar } from "../components/Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { getUser } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import { Panel, SectionLabel, EmptyState, ScoreBadge, ProgressBar } from "../components/CompanyUI.jsx";
import api from "../services/api.js";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export default function EmployeeComparePage() {
    const { userId } = useParams();
    const user = getUser();
    const { T, themeMode } = useTheme();
    const handleLogout = () => logoutAndRedirect();

    const [employees, setEmployees] = useState([]);
    const [empIdA, setEmpIdA] = useState(userId || "");
    const [empIdB, setEmpIdB] = useState("");
    
    const [profileA, setProfileA] = useState(null);
    const [profileB, setProfileB] = useState(null);
    
    const [loadingList, setLoadingList] = useState(true);
    const [loadingA, setLoadingA] = useState(false);
    const [loadingB, setLoadingB] = useState(false);
    
    const [range, setRange] = useState("30d");

    // Fetch employee listing
    useEffect(() => {
        async function loadEmployees() {
            setLoadingList(true);
            try {
                const res = await api.get("/api/company/employees");
                setEmployees(res.data);
                // Pre-populate second dropdown if others exist
                const other = res.data.find(e => String(e.id) !== String(userId));
                if (other) {
                    setEmpIdB(String(other.id));
                }
            } catch (err) {
                console.error("Failed to load employee list", err);
            } finally {
                setLoadingList(false);
            }
        }
        loadEmployees();
    }, [userId]);

    // Fetch profile A
    const loadProfileA = useCallback(async (id, r) => {
        if (!id) return;
        setLoadingA(true);
        try {
            const res = await api.get(`/api/company/employee/${id}?range=${r}`);
            setProfileA(res.data);
        } catch (err) {
            console.error("Failed to fetch profile A", err);
        } finally {
            setLoadingA(false);
        }
    }, []);

    // Fetch profile B
    const loadProfileB = useCallback(async (id, r) => {
        if (!id) return;
        setLoadingB(true);
        try {
            const res = await api.get(`/api/company/employee/${id}?range=${r}`);
            setProfileB(res.data);
        } catch (err) {
            console.error("Failed to fetch profile B", err);
        } finally {
            setLoadingB(false);
        }
    }, []);

    useEffect(() => {
        loadProfileA(empIdA, range);
    }, [empIdA, range, loadProfileA]);

    useEffect(() => {
        loadProfileB(empIdB, range);
    }, [empIdB, range, loadProfileB]);

    // Construct merged line charts datasets
    const scoreChartData = useMemo(() => {
        const seriesA = profileA?.analytics?.dailySeries || [];
        const seriesB = profileB?.analytics?.dailySeries || [];

        const dayMap = {};
        seriesA.forEach(pt => {
            dayMap[pt.date] = { date: pt.date, scoreA: pt.avgScore };
        });
        seriesB.forEach(pt => {
            if (dayMap[pt.date]) {
                dayMap[pt.date].scoreB = pt.avgScore;
            } else {
                dayMap[pt.date] = { date: pt.date, scoreB: pt.avgScore };
            }
        });

        return Object.values(dayMap).sort((x, y) => x.date.localeCompare(y.date));
    }, [profileA, profileB]);

    const tooltipStyle = {
        background: "rgba(10, 10, 26, 0.95)",
        borderColor: "rgba(255,255,255,0.09)",
        color: "#fff",
        borderRadius: "8px",
        fontSize: "11px",
    };

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>
            <Sidebar collapsed={false} setCollapsed={() => {}} T={T} user={user}
                handleLogout={handleLogout} currentPath="/company" needsAttentionCount={0} totalCalls={0} />
            
            <div className="flex-1 min-w-0 px-4 sm:px-6 py-7 space-y-6">
                
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.textFaint }}>
                    <Link to="/company" className="hover:underline" style={{ color: T.textMuted }}>Company</Link>
                    <ChevronRight size={12} />
                    <Link to={`/company/employee/${userId}`} className="hover:underline" style={{ color: T.textMuted }}>
                        {profileA?.name || "Employee"}
                    </Link>
                    <ChevronRight size={12} />
                    <span style={{ color: T.text }}>Side-by-Side Comparison</span>
                </div>

                {/* Selection Bar */}
                <Panel T={T} className="border border-violet-500/10">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Scale className="text-violet-400" size={18} />
                            <h2 className="text-base font-black text-white">Compare Team Members</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                            {/* Employee A select */}
                            <div className="relative flex-1 sm:flex-initial">
                                <select value={empIdA} onChange={e => setEmpIdA(e.target.value)}
                                        className="appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-semibold cursor-pointer outline-none w-full"
                                        style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}>
                                    <option value="">Select Employee A</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.textFaint }} />
                            </div>

                            <span className="text-xs font-bold text-slate-500">VS</span>

                            {/* Employee B select */}
                            <div className="relative flex-1 sm:flex-initial">
                                <select value={empIdB} onChange={e => setEmpIdB(e.target.value)}
                                        className="appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-semibold cursor-pointer outline-none w-full"
                                        style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}>
                                    <option value="">Select Employee B</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.textFaint }} />
                            </div>

                            {/* Range filter */}
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
                    </div>
                </Panel>

                {/* Main Comparison content */}
                {!empIdA || !empIdB ? (
                    <Panel T={T}>
                        <EmptyState icon={Users} T={T}
                            title="Select two employees"
                            subtitle="Choose two team members from the dropdown controls above to see side-by-side KPI benchmarks." />
                    </Panel>
                ) : loadingA || loadingB ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Panel T={T}><Skeleton T={T} className="h-64" /></Panel>
                        <Panel T={T}><Skeleton T={T} className="h-64" /></Panel>
                    </div>
                ) : (
                    <div className="space-y-6">
                        
                        {/* Side-by-side KPI Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            
                            {/* Profile A card */}
                            <Panel T={T} className="relative overflow-hidden border border-violet-500/10">
                                <div className="absolute top-3 right-3 text-[10px] font-bold text-violet-400 px-2 py-0.5 rounded bg-violet-500/10">REP A</div>
                                <h3 className="text-lg font-black text-white">{profileA?.name}</h3>
                                <p className="text-xs text-slate-400">{profileA?.role} · {profileA?.email}</p>
                                
                                <div className="grid grid-cols-2 gap-4 mt-5 text-xs">
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Average QA</p>
                                        <p className="text-lg font-black text-white">{profileA?.dashboard?.avgScore}%</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">CSAT Avg</p>
                                        <p className="text-lg font-black text-emerald-400">{profileA?.dashboard?.avgCustomerSatisfaction}%</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Call Volume</p>
                                        <p className="text-lg font-black text-white">{profileA?.dashboard?.totalCalls} Calls</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Positive sentiment %</p>
                                        <p className="text-lg font-black text-violet-300">{profileA?.dashboard?.positivePercent}%</p>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">QA Status:</span>
                                        <span className="font-bold text-violet-400">{profileA?.statusBadge}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">Risk Profile:</span>
                                        <span className="font-bold text-red-400">{profileA?.riskLevel} Risk</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">QA Progression:</span>
                                        <TrendIndicatorBadge trendPercent={profileA?.analytics?.scoreTrendPercent} />
                                    </div>
                                </div>
                            </Panel>

                            {/* Profile B card */}
                            <Panel T={T} className="relative overflow-hidden border border-amber-500/10">
                                <div className="absolute top-3 right-3 text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10">REP B</div>
                                <h3 className="text-lg font-black text-white">{profileB?.name}</h3>
                                <p className="text-xs text-slate-400">{profileB?.role} · {profileB?.email}</p>
                                
                                <div className="grid grid-cols-2 gap-4 mt-5 text-xs">
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Average QA</p>
                                        <p className="text-lg font-black text-white">{profileB?.dashboard?.avgScore}%</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">CSAT Avg</p>
                                        <p className="text-lg font-black text-emerald-400">{profileB?.dashboard?.avgCustomerSatisfaction}%</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Call Volume</p>
                                        <p className="text-lg font-black text-white">{profileB?.dashboard?.totalCalls} Calls</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Positive sentiment %</p>
                                        <p className="text-lg font-black text-amber-300">{profileB?.dashboard?.positivePercent}%</p>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">QA Status:</span>
                                        <span className="font-bold text-amber-400">{profileB?.statusBadge}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">Risk Profile:</span>
                                        <span className="font-bold text-red-400">{profileB?.riskLevel} Risk</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">QA Progression:</span>
                                        <TrendIndicatorBadge trendPercent={profileB?.analytics?.scoreTrendPercent} />
                                    </div>
                                </div>
                            </Panel>

                        </div>

                        {/* Side-by-side Skill Parameter Bar Comparison */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Panel T={T}>
                                <SectionLabel icon={TrendingUp} tone="#8b5cf6">Metric Benchmarks — {profileA?.name}</SectionLabel>
                                <div className="mt-4 space-y-4">
                                    <ProgressBar label="Communication" value={profileA?.dashboard?.avgCommunication || 0} target={100} color="#8b5cf6" T={T} />
                                    <ProgressBar label="Problem Resolution" value={profileA?.dashboard?.avgProblemResolution || 0} target={100} color="#10b981" T={T} />
                                    <ProgressBar label="Professionalism" value={profileA?.dashboard?.avgProfessionalism || 0} target={100} color="#3b82f6" T={T} />
                                    <ProgressBar label="Customer Satisfaction" value={profileA?.dashboard?.avgCustomerSatisfaction || 0} target={100} color="#fbbf24" T={T} />
                                </div>
                            </Panel>

                            <Panel T={T}>
                                <SectionLabel icon={TrendingUp} tone="#f59e0b">Metric Benchmarks — {profileB?.name}</SectionLabel>
                                <div className="mt-4 space-y-4">
                                    <ProgressBar label="Communication" value={profileB?.dashboard?.avgCommunication || 0} target={100} color="#a78bfa" T={T} />
                                    <ProgressBar label="Problem Resolution" value={profileB?.dashboard?.avgProblemResolution || 0} target={100} color="#34d399" T={T} />
                                    <ProgressBar label="Professionalism" value={profileB?.dashboard?.avgProfessionalism || 0} target={100} color="#60a5fa" T={T} />
                                    <ProgressBar label="Customer Satisfaction" value={profileB?.dashboard?.avgCustomerSatisfaction || 0} target={100} color="#fbbf24" T={T} />
                                </div>
                            </Panel>
                        </div>

                        {/* Shared Line Chart comparison of QA score over time */}
                        <Panel T={T}>
                            <SectionLabel icon={TrendingUp} tone="#8b5cf6">QA Score Progression Over Time</SectionLabel>
                            {scoreChartData.length === 0 ? (
                                <p className="text-xs text-slate-400 mt-3">No trend data available for comparison.</p>
                            ) : (
                                <div className="mt-4">
                                    <ResponsiveContainer width="100%" height={260}>
                                        <LineChart data={scoreChartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={T.divider} vertical={false} />
                                            <XAxis dataKey="date" tick={{ fill: T.textFaint, fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <YAxis domain={[0, 100]} tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                                            <Line type="monotone" dataKey="scoreA" name={profileA?.name} stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: "#8b5cf6", r: 4 }} />
                                            <Line type="monotone" dataKey="scoreB" name={profileB?.name} stroke="#fbbf24" strokeWidth={2.5} dot={{ fill: "#fbbf24", r: 4 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Panel>

                    </div>
                )}
            </div>
        </div>
    );
}
