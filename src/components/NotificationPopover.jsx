/**
 * NotificationPopover.jsx — Convexa AI · Actionable Workspace Notifications
 * ─────────────────────────────────────────────────────────────────────────────
 * Real-time, database-backed notification bell and popover for the Owner / Executive.
 * Fully theme-aware (Light & Dark), scoped to the authenticated workspace & user.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.js";
import {
    Bell, Sparkles, AlertTriangle, UserPlus, Users,
    FileText, AlertOctagon, Shield, Radio, CheckCheck,
    Inbox, RefreshCw, TrendingDown, ArrowRight, ExternalLink
} from "lucide-react";

const TYPE_CONFIG = {
    CALL_ANALYSIS_COMPLETED: { icon: Sparkles, color: "#8b5cf6", lightColor: "#7c3aed", label: "AI Analysis" },
    HIGH_RISK_DETECTED:      { icon: AlertTriangle, color: "#ef4444", lightColor: "#dc2626", label: "High Risk" },
    QA_SCORE_DROP:           { icon: TrendingDown, color: "#f59e0b", lightColor: "#d97706", label: "QA Quality" },
    MEMBER_JOINED:           { icon: UserPlus, color: "#10b981", lightColor: "#059669", label: "Team" },
    MEMBER_INVITATION:       { icon: Users, color: "#3b82f6", lightColor: "#2563eb", label: "Workspace" },
    REPORT_READY:            { icon: FileText, color: "#06b6d4", lightColor: "#0891b2", label: "Report" },
    CALL_ANALYSIS_FAILED:    { icon: AlertOctagon, color: "#ef4444", lightColor: "#dc2626", label: "System Issue" },
    SECURITY_EVENT:          { icon: Shield, color: "#8b5cf6", lightColor: "#7c3aed", label: "Security" },
    SYSTEM_EVENT:            { icon: Radio, color: "#06b6d4", lightColor: "#0891b2", label: "System Feed" },
};

export function NotificationPopover({ T, user, companySlug }) {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const wrapRef = useRef(null);

    const isDark = T?.isDark ?? true;

    // ── Fetch Notifications from Database ────────────────────────────────────
    const fetchNotifications = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        try {
            const [listRes, countRes] = await Promise.all([
                api.get("/api/notifications?limit=20"),
                api.get("/api/notifications/unread-count")
            ]);
            setNotifications(listRes.data || []);
            setUnreadCount(countRes.data?.unreadCount || 0);
            setError(false);
        } catch (err) {
            console.error("Failed to fetch notifications:", err);
            setError(true);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications(true);
        // Polling interval (every 30 seconds)
        const timer = setInterval(() => {
            fetchNotifications(false);
        }, 30000);
        return () => clearInterval(timer);
    }, [fetchNotifications]);

    // ── Click Outside & ESC to Close ─────────────────────────────────────────
    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        function handleKeyDown(e) {
            if (e.key === "Escape") {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    // ── Mark Single As Read ──────────────────────────────────────────────────
    const handleMarkAsRead = async (notif) => {
        if (!notif.read) {
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
            try {
                await api.patch(`/api/notifications/${notif.id}/read`);
            } catch (err) {
                console.error("Failed to mark notification as read:", err);
            }
        }
    };

    // ── Mark All As Read ─────────────────────────────────────────────────────
    const handleMarkAllAsRead = async () => {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
        try {
            await api.patch("/api/notifications/read-all");
        } catch (err) {
            console.error("Failed to mark all notifications as read:", err);
        }
    };

    // ── Resolve navigation link for reference ────────────────────────────────
    const getNotificationLink = (notif) => {
        const slug = companySlug || user?.companySlug || "default";
        if (notif.referenceType === "CALL" && notif.referenceId) {
            return `/w/${slug}/calls/${notif.referenceId}`;
        }
        if (notif.referenceType === "MEMBER") {
            return `/w/${slug}/company/members`;
        }
        return null;
    };

    return (
        <div className="relative" ref={wrapRef}>
            {/* Bell Icon Trigger Button */}
            <button
                onClick={() => {
                    setOpen(o => !o);
                    if (!open) fetchNotifications(false);
                }}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 flex-shrink-0 active:scale-95"
                style={{
                    background: open ? (T.isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9") : T.inputBg,
                    border: `1px solid ${open ? "rgba(139,92,246,0.4)" : T.panelBorder}`,
                    color: open ? (T.isDark ? "#ffffff" : "#7c3aed") : T.textMuted
                }}
                title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "Notifications"}
                aria-label="Workspace notifications"
            >
                <Bell size={15} className={unreadCount > 0 ? "animate-pulse" : ""} />
                {unreadCount > 0 && (
                    <span
                        className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-sm"
                        style={{ background: "#ef4444", border: "1.5px solid " + (T.isDark ? "#05060A" : "#ffffff") }}
                    >
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Popover Card */}
            {open && (
                <div
                    className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl overflow-hidden z-50 animate-fade-in"
                    style={{
                        background: T.popoverBg,
                        border: `1px solid ${T.popoverBorder}`,
                        boxShadow: T.popoverShadow,
                        backdropFilter: "blur(20px)"
                    }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-4 py-3"
                        style={{ borderBottom: `1px solid ${T.divider}` }}
                    >
                        <div className="flex items-center gap-2">
                            <p className="text-xs font-black tracking-tight" style={{ color: T.text }}>
                                Notifications
                            </p>
                            {unreadCount > 0 && (
                                <span
                                    className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold"
                                    style={{
                                        background: T.isDark ? "rgba(139,92,246,0.2)" : "#f5f3ff",
                                        color: T.isDark ? "#c4b5fd" : "#7c3aed",
                                        border: `1px solid ${T.isDark ? "rgba(139,92,246,0.3)" : "#ddd6fe"}`
                                    }}
                                >
                                    {unreadCount} new
                                </span>
                            )}
                        </div>

                        {notifications.length > 0 && unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:opacity-80"
                                style={{ color: T.isDark ? "#a78bfa" : "#7c3aed" }}
                            >
                                <CheckCheck size={12} /> Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification List Container */}
                    <div className="max-h-96 overflow-y-auto divide-y" style={{ borderColor: T.divider }}>
                        {loading && notifications.length === 0 ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex gap-3 animate-pulse">
                                        <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                                            <div className="h-2.5 bg-slate-100 dark:bg-slate-850 rounded w-full" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : error && notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                                <AlertTriangle size={22} className="text-amber-500 mb-2" />
                                <p className="text-xs font-semibold" style={{ color: T.text }}>Unable to load notifications</p>
                                <button
                                    onClick={() => fetchNotifications(true)}
                                    className="mt-2 text-[11px] font-bold flex items-center gap-1 text-violet-600 dark:text-violet-400"
                                >
                                    <RefreshCw size={11} /> Retry
                                </button>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5"
                                    style={{ background: T.isDark ? "rgba(255,255,255,0.04)" : "#f1f5f9" }}
                                >
                                    <Inbox size={18} style={{ color: T.textFaint }} />
                                </div>
                                <p className="text-xs font-bold" style={{ color: T.text }}>You're all caught up</p>
                                <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                                    Recent call evaluations and workspace actions will appear here.
                                </p>
                            </div>
                        ) : (
                            notifications.map(n => {
                                const typeCfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.SYSTEM_EVENT;
                                const IconComp = typeCfg.icon;
                                const iconColor = T.isDark ? typeCfg.color : typeCfg.lightColor;
                                const link = getNotificationLink(n);

                                const ItemContent = (
                                    <div
                                        onClick={() => {
                                            handleMarkAsRead(n);
                                            if (link) setOpen(false);
                                        }}
                                        className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-200 text-left hover:opacity-90"
                                        style={{
                                            background: !n.read
                                                ? (T.isDark ? "rgba(139,92,246,0.08)" : "rgba(124,58,237,0.04)")
                                                : "transparent",
                                            opacity: n.read ? 0.75 : 1
                                        }}
                                    >
                                        {/* Type Icon */}
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                            style={{
                                                background: `${iconColor}15`,
                                                border: `1px solid ${iconColor}30`
                                            }}
                                        >
                                            <IconComp size={14} style={{ color: iconColor }} />
                                        </div>

                                        {/* Text Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1.5">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <p
                                                        className="text-xs font-bold truncate"
                                                        style={{ color: n.read ? T.textMuted : T.text }}
                                                    >
                                                        {n.title}
                                                    </p>
                                                    {!n.read && (
                                                        <span
                                                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                            style={{ background: iconColor }}
                                                        />
                                                    )}
                                                </div>
                                                <span className="text-[10px] flex-shrink-0" style={{ color: T.textFaint }}>
                                                    {n.timeAgo}
                                                </span>
                                            </div>

                                            <p
                                                className="text-[11px] mt-0.5 leading-relaxed line-clamp-2"
                                                style={{ color: n.read ? T.textFaint : T.textMuted }}
                                            >
                                                {n.message}
                                            </p>
                                        </div>
                                    </div>
                                );

                                return link ? (
                                    <Link key={n.id} to={link} className="block">
                                        {ItemContent}
                                    </Link>
                                ) : (
                                    <div key={n.id}>
                                        {ItemContent}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Popover Footer */}
                    <div
                        className="px-4 py-2.5 flex items-center justify-between text-[11px]"
                        style={{
                            background: T.isDark ? "rgba(255,255,255,0.02)" : "#f8fafc",
                            borderTop: `1px solid ${T.divider}`
                        }}
                    >
                        <span className="font-medium" style={{ color: T.textFaint }}>
                            Workspace Intelligence
                        </span>
                        <Link
                            to={`/w/${companySlug || user?.companySlug || "default"}/history`}
                            onClick={() => setOpen(false)}
                            className="font-bold flex items-center gap-1 hover:underline text-violet-600 dark:text-violet-400"
                        >
                            View All Calls <ArrowRight size={10} />
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
