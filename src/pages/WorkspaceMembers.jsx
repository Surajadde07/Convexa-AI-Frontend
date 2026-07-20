import { useEffect, useState, useMemo, useCallback } from "react";
import api, { getUser, refreshSeatCount } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import { Sidebar } from "../components/Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import {
    Users, Trash2, Search, SlidersHorizontal, ChevronLeft, ChevronRight,
    Sun, Moon, Menu, X, Shield, Sparkles, UserPlus, Info, Check, ShieldAlert, RefreshCw
} from "lucide-react";

function SectionLabel({ icon: Icon, children, tone = "#8b5cf6" }) {
    return (
        <div className="flex items-center gap-2">
            {Icon && (
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: `${tone}12`, border: `1px solid ${tone}30` }}>
                    <Icon size={11} style={{ color: tone }} strokeWidth={2.5} />
                </div>
            )}
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: tone }}>{children}</span>
        </div>
    );
}

function Panel({ children, className = "", style = {}, T }) {
    return (
        <div className={`rounded-2xl p-5 sm:p-6 ${className}`}
            style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, ...style }}>
            {children}
        </div>
    );
}

function inputStyle(T) {
    return {
        background: T.inputBg,
        border: `1px solid ${T.panelBorder}`,
        color: T.text,
        transition: "border-color 0.2s, box-shadow 0.2s"
    };
}

