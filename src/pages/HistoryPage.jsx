import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api, { getUser, clearSession } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";
import MiniAudioPlayer from "../components/MiniAudioPlayer.jsx";
import { Sidebar, THEMES } from "../components/Sidebar.jsx";
import {
    Search, SlidersHorizontal, ArrowUpDown, LayoutGrid, Rows3,
    Upload, X, ChevronDown, Smile, Frown, Meh, Star, Clock3,
    Phone, PhoneIncoming, PhoneOutgoing, Flame, ShieldCheck, ShieldAlert,
    Target, ListChecks, Download, Share2, Trash2, ArrowUpRight, PlayCircle,
    CalendarDays, RefreshCw, AlertTriangle, CheckCircle, Sparkles, Menu,
    FileAudio, Radio, Command, Bell, Sun, Moon, LogOut, MoreHorizontal,
    LayoutDashboard, History as HistoryIcon, LineChart, TrendingUp, TrendingDown,
    Gauge, Tag, CircleSlash,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — reads only from real fields already returned by /api/calls/my-calls.
// Nothing here fabricates data; optional fields (duration, outcome, callType,
// buyingIntent, actionItems…) are rendered ONLY when present on the call object,
// so this component is forward-compatible without ever inventing numbers.
// ─────────────────────────────────────────────────────────────────────────────

const SENT_CONFIG = {
    POSITIVE: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", label: "Positive", Icon: Smile },
    NEGATIVE: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: "Negative", Icon: Frown },
    NEUTRAL: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "Neutral", Icon: Meh },
};

const RISK_CFG = {
    high: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: "High risk", Icon: Flame },
    medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "Needs review", Icon: ShieldAlert },
    low: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", label: "Healthy", Icon: ShieldCheck },
};

/** Same heuristic used on the Dashboard's "Needs Attention" panel — kept in
 *  sync intentionally so risk means the same thing on both pages. */
function computeRisk(c) {
    const score = c.overallScore;
    if ((score != null && score < 35) || (c.sentiment === "NEGATIVE" && score != null && score < 50)) return "high";
    if (c.sentiment === "NEGATIVE" || (score != null && score < 50)) return "medium";
    if (score != null || c.sentiment) return "low";
    return null;
}

function parseList(str) {
    if (!str) return [];
    if (typeof str !== "string") return Array.isArray(str) ? str : [];
    if (str.trim().startsWith("[")) {
        try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) return parsed.map(s => String(s).trim()).filter(Boolean);
        } catch { /* fall through to comma split */ }
    }
    return str.split(/,|\n/).map(s => s.replace(/^[\s*\-•]+/, "").trim()).filter(Boolean);
}

/** Turns "acme_corp_demo_call.mp3" into "Acme Corp Demo Call" for a card title
 *  when no explicit customer name field exists on the call. */
function titleFromFileName(name) {
    if (!name) return "Untitled call";
    const base = name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
    return base.replace(/\b\w/g, ch => ch.toUpperCase());
}

