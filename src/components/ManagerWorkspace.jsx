import {
    Sparkles, TrendingUp, TrendingDown, Minus, ShieldAlert, ShieldCheck, Shield,
    CalendarPlus, StickyNote, GraduationCap as ModuleIcon, CheckCircle2,
    Phone, MessageSquareWarning, Lightbulb, Circle, Download, FileText,
    Users, Send, Award, Target, Smile, Star
} from "lucide-react";
import { Panel, SectionLabel, ProgressBar } from "./CompanyUI.jsx";

// ── AI Manager Summary (Feature 2) ──────────────────────────────────────
export function AISummaryCard({ profile, T }) {
    const dashboard = profile?.dashboard;
    const analytics = profile?.analytics;
    const coaching = profile?.coachingSummary;

    if (!dashboard) return null;

    const trendClause = analytics?.scoreTrendPercent == null
        ? null
        : analytics.scoreTrendPercent > 3
            ? `Performance is trending up ${Math.abs(analytics.scoreTrendPercent).toFixed(1)}% over the period.`
            : analytics.scoreTrendPercent < -3
                ? `Performance has declined ${Math.abs(analytics.scoreTrendPercent).toFixed(1)}% over the period — worth a closer look.`
                : "Performance has stayed steady over the period.";

    const weaknessClause = dashboard.weakestDimensionLabel
        ? `${dashboard.weakestDimensionLabel} is the area most worth coaching on right now.`
        : null;

    const objectionClause = coaching?.topObjections?.length
        ? `Recurring objection: "${coaching.topObjections[0]}".`
        : null;

    return (
        <Panel T={T} className="relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
                style={{ background: "radial-gradient(ellipse at 0% 0%, #8b5cf6, transparent 60%)" }} />
            <div className="relative flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(139,92,246,0.16)", border: "1px solid rgba(139,92,246,0.3)" }}>
                    <Sparkles size={16} style={{ color: "#c4b5fd" }} />
                </div>
                <div>
                    <SectionLabel tone="#8b5cf6">AI Manager Summary</SectionLabel>
                    <p className="text-[15px] leading-relaxed mt-3" style={{ color: T.text }}>
                        {dashboard.briefing || "Employee performance is active with analysed calls."}{" "}
                        {trendClause && <span style={{ color: T.textMuted }}>{trendClause}</span>}{" "}
                        {objectionClause && <span style={{ color: T.textMuted }}>{objectionClause}</span>}
                    </p>
                    {weaknessClause && (
                        <p className="text-sm mt-2 font-medium" style={{ color: "#c4b5fd" }}>Recommend one coaching session focused on {dashboard.weakestDimensionLabel?.toLowerCase()}.</p>
                    )}
                </div>
            </div>
        </Panel>
    );
}

// ── Performance Trend Indicator ─────────────────────────────
export function trendFromPercent(pct) {
    if (pct == null) return { label: "Stable", Icon: Minus, color: "#94a3b8" };
    if (pct > 3) return { label: "Improving", Icon: TrendingUp, color: "#34d399" };
    if (pct < -3) return { label: "Declining", Icon: TrendingDown, color: "#f87171" };
    return { label: "Stable", Icon: Minus, color: "#94a3b8" };
}

export function TrendIndicatorBadge({ trendPercent }) {
    const { label, Icon, color } = trendFromPercent(trendPercent);
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ color, background: `${color}18`, border: `1px solid ${color}35` }}>
            <Icon size={12} /> {label}
        </span>
    );
}