export default function WorkspaceMembers() {
    const { themeMode, toggleTheme, T } = useTheme();
    // Reactive user state — re-reading localStorage after seat sync re-renders Sidebar
    const [userState, setUserState] = useState(getUser());
    const actor = userState;
    const handleLogout = () => logoutAndRedirect();

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Members list state
    const [members, setMembers] = useState([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [sortBy, setSortBy] = useState("createdAt,desc");

    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    // Per-member action loading guard (prevents double-click on role/remove)
    const [actionInProgress, setActionInProgress] = useState(new Set());

    // Debounced search state trigger
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(0); // Reset page on search change
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    const fetchMembers = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        setError("");
        try {
            const roleParam = roleFilter === "ALL" ? "" : roleFilter;
            const res = await api.get("/api/company/members", {
                params: {
                    page,
                    size: 10,
                    search: debouncedSearch,
                    role: roleParam,
                    sort: sortBy
                }
            });
            setMembers(res.data.content || []);
            setTotalPages(res.data.totalPages || 0);
            setTotalElements(res.data.totalElements || 0);
        } catch (err) {
            console.error("Failed to load members", err);
            setError("Failed to fetch workspace members.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [page, debouncedSearch, roleFilter, sortBy]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    // Handle role modification
    const handleRoleChange = async (memberId, newRole) => {
        if (actionInProgress.has(memberId)) return;
        setError("");
        setSuccess("");
        setActionInProgress(prev => new Set(prev).add(memberId));
        try {
            await api.patch(`/api/company/members/${memberId}/role`, { role: newRole });
            setSuccess("Member role updated successfully.");
            fetchMembers();
            setTimeout(() => setSuccess(""), 4000);
        } catch (err) {
            console.error("Failed to update role", err);
            setError(err.response?.data?.error || "Unauthorized role promotion or demotion.");
        } finally {
            setActionInProgress(prev => { const s = new Set(prev); s.delete(memberId); return s; });
        }
    };

    // Handle member removal
    const handleRemove = async (member) => {
        if (actionInProgress.has(member.id)) return;
        if (!window.confirm(`Are you sure you want to remove ${member.name || member.email} from the workspace?`)) return;
        setError("");
        setSuccess("");
        setActionInProgress(prev => new Set(prev).add(member.id));
        try {
            await api.delete(`/api/company/members/${member.id}`);
            setSuccess("Member removed successfully.");
            setPage(0);
            fetchMembers();
            // Issue 4: refresh seat count in localStorage so Sidebar updates without page reload
            const newCount = await refreshSeatCount(api);
            if (newCount !== null) {
                setUserState(prev => prev ? { ...prev, currentSeatCount: newCount } : prev);
            }
            setTimeout(() => setSuccess(""), 4000);
        } catch (err) {
            console.error("Failed to remove member", err);
            setError(err.response?.data?.error || "Failed to remove member from workspace.");
        } finally {
            setActionInProgress(prev => { const s = new Set(prev); s.delete(member.id); return s; });
        }
    };

    // Helper checks to check if the actor has permissions to modify target roles / remove members
    const canManage = (target) => {
        if (!actor) return false;
        if (target.id === actor.id) return false; // Self-manage role/removal blocked
        if (target.role === "OWNER") return false; // OWNER is untouchable

        const actorRole = actor.role;
        if (actorRole === "OWNER") return true; // OWNER manages everyone else
        if (actorRole === "ADMIN") {
            // ADMIN manages USER and MANAGER only
            return target.role === "USER" || target.role === "MANAGER";
        }
        return false; // MANAGER/USER cannot manage anyone
    };

    const getAvailableRolesForActor = (targetRole) => {
        if (!actor) return [];
        if (actor.role === "OWNER") {
            return ["USER", "MANAGER", "ADMIN", "OWNER"];
        }
        if (actor.role === "ADMIN") {
            // ADMIN cannot promote target to ADMIN/OWNER, only toggle between USER/MANAGER
            return ["USER", "MANAGER"];
        }
        return [];
    };

    // Trial countdown calculation
    const getTrialDaysLeft = (endsAt) => {
        if (!endsAt) return null;
        try {
            const diff = new Date(endsAt) - new Date();
            return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        } catch (e) {
            return null;
        }
    };
    const daysLeft = getTrialDaysLeft(actor?.trialEndsAt);

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>
            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={actor}
                handleLogout={handleLogout} currentPath="/company/members" needsAttentionCount={0} totalCalls={0} />

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="sticky top-0 z-30" style={{ background: T.headerBg, borderBottom: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>
                    <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
                        <div className="flex-1" />
                        <button onClick={toggleTheme}
                            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors cursor-pointer"
                            style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }}
                            title="Toggle theme">
                            {themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                        </button>
                        <button className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-all cursor-pointer"
                            onClick={() => setMobileMenuOpen(o => !o)}
                            style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}` }}>
                            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
                        </button>
                    </div>
                </header>

                <main className="flex-1 min-w-0 px-4 sm:px-6 py-7 space-y-6">
                    <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.textFaint }}>
                        <span>Company</span>
                        <span>·</span>
                        <span style={{ color: T.textMuted }}>Members</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-black text-white">Workspace Members</h1>
                            <p className="text-xs mt-1" style={{ color: T.textMuted }}>Manage teammate roles, subscription seats, and workspace access authorization.</p>
                        </div>
                        <button
                            onClick={() => fetchMembers(true)}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                            style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}
                            title="Refresh members list">
                            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                            {refreshing ? "Refreshing…" : "Refresh"}
                        </button>
                    </div>

                    {/* Workspace Details Banner (Issue 6) */}
                    {actor?.companyName && (
                        <div className="p-5 rounded-2xl border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative overflow-hidden"
                            style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(59,130,246,0.03) 100%)", borderColor: "rgba(139,92,246,0.22)" }}>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white flex-shrink-0"
                                    style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)", boxShadow: "0 4px 12px rgba(124,58,237,0.2)" }}>
                                    {actor.companyName[0].toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="text-md font-bold text-white">{actor.companyName}</h4>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1" style={{ color: T.textMuted }}>
                                        <span>Plan: <span className="text-violet-300 font-bold">{actor.subscriptionPlan || "BUSINESS"}</span></span>
                                        <span className="opacity-40">•</span>
                                        <span>Status: <span className="text-emerald-400 font-semibold">{actor.subscriptionStatus === "TRIALING" ? "Business Trial" : "Active"}</span></span>
                                        {actor.subscriptionStatus === "TRIALING" && actor.trialEndsAt && (
                                            <>
                                                <span className="opacity-40">•</span>
                                                <span className="text-amber-400 font-medium">Trial ends in {daysLeft ?? 0} days</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 text-left lg:text-right flex-shrink-0 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0" style={{ borderColor: T.divider }}>
                                <div>
                                    <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: T.textFaint }}>Seat Usage</p>
                                    <p className="text-xl font-black text-white mt-0.5">{totalElements} / {actor.seatLimit || 25} <span className="text-xs font-semibold" style={{ color: T.textMuted }}>Seats Used</span></p>
                                </div>
                                <div className="h-8 w-[1px] bg-slate-800 hidden lg:block" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: T.textFaint }}>Workspace Capacity</p>
                                    <div className="w-24 bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                                        <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-1.5 rounded-full"
                                            style={{ width: `${Math.min(100, (totalElements / (actor.seatLimit || 25)) * 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 text-xs font-bold rounded-xl border flex items-center gap-2"
                             style={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.22)", color: "#f87171" }}>
                            <ShieldAlert size={14} />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-3 text-xs font-bold rounded-xl border flex items-center gap-2"
                             style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.22)", color: "#34d399" }}>
                            <Check size={14} />
                            {success}
                        </div>
                    )}

                    {/* Filters & Search Toolbar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="relative">
                            <input type="text" placeholder="Search members by name or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs font-semibold outline-none"
                                style={inputStyle(T)} />
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        </div>

                        <div className="relative">
                            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none appearance-none cursor-pointer"
                                style={inputStyle(T)}>
                                <option value="ALL">All Roles</option>
                                <option value="OWNER">OWNER</option>
                                <option value="ADMIN">ADMIN</option>
                                <option value="MANAGER">MANAGER</option>
                                <option value="USER">USER</option>
                            </select>
                        </div>

                        <div className="relative">
                            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none appearance-none cursor-pointer"
                                style={inputStyle(T)}>
                                <option value="createdAt,desc">Joined Date: Newest</option>
                                <option value="createdAt,asc">Joined Date: Oldest</option>
                                <option value="name,asc">Name: A - Z</option>
                                <option value="name,desc">Name: Z - A</option>
                                <option value="email,asc">Email: A - Z</option>
                            </select>
                        </div>
                    </div>

                    {/* Members List Panel */}
                    <Panel T={T}>
                        <SectionLabel icon={Users} tone="#10b981">Active Members List</SectionLabel>

                        {loading ? (
                            <div className="space-y-3 mt-5 animate-pulse">
                                <div className="h-12 bg-slate-800 rounded-xl w-full" />
                                <div className="h-12 bg-slate-800 rounded-xl w-full" />
                                <div className="h-12 bg-slate-800 rounded-xl w-full" />
                            </div>
                        ) : members.length === 0 ? (
                            <div className="text-center py-10" style={{ color: T.textFaint }}>
                                <p className="text-xs">No active members match your filter criteria.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto mt-4">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="uppercase tracking-wider font-bold text-[10px]" style={{ color: T.textFaint }}>
                                            <th className="pb-3 pl-2">Teammate</th>
                                            <th className="pb-3">Department</th>
                                            <th className="pb-3">Joined Date</th>
                                            <th className="pb-3 text-center">Role Badge</th>
                                            <th className="pb-3 text-right pr-2">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {members.map(member => {
                                            const isSelf = member.id === actor?.id;
                                            const editable = canManage(member);
                                            const roleOptions = getAvailableRolesForActor(member.role);

                                            // Role badge coloring
                                            let badgeBg = "rgba(100,116,139,0.08)";
                                            let badgeColor = "#94a3b8";
                                            if (member.role === "OWNER") {
                                                badgeBg = "rgba(245,158,11,0.08)";
                                                badgeColor = "#fbbf24";
                                            } else if (member.role === "ADMIN") {
                                                badgeBg = "rgba(139,92,246,0.08)";
                                                badgeColor = "#a78bfa";
                                            } else if (member.role === "MANAGER") {
                                                badgeBg = "rgba(59,130,246,0.08)";
                                                badgeColor = "#60a5fa";
                                            }

                                            return (
                                                <tr key={member.id} style={{ borderTop: `1px solid ${T.divider}` }}>
                                                    {/* Teammate Identity */}
                                                    <td className="py-3 pl-2 flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0 select-none"
                                                            style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)" }}>
                                                            {member.name ? member.name[0].toUpperCase() : "U"}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-white truncate flex items-center gap-1.5">
                                                                {member.name || member.email}
                                                                {isSelf && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-800 text-slate-400">YOU</span>
                                                                )}
                                                            </p>
                                                            <p className="text-[10px] truncate" style={{ color: T.textFaint }}>{member.email}</p>
                                                        </div>
                                                    </td>

                                                    {/* Department */}
                                                    <td className="py-3 text-slate-400 font-medium">
                                                        {member.department || "—"}
                                                    </td>

                                                    {/* Joined Date */}
                                                    <td className="py-3" style={{ color: T.textMuted }}>
                                                        {member.createdAt ? new Date(member.createdAt).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric"
                                                        }) : "Recently"}
                                                    </td>

                                                    {/* Role Badge */}
                                                    <td className="py-3 text-center">
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
                                                            style={{ background: badgeBg, color: badgeColor }}>
                                                            {member.role}
                                                        </span>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="py-3 text-right pr-2">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {editable ? (
                                                                <>
                                                                    <select value={member.role} onChange={e => handleRoleChange(member.id, e.target.value)}
                                                                        disabled={actionInProgress.has(member.id)}
                                                                        className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                                                                        {roleOptions.map(r => (
                                                                            <option key={r} value={r}>{r}</option>
                                                                        ))}
                                                                    </select>
                                                                    <button onClick={() => handleRemove(member)} title="Remove Teammate from Workspace"
                                                                        disabled={actionInProgress.has(member.id)}
                                                                        className="p-1.5 rounded bg-red-950/20 hover:bg-red-950/40 text-red-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px]" style={{ color: T.textFaint }}>Managed by Owner</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination Footer */}
                        {!loading && totalPages > 1 && (
                            <div className="flex items-center justify-between mt-5 pt-3" style={{ borderTop: `1px solid ${T.divider}` }}>
                                <p className="text-[10px]" style={{ color: T.textFaint }}>Showing page {page + 1} of {totalPages}</p>
                                <div className="flex items-center gap-1.5">
                                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                                        className="p-1 px-2 rounded bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 cursor-pointer">
                                        <ChevronLeft size={12} />
                                    </button>
                                    <button disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}
                                        className="p-1 px-2 rounded bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 cursor-pointer">
                                        <ChevronRight size={12} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </Panel>
                </main>
            </div>
        </div>
    );
}