function formatDuration(sec) {
    if (sec == null || Number.isNaN(sec)) return null;
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(dateStr) {
    if (!dateStr) return "";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton({ className = "", T }) {
    const base = T?.panelHover ?? "rgba(255,255,255,0.08)";
    return (
        <div className={`rounded-xl ${className}`}
            style={{ background: `linear-gradient(90deg, transparent 25%, ${base} 50%, transparent 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
    );
}

function Toast({ message, type = "success", onDismiss }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 3200);
        return () => clearTimeout(t);
    }, [onDismiss]);
    const isSuccess = type === "success";
    return (
        <div className="fixed bottom-6 right-6 left-6 sm:left-auto z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl"
            style={{
                background: isSuccess ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                borderColor: isSuccess ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)",
                animation: "slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                boxShadow: isSuccess ? "0 8px 32px rgba(16,185,129,0.2)" : "0 8px 32px rgba(239,68,68,0.2)",
            }}>
            {isSuccess ? <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" /> : <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />}
            <span className="text-sm font-semibold" style={{ color: isSuccess ? "#6ee7b7" : "#fca5a5" }}>{message}</span>
            <button onClick={onDismiss} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
                <X size={14} className="text-white" />
            </button>
        </div>
    );
}

function DeleteModal({ callName, onConfirm, onCancel, T }) {
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}>
            <div className="w-full max-w-sm rounded-3xl p-6 sm:p-8" style={{ background: T.headerBg, border: `1px solid ${T.panelBorder}`, backdropFilter: "blur(24px)" }}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
                        <Trash2 size={26} className="text-red-400" />
                    </div>
                    <div>
                        <p className="font-black text-lg" style={{ color: T.text }}>Delete this call?</p>
                        <p className="text-sm mt-1.5 max-w-xs" style={{ color: T.textMuted }}>
                            "<span style={{ color: T.text }}>{callName}</span>" will be permanently deleted and cannot be recovered.
                        </p>
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                            style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>
                            Cancel
                        </button>
                        <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all hover:shadow-lg hover:shadow-red-500/25 active:scale-95">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Small rounded pill used across cards for every badge type. */
function Badge({ Icon, label, color, bg, border, size = "sm" }) {
    const pad = size === "sm" ? "px-2 py-1" : "px-2.5 py-1.5";
    const text = size === "sm" ? "text-[10.5px]" : "text-xs";
    return (
        <span className={`inline-flex items-center gap-1 ${pad} rounded-lg ${text} font-bold whitespace-nowrap`}
            style={{ color, background: bg, border: `1px solid ${border}` }}>
            {Icon && <Icon size={11} strokeWidth={2.5} />}
            {label}
        </span>
    );
}

function ScorePill({ score, T }) {
    if (score == null) return <span className="text-xs" style={{ color: T.textFaint }}>—</span>;
    const color = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
    return (
        <div className="flex items-center gap-1.5">
            <Gauge size={13} style={{ color }} />
            <span className="text-sm font-black" style={{ color }}>{score}</span>
            <span className="text-[10px] font-medium" style={{ color: T.textFaint }}>/ 100</span>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ T, hasFilters, onClear }) {
    if (hasFilters) {
        return (
            <div className="text-center py-20 rounded-3xl border border-dashed" style={{ background: T.panel, borderColor: T.panelBorder }}>
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: T.panelHover }}>
                    <Search size={22} style={{ color: T.textFaint }} />
                </div>
                <p className="font-bold text-lg" style={{ color: T.text }}>No calls match these filters</p>
                <p className="text-sm mt-1" style={{ color: T.textMuted }}>Try widening your search or clearing a filter.</p>
                <button onClick={onClear}
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}>
                    <RefreshCw size={13} /> Clear all filters
                </button>
            </div>
        );
    }
    return (
        <div className="text-center py-20 px-6 rounded-3xl border border-dashed relative overflow-hidden" style={{ background: T.panel, borderColor: T.panelBorder }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full pointer-events-none opacity-[0.08] blur-3xl" style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
            <svg width="132" height="104" viewBox="0 0 132 104" fill="none" className="mx-auto mb-6 relative">
                <rect x="18" y="22" width="96" height="64" rx="10" fill={T.panelHover} stroke={T.panelBorder} />
                <rect x="30" y="36" width="52" height="6" rx="3" fill={T.textFaint} opacity="0.5" />
                <rect x="30" y="48" width="72" height="6" rx="3" fill={T.textFaint} opacity="0.3" />
                <rect x="30" y="60" width="40" height="6" rx="3" fill={T.textFaint} opacity="0.3" />
                <circle cx="66" cy="20" r="20" fill="url(#emptyGrad)" />
                <path d="M58 20l5.5 5.5L75 14" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                    <linearGradient id="emptyGrad" x1="46" y1="0" x2="86" y2="40" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#7c3aed" /><stop offset="1" stopColor="#2563eb" />
                    </linearGradient>
                </defs>
            </svg>
            <h2 className="text-xl font-black mb-2 relative" style={{ color: T.text }}>Upload your first sales call</h2>
            <p className="max-w-md mx-auto mb-7 text-sm leading-relaxed relative" style={{ color: T.textMuted }}>
                Once you analyze a call, it'll show up here with AI scoring, sentiment, and a searchable transcript — ready to revisit anytime.
            </p>
            <Link to="/dashboard"
                className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 2px 16px rgba(124,58,237,0.3)" }}>
                <Upload size={15} /> Upload a call
            </Link>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALL CARD (grid view)
// ─────────────────────────────────────────────────────────────────────────────

function CallCard({ call, T, onOpen, onDelete, onAction, playingId, setPlayingId }) {
    const sent = SENT_CONFIG[call.sentiment];
    const risk = computeRisk(call);
    const riskCfg = risk ? RISK_CFG[risk] : null;
    const duration = formatDuration(call.duration ?? call.durationSeconds);
    const actionItems = Array.isArray(call.actionItems) ? call.actionItems.length : (typeof call.actionItemsCount === "number" ? call.actionItemsCount : null);
    const title = call.customerName || titleFromFileName(call.fileName);
    const accent = call.overallScore >= 70 ? "#10b981" : call.overallScore >= 50 ? "#f59e0b" : call.overallScore != null ? "#ef4444" : "#8b5cf6";

    return (
        <div onClick={() => onOpen(call)}
            className="group relative rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 flex flex-col"
            style={{ background: T.panel, borderColor: T.panelBorder }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}55`; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 16px 36px ${accent}1c`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.panelBorder; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>

            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 20% 0%, ${accent}12 0%, transparent 60%)` }} />

            <div className="p-5 flex-1 flex flex-col relative">
                {/* Header row */}
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                        <Phone size={16} style={{ color: accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: T.text }}>{title}</p>
                        <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: T.textFaint }}>
                            <Clock3 size={10} /> {timeAgo(call.createdAt)}
                            {duration && <><span className="opacity-50">·</span>{duration}</>}
                        </p>
                    </div>
                    <div onClick={e => e.stopPropagation()} className="relative flex-shrink-0">
                        <QuickActions call={call} T={T} onDelete={onDelete} onAction={onAction} />
                    </div>
                </div>

                {/* Summary */}
                <p className="text-xs leading-relaxed mb-4 line-clamp-2 flex-1" style={{ color: T.textMuted }}>
                    {call.summary || "No AI summary available for this call yet."}
                </p>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {sent && <Badge Icon={sent.Icon} label={sent.label} color={sent.color} bg={sent.bg} border={sent.border} />}
                    {riskCfg && <Badge Icon={riskCfg.Icon} label={riskCfg.label} color={riskCfg.color} bg={riskCfg.bg} border={riskCfg.border} />}
                    {call.outcome && <Badge Icon={Target} label={call.outcome} color="#a78bfa" bg="rgba(139,92,246,0.12)" border="rgba(139,92,246,0.3)" />}
                    {call.callType && (
                        <Badge Icon={/inbound/i.test(call.callType) ? PhoneIncoming : PhoneOutgoing} label={call.callType}
                            color="#60a5fa" bg="rgba(59,130,246,0.12)" border="rgba(59,130,246,0.3)" />
                    )}
                    {call.buyingIntent && <Badge Icon={Flame} label={`${call.buyingIntent} intent`} color="#f472b6" bg="rgba(244,114,182,0.12)" border="rgba(244,114,182,0.3)" />}
                </div>

                {/* Footer: score + audio + action items */}
                <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${T.divider}` }}>
                    <ScorePill score={call.overallScore} T={T} />
                    <div className="flex items-center gap-3">
                        {actionItems != null && actionItems > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: T.textMuted }}>
                                <ListChecks size={12} /> {actionItems}
                            </span>
                        )}
                        <div onClick={e => e.stopPropagation()}>
                            <MiniAudioPlayer cloudinaryUrl={call.cloudinaryUrl} playingId={playingId} callId={call.id} onPlay={setPlayingId} onStop={() => setPlayingId(null)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Hover action bar */}
            <div className="flex items-center gap-2 px-5 py-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ borderTop: `1px solid ${T.divider}`, background: T.panelHover }}>
                <Link to={`/calls/${call.id}`} onClick={e => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: "rgba(139,92,246,0.14)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}>
                    Open details <ArrowUpRight size={11} />
                </Link>
                <button onClick={e => { e.stopPropagation(); onAction("download", call); }} title="Download report"
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
                    style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>
                    <Download size={13} />
                </button>
                <button onClick={e => { e.stopPropagation(); onAction("share", call); }} title="Share"
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
                    style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>
                    <Share2 size={13} />
                </button>
                <button onClick={e => { e.stopPropagation(); onDelete(call); }} title="Delete"
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    );
}

function QuickActions({ call, T, onDelete, onAction }) {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!open) return;
        const h = () => setOpen(false);
        window.addEventListener("click", h);
        return () => window.removeEventListener("click", h);
    }, [open]);
    return (
        <div className="relative">
            <button onClick={() => setOpen(o => !o)} className="w-7 h-7 flex items-center justify-center rounded-lg transition-all" style={{ color: T.textFaint }}
                onMouseEnter={e => e.currentTarget.style.background = T.panelHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <MoreHorizontal size={15} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl overflow-hidden z-30" style={{ background: T.headerBg, border: `1px solid ${T.panelBorder}`, backdropFilter: "blur(20px)", boxShadow: "0 12px 32px rgba(0,0,0,0.35)" }}>
                    <Link to={`/calls/${call.id}`} className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold transition-all" style={{ color: T.text }}
                        onMouseEnter={e => e.currentTarget.style.background = T.panelHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <ArrowUpRight size={13} /> Open details
                    </Link>
                    <button onClick={() => { setOpen(false); onAction("download", call); }} className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold transition-all" style={{ color: T.text }}
                        onMouseEnter={e => e.currentTarget.style.background = T.panelHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <Download size={13} /> Download report
                    </button>
                    <button onClick={() => { setOpen(false); onAction("share", call); }} className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold transition-all" style={{ color: T.text }}
                        onMouseEnter={e => e.currentTarget.style.background = T.panelHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <Share2 size={13} /> Share
                    </button>
                    <button onClick={() => { setOpen(false); onDelete(call); }} className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold transition-all" style={{ color: "#f87171" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <Trash2 size={13} /> Delete
                    </button>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALL ROW (list view)
// ─────────────────────────────────────────────────────────────────────────────

function CallRow({ call, T, onOpen, onDelete, onAction, playingId, setPlayingId }) {
    const sent = SENT_CONFIG[call.sentiment];
    const risk = computeRisk(call);
    const riskCfg = risk ? RISK_CFG[risk] : null;
    const title = call.customerName || titleFromFileName(call.fileName);
    const accent = call.overallScore >= 70 ? "#10b981" : call.overallScore >= 50 ? "#f59e0b" : call.overallScore != null ? "#ef4444" : "#8b5cf6";

    return (
        <div onClick={() => onOpen(call)}
            className="group flex flex-col gap-3 md:grid md:grid-cols-[256px_200px_84px_172px] lg:grid-cols-[256px_minmax(0,1fr)_200px_84px_172px] md:items-center md:gap-4 px-4 sm:px-5 py-4 cursor-pointer transition-all"
            style={{ borderBottom: `1px solid ${T.divider}` }}
            onMouseEnter={e => e.currentTarget.style.background = T.panelHover}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

            <div className="flex items-center gap-3 min-w-0">
                <div onClick={e => e.stopPropagation()}>
                    <MiniAudioPlayer cloudinaryUrl={call.cloudinaryUrl} playingId={playingId} callId={call.id} onPlay={setPlayingId} onStop={() => setPlayingId(null)} />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: T.text }}>{title}</p>
                    <p className="text-[11px] truncate" style={{ color: T.textFaint }}>{timeAgo(call.createdAt)}</p>
                </div>
            </div>

            <p className="text-xs min-w-0 truncate hidden lg:block" style={{ color: T.textMuted }}>
                {call.summary || "No AI summary available yet."}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                {sent && <Badge Icon={sent.Icon} label={sent.label} color={sent.color} bg={sent.bg} border={sent.border} />}
                {riskCfg && <Badge Icon={riskCfg.Icon} label={riskCfg.label} color={riskCfg.color} bg={riskCfg.bg} border={riskCfg.border} />}
                {call.outcome && <Badge Icon={Target} label={call.outcome} color="#a78bfa" bg="rgba(139,92,246,0.12)" border="rgba(139,92,246,0.3)" />}
            </div>

            <div><ScorePill score={call.overallScore} T={T} /></div>

            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <Link to={`/calls/${call.id}`}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.28)" }}>
                    Open
                </Link>
                <button onClick={() => onAction("download", call)} title="Download report" className="w-7 h-7 flex items-center justify-center rounded-lg transition-all" style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>
                    <Download size={12} />
                </button>
                <button onClick={() => onAction("share", call)} title="Share" className="w-7 h-7 flex items-center justify-center rounded-lg transition-all" style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>
                    <Share2 size={12} />
                </button>
                <button onClick={() => onDelete(call)} title="Delete" className="w-7 h-7 flex items-center justify-center rounded-lg transition-all" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function FilterDrawer({ T, onClose, state, setState, facets, sentCounts }) {
    const { filterSentiment, filterDateFrom, filterDateTo, filterRisk, filterScoreMin } = state;
    return (
        <>
            <div className="fixed inset-0 z-[80]" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} onClick={onClose} />
            <div className="fixed top-0 right-0 h-full w-full sm:w-96 z-[81] flex flex-col"
                style={{ background: T.headerBg, borderLeft: `1px solid ${T.panelBorder}`, backdropFilter: "blur(24px)", animation: "drawerSlideIn 0.25s cubic-bezier(0.32,0.72,0,1)" }}>
                <div className="flex items-center justify-between px-5 h-16 flex-shrink-0" style={{ borderBottom: `1px solid ${T.divider}` }}>
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal size={15} style={{ color: T.text }} />
                        <span className="text-sm font-bold" style={{ color: T.text }}>Filters</span>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl transition-all" style={{ background: T.inputBg }}>
                        <X size={14} style={{ color: T.textMuted }} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* Sentiment */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: T.textFaint }}>Sentiment</p>
                        <div className="flex flex-wrap gap-2">
                            {["ALL", "POSITIVE", "NEUTRAL", "NEGATIVE"].map(s => {
                                const cfg = s === "ALL" ? null : SENT_CONFIG[s];
                                const active = filterSentiment === s;
                                return (
                                    <button key={s} onClick={() => setState(v => ({ ...v, filterSentiment: s }))}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                        style={active ? { background: "rgba(139,92,246,0.16)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.4)" } : { background: T.inputBg, color: T.textMuted, border: `1px solid ${T.panelBorder}` }}>
                                        {cfg?.Icon ? <cfg.Icon size={12} /> : <Radio size={12} />}
                                        {s === "ALL" ? `All (${sentCounts.ALL})` : `${cfg.label} (${sentCounts[s] ?? 0})`}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* AI Score */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: T.textFaint }}>Minimum AI score</p>
                        <div className="flex items-center gap-3">
                            <input type="range" min="0" max="100" step="5" value={filterScoreMin}
                                onChange={e => setState(v => ({ ...v, filterScoreMin: Number(e.target.value) }))}
                                className="flex-1 accent-violet-500" />
                            <span className="text-sm font-black w-10 text-right" style={{ color: T.text }}>{filterScoreMin}</span>
                        </div>
                    </div>

                    {/* Risk level */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: T.textFaint }}>Risk level</p>
                        <div className="flex flex-wrap gap-2">
                            {["ALL", "high", "medium", "low"].map(r => {
                                const cfg = r === "ALL" ? null : RISK_CFG[r];
                                const active = filterRisk === r;
                                return (
                                    <button key={r} onClick={() => setState(v => ({ ...v, filterRisk: r }))}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                        style={active ? { background: "rgba(139,92,246,0.16)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.4)" } : { background: T.inputBg, color: T.textMuted, border: `1px solid ${T.panelBorder}` }}>
                                        {cfg?.Icon ? <cfg.Icon size={12} /> : <Radio size={12} />}
                                        {r === "ALL" ? "All" : cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Date range */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: T.textFaint }}>Date range</p>
                        <div className="flex items-center gap-2">
                            <input type="date" value={filterDateFrom} onChange={e => setState(v => ({ ...v, filterDateFrom: e.target.value }))}
                                className="flex-1 rounded-xl px-3 py-2 text-xs outline-none" style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }} />
                            <span className="text-xs" style={{ color: T.textFaint }}>to</span>
                            <input type="date" value={filterDateTo} onChange={e => setState(v => ({ ...v, filterDateTo: e.target.value }))}
                                className="flex-1 rounded-xl px-3 py-2 text-xs outline-none" style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }} />
                        </div>
                    </div>

                    {/* Data-driven facets — only appear once your backend starts returning these fields */}
                    {facets.outcomes.length > 0 && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: T.textFaint }}>Outcome</p>
                            <div className="flex flex-wrap gap-2">
                                {["ALL", ...facets.outcomes].map(o => (
                                    <button key={o} onClick={() => setState(v => ({ ...v, filterOutcome: o }))}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                        style={state.filterOutcome === o ? { background: "rgba(139,92,246,0.16)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.4)" } : { background: T.inputBg, color: T.textMuted, border: `1px solid ${T.panelBorder}` }}>
                                        {o}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {facets.callTypes.length > 0 && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: T.textFaint }}>Call type</p>
                            <div className="flex flex-wrap gap-2">
                                {["ALL", ...facets.callTypes].map(o => (
                                    <button key={o} onClick={() => setState(v => ({ ...v, filterCallType: o }))}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                        style={state.filterCallType === o ? { background: "rgba(139,92,246,0.16)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.4)" } : { background: T.inputBg, color: T.textMuted, border: `1px solid ${T.panelBorder}` }}>
                                        {o}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {facets.intents.length > 0 && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: T.textFaint }}>Buying intent</p>
                            <div className="flex flex-wrap gap-2">
                                {["ALL", ...facets.intents].map(o => (
                                    <button key={o} onClick={() => setState(v => ({ ...v, filterIntent: o }))}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                        style={state.filterIntent === o ? { background: "rgba(139,92,246,0.16)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.4)" } : { background: T.inputBg, color: T.textMuted, border: `1px solid ${T.panelBorder}` }}>
                                        {o}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 flex-shrink-0" style={{ borderTop: `1px solid ${T.divider}` }}>
                    <button onClick={onClose} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all active:scale-95"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                        Show results
                    </button>
                </div>
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = getUser();

    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [toast, setToast] = useState(null);
    const [playingId, setPlayingId] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [themeMode, setThemeMode] = useState("dark");
    const [view, setView] = useState("grid"); // grid | list
    const [filterOpen, setFilterOpen] = useState(false);
    const T = THEMES[themeMode];

    // Filters — search / sentiment / date range / sort are unchanged from the
    // original page. filterRisk, filterScoreMin, filterOutcome, filterCallType
    // and filterIntent are additive, purely client-side, and never touch the API.
    const [search, setSearch] = useState("");
    const [filterState, setFilterState] = useState({
        filterSentiment: "ALL",
        filterDateFrom: "",
        filterDateTo: "",
        filterRisk: "ALL",
        filterScoreMin: 0,
        filterOutcome: "ALL",
        filterCallType: "ALL",
        filterIntent: "ALL",
    });
    const [sortOrder, setSortOrder] = useState("newest");

    const fetchCalls = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get("/api/calls/my-calls");
            setCalls(res.data);
        } catch {
            setError("Failed to load call history.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCalls(); }, [fetchCalls]);

    useEffect(() => {
        const h = () => setProfileOpen(false);
        if (profileOpen) window.addEventListener("click", h);
        return () => window.removeEventListener("click", h);
    }, [profileOpen]);

    useEffect(() => {
        const onKey = e => { if (e.key === "Escape") { setMobileMenuOpen(false); setFilterOpen(false); } };
        if (mobileMenuOpen || filterOpen) {
            document.addEventListener("keydown", onKey);
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    }, [mobileMenuOpen, filterOpen]);

    const handleLogout = () => logoutAndRedirect();

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await api.delete(`/api/calls/${deleteTarget.id}`);
            setCalls(prev => prev.filter(c => c.id !== deleteTarget.id));
            setToast({ message: "Call deleted successfully", type: "success" });
        } catch {
            setToast({ message: "Delete failed. Please try again.", type: "error" });
        } finally {
            setDeleteTarget(null);
        }
    };

    /** Download generates the same premium PDF report used on the Call Details
     *  page; Share uses the native share sheet when available and otherwise
     *  falls back to copying a link to the call. Both are frontend-only —
     *  no backend or API changes. */
    const handleQuickAction = async (action, call) => {
        if (action === "download") {
            try {
                const { generateCallReport } = await import("../utils/generateReport.js");
                generateCallReport(call);
                setToast({ message: "Report downloaded successfully", type: "success" });
            } catch (err) {
                console.error("Report generation failed:", err);
                setToast({ message: "Could not generate report. Please try again.", type: "error" });
            }
            return;
        }

        if (action === "share") {
            const title = call.customerName || titleFromFileName(call.fileName);
            const shareUrl = `${window.location.origin}/calls/${call.id}`;
            try {
                if (navigator.share) {
                    await navigator.share({ title: `${title} — Call Report`, text: `Call analysis for ${title}`, url: shareUrl });
                    return;
                }
                await navigator.clipboard.writeText(shareUrl);
                setToast({ message: "Link copied successfully", type: "success" });
            } catch (err) {
                if (err?.name === "AbortError") return; // user dismissed the native share sheet
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    setToast({ message: "Link copied successfully", type: "success" });
                } catch {
                    setToast({ message: "Could not copy link. Please try again.", type: "error" });
                }
            }
        }
    };

    const openCall = (call) => navigate(`/calls/${call.id}`);

    // ── Facets — only surfaced if the field actually exists somewhere in the data ──
    const facets = useMemo(() => ({
        outcomes: [...new Set(calls.map(c => c.outcome).filter(Boolean))],
        callTypes: [...new Set(calls.map(c => c.callType).filter(Boolean))],
        intents: [...new Set(calls.map(c => c.buyingIntent).filter(Boolean))],
    }), [calls]);

    // ── Filter + sort (search/sentiment/date/sort logic identical to the original page) ──
    const filtered = useMemo(() => {
        return calls
            .filter(c => {
                const q = search.toLowerCase();
                const matchSearch = !q ||
                    c.fileName?.toLowerCase().includes(q) ||
                    c.transcript?.toLowerCase().includes(q) ||
                    c.summary?.toLowerCase().includes(q);

                const matchSentiment = filterState.filterSentiment === "ALL" || c.sentiment === filterState.filterSentiment;

                const created = c.createdAt ? new Date(c.createdAt) : null;
                const matchFrom = !filterState.filterDateFrom || (created && created >= new Date(filterState.filterDateFrom));
                const matchTo = !filterState.filterDateTo || (created && created <= new Date(filterState.filterDateTo + "T23:59:59"));

                const matchScore = (c.overallScore ?? 0) >= filterState.filterScoreMin;
                const risk = computeRisk(c);
                const matchRisk = filterState.filterRisk === "ALL" || risk === filterState.filterRisk;
                const matchOutcome = filterState.filterOutcome === "ALL" || c.outcome === filterState.filterOutcome;
                const matchCallType = filterState.filterCallType === "ALL" || c.callType === filterState.filterCallType;
                const matchIntent = filterState.filterIntent === "ALL" || c.buyingIntent === filterState.filterIntent;

                return matchSearch && matchSentiment && matchFrom && matchTo && matchScore && matchRisk && matchOutcome && matchCallType && matchIntent;
            })
            .sort((a, b) => {
                if (sortOrder === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
                if (sortOrder === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
                if (sortOrder === "score_high") return (b.overallScore ?? 0) - (a.overallScore ?? 0);
                if (sortOrder === "score_low") return (a.overallScore ?? 0) - (b.overallScore ?? 0);
                return 0;
            });
    }, [calls, search, filterState, sortOrder]);

    const sentCounts = { ALL: calls.length, POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 };
    calls.forEach(c => { if (c.sentiment && sentCounts[c.sentiment] != null) sentCounts[c.sentiment]++; });

    const hasActiveFilters = search || filterState.filterSentiment !== "ALL" || filterState.filterDateFrom || filterState.filterDateTo ||
        filterState.filterRisk !== "ALL" || filterState.filterScoreMin > 0 || filterState.filterOutcome !== "ALL" ||
        filterState.filterCallType !== "ALL" || filterState.filterIntent !== "ALL";

    const clearFilters = () => {
        setSearch("");
        setFilterState({ filterSentiment: "ALL", filterDateFrom: "", filterDateTo: "", filterRisk: "ALL", filterScoreMin: 0, filterOutcome: "ALL", filterCallType: "ALL", filterIntent: "ALL" });
    };

    const activeFilterCount = [
        filterState.filterSentiment !== "ALL", filterState.filterDateFrom, filterState.filterDateTo,
        filterState.filterRisk !== "ALL", filterState.filterScoreMin > 0, filterState.filterOutcome !== "ALL",
        filterState.filterCallType !== "ALL", filterState.filterIntent !== "ALL",
    ].filter(Boolean).length;

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>

            <div className="fixed inset-0 pointer-events-none opacity-[0.018]"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
            <div className="fixed top-0 left-1/3 w-96 h-96 rounded-full pointer-events-none opacity-[0.045] blur-3xl" style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
            <div className="fixed bottom-0 right-1/4 w-80 h-80 rounded-full pointer-events-none opacity-[0.035] blur-3xl" style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />

            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={user}
                handleLogout={handleLogout} currentPath={location.pathname}
                needsAttentionCount={calls.filter(c => computeRisk(c) === "high").length} totalCalls={calls.length} />

            <div className="flex-1 min-w-0 flex flex-col">
                {/* ── TOP BAR (identical structure to Dashboard/Analytics) ── */}
                <header className="sticky top-0 z-30" style={{ background: T.headerBg, borderBottom: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>
                    <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
                        <div className="md:hidden flex items-center gap-2 flex-shrink-0">
                            <img src={logo} alt="Convexa AI" className="h-6 w-auto" />
                        </div>

                        <div className="relative flex-1 max-w-md">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.textFaint }} />
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search by filename, transcript, summary…"
                                className="w-full rounded-xl pl-9 pr-9 py-2 text-sm outline-none transition-all"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}
                                onFocus={e => e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"}
                                onBlur={e => e.currentTarget.style.borderColor = T.panelBorder} />
                            {search && (
                                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: T.textFaint }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                            <Link to="/dashboard"
                                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-white transition-all active:scale-95"
                                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 2px 16px rgba(124,58,237,0.3)" }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(124,58,237,0.5)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 16px rgba(124,58,237,0.3)"; e.currentTarget.style.transform = ""; }}>
                                <Upload size={14} /> Upload Call
                            </Link>

                            <button onClick={() => setThemeMode(m => m === "dark" ? "light" : "dark")}
                                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }} title="Toggle theme">
                                {themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                            </button>

                            <div className="relative" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setProfileOpen(o => !o)}
                                    className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl transition-all"
                                    style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}` }}>
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
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
                                            <button onClick={handleLogout} className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-all" style={{ color: "#f87171" }}
                                                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                                <LogOut size={13} /> Sign out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-all flex-shrink-0"
                                onClick={() => setMobileMenuOpen(o => !o)} style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}` }} aria-label="Toggle navigation menu">
                                {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
                            </button>
                        </div>
                    </div>
                </header>

                {/* ── MOBILE NAV DRAWER (identical to Dashboard) ── */}
                {mobileMenuOpen && (
                    <>
                        <div className="md:hidden fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
                        <div className="md:hidden fixed top-0 right-0 h-full w-72 z-50 flex flex-col"
                            style={{ background: "linear-gradient(160deg, rgba(10,8,32,0.99) 0%, rgba(8,18,40,0.99) 100%)", borderLeft: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(24px)", animation: "drawerSlideIn 0.25s cubic-bezier(0.32,0.72,0,1)" }}>
                            <div className="flex items-center justify-between px-5 h-16 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Navigation</span>
                                <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl transition-all" style={{ background: "rgba(255,255,255,0.05)" }} aria-label="Close menu">
                                    <X size={14} className="text-slate-400" />
                                </button>
                            </div>
                            <nav className="flex flex-col gap-1 p-4 flex-1">
                                {[
                                    { label: "Dashboard", path: "/dashboard", Icon: LayoutDashboard, desc: "Overview & recent calls" },
                                    { label: "Call History", path: "/history", Icon: HistoryIcon, desc: "Browse all recordings" },
                                    { label: "Analytics", path: "/analytics", Icon: LineChart, desc: "Trends & insights" },
                                ].map(({ label, path, Icon, desc }) => (
                                    <Link key={label} to={path} onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all group"
                                        style={location.pathname === path ? { background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.09)" } : { color: "#64748b", border: "1px solid transparent" }}>
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

                {filterOpen && (
                    <FilterDrawer T={T} onClose={() => setFilterOpen(false)} state={filterState} setState={setFilterState} facets={facets} sentCounts={sentCounts} />
                )}

                <main className="flex-1 min-w-0 px-4 sm:px-6 py-7 space-y-6">

                    {error && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                            <span className="text-sm text-red-300">{error}</span>
                            <button onClick={fetchCalls} className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg transition-all" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}>
                                <RefreshCw size={11} /> Retry
                            </button>
                        </div>
                    )}

                    {/* ── PAGE HEADER / TOOLBAR ── */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-[1.7rem] font-black tracking-tight" style={{ color: T.text }}>Call History</h1>
                            <p className="text-sm mt-1" style={{ color: T.textMuted }}>
                                {loading ? "Loading your calls…" : `${calls.length} call${calls.length !== 1 ? "s" : ""} analyzed · ${filtered.length} shown`}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button onClick={() => setFilterOpen(true)}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                                style={{ background: activeFilterCount > 0 ? "rgba(139,92,246,0.14)" : T.inputBg, border: `1px solid ${activeFilterCount > 0 ? "rgba(139,92,246,0.4)" : T.panelBorder}`, color: activeFilterCount > 0 ? "#c4b5fd" : T.textMuted }}>
                                <SlidersHorizontal size={13} /> Filter
                                {activeFilterCount > 0 && (
                                    <span className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: "#7c3aed" }}>{activeFilterCount}</span>
                                )}
                            </button>

                            <div className="relative">
                                <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                                    className="appearance-none pl-8 pr-8 py-2 rounded-xl text-xs font-semibold cursor-pointer outline-none"
                                    style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}>
                                    <option value="newest">Newest first</option>
                                    <option value="oldest">Oldest first</option>
                                    <option value="score_high">Highest score</option>
                                    <option value="score_low">Lowest score</option>
                                </select>
                                <ArrowUpDown size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.textFaint }} />
                                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.textFaint }} />
                            </div>

                            <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: `1px solid ${T.panelBorder}` }}>
                                <button onClick={() => setView("grid")} title="Grid view"
                                    className="w-9 h-9 flex items-center justify-center transition-all"
                                    style={view === "grid" ? { background: "rgba(139,92,246,0.16)", color: "#c4b5fd" } : { background: T.inputBg, color: T.textFaint }}>
                                    <LayoutGrid size={14} />
                                </button>
                                <button onClick={() => setView("list")} title="List view"
                                    className="w-9 h-9 flex items-center justify-center transition-all"
                                    style={view === "list" ? { background: "rgba(139,92,246,0.16)", color: "#c4b5fd" } : { background: T.inputBg, color: T.textFaint }}>
                                    <Rows3 size={14} />
                                </button>
                            </div>

                            {hasActiveFilters && (
                                <button onClick={clearFilters}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                                    style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>
                                    <RefreshCw size={12} /> Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── QUICK SENTIMENT CHIPS ── */}
                    <div className="flex flex-wrap gap-2">
                        {["ALL", "POSITIVE", "NEUTRAL", "NEGATIVE"].map(s => {
                            const cfg = s === "ALL" ? null : SENT_CONFIG[s];
                            const active = filterState.filterSentiment === s;
                            return (
                                <button key={s} onClick={() => setFilterState(v => ({ ...v, filterSentiment: s }))}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                    style={active ? { background: "rgba(139,92,246,0.16)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.4)" } : { background: T.panel, color: T.textMuted, border: `1px solid ${T.panelBorder}` }}>
                                    {cfg?.Icon ? <cfg.Icon size={12} /> : <Radio size={12} />}
                                    {s === "ALL" ? `All (${sentCounts.ALL})` : `${cfg.label} (${sentCounts[s]})`}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── CONTENT ── */}
                    {loading ? (
                        view === "grid" ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="rounded-2xl p-5 space-y-4" style={{ background: T.panel, border: `1px solid ${T.panelBorder}` }}>
                                        <div className="flex items-center gap-3">
                                            <Skeleton T={T} className="w-10 h-10 rounded-xl" />
                                            <div className="flex-1 space-y-2"><Skeleton T={T} className="h-3.5 w-2/3" /><Skeleton T={T} className="h-2.5 w-1/3" /></div>
                                        </div>
                                        <Skeleton T={T} className="h-3 w-full" />
                                        <Skeleton T={T} className="h-3 w-4/5" />
                                        <div className="flex gap-2"><Skeleton T={T} className="h-6 w-20" /><Skeleton T={T} className="h-6 w-24" /></div>
                                        <Skeleton T={T} className="h-8 w-full" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.panelBorder}` }}>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: `1px solid ${T.divider}` }}>
                                        <Skeleton T={T} className="w-9 h-9 rounded-full flex-shrink-0" />
                                        <Skeleton T={T} className="h-3.5 flex-1" />
                                        <Skeleton T={T} className="h-6 w-20" />
                                        <Skeleton T={T} className="h-6 w-16" />
                                    </div>
                                ))}
                            </div>
                        )
                    ) : filtered.length === 0 ? (
                        <EmptyState T={T} hasFilters={calls.length > 0} onClear={clearFilters} />
                    ) : view === "grid" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filtered.map(call => (
                                <CallCard key={call.id} call={call} T={T} onOpen={openCall} onDelete={setDeleteTarget}
                                    onAction={handleQuickAction} playingId={playingId} setPlayingId={setPlayingId} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.panelBorder}` }}>
                            <div className="hidden md:grid md:grid-cols-[256px_200px_84px_172px] lg:grid-cols-[256px_minmax(0,1fr)_200px_84px_172px] items-center gap-4 px-5 py-3" style={{ background: T.panelHover, borderBottom: `1px solid ${T.divider}` }}>
                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Call</p>
                                <p className="text-xs font-bold uppercase tracking-wider hidden lg:block" style={{ color: T.textFaint }}>Summary</p>
                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Status</p>
                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Score</p>
                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>Actions</p>
                            </div>
                            {filtered.map(call => (
                                <CallRow key={call.id} call={call} T={T} onOpen={openCall} onDelete={setDeleteTarget}
                                    onAction={handleQuickAction} playingId={playingId} setPlayingId={setPlayingId} />
                            ))}
                            <div className="px-5 py-3 text-xs flex justify-between items-center" style={{ color: T.textFaint, background: T.panelHover }}>
                                <span>Showing {filtered.length} of {calls.length} calls</span>
                            </div>
                        </div>
                    )}
                </main>

                <footer className="mt-4" style={{ borderTop: `1px solid ${T.divider}` }}>
                    <div className="px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: T.textFaint }}>© 2026 Convexa AI · Conversation Intelligence Platform</span>
                        <span className="text-xs" style={{ color: T.textFaint, opacity: 0.6 }}>Powered by Whisper · Groq · Llama 3.3</span>
                    </div>
                </footer>
            </div>

            {deleteTarget && (
                <DeleteModal T={T} callName={deleteTarget.customerName || titleFromFileName(deleteTarget.fileName)} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
            )}
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <style>{`
                @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes drawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
                .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            `}</style>
        </div>
    );
}
