import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import api, { getUser } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";
import { Sidebar } from "../components/Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import {
    Search, Star, Archive, ArchiveRestore, Tag, X, Check, Trash2,
    Download, FileText, Clock, Phone, ChevronDown, SlidersHorizontal,
    Menu, Sun, Moon, Smile, Frown, Meh, PlayCircle, Eye, Plus,
    CheckSquare, Square, Library as LibraryIcon, Sparkles, History as HistoryIcon,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────── *
 * Library — searchable repository over conversations already returned by *
 * GET /api/calls/my-calls. Search, filters and categories are real,      *
 * computed from real fields (callType, sentiment, outcome, overallScore).*
 * Favorites / tags / archive / recently-viewed have no backend endpoint  *
 * yet, so they persist to localStorage per-user and are clearly marked   *
 * below — swap LOCAL_STORE for real API calls once those endpoints exist.*
 * ────────────────────────────────────────────────────────────────────── */

const SENT_CONFIG = {
    POSITIVE: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", Icon: Smile },
    NEGATIVE: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", Icon: Frown },
    NEUTRAL:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", Icon: Meh },
};

function storeKey(user, name) {
    return `convexa_library_${name}_${user?.id ?? "anon"}`;
}
function loadSet(user, name) {
    try { return new Set(JSON.parse(localStorage.getItem(storeKey(user, name)) || "[]")); }
    catch { return new Set(); }
}
function saveSet(user, name, set) {
    localStorage.setItem(storeKey(user, name), JSON.stringify([...set]));
}
function loadTags(user) {
    try { return JSON.parse(localStorage.getItem(storeKey(user, "tags")) || "{}"); }
    catch { return {}; }
}
function saveTags(user, tags) {
    localStorage.setItem(storeKey(user, "tags"), JSON.stringify(tags));
}

function SectionLabel({ icon: Icon, children, tone = "#8b5cf6" }) {
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
function Panel({ children, className = "", style = {}, T }) {
    return <div className={`rounded-2xl p-5 sm:p-6 ${className}`} style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, ...style }}>{children}</div>;
}
function Skeleton({ className = "", T }) {
    return <div className={`rounded-xl ${className}`} style={{ background: `linear-gradient(90deg, transparent 25%, ${T.panelHover} 50%, transparent 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />;
}
function Toast({ message, type, onDismiss }) {
    useEffect(() => { const t = setTimeout(onDismiss, 3200); return () => clearTimeout(t); }, [onDismiss]);
    const ok = type === "success";
    return (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ background: ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${ok ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`, color: ok ? "#34d399" : "#f87171", backdropFilter: "blur(20px)", animation: "slideUp 0.25s ease-out" }}>
            {ok ? <Check size={15} /> : <X size={15} />} {message}
        </div>
    );
}

