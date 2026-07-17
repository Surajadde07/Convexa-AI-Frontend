import { ArrowUp, ArrowDown, Inbox } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────── *
 * Shared primitives for the Company workspace (CompanyDashboard.jsx +     *
 * EmployeePerformancePage.jsx).                                          *
 *                                                                        *
 * Extracted out of CompanyDashboard.jsx (Sprint 2), which originally     *
 * defined these locally — Sprint 2.5 needs the identical look in a       *
 * second page, and "don't duplicate components" means factoring these    *
 * out once, not copy-pasting them into the new file.                     *
 * ────────────────────────────────────────────────────────────────────── */

export function SectionLabel({ icon: Icon, children, tone = "#8b5cf6" }) {
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

export function Panel({ children, className = "", style = {}, T }) {
    return (
        <div className={`rounded-2xl p-5 sm:p-6 ${className}`}
            style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, ...style }}>
            {children}
        </div>
    );
}

export function Skeleton({ className = "", T }) {
    const base = T?.panelHover ?? "rgba(255,255,255,0.08)";
    return (
        <div className={`rounded-xl ${className}`}
            style={{ background: `linear-gradient(90deg, transparent 25%, ${base} 50%, transparent 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
    );
}

export function TrendBadge({ pct }) {
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

export function KPICard({ label, value, sub, Icon, accent = "#8b5cf6", T }) {
    return (
        <div className="group relative overflow-hidden rounded-2xl border transition-all duration-300"
            style={{ background: T.panel, borderColor: T.panelBorder }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}55`; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 12px 32px ${accent}1c`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.panelBorder; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 15% 0%, ${accent}14 0%, transparent 60%)` }} />
            <div className="p-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mb-3.5"
                    style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                    {Icon && <Icon size={18} style={{ color: accent }} strokeWidth={2} />}
                </div>
                <p className="text-3xl font-black mb-1 tracking-tight" style={{ color: T.text }}>{value}</p>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: T.textMuted }}>{label}</p>
                {sub && <p className="text-[10px] mt-0.5" style={{ color: T.textFaint }}>{sub}</p>}
            </div>
        </div>
    );
}

export const tooltipStyleFor = (T) => ({
    background: T.sidebarBg,
    border: `1px solid ${T.panelBorder}`,
    borderRadius: "12px",
    color: T.text,
    fontSize: "13px",
});

export function ScoreBadge({ score }) {
    const color = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
    return (
        <span className="inline-flex items-center justify-center min-w-[2.5rem] text-xs font-bold px-2 py-1 rounded-lg"
            style={{ color, background: `${color}18` }}>
            {Math.round(score)}
        </span>
    );
}

// Same sentiment palette AnalyticsPage.jsx already uses (SENT_COLORS) — kept
// identical here rather than redefined with different values.
export const SENTIMENT_COLORS = { POSITIVE: "#10b981", NEUTRAL: "#f59e0b", NEGATIVE: "#ef4444" };

// Same buying-intent palette AnalyticsPage.jsx already uses.
export const BUYING_INTENT_COLORS = { High: "#10b981", Medium: "#f59e0b", Low: "#f97316" };
export function buyingIntentColor(intent) {
    return BUYING_INTENT_COLORS[intent] ?? "#94a3b8";
}

/**
 * Feature 7 — performance badges. Thresholds are a deliberate, stated
 * choice (not in the spec numerically) chosen to line up with the same
 * score bands ScoreBadge/company coaching threshold already use:
 * Elite 90+, Strong 80-89, Good 65-79 (top performers); Coaching Required
 * 50-64, Critical <50 (needs coaching — the <65 threshold that puts someone
 * on this list at all is defined server-side in CompanyService).
 */
export function performerBadge(avgScore) {
    if (avgScore >= 90) return { label: "Elite", emoji: "🏆", color: "#f59e0b" };
    if (avgScore >= 80) return { label: "Strong", emoji: "⭐", color: "#8b5cf6" };
    return { label: "Good", emoji: "👍", color: "#10b981" };
}

export function coachingBadge(avgScore) {
    if (avgScore < 50) return { label: "Critical", emoji: "🚨", color: "#ef4444" };
    return { label: "Coaching Required", emoji: "⚠️", color: "#f59e0b" };
}

export function PerformanceBadgePill({ badge }) {
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
            style={{ color: badge.color, background: `${badge.color}18`, border: `1px solid ${badge.color}35` }}>
            <span>{badge.emoji}</span> {badge.label}
        </span>
    );
}

/**
 * Generic labeled progress bar — used for Goal Progress (Feature 5) and
 * skill bars (Feature 10), but intentionally not named/typed for either,
 * so it's equally usable anywhere else a "value out of target" needs
 * showing (Feature 14 — future company/team/HR views).
 */
export function ProgressBar({ label, value, target = 100, color = "#8b5cf6", T }) {
    const pct = Math.max(0, Math.min(100, target > 0 ? (value / target) * 100 : 0));
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold" style={{ color: T.text }}>{label}</span>
                <span className="text-xs font-bold" style={{ color }}>{Math.round(pct)}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: T.panelHover }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
}

/**
 * Generic empty state — icon + title + subtitle, replacing ad hoc
 * "No data" text blocks. Reusable anywhere a panel needs one (Feature 12).
 */
export function EmptyState({ icon: Icon = Inbox, title = "Nothing here yet", subtitle, T }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-1"
                style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}>
                <Icon size={18} style={{ color: T.textFaint }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: T.textMuted }}>{title}</p>
            {subtitle && <p className="text-xs max-w-[220px]" style={{ color: T.textFaint }}>{subtitle}</p>}
        </div>
    );
}