// ── Risk Level Card ──────────────────────────────────────────
export function computeRiskLevel(profile) {
    const dashboard = profile?.dashboard;
    const analytics = profile?.analytics;
    const coaching = profile?.coachingSummary;
    const recentCalls = profile?.recentCalls || [];
    if (!dashboard) return { level: "Low", reasons: [] };

    const reasons = [];
    let points = 0;

    if ((dashboard.avgScore ?? 100) < 65) { reasons.push("Declining QA"); points += 2; }
    if ((analytics?.negativePercent ?? 0) > 30) { reasons.push("High negative sentiment"); points += 2; }
    if ((analytics?.scoreTrendPercent ?? 0) < -5) { reasons.push("Declining QA trend"); points += 1; }

    const escalations = recentCalls.filter(c => c.outcomeStatus === "Escalated").length;
    if (escalations >= 2) { reasons.push("Multiple call escalations"); points += 2; }

    if ((coaching?.topObjections?.length ?? 0) >= 3) { reasons.push("Repeated customer objections"); points += 1; }

    const level = points >= 4 ? "High" : points >= 2 ? "Medium" : "Low";
    return { level, reasons: [...new Set(reasons)] };
}

const RISK_STYLE = {
    Low: { color: "#34d399", Icon: ShieldCheck },
    Medium: { color: "#f59e0b", Icon: Shield },
    High: { color: "#f87171", Icon: ShieldAlert },
};

export function RiskLevelCard({ profile, T }) {
    const { level, reasons } = computeRiskLevel(profile);
    const style = RISK_STYLE[level];
    return (
        <Panel T={T}>
            <SectionLabel icon={style.Icon} tone={style.color}>Overall Employee Risk</SectionLabel>
            <div className="mt-3 flex items-center gap-2">
                <span className="text-2xl font-black" style={{ color: style.color }}>{level}</span>
            </div>
            {reasons.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm" style={{ color: T.textMuted }}>
                    {reasons.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
            ) : (
                <p className="mt-3 text-sm" style={{ color: T.textFaint }}>No risk indicators detected in this range.</p>
            )}
        </Panel>
    );
}

// ── Skill Bars — Strongest/Weakest ──────────────────────────
export function SkillBars({ dashboard, T }) {
    if (!dashboard) return null;
    const dims = [
        { label: "Communication", value: dashboard.avgCommunication ?? 0 },
        { label: "Problem Resolution", value: dashboard.avgProblemResolution ?? 0 },
        { label: "Professionalism", value: dashboard.avgProfessionalism ?? 0 },
        { label: "Cust. Satisfaction", value: dashboard.avgCustomerSatisfaction ?? 0 },
    ].sort((a, b) => b.value - a.value);

    const top = dims[0];
    const weakest = dims[dims.length - 1];

    return (
        <Panel T={T}>
            <SectionLabel tone="#8b5cf6">Strongest / Weakest Metrics</SectionLabel>
            <div className="mt-3 flex items-center gap-6 flex-wrap">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#34d399" }}>Top Skill</p>
                    <p className="text-lg font-black" style={{ color: T.text }}>{top.label}</p>
                    <p className="text-sm font-bold" style={{ color: "#34d399" }}>{top.value}%</p>
                </div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#f87171" }}>Weakest Skill</p>
                    <p className="text-lg font-black" style={{ color: T.text }}>{weakest.label}</p>
                    <p className="text-sm font-bold" style={{ color: "#f87171" }}>{weakest.value}%</p>
                </div>
            </div>
            <div className="mt-5 space-y-3.5">
                {dims.map(d => (
                    <ProgressBar key={d.label} label={d.label} value={d.value} target={100}
                        color={d.value >= 80 ? "#34d399" : d.value >= 60 ? "#f59e0b" : "#f87171"} T={T} />
                ))}
            </div>
        </Panel>
    );
}

// ── Goal Progress ────────────────────────────────────────────
const GOAL_TARGETS = { qa: 85, csat: 80, quality: 85 };