function toCsv(calls) {
    const header = ["File", "Customer", "Date", "Duration(s)", "Type", "Sentiment", "Outcome", "Score"];
    const rows = calls.map(c => [
        c.fileName, c.customerName ?? "", c.createdAt ?? "", c.durationSeconds ?? "",
        c.callType ?? "", c.sentiment ?? "", c.outcome ?? "", c.overallScore ?? "",
    ]);
    return [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export default function LibraryPage() {
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    // theme now comes from the global ThemeProvider — no local state, no localStorage here
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const user = getUser();
    const { themeMode, toggleTheme, T } = useTheme();
    const location = useLocation();

    const [favorites, setFavorites] = useState(() => loadSet(user, "favorites"));
    const [archived, setArchived] = useState(() => loadSet(user, "archived"));
    const [recentlyViewed, setRecentlyViewed] = useState(() => {
        try { return JSON.parse(localStorage.getItem(storeKey(user, "recent")) || "[]"); } catch { return []; }
    });
    const [tags, setTags] = useState(() => loadTags(user));

    const [tab, setTab] = useState("all"); // all | favorites | recent | archived
    const [query, setQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [sentimentFilter, setSentimentFilter] = useState("all");
    const [sortBy, setSortBy] = useState("newest");

    const [selected, setSelected] = useState(() => new Set());
    const [previewCall, setPreviewCall] = useState(null);
    const [previewDetail, setPreviewDetail] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [tagDraft, setTagDraft] = useState("");

    const fetchCalls = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await api.get("/api/calls");
            setCalls([...res.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } catch (err) {
            console.error("Failed to fetch library:", err);
            setError("Failed to load your conversation library.");
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { fetchCalls(); }, [fetchCalls]);

    useEffect(() => { saveSet(user, "favorites", favorites); }, [favorites]);
    useEffect(() => { saveSet(user, "archived", archived); }, [archived]);
    useEffect(() => { saveTags(user, tags); }, [tags]);

    const handleLogout = () => logoutAndRedirect();

    const totalCalls = calls.length;
    const needsAttentionCount = 0; // Library doesn't own that badge — Dashboard does.

    const categories = useMemo(() => Array.from(new Set(calls.map(c => c.callType).filter(Boolean))), [calls]);

    const openPreview = async (call) => {
        setPreviewCall(call);
        setPreviewDetail(null);
        setPreviewLoading(true);
        setRecentlyViewed(prev => {
            const next = [call.id, ...prev.filter(id => id !== call.id)].slice(0, 12);
            localStorage.setItem(storeKey(user, "recent"), JSON.stringify(next));
            return next;
        });
        try {
            const res = await api.get(`/api/calls/${call.id}`);
            setPreviewDetail(res.data);
        } catch (err) {
            console.error("Failed to load call detail:", err);
            setPreviewDetail({ error: true });
        } finally { setPreviewLoading(false); }
    };

    const toggleFavorite = (id) => setFavorites(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleArchive = (id) => setArchived(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const addTag = (id) => {
        const value = tagDraft.trim();
        if (!value) return;
        setTags(prev => ({ ...prev, [id]: Array.from(new Set([...(prev[id] || []), value])) }));
        setTagDraft("");
    };
    const removeTag = (id, tag) => setTags(prev => ({ ...prev, [id]: (prev[id] || []).filter(t => t !== tag) }));

    /* ── Filter pipeline: tab → category → sentiment → search → sort. ── */
    const filtered = useMemo(() => {
        let list = calls;
        if (tab === "favorites") list = list.filter(c => favorites.has(c.id));
        else if (tab === "archived") list = list.filter(c => archived.has(c.id));
        else if (tab === "recent") list = recentlyViewed.map(id => calls.find(c => c.id === id)).filter(Boolean);
        else list = list.filter(c => !archived.has(c.id));

        if (categoryFilter !== "all") list = list.filter(c => c.callType === categoryFilter);
        if (sentimentFilter !== "all") list = list.filter(c => c.sentiment === sentimentFilter);
        if (query.trim()) {
            const q = query.toLowerCase();
            list = list.filter(c =>
                c.fileName?.toLowerCase().includes(q) ||
                c.customerName?.toLowerCase().includes(q) ||
                c.summary?.toLowerCase().includes(q) ||
                (tags[c.id] || []).some(t => t.toLowerCase().includes(q))
            );
        }
        const sorted = [...list];
        if (sortBy === "newest") sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        else if (sortBy === "oldest") sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        else if (sortBy === "score") sorted.sort((a, b) => (b.overallScore ?? -1) - (a.overallScore ?? -1));
        else if (sortBy === "name") sorted.sort((a, b) => (a.fileName || "").localeCompare(b.fileName || ""));
        return sorted;
    }, [calls, tab, favorites, archived, recentlyViewed, categoryFilter, sentimentFilter, query, sortBy, tags]);

    const allVisibleSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));
    const toggleSelectAll = () => {
        setSelected(prev => {
            if (allVisibleSelected) return new Set();
            return new Set(filtered.map(c => c.id));
        });
    };

    const handleBulkExport = () => {
        const chosen = calls.filter(c => selected.has(c.id));
        const blob = new Blob([toCsv(chosen)], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `convexa-library-export-${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
        setToast({ message: `Exported ${chosen.length} conversation${chosen.length !== 1 ? "s" : ""}.`, type: "success" });
    };

    /* NOTE: assumes a DELETE /api/calls/{id} endpoint exists (standard REST
       for the calls resource). If it doesn't yet, this fails gracefully per
       call and reports how many actually succeeded. */
    const handleBulkDelete = async () => {
        const ids = [...selected];
        if (!ids.length) return;
        if (!window.confirm(`Permanently delete ${ids.length} conversation${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
        let okCount = 0;
        for (const id of ids) {
            try { await api.delete(`/api/calls/${id}`); okCount++; } catch (err) { console.error("Delete failed for", id, err); }
        }
        setSelected(new Set());
        fetchCalls();
        setToast({ message: okCount === ids.length ? `Deleted ${okCount} conversation${okCount !== 1 ? "s" : ""}.` : `Deleted ${okCount}/${ids.length} — some failed.`, type: okCount === ids.length ? "success" : "error" });
    };

    const handleBulkArchive = () => {
        setArchived(prev => { const n = new Set(prev); selected.forEach(id => n.add(id)); return n; });
        setToast({ message: `Archived ${selected.size} conversation${selected.size !== 1 ? "s" : ""}.`, type: "success" });
        setSelected(new Set());
    };

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>
            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={user}
                handleLogout={handleLogout} currentPath={location.pathname}
                needsAttentionCount={needsAttentionCount} totalCalls={totalCalls} />

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="sticky top-0 z-30" style={{ background: T.headerBg, borderBottom: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>
                    <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
                        <div className="md:hidden flex items-center gap-2 flex-shrink-0"><img src={logo} alt="Convexa AI" className="h-6 w-auto" /></div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.28)" }}>
                                <LibraryIcon size={15} style={{ color: "#a78bfa" }} />
                            </div>
                            <div>
                                <p className="text-sm font-bold" style={{ color: T.text }}>Library</p>
                                <p className="text-[10px]" style={{ color: T.textFaint }}>{totalCalls} conversation{totalCalls !== 1 ? "s" : ""} analysed</p>
                            </div>
                        </div>
                        <div className="flex-1" />
                        <button onClick={toggleTheme}
                            className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}>
                            {themeMode === "dark" ? <Sun size={14} style={{ color: T.textMuted }} /> : <Moon size={14} style={{ color: T.textMuted }} />}
                        </button>
                        <button onClick={() => setMobileMenuOpen(o => !o)} className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}>
                            <Menu size={16} style={{ color: T.textMuted }} />
                        </button>
                    </div>
                </header>

                <main className="flex-1 px-4 sm:px-6 py-6 space-y-6 max-w-7xl w-full mx-auto">
                    {/* ── Tabs ── */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                            { id: "all", label: "All", count: calls.filter(c => !archived.has(c.id)).length },
                            { id: "favorites", label: "Favorites", count: favorites.size, Icon: Star },
                            { id: "recent", label: "Recently Viewed", count: recentlyViewed.length, Icon: Eye },
                            { id: "archived", label: "Archived", count: archived.size, Icon: Archive },
                        ].map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                                style={tab === t.id
                                    ? { background: "rgba(139,92,246,0.14)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.35)" }
                                    : { background: T.panel, color: T.textMuted, border: `1px solid ${T.panelBorder}` }}>
                                {t.Icon && <t.Icon size={12} />} {t.label}
                                <span className="text-[10px] px-1.5 rounded-full" style={{ background: tab === t.id ? "rgba(139,92,246,0.25)" : T.panelHover }}>{t.count}</span>
                            </button>
                        ))}
                    </div>

                    {/* ── Search + filters ── */}
                    <Panel T={T} className="!p-4">
                        <div className="flex flex-col lg:flex-row gap-3">
                            <div className="flex-1 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5" style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}` }}>
                                <Search size={14} style={{ color: T.textFaint }} className="flex-shrink-0" />
                                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search conversations, customers, tags…"
                                    className="flex-1 min-w-0 bg-transparent text-sm outline-none" style={{ color: T.text }} />
                                {query && <button onClick={() => setQuery("")}><X size={13} style={{ color: T.textFaint }} /></button>}
                            </div>
                            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                                className="rounded-xl px-3 py-2.5 text-xs font-semibold outline-none" style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}>
                                <option value="all">All categories</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select value={sentimentFilter} onChange={e => setSentimentFilter(e.target.value)}
                                className="rounded-xl px-3 py-2.5 text-xs font-semibold outline-none" style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}>
                                <option value="all">All sentiment</option>
                                <option value="POSITIVE">Positive</option>
                                <option value="NEUTRAL">Neutral</option>
                                <option value="NEGATIVE">Negative</option>
                            </select>
                            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                                className="rounded-xl px-3 py-2.5 text-xs font-semibold outline-none" style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }}>
                                <option value="newest">Newest first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="score">Highest score</option>
                                <option value="name">Name A–Z</option>
                            </select>
                        </div>
                    </Panel>

                    {/* ── Bulk action bar ── */}
                    {selected.size > 0 && (
                        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)" }}>
                            <span className="text-xs font-bold" style={{ color: "#c4b5fd" }}>{selected.size} selected</span>
                            <div className="flex-1" />
                            <button onClick={handleBulkExport} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: T.panelHover, color: T.text }}><Download size={12} /> Export CSV</button>
                            {tab !== "archived" && <button onClick={handleBulkArchive} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: T.panelHover, color: T.text }}><Archive size={12} /> Archive</button>}
                            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}><Trash2 size={12} /> Delete</button>
                            <button onClick={() => setSelected(new Set())} className="text-xs font-semibold" style={{ color: T.textFaint }}>Clear</button>
                        </div>
                    )}

                    {/* ── Select all ── */}
                    {filtered.length > 0 && (
                        <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs font-semibold" style={{ color: T.textMuted }}>
                            {allVisibleSelected ? <CheckSquare size={14} style={{ color: "#8b5cf6" }} /> : <Square size={14} />}
                            Select all {filtered.length}
                        </button>
                    )}

                    {/* ── Grid ── */}
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} T={T} className="h-40" />)}
                        </div>
                    ) : error ? (
                        <Panel T={T} className="text-center text-sm" style={{ color: "#f87171" }}>{error}</Panel>
                    ) : filtered.length === 0 ? (
                        <Panel T={T} className="text-center py-16">
                            <LibraryIcon size={28} className="mx-auto mb-3" style={{ color: T.textFaint }} />
                            <p className="text-sm font-semibold" style={{ color: T.text }}>No conversations here</p>
                            <p className="text-xs mt-1" style={{ color: T.textFaint }}>
                                {tab === "favorites" ? "Star a conversation to pin it here." : tab === "archived" ? "Archived conversations will show up here." : tab === "recent" ? "Open a conversation and it'll appear here." : "Try adjusting your search or filters."}
                            </p>
                        </Panel>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filtered.map(call => {
                                const cfg = SENT_CONFIG[call.sentiment] || SENT_CONFIG.NEUTRAL;
                                const SIcon = cfg.Icon;
                                const isFav = favorites.has(call.id);
                                const isArchived = archived.has(call.id);
                                const isSel = selected.has(call.id);
                                const callTags = tags[call.id] || [];
                                return (
                                    <div key={call.id} className="group relative rounded-2xl p-4 flex flex-col gap-3 transition-all cursor-pointer"
                                        style={{ background: T.panel, border: `1px solid ${isSel ? "rgba(139,92,246,0.5)" : T.panelBorder}` }}
                                        onClick={() => openPreview(call)}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <button onClick={e => { e.stopPropagation(); toggleSelect(call.id); }} className="flex-shrink-0">
                                                    {isSel ? <CheckSquare size={15} style={{ color: "#8b5cf6" }} /> : <Square size={15} style={{ color: T.textFaint }} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                                                </button>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold truncate" style={{ color: T.text }}>{call.customerName || call.fileName}</p>
                                                    <p className="text-[10px] truncate" style={{ color: T.textFaint }}>{call.createdAt ? new Date(call.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unknown"}</p>
                                                </div>
                                            </div>
                                            <button onClick={e => { e.stopPropagation(); toggleFavorite(call.id); }} className="flex-shrink-0">
                                                <Star size={15} fill={isFav ? "#f59e0b" : "none"} style={{ color: isFav ? "#f59e0b" : T.textFaint }} />
                                            </button>
                                        </div>

                                        <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: T.textMuted }}>{call.summary || "AI summary not available."}</p>

                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {call.callType && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: T.panelHover, color: T.textMuted }}>{call.callType}</span>}
                                            {callTags.slice(0, 2).map(t => (
                                                <span key={t} className="text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}><Tag size={7} />{t}</span>
                                            ))}
                                            {callTags.length > 2 && <span className="text-[9px]" style={{ color: T.textFaint }}>+{callTags.length - 2}</span>}
                                        </div>

                                        <div className="flex items-center justify-between mt-auto pt-2" style={{ borderTop: `1px solid ${T.divider}` }}>
                                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                                <SIcon size={9} />
                                            </span>
                                            {call.overallScore != null && <span className="text-xs font-black" style={{ color: T.text }}>{call.overallScore}</span>}
                                            <button onClick={e => { e.stopPropagation(); toggleArchive(call.id); }} title={isArchived ? "Restore" : "Archive"}>
                                                {isArchived ? <ArchiveRestore size={13} style={{ color: T.textFaint }} /> : <Archive size={13} style={{ color: T.textFaint }} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>

            {/* ── Preview drawer: transcript + AI summary + tags ── */}
            {previewCall && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} onClick={() => setPreviewCall(null)}>
                    <div className="w-full max-w-lg h-full overflow-y-auto p-6" style={{ background: themeMode === "dark" ? "rgba(10,10,26,0.98)" : "#fff", borderLeft: `1px solid ${T.panelBorder}`, animation: "drawerSlideIn 0.25s ease-out" }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <p className="text-sm font-black" style={{ color: T.text }}>{previewCall.customerName || previewCall.fileName}</p>
                                <p className="text-[11px] mt-0.5" style={{ color: T.textFaint }}>{previewCall.createdAt ? new Date(previewCall.createdAt).toLocaleString() : ""}</p>
                            </div>
                            <button onClick={() => setPreviewCall(null)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: T.panelHover }}><X size={14} style={{ color: T.textMuted }} /></button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <SectionLabel icon={Sparkles} tone="#8b5cf6">AI Summary</SectionLabel>
                                <p className="text-xs leading-relaxed mt-2" style={{ color: T.textMuted }}>{previewCall.summary || "No summary available."}</p>
                            </div>

                            <div>
                                <SectionLabel icon={FileText} tone="#3b82f6">Transcript Preview</SectionLabel>
                                {previewLoading ? (
                                    <div className="space-y-2 mt-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} T={T} className="h-4" />)}</div>
                                ) : previewDetail?.error ? (
                                    <p className="text-xs mt-2" style={{ color: T.textFaint }}>Transcript unavailable.</p>
                                ) : (
                                    <p className="text-xs leading-relaxed mt-2 line-clamp-[10]" style={{ color: T.textMuted, whiteSpace: "pre-wrap" }}>
                                        {(previewDetail?.transcript || "No transcript available.").slice(0, 800)}
                                        {(previewDetail?.transcript?.length || 0) > 800 && "…"}
                                    </p>
                                )}
                            </div>

                            <div>
                                <SectionLabel icon={Tag} tone="#f59e0b">Tags</SectionLabel>
                                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                    {(tags[previewCall.id] || []).map(t => (
                                        <span key={t} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
                                            {t} <button onClick={() => removeTag(previewCall.id, t)}><X size={9} /></button>
                                        </span>
                                    ))}
                                    <div className="flex items-center gap-1">
                                        <input value={tagDraft} onChange={e => setTagDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag(previewCall.id)}
                                            placeholder="Add tag…" className="text-[10px] px-2 py-1 rounded-full outline-none w-20" style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }} />
                                        <button onClick={() => addTag(previewCall.id)}><Plus size={12} style={{ color: T.textFaint }} /></button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <button onClick={() => toggleFavorite(previewCall.id)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg" style={{ background: T.panelHover, color: T.text }}>
                                    <Star size={13} fill={favorites.has(previewCall.id) ? "#f59e0b" : "none"} style={{ color: favorites.has(previewCall.id) ? "#f59e0b" : T.textMuted }} /> {favorites.has(previewCall.id) ? "Favorited" : "Favorite"}
                                </button>
                                <Link to={`/w/${getUser()?.companySlug || "default"}/calls/${previewCall.id}`} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg text-white" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                                    <PlayCircle size={13} /> Open Full Details
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <style>{`
                @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                @keyframes drawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
                .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            `}</style>
        </div>
    );
}
