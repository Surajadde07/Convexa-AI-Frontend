import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getUser, clearSession } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";
import MiniAudioPlayer from "../components/MiniAudioPlayer.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const SENT_CONFIG = {
    POSITIVE: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", label: "Positive", emoji: "😊" },
    NEGATIVE: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: "Negative", emoji: "😔" },
    NEUTRAL:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "Neutral", emoji: "😐" },
};

function ScoreBadge({ score }) {
    if (score == null) return <span className="text-slate-600 text-xs">—</span>;
    const color = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
    return (
        <span className="text-sm font-black" style={{ color }}>{score}</span>
    );
}

function Skeleton({ className = "" }) {
    return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────

function DeleteModal({ callName, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}>
            <div className="w-full max-w-sm rounded-3xl border border-white/15 p-8"
                style={{ background: "linear-gradient(135deg, rgba(13,11,42,0.98) 0%, rgba(10,22,40,0.98) 100%)" }}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center text-3xl border border-red-500/20">
                        🗑️
                    </div>
                    <div>
                        <p className="text-white font-black text-lg">Delete Call?</p>
                        <p className="text-slate-400 text-sm mt-1.5 max-w-xs">
                            "<span className="text-slate-300">{callName}</span>" will be permanently deleted and cannot be recovered.
                        </p>
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                        <button onClick={onCancel}
                            className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5
                                text-slate-300 hover:text-white hover:bg-white/10 text-sm font-semibold transition-all">
                            Cancel
                        </button>
                        <button onClick={onConfirm}
                            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white
                                text-sm font-bold transition-all hover:shadow-lg hover:shadow-red-500/25 active:scale-95">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ message, type = "success", onDismiss }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 4000);
        return () => clearTimeout(t);
    }, [onDismiss]);
    const colors = type === "success"
        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
        : "bg-red-500/20 border-red-500/40 text-red-300";
    return (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl ${colors}`}
            style={{ animation: "slideUp 0.3s ease" }}>
            <span className="text-xl">{type === "success" ? "✅" : "⚠️"}</span>
            <span className="text-sm font-semibold">{message}</span>
            <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
    const navigate  = useNavigate();
    const user      = getUser();

    const [calls, setCalls]                   = useState([]);
    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState(null);
    const [profileOpen, setProfileOpen]       = useState(false);
    const [deleteTarget, setDeleteTarget]     = useState(null); // call object to delete
    const [toast, setToast]                   = useState(null);
    const [playingId, setPlayingId]           = useState(null);

    // Filters
    const [search, setSearch]                 = useState("");
    const [filterSentiment, setFilterSentiment] = useState("ALL");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo]     = useState("");
    const [sortOrder, setSortOrder]           = useState("newest"); // newest | oldest | score_high | score_low

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

    // Close profile dropdown on outside click
    useEffect(() => {
        const h = () => setProfileOpen(false);
        if (profileOpen) window.addEventListener("click", h);
        return () => window.removeEventListener("click", h);
    }, [profileOpen]);

    const handleLogout = () => {
        logoutAndRedirect();
    };

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

    // ── Filter + Sort ──────────────────────────────────────────────────────────
    const filtered = calls
        .filter(c => {
            const q = search.toLowerCase();
            const matchSearch = !q ||
                c.fileName?.toLowerCase().includes(q) ||
                c.transcript?.toLowerCase().includes(q) ||
                c.summary?.toLowerCase().includes(q);

            const matchSentiment = filterSentiment === "ALL" || c.sentiment === filterSentiment;

            const created = c.createdAt ? new Date(c.createdAt) : null;
            const matchFrom = !filterDateFrom || (created && created >= new Date(filterDateFrom));
            const matchTo   = !filterDateTo   || (created && created <= new Date(filterDateTo + "T23:59:59"));

            return matchSearch && matchSentiment && matchFrom && matchTo;
        })
        .sort((a, b) => {
            if (sortOrder === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
            if (sortOrder === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
            if (sortOrder === "score_high") return (b.overallScore ?? 0) - (a.overallScore ?? 0);
            if (sortOrder === "score_low")  return (a.overallScore ?? 0) - (b.overallScore ?? 0);
            return 0;
        });

    const sentCounts = { ALL: calls.length, POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 };
    calls.forEach(c => { if (c.sentiment && sentCounts[c.sentiment] != null) sentCounts[c.sentiment]++; });

    return (
        <div className="min-h-screen text-white"
            style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #0d0b2a 40%, #0a1628 100%)" }}>

            {/* Noise texture */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

            {/* ── NAV ── */}
            <header className="sticky top-0 z-40 border-b border-white/8 backdrop-blur-xl"
                style={{ background: "rgba(10,10,26,0.88)" }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
                    <Link to="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
                        <img src={logo} alt="Convexa AI" className="h-7 w-auto" />
                        <span className="text-base font-black tracking-tight hidden sm:block">
                            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Convexa</span>
                            <span className="text-white ml-1">AI</span>
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-1">
                        {[
                            { label: "Dashboard", path: "/dashboard" },
                            { label: "Call History", path: "/history" },
                            { label: "Analytics", path: "/analytics" },
                        ].map(({ label, path }) => (
                            <Link key={label} to={path}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                                    ${window.location.pathname === path
                                        ? "bg-white/10 text-white"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                                {label}
                            </Link>
                        ))}
                    </nav>

                    <div className="relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setProfileOpen(o => !o)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10
                                bg-white/5 hover:bg-white/10 transition-all">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500
                                flex items-center justify-center text-xs font-bold">
                                {user?.name?.[0]?.toUpperCase() ?? "U"}
                            </div>
                            <span className="text-sm font-medium hidden sm:block">{user?.name ?? "User"}</span>
                            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {profileOpen && (
                            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-white/10
                                bg-slate-900/98 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
                                <div className="px-4 py-3 border-b border-white/8">
                                    <p className="text-sm font-bold text-white">{user?.name}</p>
                                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                                </div>
                                <div className="p-2">
                                    <button onClick={handleLogout}
                                        className="w-full text-left px-3 py-2 text-sm text-red-400
                                            hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all">
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

                {/* ── PAGE HEADER ── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-white">Call History</h1>
                        <p className="text-slate-400 text-sm mt-1">
                            {loading ? "Loading…" : `${calls.length} calls · ${filtered.length} shown`}
                        </p>
                    </div>
                    <Link to="/dashboard"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm
                            bg-gradient-to-r from-violet-600 to-blue-600 text-white
                            hover:from-violet-500 hover:to-blue-500 transition-all
                            hover:shadow-lg hover:shadow-violet-500/30 active:scale-95">
                        ← Dashboard
                    </Link>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300">
                        <span>⚠️</span>
                        <span className="text-sm">{error}</span>
                        <button onClick={fetchCalls} className="ml-auto text-xs bg-red-500/20 hover:bg-red-500/30 px-3 py-1 rounded-lg">Retry</button>
                    </div>
                )}

                {/* ── FILTER BAR ── */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                    {/* Sentiment quick-filter */}
                    <div className="flex flex-wrap gap-2">
                        {["ALL", "POSITIVE", "NEUTRAL", "NEGATIVE"].map(s => {
                            const cfg = s === "ALL" ? null : SENT_CONFIG[s];
                            const active = filterSentiment === s;
                            return (
                                <button key={s} onClick={() => setFilterSentiment(s)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
                                        ${active
                                            ? "bg-white/12 text-white border-white/20"
                                            : "bg-white/3 text-slate-400 border-white/8 hover:bg-white/8 hover:text-white"}`}>
                                    {cfg ? cfg.emoji : "📞"} {s === "ALL" ? `All (${sentCounts.ALL})` : `${cfg.label} (${sentCounts[s]})`}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search */}
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Search by filename, transcript, summary…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white
                                    placeholder-slate-600 focus:outline-none focus:border-violet-500/40 focus:bg-white/8 transition-all pr-10"
                            />
                            {search && (
                                <button onClick={() => setSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs">
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Date from */}
                        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                            title="From date"
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300
                                focus:outline-none focus:border-violet-500/40 transition-all" />

                        {/* Date to */}
                        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                            title="To date"
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300
                                focus:outline-none focus:border-violet-500/40 transition-all" />

                        {/* Sort */}
                        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300
                                focus:outline-none focus:border-violet-500/40 transition-all cursor-pointer">
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                            <option value="score_high">Highest score</option>
                            <option value="score_low">Lowest score</option>
                        </select>

                        {/* Clear filters */}
                        {(search || filterSentiment !== "ALL" || filterDateFrom || filterDateTo) && (
                            <button onClick={() => { setSearch(""); setFilterSentiment("ALL"); setFilterDateFrom(""); setFilterDateTo(""); }}
                                className="px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white
                                    border border-white/8 hover:border-white/15 bg-white/3 hover:bg-white/8 transition-all flex-shrink-0">
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* ── TABLE ── */}
                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 rounded-3xl border border-white/8 border-dashed"
                        style={{ background: "rgba(255,255,255,0.015)" }}>
                        <div className="text-5xl mb-4">🔍</div>
                        <p className="text-white font-bold text-lg">No calls found</p>
                        <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-white/10 overflow-hidden">
                        {/* Table header */}
                        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-white/8"
                            style={{ background: "rgba(255,255,255,0.03)" }}>
                            {["File Name", "Date", "Sentiment", "Score", "Actions"].map(h => (
                                <p key={h} className="text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</p>
                            ))}
                        </div>

                        {/* Rows */}
                        <div className="divide-y divide-white/5">
                            {filtered.map(call => {
                                const cfg = SENT_CONFIG[call.sentiment] || SENT_CONFIG.NEUTRAL;
                                return (
                                    <div key={call.id}
                                        className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-4 items-center
                                            hover:bg-white/3 transition-all group">

                                        {/* File name + mini player */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            <MiniAudioPlayer
                                                filePath={call.filePath}
                                                playingId={playingId}
                                                callId={call.id}
                                                onPlay={setPlayingId}
                                                onStop={() => setPlayingId(null)}
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-white truncate">{call.fileName}</p>
                                                <p className="text-xs text-slate-500 truncate">{call.status || "COMPLETED"}</p>
                                            </div>
                                        </div>

                                        {/* Date */}
                                        <p className="text-xs text-slate-400">
                                            {call.createdAt
                                                ? new Date(call.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                : "—"}
                                        </p>

                                        {/* Sentiment */}
                                        <div>
                                            {call.sentiment ? (
                                                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                                    {cfg.emoji} {cfg.label}
                                                </span>
                                            ) : (
                                                <span className="text-slate-600 text-xs">—</span>
                                            )}
                                        </div>

                                        {/* Score */}
                                        <ScoreBadge score={call.overallScore} />

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <Link to={`/calls/${call.id}`}
                                                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                                                    bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 hover:text-violet-300
                                                    border border-violet-500/20 hover:border-violet-500/40">
                                                View
                                            </Link>
                                            <button onClick={() => setDeleteTarget(call)}
                                                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                                                    bg-red-500/8 hover:bg-red-500/15 text-red-500 hover:text-red-400
                                                    border border-red-500/15 hover:border-red-500/30">
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer count */}
                        <div className="px-5 py-3 border-t border-white/6 text-xs text-slate-600 flex justify-between items-center"
                            style={{ background: "rgba(255,255,255,0.02)" }}>
                            <span>Showing {filtered.length} of {calls.length} calls</span>
                            {filtered.length > 10 && (
                                <span className="text-violet-500">Scroll to see all</span>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-white/6 mt-12 py-5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <span className="text-xs text-slate-600">© 2026 Convexa AI</span>
                    <span className="text-xs text-slate-700">Powered by Whisper · Ollama · Qwen 2.5</span>
                </div>
            </footer>

            {/* Delete modal */}
            {deleteTarget && (
                <DeleteModal
                    callName={deleteTarget.fileName}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}

            {toast && (
                <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(24px); opacity: 0; }
                    to   { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
