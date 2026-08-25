import { Link } from "react-router-dom";
import { useState, useRef, useLayoutEffect } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import logo from "../assets/CONVEXA_AI_logo.png";
import {
    LayoutDashboard, History, LineChart, BookOpen, Brain,
    ClipboardList, FileText, Key, Settings, Sparkles,
    ArrowRight, ChevronsLeft, ChevronsRight, LogOut, Lock, Building2,
    SlidersHorizontal, Users, ChevronDown, DollarSign, Trophy, Mic, CreditCard,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────── */
/* Theme tokens — shared by every page that renders inside the app shell. */
/* Extracted unchanged from DashboardPage.jsx so Dashboard, Analytics,    */
/* and any future page all read from the exact same source of truth.     */
/* ────────────────────────────────────────────────────────────────────── */
export const THEMES = {
    dark: {
        isDark: true,
        pageBg: "linear-gradient(160deg, #05060A 0%, #0B1020 45%, #070912 100%)",
        sidebarBg: "rgba(8,9,18,0.92)",
        headerBg: "rgba(5,6,10,0.85)",
        panel: "rgba(255,255,255,0.025)",
        panelSolid: "#0e1326",
        panelBorder: "rgba(255,255,255,0.07)",
        panelHover: "rgba(255,255,255,0.045)",
        inputBg: "rgba(255,255,255,0.04)",
        popoverBg: "rgba(10,10,26,0.98)",
        popoverBorder: "rgba(255,255,255,0.12)",
        popoverShadow: "0 20px 60px rgba(0,0,0,0.5)",
        text: "#f8fafc",
        textMuted: "#94a3b8",
        textFaint: "#475569",
        divider: "rgba(255,255,255,0.06)",
        cardShadow: "0 4px 20px rgba(0,0,0,0.25)",
    },
    light: {
        isDark: false,
        pageBg: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
        sidebarBg: "#ffffff",
        headerBg: "rgba(255,255,255,0.95)",
        panel: "#ffffff",
        panelSolid: "#ffffff",
        panelBorder: "#e2e8f0",
        panelHover: "#f8fafc",
        inputBg: "#ffffff",
        popoverBg: "#ffffff",
        popoverBorder: "#e2e8f0",
        popoverShadow: "0 20px 40px -10px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.05)",
        text: "#0f172a",
        textMuted: "#475569",
        textFaint: "#64748b",
        divider: "#e2e8f0",
        cardShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
    },
};

/**
 * Sidebar — the app's primary left navigation.
 */
export function Sidebar({ collapsed, setCollapsed, T, user, handleLogout, currentPath, needsAttentionCount, totalCalls }) {
    const { workspaces, currentWorkspace, switchWorkspace } = useWorkspace();
    const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
    const isManagerOrAdmin = user?.role === "OWNER" || user?.role === "MANAGER" || user?.role === "ADMIN";
    const navRef = useRef(null);

    useLayoutEffect(() => {
        const nav = navRef.current;
        if (!nav) return;
        const saved = parseInt(sessionStorage.getItem("sidebar_scroll") || "0", 10);
        if (saved > 0) {
            requestAnimationFrame(() => {
                if (navRef.current) navRef.current.scrollTop = saved;
            });
        }
        return () => {
            if (navRef.current) {
                sessionStorage.setItem("sidebar_scroll", String(navRef.current.scrollTop));
            }
        };
    }, []);

    const getTrialInfo = (trialEndsAt) => {
        if (!trialEndsAt) return { daysLeft: 0, formattedDate: "" };
        try {
            const endDate = new Date(trialEndsAt);
            const today = new Date();
            const diffTime = endDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const formatted = endDate.toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                year: "numeric"
            });
            
            return {
                daysLeft: Math.max(0, diffDays),
                formattedDate: formatted
            };
        } catch (e) {
            return { daysLeft: 0, formattedDate: "" };
        }
    };
    
    const trialInfo = getTrialInfo(user?.trialEndsAt);
    const isLogoInvalid = !user?.companyLogo || user.companyLogo.trim() === "" || user.companyLogo.includes("placeholder.com") || user.companyLogo.includes("via.placeholder.com");

    const isOwner = user?.role === "OWNER";
    const companySlug = user?.companySlug || "default";

    const OWNER_NAV_GROUPS = [
        {
            title: "EXECUTIVE",
            items: [
                { label: "Executive Command Center", path: `/w/${companySlug}/dashboard`, activePath: "/dashboard", Icon: LayoutDashboard },
                { label: "Revenue Intelligence", path: `/w/${companySlug}/revenue-intelligence`, activePath: "/revenue-intelligence", Icon: DollarSign },
                { label: "AI Insights", path: `/w/${companySlug}/insights`, activePath: "/insights", Icon: Brain },
                { label: "Performance Center", path: `/w/${companySlug}/analytics`, activePath: "/analytics", Icon: Trophy },
            ]
        },
        {
            title: "OPERATIONS",
            items: [
                { label: "Conversation Library", path: `/w/${companySlug}/history`, activePath: "/history", Icon: Mic },
                { label: "Executive Reports", path: `/w/${companySlug}/reports`, activePath: "/reports", Icon: FileText },
            ]
        },
        {
            title: "WORKSPACE",
            items: [
                { label: "Members", path: `/w/${companySlug}/company/members`, activePath: "/company/members", Icon: Users },
            ]
        },
        {
            title: "ADMINISTRATION",
            items: [
                { label: "Billing & Seats", path: `/w/${companySlug}/company/billing`, activePath: "/company/billing", Icon: CreditCard },
                { label: "Workspace Settings", path: `/w/${companySlug}/company/settings`, activePath: "/company/settings", Icon: SlidersHorizontal },
            ]
        }
    ];

    const REAL_ITEMS = [
        { label: "Dashboard", path: `/w/${companySlug}/dashboard`, activePath: "/dashboard", Icon: LayoutDashboard },
        { label: "Call History", path: `/w/${companySlug}/history`, activePath: "/history", Icon: History },
        { label: "Analytics", path: `/w/${companySlug}/analytics`, activePath: "/analytics", Icon: LineChart },
        { label: "Library", path: `/w/${companySlug}/library`, activePath: "/library", Icon: BookOpen },
        { label: "AI Insights", path: `/w/${companySlug}/insights`, activePath: "/insights", Icon: Brain },
        { label: "Scorecards", path: `/w/${companySlug}/scorecards`, activePath: "/scorecards", Icon: ClipboardList },
        ...(isManagerOrAdmin ? [
            { label: "Company", path: `/w/${companySlug}/company`, activePath: "/company", Icon: Building2 },
            { label: "Members", path: `/w/${companySlug}/company/members`, activePath: "/company/members", Icon: Users },
            { label: "Company Settings", path: `/w/${companySlug}/company/settings`, activePath: "/company/settings", Icon: SlidersHorizontal },
            { label: "Invitations", path: `/w/${companySlug}/company/invitations`, activePath: "/company/invitations", Icon: ClipboardList }
        ] : []),
        { label: "Settings", path: `/w/${companySlug}/settings`, activePath: "/settings", Icon: Settings },
    ];
    const SOON_ITEMS = [
        { label: "Reports", Icon: FileText },
        { label: "Keywords", Icon: Key },
    ];

    const renderNavItem = ({ label, path, activePath, Icon }) => {
        const normCurrent = (currentPath || "").replace(/\/+$/, "");
        const normPath = path.replace(/\/+$/, "");
        const normActive = activePath.replace(/\/+$/, "");

        const match = normCurrent.match(/^\/w\/[^/]+(\/.*)?$/);
        const currentSubPath = match ? (match[1] || "/dashboard") : normCurrent;

        const active = normCurrent === normPath || normCurrent === normActive || currentSubPath === normActive;
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
                {!collapsed && (label === "Dashboard" || label === "Executive Dashboard") && needsAttentionCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.18)", color: "#f87171" }}>
                        {needsAttentionCount}
                    </span>
                )}
            </Link>
        );
    };

    return (
        <aside className={`hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 transition-all duration-300 z-40 ${collapsed ? "w-[76px]" : "w-64"}`}
            style={{ background: T.sidebarBg, borderRight: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>

            {/* Top Sidebar Header: Convexa Platform Brand + Workspace Switcher */}
            <div className={`flex flex-col flex-shrink-0 ${collapsed ? "py-4 items-center justify-center" : "p-3.5 space-y-2.5"}`}
                style={{ borderBottom: `1px solid ${T.divider}` }}>
                {!collapsed ? (
                    <>
                        {/* Convexa AI Platform Brand Mark */}
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <img src={logo} alt="Convexa AI" className="h-5 w-auto object-contain flex-shrink-0" />
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-black tracking-tight uppercase" style={{ color: T.text }}>Convexa</span>
                                    <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase tracking-wider bg-violet-500/20 text-violet-600 dark:text-violet-300 border border-violet-500/30">AI</span>
                                </div>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: T.textFaint }}>v2.0</span>
                        </div>

                        {/* Divider */}
                        <div className="h-[1px] w-full" style={{ background: T.divider }} />

                        {/* Multi-Tenant Workspace Selector */}
                        <div className="relative w-full">
                            <button 
                                onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                                className="flex items-center justify-between w-full p-2 rounded-xl transition-all duration-200 text-left hover:opacity-90"
                                style={{
                                    color: T.text,
                                    background: T.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                                    border: `1px solid ${T.panelBorder}`
                                }}
                                title="Switch workspace"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    {isLogoInvalid ? (
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white flex-shrink-0 text-xs"
                                            style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)", boxShadow: "0 2px 8px rgba(139,92,246,0.2)" }}>
                                            <span>{user?.companyName ? user.companyName[0].toUpperCase() : "C"}</span>
                                        </div>
                                    ) : (
                                        <img src={user.companyLogo} alt="Workspace Logo" className="h-7 w-7 rounded-lg object-contain flex-shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold tracking-tight truncate" style={{ color: T.text }}>
                                            {user?.companyName || "Convexa AI"}
                                        </p>
                                        <p className="text-[9px] font-semibold uppercase tracking-wider truncate" style={{ color: T.textFaint }}>
                                            {user?.role || "Member"}
                                        </p>
                                    </div>
                                </div>
                                <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 ${wsDropdownOpen ? "rotate-180" : ""}`} style={{ color: T.textFaint }} />
                            </button>

                            {/* Dropdown Menu */}
                            {wsDropdownOpen && (
                                <div className="absolute left-0 right-0 mt-2 p-1.5 rounded-2xl border backdrop-blur-xl shadow-2xl z-50 animate-fade-in"
                                    style={{ 
                                        background: T.popoverBg, 
                                        borderColor: T.popoverBorder,
                                        boxShadow: T.popoverShadow
                                    }}
                                >
                                    <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: T.textFaint }}>Switch Workspace</p>
                                    <div className="max-h-60 overflow-y-auto space-y-0.5">
                                        {workspaces.map((ws) => {
                                            const isActive = currentWorkspace?.company?.id === ws.id;
                                            const isWsLogoInvalid = !ws.logoUrl || ws.logoUrl.trim() === "" || ws.logoUrl.includes("placeholder.com") || ws.logoUrl.includes("via.placeholder.com");
                                            return (
                                                <button
                                                    key={ws.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setWsDropdownOpen(false);
                                                        switchWorkspace(ws.slug);
                                                    }}
                                                    className="w-full flex items-center gap-2.5 p-2 rounded-xl transition-all duration-200 text-left hover:opacity-80"
                                                    style={isActive ? { background: "rgba(139,92,246,0.12)", color: "#7c3aed", fontWeight: 700 } : { color: T.textMuted }}
                                                >
                                                    {isWsLogoInvalid ? (
                                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0 text-[10px]"
                                                            style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)" }}>
                                                            {ws.name ? ws.name[0].toUpperCase() : "C"}
                                                        </div>
                                                    ) : (
                                                        <img src={ws.logoUrl} alt="Workspace Logo" className="h-6 w-6 rounded-lg object-contain flex-shrink-0" />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs truncate">{ws.name}</p>
                                                    </div>
                                                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <img src={logo} alt="Convexa AI" className="h-6 w-auto object-contain" title="Convexa AI" />
                        {isLogoInvalid ? (
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white flex-shrink-0 text-[10px]"
                                style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)", boxShadow: "0 2px 8px rgba(139,92,246,0.2)" }}
                                title={user?.companyName}>
                                <span>{user?.companyName ? user.companyName[0].toUpperCase() : "C"}</span>
                            </div>
                        ) : (
                            <img src={user.companyLogo} alt="Workspace Logo" className="h-7 w-7 rounded-lg object-contain" title={user?.companyName} />
                        )}
                    </div>
                )}
            </div>

            <nav ref={navRef} className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
                {isOwner ? (
                    OWNER_NAV_GROUPS.map((group, idx) => (
                        <div key={group.title} className={idx > 0 ? "pt-3" : ""}>
                            {!collapsed && (
                                <p className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-violet-400 opacity-90">{group.title}</p>
                            )}
                            {group.items.map(renderNavItem)}
                        </div>
                    ))
                ) : (
                    REAL_ITEMS.map(renderNavItem)
                )}

                {!isOwner && !collapsed && (
                    <p className="px-3.5 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textFaint }}>Coming soon</p>
                )}
                {!isOwner && SOON_ITEMS.map(({ label, Icon }) => (
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
                        <div className="mt-3.5 space-y-1.5 pt-2" style={{ borderTop: `1px solid ${T.panelBorder}` }}>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-violet-300">
                                    {user?.subscriptionStatus === "TRIALING" ? "Business Trial" : `${user?.subscriptionPlan || "Free"} Plan`}
                                </span>
                                <span className="text-[9px] font-semibold text-slate-400">
                                    {user?.currentSeatCount ?? 1} / {user?.seatLimit ?? 25} seats
                                </span>
                            </div>
                            {user?.subscriptionStatus === "TRIALING" && trialInfo.formattedDate && (
                                <p className="text-[9px] leading-tight" style={{ color: T.textMuted }}>
                                    Trial until {trialInfo.formattedDate} ({trialInfo.daysLeft} days left)
                                </p>
                            )}
                            <p className="text-[9px] leading-none" style={{ color: T.textFaint }}>
                                {totalCalls} call{totalCalls !== 1 ? "s" : ""} analysed
                            </p>
                        </div>
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
                                <p className="text-[10px] truncate" style={{ color: T.textFaint }}>{user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : "User"}</p>
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
