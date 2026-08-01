import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import api, { getUser } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";
import { Sidebar } from "../components/Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import {
    SectionLabel, Panel, Skeleton, KPICard, tooltipStyleFor, ScoreBadge,
    SENTIMENT_COLORS, buyingIntentColor, EmptyState, PerformanceBadgePill,
} from "../components/CompanyUI.jsx";
import {
    AISummaryCard, TrendIndicatorBadge, RiskLevelCard, SkillBars, GoalProgress,
    CoachingCenter, NotesTimeline, ActivityFeedPanel, StickyActionBar,
    StatusDot, deriveStatus, UpcomingActionsCard, AlertCenterCard, TeamComparisonCard
} from "../components/ManagerWorkspace.jsx";
import { generateEmployeeReport, generatePerformanceReview } from "../utils/generateReport.js";
import { generateEmployeeCSV } from "../utils/generateEmployeeCSV.js";
import {
    Phone, Star, Smile, GraduationCap, TrendingUp, ArrowUp, ArrowDown, Minus,
    AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Sun, Moon,
    Menu, X, Mail, Calendar, ThumbsUp, ThumbsDown, ListChecks, ShieldAlert,
    MessageSquareWarning, ClipboardList, Building2, UserCog, PhoneCall,
    Target, Trophy, Heart, Activity, Award, BookOpen, Send, FileText, CheckCircle2
} from "lucide-react";
import {
    ScheduleCoachingModal, AssignLearningModal, CreateImprovementPlanModal,
    AddNoteModal, MarkImprovedModal, shareReportLink
} from "../components/ManagerModals.jsx";

function ScoreArrow({ current, previous }) {
    if (previous == null) return <Minus size={14} style={{ color: "#64748b" }} />;
    if (current > previous) return <ArrowUp size={14} style={{ color: "#34d399" }} />;
    if (current < previous) return <ArrowDown size={14} style={{ color: "#f87171" }} />;
    return <Minus size={14} style={{ color: "#64748b" }} />;
}

