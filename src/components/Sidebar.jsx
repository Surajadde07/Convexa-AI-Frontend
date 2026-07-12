import { Link } from "react-router-dom";
import logo from "../assets/CONVEXA_AI_logo.png";
import {
    LayoutDashboard, History, LineChart, BookOpen, Brain,
    ClipboardList, FileText, Key, Settings, Sparkles,
    ArrowRight, ChevronsLeft, ChevronsRight, LogOut, Lock, Building2,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────── */
/* Theme tokens — shared by every page that renders inside the app shell. */
/* Extracted unchanged from DashboardPage.jsx so Dashboard, Analytics,    */
/* and any future page all read from the exact same source of truth.     */
/* ────────────────────────────────────────────────────────────────────── */
export const THEMES = {
    dark: {
        pageBg: "linear-gradient(160deg, #05060A 0%, #0B1020 45%, #070912 100%)",
        sidebarBg: "rgba(8,9,18,0.92)",
        headerBg: "rgba(5,6,10,0.82)",
        panel: "rgba(255,255,255,0.025)",
        panelBorder: "rgba(255,255,255,0.07)",
        panelHover: "rgba(255,255,255,0.045)",
        inputBg: "rgba(255,255,255,0.04)",
        text: "#f8fafc",
        textMuted: "#94a3b8",
        textFaint: "#475569",
        divider: "rgba(255,255,255,0.06)",
    },
    light: {
        pageBg: "linear-gradient(160deg, #f8f9fc 0%, #eef0f7 45%, #f4f5fb 100%)",
        sidebarBg: "rgba(255,255,255,0.9)",
        headerBg: "rgba(255,255,255,0.85)",
        panel: "rgba(17,24,39,0.025)",
        panelBorder: "rgba(17,24,39,0.08)",
        panelHover: "rgba(17,24,39,0.045)",
        inputBg: "rgba(17,24,39,0.04)",
        text: "#0f172a",
        textMuted: "#475569",
        textFaint: "#94a3b8",
        divider: "rgba(17,24,39,0.07)",
    },
};

/**
 * Sidebar — the app's primary left navigation.
 *
 * Nav is now split by real product maturity, not by build order:
 *   REAL_ITEMS  — fully shipped pages, live routes, real backend data.
 *   SOON_ITEMS  — Reports & Keywords, which need backend work (scheduled
 *                 export pipelines / keyword-spotting engine respectively)
 *                 that hasn't been built yet. Shown as premium locked rows
 *                 rather than dead links.
 */
export function Sidebar({ collapsed, setCollapsed, T, user, handleLogout, currentPath, needsAttentionCount, totalCalls }) {
    // Sprint 1.5 RBAC: role comes from the same `user` object every page
    // already passes in (populated at login via storeSession, which already
    // flat-copies `role` off AuthResponse) — no new prop, no new fetch.
    const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "ADMIN";

    const REAL_ITEMS = [
        { label: "Dashboard", path: "/dashboard", Icon: LayoutDashboard },
        { label: "Call History", path: "/history", Icon: History },
        { label: "Analytics", path: "/analytics", Icon: LineChart },
        { label: "Library", path: "/library", Icon: BookOpen },
        { label: "AI Insights", path: "/insights", Icon: Brain },
        { label: "Scorecards", path: "/scorecards", Icon: ClipboardList },
        // Sprint 2 will add /company + CompanyDashboard.jsx. The nav item is
        // wired now, gated to MANAGER/ADMIN, so Sprint 2 only needs to add
        // the route — nothing here changes when it does.
        ...(isManagerOrAdmin ? [{ label: "Company", path: "/company", Icon: Building2 }] : []),
        { label: "Settings", path: "/settings", Icon: Settings },
    ];
    const SOON_ITEMS = [
        { label: "Reports", Icon: FileText },
        { label: "Keywords", Icon: Key },
    ];

    return (
        <aside className={`hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 transition-all duration-300 z-40 ${collapsed ? "w-[76px]" : "w-64"}`}
            style={{ background: T.sidebarBg, borderRight: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>

            <div className={`h-16 flex items-center flex-shrink-0 ${collapsed ? "justify-center px-0" : "justify-between px-5"}`}
                style={{ borderBottom: `1px solid ${T.divider}` }}>
                {!collapsed && (
                    <div className="flex items-center gap-2.5 min-w-0">
                        <img src={logo} alt="Convexa AI" className="h-6 w-auto flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-black tracking-tight truncate" style={{ color: T.text }}>Convexa AI</p>
                            <p className="text-[10px] truncate" style={{ color: T.textFaint }}>Conversation Intelligence</p>
                        </div>
                    </div>
                )}
                {collapsed && <img src={logo} alt="Convexa AI" className="h-6 w-auto" />}
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
                {REAL_ITEMS.map(({ label, path, Icon }) => {
                    const active = currentPath === path;
                    return (
                        <Link key={label} to={path} title={collapsed ? label : undefined}
                            className={`relative flex items-center gap-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${collapsed ? "justify-center px-0 py-3" : "px-3.5 py-2.5"}`}
                            style={active
                                ? { background: "rgba(139,92,246,0.14)", color: "#c4b5fd", boxShadow: "inset 0 0 0 1px rgba(139,92,246,0.35), 0 0 20px rgba(139,92,246,0.12)" }
                                : { color: T.textMuted }}
                            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = T.panelHover; e.currentTarget.style.color = T.text; } }}
                            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMuted; } }}>
                            {active && !collapsed && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full" style={{ background: "#8b5cf6" }} />
                            )}
                            <Icon size={17} strokeWidth={2} className="flex-shrink-0" />
                            {!collapsed && <span className="truncate">{label}</span>}
                            {!collapsed && label === "Dashboard" && needsAttentionCount > 0 && (
                                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.18)", color: "#f87171" }}>
                                    {needsAttentionCount}
                                </span>
                            )}
                        </Link>
                    );
                })}

                {!collapsed && (
                    <p className="px-3.5 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textFaint }}>Coming soon</p>
                )}
                {SOON_ITEMS.map(({ label, Icon }) => (
                    <div key={label} title={collapsed ? `${label} — coming soon` : undefined}
                        className={`relative flex items-center gap-3 rounded-xl text-sm font-medium cursor-not-allowed transition-colors group ${collapsed ? "justify-center px-0 py-3" : "px-3.5 py-2.5"}`}
                        style={{ color: T.textFaint }}>
                        <div className="relative flex-shrink-0">
                            <Icon size={17} strokeWidth={2} style={{ opacity: 0.45 }} />
                            <div className="absolute -bottom-1 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                                style={{ background: T.sidebarBg, border: `1px solid ${T.panelBorder}` }}>
                                <Lock size={7} strokeWidth={2.5} style={{ color: T.textFaint }} />
                            </div>
                        </div>
                        {!collapsed && <span className="truncate flex-1" style={{ opacity: 0.5 }}>{label}</span>}
                        {!collapsed && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 tracking-wide"
                                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.22)", color: "#a78bfa" }}>
                                SOON
                            </span>
                        )}
                    </div>
                ))}
            </nav>

            <div className="flex-shrink-0 p-3 space-y-3" style={{ borderTop: `1px solid ${T.divider}` }}>
                {!collapsed ? (
                    <div className="rounded-2xl p-4 relative overflow-hidden"
                        style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.16), rgba(37,99,235,0.1))", border: "1px solid rgba(139,92,246,0.28)" }}>
                        <Sparkles size={14} className="text-violet-300 mb-2" />
                        <p className="text-xs font-bold" style={{ color: T.text }}>Upgrade to Pro</p>
                        <p className="text-[10px] mt-1 leading-relaxed" style={{ color: T.textMuted }}>Unlock advanced AI insights, custom scorecards and more.</p>
                        <button className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg text-white transition-transform active:scale-95"
                            style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                            Upgrade Now <ArrowRight size={11} />
                        </button>
                        <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>{totalCalls} call{totalCalls !== 1 ? "s" : ""} analysed on the Free plan</p>
                    </div>
                ) : (
                    <button className="w-full flex items-center justify-center py-2.5 rounded-xl" title="Upgrade to Pro"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                        <Sparkles size={15} className="text-white" />
                    </button>
                )}

                <div className={`flex items-center gap-2.5 rounded-xl p-2 ${collapsed ? "justify-center" : ""}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                        {user?.name?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    {!collapsed && (
                        <>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate" style={{ color: T.text }}>{user?.name ?? "User"}</p>
                                <p className="text-[10px] truncate" style={{ color: T.textFaint }}>Admin</p>
                            </div>
                            <button onClick={handleLogout} title="Sign out" className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                                style={{ color: T.textFaint }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = T.textFaint; e.currentTarget.style.background = "transparent"; }}>
                                <LogOut size={13} />
                            </button>
                        </>
                    )}
                </div>

                <button onClick={() => setCollapsed(c => !c)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
                    style={{ color: T.textFaint }}
                    onMouseEnter={e => e.currentTarget.style.color = T.textMuted}
                    onMouseLeave={e => e.currentTarget.style.color = T.textFaint}>
                    {collapsed ? <ChevronsRight size={13} /> : <><ChevronsLeft size={13} /> Collapse</>}
                </button>
            </div>
        </aside>
    );
}
