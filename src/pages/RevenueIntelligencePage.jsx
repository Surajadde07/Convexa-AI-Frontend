import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Sidebar } from "../components/Sidebar.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import api, { getUser } from "../services/api.js";
import {
    DollarSign, TrendingUp, TrendingDown, Target, ShieldAlert,
    ArrowUpRight, CheckCircle2, AlertTriangle,
    ArrowRight, RefreshCw, Zap, Activity, Award, PhoneCall,
    XCircle, Edit3, X, Layers, ShieldCheck
} from "lucide-react";

// ── Shared UI Primitives ─────────────────────────────────────────────────────

function Panel({ T, children, className = "", ...rest }) {
    return (
        <div
            className={`rounded-2xl border ${className}`}
            style={{
                background: T.panel,
                borderColor: T.panelBorder,
                boxShadow: T.cardShadow,
            }}
            {...rest}
        >
            {children}
        </div>
    );
}

function SectionLabel({ T, children }) {
    return (
        <p className="text-[10px] font-black uppercase tracking-widest mb-3"
            style={{ color: T.textFaint }}>
            {children}
        </p>
    );
}

function Skeleton({ T, className = "h-6 w-full" }) {
    return (
        <div
            className={`rounded-lg animate-pulse ${className}`}
            style={{ background: T.isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0" }}
        />
    );
}

// ── Currency & Metric Helpers ────────────────────────────────────────────────

function formatCurrency(val) {
    if (val === null || val === undefined) return "$0";
    const n = Number(val);
    if (isNaN(n) || n === 0) return "$0";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}K`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toLocaleString()}`;
}

// ── KPI Card Component ───────────────────────────────────────────────────────

function KpiCard({ T, label, value, sub, icon: Icon, accentColor, trend, loading, action, tooltip }) {
    return (
        <Panel T={T} className="p-4 flex flex-col justify-between gap-2 transition-all" title={tooltip}>
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider"
                    style={{ color: T.textFaint }}>
                    {label}
                </span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accentColor}1a`, color: accentColor }}>
                    <Icon size={16} />
                </div>
            </div>
            <div>
                {loading ? (
                    <>
                        <Skeleton T={T} className="h-7 w-3/4 mb-1" />
                        <Skeleton T={T} className="h-3 w-1/2" />
                    </>
                ) : (
                    <>
                        <p className="text-2xl font-black tracking-tight" style={{ color: T.text }}>
                            {value}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-1">
                            <p className="text-[11px] font-semibold flex items-center gap-1 leading-tight"
                                style={{
                                    color: trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : T.textMuted
                                }}>
                                {trend === "up" && <TrendingUp size={11} className="flex-shrink-0" />}
                                {trend === "down" && <TrendingDown size={11} className="flex-shrink-0" />}
                                <span>{sub}</span>
                            </p>
                            {action}
                        </div>
                    </>
                )}
            </div>
        </Panel>
    );
}

// ── Pipeline Health Badge ─────────────────────────────────────────────────────

function PipelineHealthBadge({ status }) {
    const configs = {
        healthy: {
            label: "Pipeline Healthy",
            bg: "rgba(16,185,129,0.12)",
            text: "#10b981",
            border: "rgba(16,185,129,0.25)",
            dot: "#10b981"
        },
        warning: {
            label: "Attention Needed",
            bg: "rgba(245,158,11,0.12)",
            text: "#f59e0b",
            border: "rgba(245,158,11,0.25)",
            dot: "#f59e0b"
        },
        risk: {
            label: "Pipeline At Risk",
            bg: "rgba(239,68,68,0.12)",
            text: "#ef4444",
            border: "rgba(239,68,68,0.25)",
            dot: "#ef4444"
        },
        empty: {
            label: "No Active Pipeline",
            bg: "rgba(148,163,184,0.1)",
            text: "#94a3b8",
            border: "rgba(148,163,184,0.2)",
            dot: "#94a3b8"
        },
    };
    const c = configs[status] || configs.empty;
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
            style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: c.dot }} />
            {c.label}
        </span>
    );
}

// ── Stage Progress Row ────────────────────────────────────────────────────────

function StageProgressRow({ T, stage, totalOpenPipeline }) {
    const val = Number(stage.totalValue || 0);
    const pct = totalOpenPipeline > 0 ? Math.min(100, Math.round((val / totalOpenPipeline) * 100)) : 0;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                    <span className="font-bold" style={{ color: T.text }}>{stage.stageLabel}</span>
                    <span className="text-[11px] font-semibold" style={{ color: T.textFaint }}>
                        ({stage.dealCount} deal{stage.dealCount !== 1 ? "s" : ""})
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-extrabold text-right" style={{ color: T.text }}>
                        ${val.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold w-10 text-right" style={{ color: T.textFaint }}>
                        {pct}%
                    </span>
                </div>
            </div>
            <div className="w-full rounded-full h-2 overflow-hidden"
                style={{ background: T.isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0" }}>
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: stage.color }}
                />
            </div>
        </div>
    );
}

// ── Target Configuration Modal ───────────────────────────────────────────────

function validateRevenueTargetInput(targetVal) {
    if (targetVal === null || targetVal === undefined || String(targetVal).trim() === "") {
        return { valid: false, error: "Revenue target amount cannot be blank", value: null };
    }
    const num = parseFloat(targetVal);
    if (isNaN(num)) {
        return { valid: false, error: "Please enter a valid numeric revenue target", value: null };
    }
    if (num <= 0) {
        return { valid: false, error: "Revenue target must be greater than zero", value: null };
    }
    return { valid: true, error: null, value: num };
}

function TargetModal({ T, isOpen, onClose, currentTarget, currentPeriod, onSave }) {
    const [targetVal, setTargetVal] = useState(currentTarget || "");
    const [period, setPeriod] = useState(currentPeriod || "QUARTERLY");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            setTargetVal(currentTarget || "");
            setPeriod(currentPeriod || "QUARTERLY");
            setError("");
        }
    }, [isOpen, currentTarget, currentPeriod]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validation = validateRevenueTargetInput(targetVal);
        if (!validation.valid) {
            setError(validation.error);
            return;
        }
        setSaving(true);
        setError("");
        try {
            await onSave(validation.value, period);
            onClose();
        } catch (err) {
            setError(err?.response?.data?.error || "Failed to update revenue target");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
            <div
                className="w-full max-w-md rounded-2xl border p-6 shadow-2xl relative"
                style={{
                    background: T.popoverBg,
                    borderColor: T.popoverBorder,
                    boxShadow: T.popoverShadow,
                    color: T.text
                }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg transition-all"
                    style={{ color: T.textMuted, background: T.isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9" }}
                >
                    <X size={16} />
                </button>

                <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>
                        <Target size={18} />
                    </div>
                    <div>
                        <h3 className="text-base font-black" style={{ color: T.text }}>Configure Revenue Target</h3>
                        <p className="text-xs" style={{ color: T.textMuted }}>Used to calculate pipeline coverage and gap</p>
                    </div>
                </div>

                {error && (
                    <div className="p-3 mb-4 rounded-xl text-xs font-semibold flex items-center gap-2"
                        style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <AlertTriangle size={14} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider block mb-1.5"
                            style={{ color: T.textFaint }}>
                            Target Period
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {["QUARTERLY", "MONTHLY"].map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPeriod(p)}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                                        period === p ? "ring-2 ring-violet-500" : ""
                                    }`}
                                    style={{
                                        background: period === p ? "rgba(139,92,246,0.15)" : (T.isDark ? "rgba(255,255,255,0.03)" : "#f8fafc"),
                                        borderColor: period === p ? "#8b5cf6" : T.panelBorder,
                                        color: period === p ? "#8b5cf6" : T.textMuted
                                    }}
                                >
                                    {p === "QUARTERLY" ? "Quarterly Target" : "Monthly Target"}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider block mb-1.5"
                            style={{ color: T.textFaint }}>
                            Target Amount ($)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-sm"
                                style={{ color: T.textFaint }}>$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="e.g. 250000"
                                value={targetVal}
                                onChange={(e) => setTargetVal(e.target.value)}
                                className="w-full pl-8 pr-4 py-2.5 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-500"
                                style={{
                                    background: T.inputBg,
                                    borderColor: T.panelBorder,
                                    color: T.text
                                }}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: T.divider }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                            style={{ background: T.isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9", color: T.textMuted }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
                            style={{ background: "linear-gradient(135deg, #7c3aed, #8b5cf6)" }}
                        >
                            {saving ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            Save Target
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function RevenueIntelligencePage() {
    const { T } = useTheme();
    const { currentWorkspace } = useWorkspace();
    const user = getUser();
    const isOwnerOrAdmin = user?.role === "OWNER" || user?.role === "ADMIN";

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    const [selectedRange, setSelectedRange] = useState("this_quarter");
    const [targetModalOpen, setTargetModalOpen] = useState(false);

    const companySlug = user?.companySlug || currentWorkspace?.company?.slug || "default";

    const fetchPipelineData = async (range = selectedRange) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/company/pipeline-intelligence?range=${range}`);
            setData(res.data || null);
        } catch (err) {
            console.error("Failed to load pipeline intelligence:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPipelineData(selectedRange);
    }, [selectedRange]);

    const handleSaveTarget = async (target, period) => {
        await api.patch("/api/company/revenue-target", { target, period });
        await fetchPipelineData(selectedRange);
    };

    // ── Pipeline Health Status Evaluation ─────────────────────────────────────
    const healthStatus = useMemo(() => {
        if (!data || data.totalOpenDeals === 0) return "empty";
        const riskRatio = data.totalOpenValue > 0
            ? Number(data.atRiskPipelineValue || 0) / Number(data.totalOpenValue)
            : 0;

        if (riskRatio > 0.40 || data.atRiskDealCount >= 3) return "risk";
        if (riskRatio > 0.15 || data.atRiskDealCount > 0 || (data.atRiskDeals && data.atRiskDeals.length > 0)) return "warning";
        return "healthy";
    }, [data]);

    // ── Date Range Options ────────────────────────────────────────────────────
    const DATE_RANGE_OPTIONS = [
        { id: "this_quarter", label: "This Quarter" },
        { id: "this_month",   label: "This Month" },
        { id: "last_quarter", label: "Last Quarter" },
        { id: "30d",          label: "Last 30 Days" },
        { id: "all",          label: "All Time" },
    ];

    const hasNoOpenDeals = !loading && data && data.totalOpenDeals === 0;

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: T.pageBg }}>
            <Sidebar
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                T={T}
                user={user}
                currentPath="/revenue-intelligence"
                totalCalls={data?.totalCalls || 0}
            />

            <div className="flex-1 overflow-y-auto min-w-0">
                <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">

                    {/* ── 1. Header ─────────────────────────────────────────── */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b"
                        style={{ borderColor: T.divider }}>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap mb-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                                    style={{
                                        background: "rgba(139,92,246,0.12)",
                                        color: "#8b5cf6",
                                        border: "1px solid rgba(139,92,246,0.2)"
                                    }}>
                                    Revenue Intelligence
                                </span>
                                {!loading && <PipelineHealthBadge status={healthStatus} />}
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5"
                                style={{ color: T.text }}>
                                <DollarSign size={28} style={{ color: "#8b5cf6" }} />
                                Revenue & Pipeline Command
                            </h1>
                            <p className="text-xs md:text-sm mt-1" style={{ color: T.textMuted }}>
                                Deal confidence, revenue exposure, and conversation-derived pipeline signals.
                            </p>
                        </div>

                        {/* Header Controls */}
                        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                            {/* Date Range Selector */}
                            <div className="relative">
                                <select
                                    value={selectedRange}
                                    onChange={(e) => setSelectedRange(e.target.value)}
                                    className="px-3 py-2 rounded-xl text-xs font-bold border focus:outline-none cursor-pointer pr-7"
                                    style={{
                                        background: T.isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
                                        borderColor: T.panelBorder,
                                        color: T.text
                                    }}
                                >
                                    {DATE_RANGE_OPTIONS.map((opt) => (
                                        <option key={opt.id} value={opt.id}
                                            style={{ background: T.popoverBg, color: T.text }}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Revenue Target Trigger */}
                            {isOwnerOrAdmin && (
                                <button
                                    onClick={() => setTargetModalOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border"
                                    style={{
                                        background: data?.revenueTarget ? "rgba(139,92,246,0.1)" : (T.isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"),
                                        color: data?.revenueTarget ? "#8b5cf6" : T.textMuted,
                                        borderColor: data?.revenueTarget ? "rgba(139,92,246,0.25)" : T.panelBorder
                                    }}
                                    title="Set or edit revenue target"
                                >
                                    <Target size={13} />
                                    {data?.revenueTarget
                                        ? `Target: ${formatCurrency(data.revenueTarget)} (${data?.revenueTargetPeriod === "MONTHLY" ? "Mo" : "Qtr"})`
                                        : "Set Target"}
                                    <Edit3 size={11} className="opacity-70" />
                                </button>
                            )}

                            {/* Refresh Button */}
                            <button
                                onClick={() => fetchPipelineData(selectedRange)}
                                disabled={loading}
                                className="p-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center"
                                style={{
                                    background: T.isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
                                    color: T.textMuted,
                                    borderColor: T.panelBorder
                                }}
                                title="Refresh data"
                            >
                                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                            </button>
                        </div>
                    </div>

                    {/* ── 2. Top 6 Financial KPIs ───────────────────────────── */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                        {/* 1. Open Pipeline */}
                        <KpiCard
                            T={T}
                            loading={loading}
                            label="Open Pipeline"
                            value={formatCurrency(data?.totalOpenValue)}
                            sub={`${data?.totalOpenDeals || 0} active deal${(data?.totalOpenDeals || 0) !== 1 ? "s" : ""} · Current snapshot`}
                            tooltip={`Current snapshot of open pipeline: ${data?.totalOpenDeals || 0} active deal${(data?.totalOpenDeals || 0) !== 1 ? "s" : ""} totaling ${formatCurrency(data?.totalOpenValue)}`}
                            icon={DollarSign}
                            accentColor="#8b5cf6"
                        />

                        {/* 2. Health-Weighted Pipeline */}
                        <KpiCard
                            T={T}
                            loading={loading}
                            label="Health-Weighted"
                            value={formatCurrency(data?.healthWeightedPipeline)}
                            sub="Stage × call-health weighting"
                            tooltip="Deterministic calculation using deal value × stage probability × call-health factor. This is not an ML forecast."
                            icon={Activity}
                            accentColor="#3b82f6"
                        />

                        {/* 3. Closed Won */}
                        <KpiCard
                            T={T}
                            loading={loading}
                            label={`Closed Won (${data?.periodLabel || "Period"})`}
                            value={formatCurrency(data?.periodClosedWon)}
                            sub={`${data?.periodClosedWonCount || 0} deal${(data?.periodClosedWonCount || 0) !== 1 ? "s" : ""} · ${formatCurrency(data?.periodClosedWon)} closed`}
                            tooltip={`${data?.periodClosedWonCount || 0} closed won deal${(data?.periodClosedWonCount || 0) !== 1 ? "s" : ""} totaling ${formatCurrency(data?.periodClosedWon)} in ${data?.periodLabel || "selected period"}`}
                            icon={Award}
                            accentColor="#10b981"
                            trend={Number(data?.periodClosedWon || 0) > 0 ? "up" : undefined}
                        />

                        {/* 4. Pipeline Coverage */}
                        <KpiCard
                            T={T}
                            loading={loading}
                            label="Pipeline Coverage"
                            value={
                                data?.targetAlignmentStatus === "PERIOD_MISMATCH"
                                    ? "Period Mismatch"
                                    : data?.targetAlignmentStatus === "HISTORICAL_UNAVAILABLE"
                                        ? "Unavailable"
                                        : data?.targetAlignmentStatus === "NOT_APPLICABLE_ALL_TIME"
                                            ? "Not Applicable"
                                            : data?.targetAlignmentStatus === "NO_TARGET" || !data?.revenueTarget
                                                ? "No Target"
                                                : data?.gapToTarget != null && Number(data.gapToTarget) <= 0
                                                    ? "Target Achieved"
                                                    : data?.pipelineCoverageRatio != null
                                                        ? `${data.pipelineCoverageRatio}x`
                                                        : "No Target"
                            }
                            sub={
                                data?.targetAlignmentStatus === "PERIOD_MISMATCH"
                                    ? `Target set for ${data?.revenueTargetPeriod?.toLowerCase() || "quarter"}`
                                    : data?.targetAlignmentStatus === "HISTORICAL_UNAVAILABLE"
                                        ? "Not tracked historically"
                                        : data?.targetAlignmentStatus === "NOT_APPLICABLE_ALL_TIME"
                                            ? "Not applicable for All Time"
                                            : data?.targetAlignmentStatus === "NO_TARGET" || !data?.revenueTarget
                                                ? "Target not set"
                                                : data?.gapToTarget != null && Number(data.gapToTarget) <= 0
                                                    ? "Target met by Closed Won"
                                                    : data?.pipelineCoverageRatio != null
                                                        ? `${formatCurrency(data?.totalOpenValue)} open ÷ ${formatCurrency(data?.gapToTarget)} remaining`
                                                        : "Target not set"
                            }
                            tooltip={
                                (() => {
                                    if (data?.targetAlignmentStatus === "PERIOD_MISMATCH") {
                                        return `Revenue target is configured for a ${data?.revenueTargetPeriod?.toLowerCase() || "quarterly"} period, which does not match the selected date range (${data?.periodLabel || "selected period"}). Select ${data?.revenueTargetPeriod === "MONTHLY" ? "This Month" : "This Quarter"} or update target.`;
                                    }
                                    if (data?.targetAlignmentStatus === "HISTORICAL_UNAVAILABLE") {
                                        return `Historical pipeline coverage is not available for ${data?.periodLabel || "past periods"}.`;
                                    }
                                    if (data?.targetAlignmentStatus === "NOT_APPLICABLE_ALL_TIME") {
                                        return "Pipeline coverage requires a time-bound period (e.g. This Quarter or This Month) and cannot be evaluated for All Time.";
                                    }
                                    if (data?.targetAlignmentStatus === "NO_TARGET" || !data?.revenueTarget) {
                                        return "No revenue target configured. Set a revenue target to track pipeline coverage against your target.";
                                    }
                                    if (data?.gapToTarget != null && Number(data.gapToTarget) <= 0) {
                                        return `Target achieved! Closed Won (${formatCurrency(data?.periodClosedWon)}) has met or exceeded the revenue target (${formatCurrency(data?.revenueTarget)}). Remaining gap is $0.`;
                                    }
                                    if (data?.pipelineCoverageRatio != null && data?.gapToTarget != null) {
                                        const openNum = Number(data?.totalOpenValue || 0);
                                        const gapNum = Number(data?.gapToTarget || 0);
                                        const ratio = Number(data.pipelineCoverageRatio);
                                        const openFormatted = formatCurrency(data.totalOpenValue);
                                        const gapFormatted = formatCurrency(data.gapToTarget);

                                        let requirementStatus;
                                        if (gapNum > openNum) {
                                            const shortfall = gapNum - openNum;
                                            requirementStatus = `Below 1.0x coverage.\n${formatCurrency(shortfall)} below remaining requirement.`;
                                        } else if (ratio === 1.0 || openNum === gapNum) {
                                            requirementStatus = "At remaining requirement (1.0x coverage).";
                                        } else {
                                            requirementStatus = `Above remaining requirement (${ratio}x coverage).`;
                                        }

                                        return `Pipeline Coverage = Open Pipeline ÷ Remaining Revenue Gap.\nCurrent open pipeline: ${openFormatted}.\nRemaining revenue gap: ${gapFormatted}.\nCoverage: ${ratio}x.\n${requirementStatus}`;
                                    }
                                    return undefined;
                                })()
                            }
                            icon={Target}
                            accentColor="#06b6d4"
                            action={
                                (!data?.revenueTarget || data?.targetAlignmentStatus === "NO_TARGET") && isOwnerOrAdmin ? (
                                    <button
                                        onClick={() => setTargetModalOpen(true)}
                                        className="text-[10px] font-black underline text-violet-400 hover:text-violet-300"
                                    >
                                        + Set
                                    </button>
                                ) : null
                            }
                        />

                        {/* 5. Win Rate */}
                        <KpiCard
                            T={T}
                            loading={loading}
                            label={`Win Rate (${data?.periodLabel || "Period"})`}
                            value={
                                (() => {
                                    const won = data?.periodClosedWonCount || 0;
                                    const lost = data?.periodClosedLostCount || 0;
                                    const total = won + lost;
                                    if (total === 0) return "0%";
                                    return data?.periodWinRatePct != null ? `${data.periodWinRatePct}%` : "0%";
                                })()
                            }
                            sub={
                                (() => {
                                    const won = data?.periodClosedWonCount || 0;
                                    const lost = data?.periodClosedLostCount || 0;
                                    const total = won + lost;
                                    if (total === 0) return "0W / 0L · No closed deals";
                                    if (total <= 2) {
                                        const dealWord = total === 1 ? "1 decided deal" : `${total} decided deals`;
                                        return `${won}W / ${lost}L · ${dealWord}`;
                                    }
                                    return `${won}W / ${lost}L`;
                                })()
                            }
                            tooltip={
                                (() => {
                                    const won = data?.periodClosedWonCount || 0;
                                    const lost = data?.periodClosedLostCount || 0;
                                    const total = won + lost;
                                    const period = data?.periodLabel || "selected period";
                                    if (total === 0) {
                                        return `No decided deals in ${period}.\nWin rate is not statistically meaningful without closed outcomes.`;
                                    }
                                    if (total <= 2) {
                                        const dealWord = total === 1 ? "1 decided deal" : `${total} decided deals`;
                                        return `Win rate = ${won} Won ÷ ${dealWord}.\nPeriod: ${period}.\nThis is an early signal because the sample contains only ${dealWord}.`;
                                    }
                                    return `Win rate = ${won} Won ÷ ${total} decided deals.\nPeriod: ${period}.`;
                                })()
                            }
                            icon={CheckCircle2}
                            accentColor="#10b981"
                        />

                        {/* 6. Gap to Target */}
                        <KpiCard
                            T={T}
                            loading={loading}
                            label="Gap to Target"
                            value={
                                data?.targetAlignmentStatus === "PERIOD_MISMATCH"
                                    ? "Period Mismatch"
                                    : data?.targetAlignmentStatus === "HISTORICAL_UNAVAILABLE"
                                        ? "Unavailable"
                                        : data?.targetAlignmentStatus === "NOT_APPLICABLE_ALL_TIME"
                                            ? "Not Applicable"
                                            : data?.targetAlignmentStatus === "NO_TARGET" || !data?.revenueTarget
                                                ? "No Target"
                                                : data?.gapToTarget != null && Number(data.gapToTarget) <= 0
                                                    ? "Target Achieved"
                                                    : data?.gapToTarget != null
                                                        ? formatCurrency(data.gapToTarget)
                                                        : "No Target"
                            }
                            sub={
                                data?.targetAlignmentStatus === "PERIOD_MISMATCH"
                                    ? `Target set for ${data?.revenueTargetPeriod?.toLowerCase() || "quarter"}`
                                    : data?.targetAlignmentStatus === "HISTORICAL_UNAVAILABLE"
                                        ? "Not tracked historically"
                                        : data?.targetAlignmentStatus === "NOT_APPLICABLE_ALL_TIME"
                                            ? "Not applicable for All Time"
                                            : data?.targetAlignmentStatus === "NO_TARGET" || !data?.revenueTarget
                                                ? "Set target to track"
                                                : data?.gapToTarget != null && Number(data.gapToTarget) <= 0
                                                    ? "Target met by actual Closed Won"
                                                    : data?.revenueTarget != null
                                                        ? `${formatCurrency(data?.revenueTarget)} target − ${formatCurrency(data?.periodClosedWon)} closed`
                                                        : "Target minus actual Closed Won"
                            }
                            tooltip={
                                (() => {
                                    if (data?.targetAlignmentStatus === "PERIOD_MISMATCH") {
                                        return `Revenue target is configured for a ${data?.revenueTargetPeriod?.toLowerCase() || "quarterly"} period, which does not match the selected date range (${data?.periodLabel || "selected period"}). Select ${data?.revenueTargetPeriod === "MONTHLY" ? "This Month" : "This Quarter"} or update target.`;
                                    }
                                    if (data?.targetAlignmentStatus === "HISTORICAL_UNAVAILABLE") {
                                        return `Historical target tracking is not available for ${data?.periodLabel || "past periods"}.`;
                                    }
                                    if (data?.targetAlignmentStatus === "NOT_APPLICABLE_ALL_TIME") {
                                        return "Revenue targets apply to specific time periods and cannot be evaluated for All Time.";
                                    }
                                    if (data?.targetAlignmentStatus === "NO_TARGET" || !data?.revenueTarget) {
                                        return "Set a quarterly or monthly revenue target to track your remaining revenue gap.";
                                    }
                                    if (data?.gapToTarget != null && Number(data.gapToTarget) <= 0) {
                                        return `Target achieved! Actual Closed Won (${formatCurrency(data?.periodClosedWon)}) has met or exceeded the revenue target (${formatCurrency(data?.revenueTarget)}). Remaining gap is $0.`;
                                    }
                                    if (data?.revenueTarget != null) {
                                        return `Revenue Target (${formatCurrency(data.revenueTarget)}) − Closed Won (${formatCurrency(data?.periodClosedWon || 0)}) = Remaining Gap (${formatCurrency(data?.gapToTarget || 0)})`;
                                    }
                                    return undefined;
                                })()
                            }
                            icon={TrendingUp}
                            accentColor="#f59e0b"
                            trend={
                                data?.targetAlignmentStatus === "ALIGNED" && data?.gapToTarget != null && Number(data.gapToTarget) <= 0
                                    ? "up"
                                    : undefined
                            }
                        />
                    </div>

                    {/* ── 3. Active Stage Breakdown & At-Risk Summary Grid ───── */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                        {/* Active Pipeline Stage Breakdown (7 cols) */}
                        <Panel T={T} className="lg:col-span-7 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <SectionLabel T={T}>Active Pipeline Funnel</SectionLabel>
                                    <h3 className="text-sm font-black flex items-center gap-2" style={{ color: T.text }}>
                                        <Layers size={16} style={{ color: "#8b5cf6" }} />
                                        Stage Distribution
                                    </h3>
                                </div>
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                                    style={{ background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>
                                    {data?.totalOpenDeals || 0} active deals (excludes closed)
                                </span>
                            </div>

                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3, 4].map(i => <Skeleton key={i} T={T} className="h-9 w-full" />)}
                                </div>
                            ) : hasNoOpenDeals ? (
                                <div className="py-10 text-center space-y-2">
                                    <Layers size={32} className="mx-auto opacity-30" style={{ color: T.textMuted }} />
                                    <p className="text-sm font-bold" style={{ color: T.text }}>No Active Open Deals</p>
                                    <p className="text-xs" style={{ color: T.textMuted }}>
                                        Deals in Discovery, Demo, Proposal, or Negotiation will display here.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4 pt-1">
                                    {data?.stageBreakdown?.map((stage) => (
                                        <StageProgressRow
                                            key={stage.stage}
                                            T={T}
                                            stage={stage}
                                            totalOpenPipeline={Number(data?.totalOpenValue || 0)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Closed Outcomes Strip */}
                            {!loading && (Number(data?.totalWonValue || 0) > 0 || Number(data?.totalLostValue || 0) > 0) && (
                                <div className="pt-4 border-t grid grid-cols-2 gap-3" style={{ borderColor: T.divider }}>
                                    <div className="flex items-center gap-2.5 p-3 rounded-xl"
                                        style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                                        <CheckCircle2 size={18} style={{ color: "#10b981" }} />
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#10b981" }}>
                                                Total Won (All Time)
                                            </p>
                                            <p className="text-sm font-black" style={{ color: T.text }}>
                                                {formatCurrency(data?.totalWonValue)} <span className="text-[10px] font-bold text-slate-400">({data?.totalWonDeals} deals)</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 p-3 rounded-xl"
                                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                                        <XCircle size={18} style={{ color: "#ef4444" }} />
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#ef4444" }}>
                                                Total Lost (All Time)
                                            </p>
                                            <p className="text-sm font-black" style={{ color: T.text }}>
                                                {formatCurrency(data?.totalLostValue)} <span className="text-[10px] font-bold text-slate-400">({data?.totalLostDeals} deals)</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Panel>

                        {/* At-Risk Pipeline Summary Card (5 cols) */}
                        <Panel T={T} className="lg:col-span-5 p-5 flex flex-col justify-between space-y-4">
                            <div>
                                <div className="flex items-center justify-between">
                                    <SectionLabel T={T}>Revenue Exposure</SectionLabel>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide"
                                        style={{
                                            background: (data?.atRiskDealCount || 0) > 0 ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                                            color: (data?.atRiskDealCount || 0) > 0 ? "#ef4444" : "#10b981"
                                        }}>
                                        {(data?.atRiskDealCount || 0) > 0 ? "Active Commercial Risk" : "No Active Commercial Risk"}
                                    </span>
                                </div>

                                <h3 className="text-sm font-black flex items-center gap-2" style={{ color: T.text }}>
                                    <ShieldAlert size={16} style={{ color: "#ef4444" }} />
                                    At-Risk Pipeline Exposure
                                </h3>

                                <div className="mt-4 p-4 rounded-xl border"
                                    style={{
                                        background: (data?.atRiskDealCount || 0) > 0 ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
                                        borderColor: (data?.atRiskDealCount || 0) > 0 ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"
                                    }}>
                                    <p className="text-xs font-bold uppercase tracking-wider"
                                        style={{ color: (data?.atRiskDealCount || 0) > 0 ? "#ef4444" : "#10b981" }}>
                                        At-Risk Pipeline Exposure
                                    </p>
                                    <p className="text-3xl font-black mt-1" style={{ color: T.text }}>
                                        {formatCurrency(data?.atRiskPipelineValue)}
                                    </p>
                                    <p className="text-xs mt-1 font-semibold" style={{ color: T.textMuted }}>
                                        {(data?.atRiskDealCount || 0) > 0
                                            ? `Across ${data.atRiskDealCount} deal${data.atRiskDealCount !== 1 ? "s" : ""} with active commercial risk`
                                            : "Deals with active commercial or conversational risk"}
                                    </p>
                                </div>
                            </div>

                            {/* Risk Triggers Breakdown */}
                            <div className="space-y-2 pt-2 border-t text-xs" style={{ borderColor: T.divider }}>
                                <div className="flex items-center justify-between">
                                    <span style={{ color: T.textMuted }}>Pricing & Budget Friction</span>
                                    <span className="font-bold" style={{ color: T.text }}>
                                        {data?.pricingPressureDeals || 0} deal{data?.pricingPressureDeals !== 1 ? "s" : ""} ({formatCurrency(data?.pricingPressureValue)})
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span style={{ color: T.textMuted }}>Late-Stage Competitor Push</span>
                                    <span className="font-bold" style={{ color: T.text }}>
                                        {data?.competitiveExposureDeals || 0} deal{data?.competitiveExposureDeals !== 1 ? "s" : ""} ({formatCurrency(data?.competitiveExposureValue)})
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span style={{ color: T.textMuted }}>Missing Call Coverage</span>
                                    <span className="font-bold" style={{ color: T.text }}>
                                        {data?.unlinkedOpenDeals || 0} deal{data?.unlinkedOpenDeals !== 1 ? "s" : ""} ({formatCurrency(data?.unlinkedOpenDealValue)})
                                    </span>
                                </div>
                            </div>
                        </Panel>
                    </div>

                    {/* ── 4. Deals Action Section ───────────────────────────── */}
                    <Panel T={T} className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <SectionLabel T={T}>Executive Deal Intervention</SectionLabel>
                                <h3 className="text-sm font-black flex items-center gap-2" style={{ color: T.text }}>
                                    <ShieldAlert size={16} style={{ color: "#ef4444" }} />
                                    Deals Requiring Attention
                                </h3>
                            </div>
                            <span className="text-xs font-bold" style={{ color: T.textMuted }}>
                                Prioritized by Deal Value & Follow-Up Urgency
                            </span>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3].map(i => <Skeleton key={i} T={T} className="h-36 rounded-xl w-full" />)}
                            </div>
                        ) : data?.atRiskDeals?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {data.atRiskDeals.map((deal) => {
                                    const isCritical = deal.riskLevel === "CRITICAL";
                                    const isHigh = deal.riskLevel === "HIGH";
                                    const badgeColor = isCritical ? "#ef4444" : isHigh ? "#f59e0b" : "#94a3b8";

                                    return (
                                        <div
                                            key={deal.dealId}
                                            className="p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all"
                                            style={{
                                                background: T.isDark ? "rgba(255,255,255,0.02)" : "#ffffff",
                                                borderColor: isCritical ? "rgba(239,68,68,0.3)" : isHigh ? "rgba(245,158,11,0.25)" : T.panelBorder
                                            }}
                                        >
                                            <div>
                                                {/* Header: Value + Risk Badge */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h4 className="text-sm font-black truncate max-w-[180px]" style={{ color: T.text }}>
                                                            {deal.dealName}
                                                        </h4>
                                                        <p className="text-[11px] font-semibold" style={{ color: T.textMuted }}>
                                                            {deal.accountName} · <span className="font-bold" style={{ color: "#8b5cf6" }}>{deal.stageLabel}</span>
                                                        </p>
                                                        <p className="text-[10px] font-medium mt-0.5" style={{ color: T.textFaint }}>
                                                            Owner: <span className="font-semibold" style={{ color: T.textMuted }}>{deal.ownerName && deal.ownerName.trim() ? deal.ownerName : "Unassigned"}</span>
                                                        </p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="text-base font-black" style={{ color: T.text }}>
                                                            ${Number(deal.dealValue).toLocaleString()}
                                                        </p>
                                                        <span className="inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                                                            style={{
                                                                background: isCritical ? "rgba(239,68,68,0.12)" : isHigh ? "rgba(245,158,11,0.12)" : (T.isDark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.12)"),
                                                                color: badgeColor,
                                                                border: `1px solid ${badgeColor}33`
                                                            }}>
                                                            {deal.riskLevel}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Risk Reason Banner */}
                                                <div className="mt-3 p-2.5 rounded-lg text-xs font-semibold flex items-start gap-2"
                                                    style={{
                                                        background: isCritical
                                                            ? "rgba(239,68,68,0.08)"
                                                            : isHigh
                                                                ? "rgba(245,158,11,0.08)"
                                                                : (T.isDark ? "rgba(148,163,184,0.08)" : "rgba(100,116,139,0.08)"),
                                                        color: isCritical
                                                            ? "#ef4444"
                                                            : isHigh
                                                                ? "#f59e0b"
                                                                : (T.isDark ? "#cbd5e1" : "#475569")
                                                    }}>
                                                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2">{deal.mainRiskReason}</span>
                                                </div>
                                            </div>

                                            {/* Footer Info & Actions */}
                                            <div className="pt-2 border-t flex items-center justify-between text-xs" style={{ borderColor: T.divider }}>
                                                <span style={{ color: T.textFaint }}>
                                                    {deal.daysSinceLastActivity === 0
                                                        ? "Active today"
                                                        : `${deal.daysSinceLastActivity}d inactive`}
                                                </span>

                                                <div className="flex items-center gap-2">
                                                    {deal.latestCallId ? (
                                                        <Link
                                                            to={companySlug ? `/w/${companySlug}/calls/${deal.latestCallId}` : `/calls/${deal.latestCallId}`}
                                                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 hover:brightness-110"
                                                            style={{
                                                                background: "rgba(139,92,246,0.12)",
                                                                color: "#8b5cf6",
                                                                border: "1px solid rgba(139,92,246,0.25)"
                                                            }}
                                                            title="Review latest call transcript and AI insights"
                                                        >
                                                            <PhoneCall size={11} /> Latest Call <ArrowUpRight size={10} />
                                                        </Link>
                                                    ) : (
                                                        <span className="text-[10px] font-medium" style={{ color: T.textFaint }}>
                                                            No calls linked
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-8 text-center space-y-2">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto"
                                    style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                                    <ShieldCheck size={22} />
                                </div>
                                <p className="text-sm font-bold" style={{ color: T.text }}>0 Deals Requiring Attention</p>
                                <p className="text-xs max-w-sm mx-auto" style={{ color: T.textMuted }}>
                                    All active open deals have recent call activity, resolved objections, and positive momentum.
                                </p>
                            </div>
                        )}
                    </Panel>

                    {/* ── 5. Revenue-Connected Conversation Signals ──────────── */}
                    <div>
                        <SectionLabel T={T}>Conversation Revenue Intelligence</SectionLabel>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            {/* Signal 1: Pricing Pressure */}
                            <Panel T={T} className="p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold" style={{ color: T.textMuted }}>Pricing Pressure</span>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                                        <AlertTriangle size={15} />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-2xl font-black" style={{ color: T.text }}>
                                        {formatCurrency(data?.pricingPressureValue)}
                                    </p>
                                    <p className="text-xs font-semibold mt-0.5" style={{ color: T.textMuted }}>
                                        Exposed across {data?.pricingPressureDeals || 0} deal{(data?.pricingPressureDeals || 0) !== 1 ? "s" : ""}
                                    </p>
                                </div>
                                <p className="text-[11px] pt-2 border-t" style={{ color: T.textFaint, borderColor: T.divider }}>
                                    Unresolved budget & pricing objections detected during deal calls.
                                </p>
                            </Panel>

                            {/* Signal 2: Competitive Exposure */}
                            <Panel T={T} className="p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold" style={{ color: T.textMuted }}>Competitive Exposure</span>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                                        <ShieldAlert size={15} />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-2xl font-black" style={{ color: T.text }}>
                                        {formatCurrency(data?.competitiveExposureValue)}
                                    </p>
                                    <p className="text-xs font-semibold mt-0.5" style={{ color: T.textMuted }}>
                                        In {data?.competitiveExposureDeals || 0} late-stage deal{(data?.competitiveExposureDeals || 0) !== 1 ? "s" : ""}
                                    </p>
                                </div>
                                <p className="text-[11px] pt-2 border-t" style={{ color: T.textFaint, borderColor: T.divider }}>
                                    Proposal & Negotiation deals with active competitor mentions.
                                </p>
                            </Panel>

                            {/* Signal 3: Call Cadence & Momentum */}
                            <Panel T={T} className="p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold" style={{ color: T.textMuted }}>Call Cadence & Momentum</span>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                                        <Zap size={15} />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-2xl font-black" style={{ color: T.text }}>
                                        {data?.healthyEngagementDeals || 0} deal{(data?.healthyEngagementDeals || 0) !== 1 ? "s" : ""} on active cadence
                                    </p>
                                    <p className="text-xs font-semibold mt-0.5" style={{ color: "#ef4444" }}>
                                        {data?.decliningEngagementDeals || 0} deal{(data?.decliningEngagementDeals || 0) !== 1 ? "s" : ""} exceeded follow-up window
                                    </p>
                                </div>
                                <p className="text-[11px] pt-2 border-t" style={{ color: T.textFaint, borderColor: T.divider }}>
                                    Based on recorded call recency and configured follow-up windows.
                                </p>
                            </Panel>

                        </div>
                    </div>

                    {/* ── 6. Executive Navigation Footer ────────────────────── */}
                    <Panel T={T} className="p-5">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>
                                    <PhoneCall size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black" style={{ color: T.text }}>
                                        Expand Conversation-to-Deal Intelligence
                                    </h3>
                                    <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>
                                        Link recorded calls to deals in the Conversation Library to unlock automated risk detection and deal health tracking.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Link
                                    to={`/w/${companySlug}/insights`}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5"
                                    style={{
                                        background: T.isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                                        color: T.textMuted,
                                        border: `1px solid ${T.panelBorder}`
                                    }}
                                >
                                    AI Insights <ArrowRight size={12} />
                                </Link>
                                <Link
                                    to={`/w/${companySlug}/history`}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all inline-flex items-center gap-1.5"
                                    style={{ background: "linear-gradient(135deg, #7c3aed, #8b5cf6)" }}
                                >
                                    Conversation Library <ArrowUpRight size={12} />
                                </Link>
                            </div>
                        </div>
                    </Panel>

                </div>
            </div>

            {/* Target Modal */}
            <TargetModal
                T={T}
                isOpen={targetModalOpen}
                onClose={() => setTargetModalOpen(false)}
                currentTarget={data?.revenueTarget}
                currentPeriod={data?.revenueTargetPeriod}
                onSave={handleSaveTarget}
            />
        </div>
    );
}
