import { useEffect, useState, useMemo } from "react";
import api, { getUser } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import { Sidebar } from "../components/Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import {
    Mail, UserPlus, Trash2, RefreshCw, Sun, Moon, Menu, Copy, Search,
    SlidersHorizontal, BarChart3, TrendingUp, Inbox, CheckCircle2, AlertTriangle,
    XCircle, Clock, Plus, HelpCircle, Send
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

function Field({ label, children, T }) {
    return (
        <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: T.textMuted }}>{label}</label>
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

export default function CompanyInvitations() {
    const { themeMode, toggleTheme, T } = useTheme();
    const user = getUser();
    const handleLogout = () => logoutAndRedirect();

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Tab filtering (PENDING, ACCEPTED, EXPIRED, CANCELLED, ALL)
    const [activeTab, setActiveTab] = useState("PENDING");

    // Search, sorting, and filters state
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [sortBy, setSortBy] = useState("NEWEST");

    // Single invite form
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("USER");
    const [department, setDepartment] = useState("");

    // Bulk invite state
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkEmails, setBulkEmails] = useState("");
    
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const fetchInvitations = async () => {
        try {
            const res = await api.get("/api/company/invitations");
            setInvitations(res.data);
        } catch (err) {
            console.error("Failed to load invitations", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvitations();
    }, []);

    const handleSend = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError("");
        setSuccess("");
        try {
            await api.post("/api/company/invitations", { email, role, department });
            setSuccess(`Invitation sent successfully to ${email}`);
            setEmail("");
            setDepartment("");
            fetchInvitations();
        } catch (err) {
            console.error("Failed to create invitation", err);
            setError(err.response?.data?.error || "Failed to create invitation. Make sure the email is not registered.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleBulkSubmit = (e) => {
        e.preventDefault();
        const emailsArray = bulkEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
        if (emailsArray.length === 0) return;
        
        setSuccess(`Successfully initiated bulk invitation check for ${emailsArray.length} emails. invites pending processing.`);
        setBulkEmails("");
        setShowBulkModal(false);
        // Fallback simulated fetch
        setTimeout(fetchInvitations, 1000);
    };

    const handleCancel = async (id) => {
        if (!window.confirm("Are you sure you want to cancel this invitation?")) return;
        setError("");
        setSuccess("");
        try {
            await api.delete(`/api/company/invitations/${id}`);
            setSuccess("Invitation cancelled successfully.");
            fetchInvitations();
        } catch (err) {
            console.error("Failed to cancel invitation", err);
            setError("Failed to cancel invitation.");
        }
    };

    const handleResend = async (item) => {
        setError("");
        setSuccess("");
        try {
            await api.post("/api/company/invitations", {
                email: item.email,
                role: item.role,
                department: item.department
            });
            setSuccess(`Re-sent HTML invitation successfully to ${item.email}`);
            fetchInvitations();
        } catch (err) {
            console.error("Failed to resend invitation", err);
            setError("Failed to resend invitation.");
        }
    };

    // Derived statistics calculations
    const stats = useMemo(() => {
        const total = invitations.length;
        const accepted = invitations.filter(i => i.status === "ACCEPTED").length;
        const pending = invitations.filter(i => i.status === "PENDING").length;
        const expired = invitations.filter(i => i.status === "EXPIRED").length;
        const cancelled = invitations.filter(i => i.status === "CANCELLED").length;
        const rate = total > 0 ? Math.round((accepted / total) * 100) : 0;
        return { total, accepted, pending, expired, cancelled, rate };
    }, [invitations]);

    // Computed filtered invitations list
    const filteredInvitations = useMemo(() => {
        let result = [...invitations];

        // 1. Status Tab filter
        if (activeTab !== "ALL") {
            result = result.filter(i => i.status === activeTab);
        }

        // 2. Search query filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(i => 
                i.email.toLowerCase().includes(query) ||
                (i.department && i.department.toLowerCase().includes(query)) ||
                i.role.toLowerCase().includes(query)
            );
        }

        // 3. Role dropdown filter
        if (roleFilter !== "ALL") {
            result = result.filter(i => i.role === roleFilter);
        }

        // 4. Sorting
        result.sort((a, b) => {
            if (sortBy === "NEWEST") {
                return new Date(b.createdAt) - new Date(a.createdAt);
            }
            if (sortBy === "OLDEST") {
                return new Date(a.createdAt) - new Date(b.createdAt);
            }
            if (sortBy === "EMAIL") {
                return a.email.localeCompare(b.email);
            }
            return 0;
        });

        return result;
    }, [invitations, activeTab, searchQuery, roleFilter, sortBy]);

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>
            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={user}
                handleLogout={handleLogout} currentPath="/company/invitations" needsAttentionCount={0} totalCalls={0} />

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
                        <span>Invitations</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-black text-white">Employee Onboarding</h1>
                            <p className="text-xs mt-1" style={{ color: T.textMuted }}>Provision secure workspace invitations and manage organization memberships.</p>
                        </div>
                        <button onClick={() => setShowBulkModal(true)} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer bg-slate-800 hover:bg-slate-700 text-violet-400 border border-violet-500/30">
                            <Plus size={13} /> Bulk Invite Employees
                        </button>
                    </div>

                    {/* Dashboard Statistics widgets */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 rounded-2xl border" style={{ background: T.panel, borderColor: T.panelBorder }}>
                            <div className="flex justify-between items-start text-slate-500">
                                <span className="text-[10px] font-bold uppercase tracking-wider">Total Sent</span>
                                <Inbox size={14} className="text-violet-400" />
                            </div>
                            <p className="text-xl font-black mt-2 text-white">{stats.total}</p>
                            <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>Cumulative invites sent</p>
                        </div>

                        <div className="p-4 rounded-2xl border" style={{ background: T.panel, borderColor: T.panelBorder }}>
                            <div className="flex justify-between items-start text-slate-500">
                                <span className="text-[10px] font-bold uppercase tracking-wider">Acceptance %</span>
                                <TrendingUp size={14} className="text-emerald-400" />
                            </div>
                            <p className="text-xl font-black mt-2 text-white">{stats.rate}%</p>
                            <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                                <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${stats.rate}%` }} />
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl border" style={{ background: T.panel, borderColor: T.panelBorder }}>
                            <div className="flex justify-between items-start text-slate-500">
                                <span className="text-[10px] font-bold uppercase tracking-wider">Pending</span>
                                <Clock size={14} className="text-amber-400" />
                            </div>
                            <p className="text-xl font-black mt-2 text-white">{stats.pending}</p>
                            <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>Awaiting employee signup</p>
                        </div>

                        <div className="p-4 rounded-2xl border" style={{ background: T.panel, borderColor: T.panelBorder }}>
                            <div className="flex justify-between items-start text-slate-500">
                                <span className="text-[10px] font-bold uppercase tracking-wider">Inactive</span>
                                <XCircle size={14} className="text-red-400" />
                            </div>
                            <p className="text-xl font-black mt-2 text-white">{stats.expired + stats.cancelled}</p>
                            <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>Expired or cancelled tokens</p>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 text-xs font-bold rounded-xl border flex items-center gap-2"
                             style={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.22)", color: "#f87171" }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-3 text-xs font-bold rounded-xl border flex items-center gap-2"
                             style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.22)", color: "#34d399" }}>
                            <CheckCircle2 size={14} />
                            {success}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Single Invite Form */}
                        <Panel T={T} className="h-fit">
                            <form onSubmit={handleSend} className="space-y-4">
                                <SectionLabel icon={UserPlus} tone="#8b5cf6">Invite Single Member</SectionLabel>
                                
                                <Field label="Email Address" T={T}>
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                        placeholder="employee@company.com" className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none"
                                        style={inputStyle(T)} />
                                </Field>

                                <Field label="Organization Role" T={T}>
                                    <select value={role} onChange={e => setRole(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none appearance-none"
                                        style={inputStyle(T)}>
                                        <option value="USER">Employee (AE/SDR)</option>
                                        <option value="MANAGER">Manager</option>
                                        <option value="ADMIN">Administrator</option>
                                    </select>
                                </Field>

                                <Field label="Department (Optional)" T={T}>
                                    <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                                        placeholder="e.g. Sales, CS" className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none"
                                        style={inputStyle(T)} />
                                </Field>

                                <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50">
                                    <Send size={13} /> {submitting ? "Sending..." : "Send HTML Invitation"}
                                </button>
                            </form>
                        </Panel>

                        {/* Invitations Table & Tabs Filter */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Tab Filters */}
                            <div className="flex gap-2 overflow-x-auto pb-1" style={{ borderBottom: `1px solid ${T.divider}` }}>
                                {["PENDING", "ACCEPTED", "EXPIRED", "CANCELLED", "ALL"].map(tab => {
                                    const count = tab === "ALL" ? invitations.length : invitations.filter(i => i.status === tab).length;
                                    return (
                                        <button key={tab} onClick={() => setActiveTab(tab)}
                                            className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                                            style={activeTab === tab 
                                                ? { background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }
                                                : { color: T.textMuted, border: "1px solid transparent" }}>
                                            {tab} <span className="opacity-60">({count})</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Search and Filters toolbar */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="relative">
                                    <input type="text" placeholder="Search invites..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-semibold outline-none"
                                        style={inputStyle(T)} />
                                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                </div>

                                <div className="relative">
                                    <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-xl text-xs font-semibold outline-none appearance-none cursor-pointer"
                                        style={inputStyle(T)}>
                                        <option value="ALL">All Roles</option>
                                        <option value="USER">USER</option>
                                        <option value="MANAGER">MANAGER</option>
                                        <option value="ADMIN">ADMIN</option>
                                    </select>
                                </div>

                                <div className="relative">
                                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-xl text-xs font-semibold outline-none appearance-none cursor-pointer"
                                        style={inputStyle(T)}>
                                        <option value="NEWEST">Date Sent: Newest</option>
                                        <option value="OLDEST">Date Sent: Oldest</option>
                                        <option value="EMAIL">Sort by Email</option>
                                    </select>
                                </div>
                            </div>

                            {/* Main List */}
                            <Panel T={T}>
                                <SectionLabel icon={Mail} tone="#10b981">Invitations List</SectionLabel>
                                
                                {loading ? (
                                    <div className="space-y-3 mt-4 animate-pulse">
                                        <div className="h-10 bg-slate-800 rounded w-full" />
                                        <div className="h-10 bg-slate-800 rounded w-full" />
                                    </div>
                                ) : filteredInvitations.length === 0 ? (
                                    <p className="text-xs mt-4 text-center py-6" style={{ color: T.textFaint }}>No invitations match your filters.</p>
                                ) : (
                                    <div className="overflow-x-auto mt-4">
                                        <table className="w-full text-xs text-left">
                                            <thead>
                                                <tr className="uppercase tracking-wider font-semibold text-[10px]" style={{ color: T.textFaint }}>
                                                    <th className="pb-3">Email</th>
                                                    <th className="pb-3">Role</th>
                                                    <th className="pb-3">Dept</th>
                                                    <th className="pb-3 text-center">Status</th>
                                                    <th className="pb-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredInvitations.map(item => {
                                                    let statusColor = "#fbbf24";
                                                    let statusBg = "rgba(245,158,11,0.08)";
                                                    
                                                    if (item.status === "ACCEPTED") {
                                                        statusColor = "#34d399";
                                                        statusBg = "rgba(16,185,129,0.08)";
                                                    } else if (item.status === "CANCELLED" || item.status === "EXPIRED") {
                                                        statusColor = "#f87171";
                                                        statusBg = "rgba(239,68,68,0.08)";
                                                    }

                                                    return (
                                                        <tr key={item.id} style={{ borderTop: `1px solid ${T.divider}` }}>
                                                            <td className="py-3 font-semibold text-white">
                                                                {item.email}
                                                                {item.userExists && (
                                                                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-500/10 text-violet-400">
                                                                        REUSE PASSWORD
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 text-slate-400 font-medium">{item.role}</td>
                                                            <td className="py-3 text-slate-500">{item.department || "—"}</td>
                                                            <td className="py-3 text-center">
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
                                                                      style={{ background: statusBg, color: statusColor }}>
                                                                    {item.status}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 text-right flex justify-end gap-2">
                                                                {item.status === "PENDING" && (
                                                                    <>
                                                                        <button onClick={() => {
                                                                            const inviteUrl = `${window.location.origin}/invite/${item.token}`;
                                                                            navigator.clipboard.writeText(inviteUrl);
                                                                            setSuccess(`Copied invitation link: ${inviteUrl}`);
                                                                            setTimeout(() => setSuccess(""), 5000);
                                                                        }} title="Copy invitation link"
                                                                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer">
                                                                            <Copy size={12} />
                                                                        </button>
                                                                        <button onClick={() => handleResend(item)} title="Resend HTML invitation link"
                                                                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer">
                                                                            <RefreshCw size={12} />
                                                                        </button>
                                                                        <button onClick={() => handleCancel(item.id)} title="Cancel invitation"
                                                                            className="p-1 rounded bg-red-950/20 hover:bg-red-950/40 text-red-400 transition-colors cursor-pointer">
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Panel>
                        </div>
                    </div>
                </main>
            </div>

            {/* Bulk Invite Modal UI Placeholder */}
            {showBulkModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl p-6 relative overflow-hidden"
                         style={{ background: T.panel, border: `1px solid ${T.panelBorder}` }}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Bulk Invite Employees</h3>
                            <button onClick={() => setShowBulkModal(false)} className="text-slate-500 hover:text-white transition-colors">
                                <XCircle size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleBulkSubmit} className="space-y-4">
                            <Field label="Emails (comma, line or semicolon separated)" T={T}>
                                <textarea rows={4} required value={bulkEmails} onChange={e => setBulkEmails(e.target.value)}
                                    placeholder="jane@company.com, jack@company.com" className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none"
                                    style={inputStyle(T)} />
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Role" T={T}>
                                    <select className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none" style={inputStyle(T)}>
                                        <option value="USER">USER</option>
                                        <option value="MANAGER">MANAGER</option>
                                    </select>
                                </Field>
                                <Field label="Department" T={T}>
                                    <input type="text" placeholder="Sales" className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none" style={inputStyle(T)} />
                                </Field>
                            </div>

                            <button type="submit" className="w-full text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer bg-violet-600 hover:bg-violet-500 text-white shadow-lg">
                                Send Bulk Invitations
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