export function GoalProgress({ dashboard, T }) {
    if (!dashboard) return null;
    const callQuality = Math.round(((dashboard.avgCommunication ?? 0) + (dashboard.avgProblemResolution ?? 0) + (dashboard.avgProfessionalism ?? 0)) / 3);
    return (
        <Panel T={T}>
            <SectionLabel tone="#f59e0b">Goal Progress</SectionLabel>
            <p className="text-[11px] mt-1 mb-4" style={{ color: T.textFaint }}>Targets shown are benchmarks for employee performance.</p>
            <div className="space-y-4">
                <ProgressBar label="QA Target" value={dashboard.avgScore ?? 0} target={GOAL_TARGETS.qa} color="#8b5cf6" T={T} />
                <ProgressBar label="Customer Satisfaction" value={dashboard.avgCustomerSatisfaction ?? 0} target={GOAL_TARGETS.csat} color="#10b981" T={T} />
                <ProgressBar label="Call Quality" value={callQuality} target={GOAL_TARGETS.quality} color="#f59e0b" T={T} />
            </div>
        </Panel>
    );
}

// ── Coaching Center ────────────────────────────────
export function CoachingCenter({ onScheduleCoaching, onAddNote, onAssignModule, onMarkImproved, T }) {
    const actions = [
        { label: "Schedule Coaching", Icon: CalendarPlus, onClick: onScheduleCoaching, color: "#8b5cf6" },
        { label: "Add Coaching Note", Icon: StickyNote, onClick: onAddNote, color: "#06b6d4" },
        { label: "Assign Learning Module", Icon: ModuleIcon, onClick: onAssignModule, color: "#f59e0b" },
        { label: "Mark Employee Improved", Icon: CheckCircle2, onClick: onMarkImproved, color: "#34d399" },
    ];
    return (
        <Panel T={T}>
            <SectionLabel tone="#8b5cf6">Coaching Center</SectionLabel>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {actions.map(a => (
                    <button key={a.label} onClick={a.onClick}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all cursor-pointer"
                        style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${a.color}55`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.panelBorder; }}>
                        <a.Icon size={17} style={{ color: a.color }} />
                        <span className="text-[11px] font-semibold" style={{ color: T.textMuted }}>{a.label}</span>
                    </button>
                ))}
            </div>
        </Panel>
    );
}

// ── Manager Notes Timeline ─────────────────────────
export function NotesTimeline({ notes, T }) {
    return (
        <Panel T={T}>
            <SectionLabel tone="#06b6d4">Manager Notes</SectionLabel>
            {!notes?.length ? (
                <p className="text-sm mt-3" style={{ color: T.textFaint }}>No notes yet. Use "Add Coaching Note" above to log one.</p>
            ) : (
                <div className="mt-4 space-y-0 max-h-[300px] overflow-y-auto pr-1">
                    {notes.map((n, i) => (
                        <div key={n.id || i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                                <Circle size={8} fill="#06b6d4" style={{ color: "#06b6d4" }} />
                                {i < notes.length - 1 && <div className="w-px flex-1 my-1" style={{ background: T.divider }} />}
                            </div>
                            <div className="pb-4 min-w-0">
                                <p className="text-xs font-bold" style={{ color: T.textFaint }}>{new Date(n.createdAt).toLocaleDateString()}</p>
                                <p className="text-sm mt-0.5" style={{ color: T.text }}>{n.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}

// ── Upgraded Performance Timeline (Jira-style activity timeline) ─────────────────
export function ActivityFeedPanel({ timeline, T }) {
    if (!timeline || timeline.length === 0) {
        return (
            <Panel T={T}>
                <SectionLabel tone="#a1a1aa">Performance Timeline</SectionLabel>
                <p className="text-sm mt-3" style={{ color: T.textFaint }}>No activity logged yet.</p>
            </Panel>
        );
    }

    return (
        <Panel T={T}>
            <SectionLabel tone="#a1a1aa">Performance Timeline</SectionLabel>
            <div className="mt-4 space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {timeline.map((evt) => {
                    let Icon = StickyNote;
                    let color = "#8b5cf6";
                    
                    if (evt.type === "COACHING") { Icon = CalendarPlus; color = "#a78bfa"; }
                    else if (evt.type === "LEARNING") { Icon = ModuleIcon; color = "#fb923c"; }
                    else if (evt.type === "NOTE") { Icon = StickyNote; color = "#22d3ee"; }
                    else if (evt.type === "IMPROVEMENT") { Icon = CheckCircle2; color = "#4ade80"; }
                    else if (evt.type === "QA") { Icon = Award; color = "#34d399"; }
                    else if (evt.type === "ALERT") { Icon = ShieldAlert; color = "#f87171"; }

                    return (
                        <div key={evt.id} className="flex gap-3 text-xs">
                            <div className="flex flex-col items-center">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                     style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                                    <Icon size={12} style={{ color }} />
                                </div>
                                <div className="w-px flex-1 my-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                            </div>
                            <div className="pb-2 flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2 flex-wrap">
                                    <p className="font-bold text-white truncate">{evt.title}</p>
                                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                        {new Date(evt.date).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>{evt.detail}</p>
                                <div className="mt-1.5 flex gap-1.5 flex-wrap">
                                    {evt.priority && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                                              style={{
                                                  background: evt.priority === "High" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                                                  color: evt.priority === "High" ? "#f87171" : "#fbbf24"
                                              }}>
                                            {evt.priority} Priority
                                        </span>
                                    )}
                                    {evt.status && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                                              style={{
                                                  background: evt.status === "Completed" || evt.status === "Active" ? "rgba(16,185,129,0.12)" : "rgba(139,92,246,0.12)",
                                                  color: evt.status === "Completed" || evt.status === "Active" ? "#34d399" : "#c4b5fd"
                                              }}>
                                            {evt.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

// ── Upcoming Actions Card ──────────────────────────────────────────────────
export function UpcomingActionsCard({ actions, T }) {
    if (!actions || actions.length === 0) {
        return (
            <Panel T={T}>
                <SectionLabel tone="#8b5cf6">Upcoming Actions</SectionLabel>
                <p className="text-xs mt-3" style={{ color: T.textFaint }}>No pending actions.</p>
            </Panel>
        );
    }

    return (
        <Panel T={T}>
            <SectionLabel tone="#8b5cf6">Upcoming Actions</SectionLabel>
            <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {actions.map((act, i) => {
                    let badgeColor = "#94a3b8";
                    if (act.priority === "HIGH" || act.priority === "High") badgeColor = "#f87171";
                    else if (act.priority === "MEDIUM" || act.priority === "Medium") badgeColor = "#fbbf24";
                    else badgeColor = "#38bdf8";

                    return (
                        <div key={i} className="p-3 rounded-xl flex items-start justify-between gap-3 text-xs"
                             style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                            <div className="min-w-0">
                                <span className="text-[9px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: badgeColor }}>
                                    {act.type}
                                </span>
                                <p className="font-semibold text-white truncate">{act.title}</p>
                                <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                                    {act.dueDate}
                                </p>
                            </div>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex-shrink-0"
                                  style={{ background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}30` }}>
                                {act.priority}
                            </span>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

// ── Alert Center Card ──────────────────────────────────────────────────────
export function AlertCenterCard({ alerts, T }) {
    if (!alerts || alerts.length === 0) {
        return (
            <Panel T={T}>
                <SectionLabel tone="#10b981">Alert Center</SectionLabel>
                <div className="mt-3 p-3 rounded-xl flex items-center gap-2"
                     style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <p className="text-xs text-emerald-400 font-semibold">All thresholds healthy. No alerts.</p>
                </div>
            </Panel>
        );
    }

    return (
        <Panel T={T}>
            <SectionLabel tone="#ef4444">Alert Center</SectionLabel>
            <div className="mt-4 space-y-2.5">
                {alerts.map((alertText, i) => (
                    <div key={i} className="p-3 rounded-xl flex items-center gap-3 text-xs"
                         style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 animate-pulse" />
                        <p className="font-semibold text-red-300 min-w-0 truncate">{alertText}</p>
                    </div>
                ))}
            </div>
        </Panel>
    );
}

// ── Team & Company Comparison Card ─────────────────────────────────────────
export function TeamComparisonCard({ comparisonData, T }) {
    if (!comparisonData || comparisonData.length === 0) return null;
    return (
        <Panel T={T}>
            <SectionLabel tone="#f59e0b">Team & Company Benchmarks</SectionLabel>
            <p className="text-[11px] mt-1 mb-4" style={{ color: T.textFaint }}>benchmarks against average team and top performer metrics.</p>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr style={{ color: T.textFaint }} className="text-left text-[10px] uppercase tracking-wider">
                            <th className="pb-2 font-semibold">Metric</th>
                            <th className="pb-2 font-semibold text-right">Rep Value</th>
                            <th className="pb-2 font-semibold text-right">Team Avg</th>
                            <th className="pb-2 font-semibold text-right">Top Rep</th>
                            <th className="pb-2 font-semibold text-right">Company Avg</th>
                        </tr>
                    </thead>
                    <tbody>
                        {comparisonData.map((row, i) => (
                            <tr key={i} style={{ borderTop: `1px solid ${T.divider}` }}>
                                <td className="py-2.5 font-bold text-white">{row.metric}</td>
                                <td className="py-2.5 text-right font-black text-violet-300">{row.employeeValue}%</td>
                                <td className="py-2.5 text-right text-slate-400">{row.teamAverage}%</td>
                                <td className="py-2.5 text-right text-emerald-400 font-bold">{row.topPerformer}%</td>
                                <td className="py-2.5 text-right text-slate-500">{row.companyAverage}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
}

// ── Header Status Dot ──────────────────────────────────
export function deriveStatus(lastCallDate) {
    if (!lastCallDate) return { label: "Offline", color: "#64748b" };
    const hoursAgo = (Date.now() - new Date(lastCallDate).getTime()) / 36e5;
    if (hoursAgo < 24) return { label: "Online", color: "#34d399" };
    if (hoursAgo < 24 * 14) return { label: "Offline", color: "#64748b" };
    return { label: "On Leave", color: "#f59e0b" };
}

export function StatusDot({ status }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ color: status.color, background: `${status.color}18`, border: `1px solid ${status.color}35` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />
            {status.label}
        </span>
    );
}

// ── Sticky Action Bar ───────────────────────────────────────
export function StickyActionBar({ onCreatePlan, onScheduleCoaching, onGenerateReview, onCompare, onDownloadReport, onShare, T }) {
    return (
        <div className="sticky top-16 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 flex items-center gap-2 flex-wrap justify-between"
            style={{ background: T.headerBg, borderBottom: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>
            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={onCreatePlan} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer bg-violet-600 hover:bg-violet-500 text-white shadow-lg">
                    <CheckCircle2 size={13} /> Create Improvement Plan
                </button>
                <button onClick={onScheduleCoaching} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer hover:bg-white/5"
                    style={{ border: `1px solid ${T.panelBorder}`, color: T.text }}>
                    <CalendarPlus size={13} /> Schedule Coaching
                </button>
                <button onClick={onGenerateReview} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer hover:bg-white/5"
                    style={{ border: `1px solid ${T.panelBorder}`, color: T.text }}>
                    <FileText size={13} /> Generate Performance Review
                </button>
                <button onClick={onCompare} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer hover:bg-white/5"
                    style={{ border: `1px solid ${T.panelBorder}`, color: T.text }}>
                    <Users size={13} /> Compare With Team
                </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={onDownloadReport} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer"
                    style={{ background: "rgba(139,92,246,0.14)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}>
                    <Download size={13} /> Download Employee Report
                </button>
                <button onClick={onShare} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer hover:bg-white/5"
                    style={{ border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>
                    <Send size={13} /> Share Report
                </button>
            </div>
        </div>
    );
}