export default function EmployeePerformancePage() {
    const { userId } = useParams();
    const user = getUser();
    const navigate = useNavigate();
    const { themeMode, toggleTheme, T } = useTheme();

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [range, setRange] = useState("30d");

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modals visibility states
    const [coachingOpen, setCoachingOpen] = useState(false);
    const [learningOpen, setLearningOpen] = useState(false);
    const [pipOpen, setPipOpen] = useState(false);
    const [noteOpen, setNoteOpen] = useState(false);
    const [improvedOpen, setImprovedOpen] = useState(false);

    const fetchProfile = useCallback(async (r) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/api/company/employee/${userId}?range=${r}`);
            setProfile(res.data);
        } catch (err) {
            console.error("Failed to fetch employee profile:", err);
            setError("Failed to load this employee's performance data.");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { fetchProfile(range); }, [fetchProfile, range]);

    const handleLogout = () => { logoutAndRedirect(); };

    // ── Export Triggers ────────────────────────────────────────────────
    const handleExportPDF = () => { if (profile) generateEmployeeReport(profile); };
    const handleExportCSV = () => { if (profile) generateEmployeeCSV(profile); };
    const handleGenerateReview = () => { if (profile) generatePerformanceReview(profile); };
    const handleShareReport = () => { shareReportLink(userId, T); };
    const handleCompare = () => navigate(`/company/compare/${userId}`);

    const tooltipStyle = tooltipStyleFor(T);
    const dashboard = profile?.dashboard;
    const analytics = profile?.analytics;

    const status = deriveStatus(profile?.recentCalls?.[0]?.createdAt);

    const sentimentPieData = analytics ? [
        { name: "POSITIVE", value: analytics.positivePercent ?? 0 },
        { name: "NEUTRAL", value: analytics.neutralPercent ?? 0 },
        { name: "NEGATIVE", value: analytics.negativePercent ?? 0 },
    ].filter(d => d.value > 0) : [];

    const buyingIntentPieData = analytics?.buyingIntentDistribution
        ? Object.entries(analytics.buyingIntentDistribution).map(([name, value]) => ({ name, value }))
        : [];

    const timeline = (profile?.recentCalls ?? []).slice().reverse();

    // Achievements calculation
    const achievements = [];
    if (dashboard?.avgScore >= 85) {
        achievements.push({ label: "Top Performer", desc: "Avg score >= 85%", color: "#fbbf24", Icon: Trophy });
    }
    if (analytics?.scoreTrendPercent > 4.0) {
        achievements.push({ label: "Fast Improver", desc: "Trend increase > 4%", color: "#34d399", Icon: Activity });
    }
    if (dashboard?.avgCustomerSatisfaction >= 80) {
        achievements.push({ label: "Customer Favourite", desc: "CSAT average >= 80%", color: "#f472b6", Icon: Heart });
    }
    if (dashboard?.avgScore >= 80) {
        achievements.push({ label: "High QA", desc: "QA average >= 80%", color: "#60a5fa", Icon: Award });
    }
    if (dashboard?.positivePercent >= 60) {
        achievements.push({ label: "Positive Streak", desc: "Positive Calls >= 60%", color: "#a78bfa", Icon: Star });
    }

    const round1 = (v) => Math.round(v * 10) / 10.0;

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>

            <div className="fixed top-0 left-1/3 w-96 h-96 rounded-full pointer-events-none opacity-[0.045] blur-3xl"
                style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />

            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={user}
                handleLogout={handleLogout} currentPath="/company"
                needsAttentionCount={profile?.alerts?.length ?? 0} totalCalls={dashboard?.totalCalls ?? 0} />

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="sticky top-0 z-30" style={{ background: T.headerBg, borderBottom: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>
                    <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
                        <div className="md:hidden flex items-center gap-2 flex-shrink-0">
                            <img src={logo} alt="Convexa AI" className="h-6 w-auto" />
                        </div>
                        <div className="flex-1" />
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={toggleTheme}
                                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors flex-shrink-0 cursor-pointer"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}
                                title="Toggle theme">
                                {themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                            </button>
                            <button className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-all flex-shrink-0 cursor-pointer"
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
                                <Link to="/company" onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all"
                                    style={{ color: "#64748b", border: "1px solid transparent" }}>
                                    <ChevronRight size={17} strokeWidth={2} className="flex-shrink-0 rotate-180" />
                                    <span className="truncate">Back to Company</span>
                                </Link>
                            </nav>
                        </div>
                    </>
                )}

                <main className="flex-1 min-w-0 px-4 sm:px-6 py-7 space-y-6">

                    <StickyActionBar
                        onCreatePlan={() => setPipOpen(true)}
                        onScheduleCoaching={() => setCoachingOpen(true)}
                        onGenerateReview={handleGenerateReview}
                        onCompare={handleCompare}
                        onDownloadReport={handleExportPDF}
                        onShare={handleShareReport}
                        T={T} />

                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.textFaint }}>
                        <Link to="/company" className="hover:underline" style={{ color: T.textMuted }}>Company</Link>
                        <ChevronRight size={12} />
                        <span style={{ color: T.text }}>{profile?.name ?? "Employee"}</span>
                        <ChevronRight size={12} />
                        <span style={{ color: T.text }}>Manager Workspace</span>
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                            <span className="text-sm text-red-300">{error}</span>
                            <button onClick={() => fetchProfile(range)} className="ml-auto flex items-center gap-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg font-semibold transition-colors text-red-200 cursor-pointer">
                                <RefreshCw className="w-3 h-3" /> Retry
                            </button>
                        </div>
                    )}

                    {/* ── TOP HEADER EXECUTIVE SUMMARY ── */}
                    {loading ? (
                        <Panel T={T}><Skeleton T={T} className="h-40" /></Panel>
                    ) : (
                        <Panel T={T} className="relative overflow-hidden border border-violet-500/10">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4" style={{ borderBottom: `1px solid ${T.divider}` }}>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black flex-shrink-0"
                                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "#fff" }}>
                                        {profile?.name?.[0]?.toUpperCase() ?? "?"}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h1 className="text-xl font-black text-white">{profile?.name}</h1>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.25)" }}>
                                                {profile?.role || "USER"}
                                            </span>
                                            <StatusDot status={status} />
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: T.textMuted }}>
                                            <span className="flex items-center gap-1"><Mail size={12} /> {profile?.email}</span>
                                            <span>•</span>
                                            <span>Joined {profile?.joinedDate ? new Date(profile.joinedDate).toLocaleDateString() : "—"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
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
                            
                            {/* Health block */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 pt-4 text-xs font-semibold">
                                <div>
                                    <p style={{ color: T.textFaint }} className="text-[10px] uppercase tracking-wider mb-1">Health Status</p>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px]"
                                        style={{
                                            background: profile?.healthStatus === 'Green' ? 'rgba(16,185,129,0.12)' : profile?.healthStatus === 'Yellow' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                                            color: profile?.healthStatus === 'Green' ? '#34d399' : profile?.healthStatus === 'Yellow' ? '#fbbf24' : '#f87171'
                                        }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: profile?.healthStatus === 'Green' ? '#34d399' : profile?.healthStatus === 'Yellow' ? '#fbbf24' : '#f87171' }} />
                                        {profile?.healthStatus} Health
                                    </span>
                                </div>
                                <div>
                                    <p style={{ color: T.textFaint }} className="text-[10px] uppercase tracking-wider mb-1">Risk Level</p>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px]"
                                        style={{
                                            background: profile?.riskLevel === 'Low' ? 'rgba(16,185,129,0.12)' : profile?.riskLevel === 'Medium' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                                            color: profile?.riskLevel === 'Low' ? '#34d399' : profile?.riskLevel === 'Medium' ? '#fbbf24' : '#f87171'
                                        }}>
                                        {profile?.riskLevel} Risk
                                    </span>
                                </div>
                                <div>
                                    <p style={{ color: T.textFaint }} className="text-[10px] uppercase tracking-wider mb-1">QA Trend</p>
                                    <TrendIndicatorBadge trendPercent={analytics?.scoreTrendPercent} />
                                </div>
                                <div>
                                    <p style={{ color: T.textFaint }} className="text-[10px] uppercase tracking-wider mb-0.5">Last Coaching</p>
                                    <p className="text-white font-black">{profile?.lastCoachingDate ? new Date(profile.lastCoachingDate).toLocaleDateString() : "None Completed"}</p>
                                </div>
                                <div>
                                    <p style={{ color: T.textFaint }} className="text-[10px] uppercase tracking-wider mb-0.5">Next Review</p>
                                    <p className="text-white font-black">{profile?.nextReviewDate ? new Date(profile.nextReviewDate).toLocaleDateString() : "—"}</p>
                                </div>
                                <div>
                                    <p style={{ color: T.textFaint }} className="text-[10px] uppercase tracking-wider mb-0.5">Performance Status</p>
                                    <p className="text-violet-300 font-black">{profile?.statusBadge || "—"}</p>
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-3 flex gap-2 items-start" style={{ borderTop: `1px solid ${T.divider}` }}>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 px-2 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: "rgba(139,92,246,0.12)" }}>Recommendation</span>
                                <p className="text-xs text-slate-300 italic">"{profile?.overallRecommendation}"</p>
                            </div>
                        </Panel>
                    )}

                    {/* ── 8 PROFESSIONAL KPI CARDS GRID ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} T={T} className="h-28" />)
                        ) : (
                            <>
                                <KPICard label="Coaching History" value={profile?.coachingSessions?.filter(s => s.status === 'Completed').length + " Sessions"} sub="Completed sessions" Icon={Phone} accent="#8b5cf6" T={T} />
                                <KPICard label="Learning Progress" value={profile?.learningAssignments?.filter(a => a.status === 'Completed').length + " / " + profile?.learningAssignments?.length} sub="Completed modules" Icon={BookOpen} accent="#f59e0b" T={T} />
                                <KPICard label="Performance Goal" value={dashboard?.avgScore + "% / " + (profile?.improvementPlans?.[0]?.targetQA || "85") + "%"} sub="QA Target Progress" Icon={Target} accent="#3b82f6" T={T} />
                                <KPICard label="Customer Satisfaction" value={`${dashboard?.avgCustomerSatisfaction ?? 0}%`} sub="CSAT score average" Icon={Smile} accent="#10b981" T={T} />
                                <KPICard label="Escalation Rate" value={`${round1(profile?.teamComparison?.find(r => r.metric === 'Escalation Rate %')?.employeeValue || 0)}%`} sub="Percentage escalated" Icon={MessageSquareWarning} accent="#ef4444" T={T} />
                                <KPICard label="Call Quality" value={`${Math.round(((dashboard?.avgCommunication || 0) + (dashboard?.avgProblemResolution || 0) + (dashboard?.avgProfessionalism || 0)) / 3)}%`} sub="Technical quality avg" Icon={Award} accent="#38bdf8" T={T} />
                                <KPICard label="Improvement %" value={`+${analytics?.scoreTrendPercent > 0 ? round1(analytics.scoreTrendPercent) : 0}%`} sub="Trend progression" Icon={TrendingUp} accent="#a78bfa" T={T} />
                                <KPICard label="Review Score" value={`${dashboard?.avgScore ?? 0} Avg`} sub="QA average score" Icon={Star} accent="#fbbf24" T={T} />
                            </>
                        )}
                    </div>

                    {/* AI Executive summary briefing */}
                    {!loading && profile && <AISummaryCard profile={profile} T={T} />}

                    {/* Coaching Center action triggers */}
                    {!loading && profile && (
                        <CoachingCenter
                            onScheduleCoaching={() => setCoachingOpen(true)}
                            onAddNote={() => setNoteOpen(true)}
                            onAssignModule={() => setLearningOpen(true)}
                            onMarkImproved={() => setImprovedOpen(true)}
                            T={T} />
                    )}

                    {/* Modals wiring */}
                    {!loading && profile && (
                        <>
                            <ScheduleCoachingModal open={coachingOpen} onClose={() => setCoachingOpen(false)} employeeId={userId} T={T} onSave={() => fetchProfile(range)} />
                            <AssignLearningModal open={learningOpen} onClose={() => setLearningOpen(false)} employeeId={userId} T={T} onSave={() => fetchProfile(range)} />
                            <CreateImprovementPlanModal open={pipOpen} onClose={() => setPipOpen(false)} employeeId={userId} T={T} onSave={() => fetchProfile(range)} />
                            <AddNoteModal open={noteOpen} onClose={() => setNoteOpen(false)} employeeId={userId} T={T} onSave={() => fetchProfile(range)} />
                            <MarkImprovedModal open={improvedOpen} onClose={() => setImprovedOpen(false)} employeeId={userId} T={T} onSave={() => fetchProfile(range)} />
                        </>
                    )}

                    {/* Achievements, Development Plan & Skill metrics */}
                    {!loading && profile && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Achievements badges */}
                            <Panel T={T}>
                                <SectionLabel icon={Trophy} tone="#fbbf24">Achievements & Badges</SectionLabel>
                                {!achievements.length ? (
                                    <p className="text-xs text-slate-400 mt-3">No special badges unlocked yet. Keep coaching to unlock performance triggers.</p>
                                ) : (
                                    <div className="mt-4 space-y-3.5">
                                        {achievements.map((ach, i) => (
                                            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border"
                                                 style={{ background: "rgba(255,255,255,0.01)", borderColor: T.panelBorder }}>
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                     style={{ background: `${ach.color}15`, border: `1px solid ${ach.color}30` }}>
                                                    <ach.Icon size={14} style={{ color: ach.color }} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white text-xs">{ach.label}</p>
                                                    <p className="text-[10px] text-slate-500">{ach.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Panel>

                            {/* Improvement plan tracking */}
                            {profile.improvementPlans?.[0] ? (
                                <Panel T={T}>
                                    <SectionLabel icon={Target} tone="#ef4444">Active Improvement Plan</SectionLabel>
                                    <div className="mt-4 space-y-3 text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Target QA Score:</span>
                                            <span className="font-bold text-white">{profile.improvementPlans[0].targetQA}%</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Target Sentiment:</span>
                                            <span className="font-bold text-white">{profile.improvementPlans[0].targetSentiment}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Deadline:</span>
                                            <span className="font-bold text-red-400">{new Date(profile.improvementPlans[0].deadline).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Assigned Modules:</span>
                                            <span className="font-bold text-violet-300 truncate max-w-[150px]">{profile.improvementPlans[0].assignedModules || "None"}</span>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1 text-[11px]">
                                                <span className="text-slate-400">Plan Progress:</span>
                                                <span className="font-bold text-white">{profile.improvementPlans[0].progress}%</span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                                <div className="h-full bg-violet-500 rounded-full animate-pulse" style={{ width: `${profile.improvementPlans[0].progress}%` }} />
                                            </div>
                                        </div>
                                        <div className="pt-2.5 flex justify-between items-center" style={{ borderTop: `1px solid ${T.divider}` }}>
                                            <span className="text-slate-400">PIP Status:</span>
                                            <span className="text-[10px] font-black uppercase text-red-400 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">{profile.improvementPlans[0].status}</span>
                                        </div>
                                    </div>
                                </Panel>
                            ) : (
                                <Panel T={T}>
                                    <SectionLabel icon={Target} tone="#94a3b8">Active Improvement Plan</SectionLabel>
                                    <p className="text-xs text-slate-400 mt-3">No active Performance Improvement Plan (PIP) logged for this employee.</p>
                                    <button onClick={() => setPipOpen(true)} className="mt-5 w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer">
                                        Create Improvement Plan
                                    </button>
                                </Panel>
                            )}

                            <SkillBars dashboard={dashboard} T={T} />
                        </div>
                    )}

                    {/* Manager Insights & Coaching History */}
                    {!loading && profile && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Manager insights priority block */}
                            <Panel T={T}>
                                <SectionLabel icon={ShieldAlert} tone="#ef4444">Manager Insights</SectionLabel>
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded" 
                                          style={{
                                              background: profile?.riskLevel === 'High' ? 'rgba(239,68,68,0.12)' : profile?.riskLevel === 'Medium' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                                              color: profile?.riskLevel === 'High' ? '#f87171' : profile?.riskLevel === 'Medium' ? '#fbbf24' : '#34d399'
                                          }}>
                                        Priority: {profile?.riskLevel === 'High' ? 'CRITICAL HIGH' : profile?.riskLevel === 'Medium' ? 'MEDIUM ATTENTION' : 'LOW ATTENTION'}
                                    </span>
                                </div>
                                <div className="mt-4 space-y-3.5 text-xs">
                                    <div>
                                        <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5">Observations / Reasons:</p>
                                        <ul className="space-y-1.5 text-slate-300">
                                            {profile?.riskLevel === 'High' && <li>• Average QA score has dropped below 60% standard</li>}
                                            {profile?.riskLevel === 'Medium' && <li>• Performance score warrants coaching attention</li>}
                                            {analytics?.negativePercent > 20 && <li>• Negative customer sentiment has increased to {round1(analytics.negativePercent)}%</li>}
                                            {profile?.recentCalls?.filter(c => c.outcomeStatus === 'Escalated').length >= 1 && <li>• Inbound call escalations detected in recent history</li>}
                                            {profile?.alerts?.map((al, idx) => <li key={idx}>• {al}</li>)}
                                            {profile?.alerts?.length === 0 && <li>• All variables within normal operating thresholds.</li>}
                                        </ul>
                                    </div>
                                    <div className="pt-2.5" style={{ borderTop: `1px solid ${T.divider}` }}>
                                        <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5">Recommended Actions:</p>
                                        <ul className="space-y-1.5 text-violet-300 font-medium">
                                            {dashboard?.avgScore < 70 && <li>• Establish structured Improvement Plan (PIP)</li>}
                                            {profile?.lastCoachingDate == null && <li>• Schedule introduction 1-on-1 coaching session</li>}
                                            {dashboard?.weakestDimensionLabel && <li>• Assign learning module on {dashboard.weakestDimensionLabel}</li>}
                                            <li>• Re-evaluate employee status in 14 days</li>
                                        </ul>
                                    </div>
                                </div>
                            </Panel>

                            {/* Coaching History log */}
                            <Panel T={T}>
                                <SectionLabel icon={Calendar} tone="#8b5cf6">Coaching Session Logs</SectionLabel>
                                {!profile?.coachingSessions?.length ? (
                                    <p className="text-xs text-slate-400 mt-3">No coaching sessions scheduled yet.</p>
                                ) : (
                                    <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                        {profile.coachingSessions.map((session, i) => {
                                            let statusBg = "rgba(245,158,11,0.1)";
                                            let statusText = "#fbbf24";
                                            if (session.status === "Completed") {
                                                statusBg = "rgba(16,185,129,0.1)";
                                                statusText = "#34d399";
                                            } else if (session.status === "Cancelled") {
                                                statusBg = "rgba(239,68,68,0.1)";
                                                statusText = "#f87171";
                                            }
                                            
                                            return (
                                                <div key={session.id || i} className="p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs"
                                                     style={{ background: T.panelHover, borderColor: T.panelBorder }}>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-white truncate">{session.reason}</p>
                                                        <p className="text-[10px] mt-0.5" style={{ color: T.textFaint }}>
                                                            {session.sessionDate} @ {session.sessionTime}
                                                        </p>
                                                        {session.notes && <p className="text-[10px] italic mt-1 text-slate-400 truncate">{session.notes}</p>}
                                                    </div>
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex-shrink-0"
                                                          style={{ background: statusBg, color: statusText }}>
                                                        {session.status}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </Panel>

                            <GoalProgress dashboard={dashboard} T={T} />
                        </div>
                    )}

                    {/* Strengths & Weaknesses (with Severity) */}
                    {!loading && profile && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Panel T={T}>
                                <SectionLabel icon={ThumbsUp} tone="#10b981">Top 5 Strengths</SectionLabel>
                                {profile?.coachingSummary?.strengths ? (
                                    <ul className="mt-3.5 space-y-2.5 text-xs text-slate-300">
                                        {profile.coachingSummary.strengths.split(/[.!?]/).filter(s => s.trim().length > 5).slice(0, 5).map((str, idx) => (
                                            <li key={idx} className="flex gap-2 items-start">
                                                <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                                <span>{str.trim()}.</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <p className="text-sm mt-3" style={{ color: T.textFaint }}>Not enough data yet.</p>}
                            </Panel>
                            <Panel T={T}>
                                <SectionLabel icon={ThumbsDown} tone="#ef4444">Opportunities for Development (Severity Rank)</SectionLabel>
                                {profile?.coachingSummary?.weaknesses ? (
                                    <ul className="mt-3.5 space-y-2.5 text-xs text-slate-300">
                                        {profile.coachingSummary.weaknesses.split(/[.!?]/).filter(w => w.trim().length > 5).slice(0, 4).map((weak, idx) => {
                                            const severity = idx === 0 ? "High" : idx === 1 ? "Medium" : "Low";
                                            const sColor = severity === "High" ? "#f87171" : severity === "Medium" ? "#fbbf24" : "#60a5fa";
                                            return (
                                                <li key={idx} className="flex gap-2 items-start">
                                                    <ShieldAlert size={13} style={{ color: sColor }} className="mt-0.5 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <span className="text-[9px] font-black mr-2 uppercase px-1.5 py-0.5 rounded" style={{ background: `${sColor}18`, color: sColor }}>
                                                            {severity}
                                                        </span>
                                                        <span>{weak.trim()}.</span>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : <p className="text-sm mt-3" style={{ color: T.textFaint }}>Not enough data yet.</p>}
                            </Panel>
                        </div>
                    )}

                    {/* Charts & Graphs */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Panel T={T}>
                            <SectionLabel icon={TrendingUp} tone="#f59e0b">Average Score Over Time</SectionLabel>
                            {loading ? <Skeleton T={T} className="h-52 mt-4" /> : !analytics?.dailySeries?.length ? (
                                <EmptyState icon={TrendingUp} title="No data in this range" subtitle="Try a wider date range or check back once more calls are analysed." T={T} />
                            ) : (
                                <div className="mt-4">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart data={analytics.dailySeries}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={T.divider} vertical={false} />
                                            <XAxis dataKey="date" tick={{ fill: T.textFaint, fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <YAxis domain={[0, 100]} tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Line type="monotone" dataKey="avgScore" name="Avg Score" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 3.5, strokeWidth: 0 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Panel>

                        <Panel T={T}>
                            <SectionLabel icon={Phone} tone="#8b5cf6">Call Volume Over Time</SectionLabel>
                            {loading ? <Skeleton T={T} className="h-52 mt-4" /> : !analytics?.dailySeries?.length ? (
                                <EmptyState icon={TrendingUp} title="No data in this range" subtitle="Try a wider date range or check back once more calls are analysed." T={T} />
                            ) : (
                                <div className="mt-4">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={analytics.dailySeries}>
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

                        <Panel T={T}>
                            <SectionLabel icon={Smile} tone="#10b981">Sentiment Breakdown</SectionLabel>
                            {loading ? <Skeleton T={T} className="h-52 mt-4" /> : !sentimentPieData.length ? (
                                <EmptyState icon={TrendingUp} title="No data in this range" subtitle="Try a wider date range or check back once more calls are analysed." T={T} />
                            ) : (
                                <div className="mt-4">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={sentimentPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                                                {sentimentPieData.map(entry => (
                                                    <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] ?? "#94a3b8"} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Panel>

                        <Panel T={T}>
                            <SectionLabel icon={ThumbsUp} tone="#f97316">Buying Intent Breakdown</SectionLabel>
                            {loading ? <Skeleton T={T} className="h-52 mt-4" /> : !buyingIntentPieData.length ? (
                                <EmptyState icon={TrendingUp} title="No data in this range" subtitle="Try a wider date range or check back once more calls are analysed." T={T} />
                            ) : (
                                <div className="mt-4">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={buyingIntentPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                                                {buyingIntentPieData.map(entry => (
                                                    <Cell key={entry.name} fill={buyingIntentColor(entry.name)} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Panel>
                    </div>

                    {/* Recent Call Records table */}
                    <Panel T={T}>
                        <SectionLabel icon={ClipboardList} tone="#a1a1aa">Recent Call Analytics logs</SectionLabel>
                        {loading ? <Skeleton T={T} className="h-56 mt-4" /> : !profile?.recentCalls?.length ? (
                            <EmptyState icon={Phone} title="No calls yet" subtitle="Once this employee has analysed calls, they will show up here." T={T} />
                        ) : (
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr style={{ color: T.textFaint }} className="text-left text-[11px] uppercase tracking-wider">
                                            <th className="pb-2 font-semibold">Date</th>
                                            <th className="pb-2 font-semibold">Customer</th>
                                            <th className="pb-2 font-semibold text-right">Score</th>
                                            <th className="pb-2 font-semibold">Sentiment</th>
                                            <th className="pb-2 font-semibold text-right">Duration</th>
                                            <th className="pb-2 font-semibold">Outcome</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {profile.recentCalls.map(c => (
                                            <tr key={c.id}
                                                onClick={() => navigate(`/w/${user?.companySlug || "default"}/calls/${c.id}`)}
                                                className="cursor-pointer transition-colors"
                                                style={{ borderTop: `1px solid ${T.divider}` }}
                                                onMouseEnter={e => { e.currentTarget.style.background = T.panelHover; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                                <td className="py-2.5" style={{ color: T.textMuted }}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</td>
                                                <td className="py-2.5 font-medium truncate max-w-[160px]" style={{ color: T.text }}>{c.fileName ?? "—"}</td>
                                                <td className="py-2.5 text-right">{c.overallScore != null ? <ScoreBadge score={c.overallScore} /> : "—"}</td>
                                                <td className="py-2.5">
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ color: SENTIMENT_COLORS[c.sentiment] ?? "#94a3b8", background: `${SENTIMENT_COLORS[c.sentiment] ?? "#94a3b8"}18` }}>
                                                        {c.sentiment ?? "—"}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 text-right" style={{ color: T.textFaint }}>—</td>
                                                <td className="py-2.5" style={{ color: T.textMuted }}>{c.outcomeStatus ?? "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    {/* ── ALERTS, TIMELINE, COMPARISONS ── */}
                    {!loading && profile && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <AlertCenterCard alerts={profile.alerts} T={T} />
                            <div id="team-comparison-section">
                                <TeamComparisonCard comparisonData={profile.teamComparison} T={T} />
                            </div>
                            <UpcomingActionsCard actions={profile.upcomingActions} T={T} />
                        </div>
                    )}

                    {/* Timeline Activity logs & Manager notes persistence */}
                    {!loading && profile && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2">
                                <NotesTimeline notes={profile.managerNotes} T={T} />
                            </div>
                            <ActivityFeedPanel timeline={profile.progressTimeline} T={T} />
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
}
