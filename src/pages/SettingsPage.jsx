import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { getUser, clearSession } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import logo from "../assets/CONVEXA_AI_logo.png";
import { Sidebar, THEMES } from "../components/Sidebar.jsx";
import {
    Settings as SettingsIcon, User, Lock, Bell, Palette, SlidersHorizontal,
    ShieldCheck, AlertTriangle, Menu, Sun, Moon, Check, X, Eye, EyeOff,
    Download, LayoutDashboard, LineChart, Save, Trash2, Info,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────── *
 * Settings.                                                              *
 * Real: profile identity (from getUser()), theme (same convexa_theme key *
 * every other page reads — changing it here changes it everywhere).      *
 * Local-only, flagged: notifications, default landing page, export       *
 * format, privacy toggle — persisted to localStorage under                *
 * convexa_settings_{userId} until dedicated endpoints exist.             *
 * Assumed endpoints (standard REST, not yet confirmed against your       *
 * backend — check before wiring): POST /api/auth/change-password,        *
 * DELETE /api/auth/account. Both fail gracefully with a clear toast if   *
 * the route doesn't exist yet.                                          *
 * ────────────────────────────────────────────────────────────────────── */

const TABS = [
    { id: "profile", label: "Profile", Icon: User },
    { id: "security", label: "Security", Icon: Lock },
    { id: "notifications", label: "Notifications", Icon: Bell },
    { id: "appearance", label: "Appearance", Icon: Palette },
    { id: "preferences", label: "Preferences", Icon: SlidersHorizontal },
    { id: "privacy", label: "Privacy", Icon: ShieldCheck },
    { id: "danger", label: "Danger Zone", Icon: AlertTriangle },
];

function settingsKey(user) { return `convexa_settings_${user?.id ?? "anon"}`; }
function loadSettings(user) {
    try { return { notifCallReady: true, notifWeeklyDigest: true, notifNeedsAttention: true, defaultLanding: "/dashboard", exportFormat: "csv", shareAnonymizedData: false, ...JSON.parse(localStorage.getItem(settingsKey(user)) || "{}") }; }
    catch { return { notifCallReady: true, notifWeeklyDigest: true, notifNeedsAttention: true, defaultLanding: "/dashboard", exportFormat: "csv", shareAnonymizedData: false }; }
}

function SectionLabel({ icon: Icon, children, tone = "#8b5cf6" }) {
    return (
        <div className="flex items-center gap-2">
            {Icon && <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${tone}1c`, border: `1px solid ${tone}35` }}><Icon size={11} style={{ color: tone }} strokeWidth={2.5} /></div>}
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: tone }}>{children}</span>
        </div>
    );
}
function Panel({ children, className = "", style = {}, T }) {
    return <div className={`rounded-2xl p-5 sm:p-6 ${className}`} style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, ...style }}>{children}</div>;
}
function Toggle({ checked, onChange, T }) {
    return (
        <button onClick={() => onChange(!checked)} className="w-10 h-5.5 rounded-full relative transition-colors flex-shrink-0" style={{ background: checked ? "#8b5cf6" : T.panelHover, border: `1px solid ${checked ? "#8b5cf6" : T.panelBorder}`, height: 22, width: 40 }}>
            <span className="absolute top-0.5 rounded-full bg-white transition-all" style={{ width: 16, height: 16, left: checked ? 20 : 3 }} />
        </button>
    );
}
function Field({ label, children, T }) {
    return <div><label className="text-xs font-semibold mb-1.5 block" style={{ color: T.textMuted }}>{label}</label>{children}</div>;
}
function inputStyle(T) { return { background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }; }
function Toast({ message, type, onDismiss }) {
    useEffect(() => { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t); }, [onDismiss]);
    const ok = type === "success";
    return (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${ok ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`, color: ok ? "#34d399" : "#f87171", backdropFilter: "blur(20px)", animation: "slideUp 0.25s ease-out" }}>
            {ok ? <Check size={15} /> : <X size={15} />} {message}
        </div>
    );
}

export default function SettingsPage() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [themeMode, setThemeMode] = useState(() => localStorage.getItem("convexa_theme") || "dark");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [tab, setTab] = useState("profile");
    const [toast, setToast] = useState(null);

    const user = getUser();
    const T = THEMES[themeMode];
    const location = useLocation();
    const navigate = useNavigate();

    const [settings, setSettings] = useState(() => loadSettings(user));
    const [name, setName] = useState(user?.name ?? "");
    const [email, setEmail] = useState(user?.email ?? "");

    const [pwCurrent, setPwCurrent] = useState("");
    const [pwNew, setPwNew] = useState("");
    const [pwConfirm, setPwConfirm] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [pwSaving, setPwSaving] = useState(false);

    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);

    useEffect(() => { document.documentElement.style.colorScheme = themeMode; localStorage.setItem("convexa_theme", themeMode); }, [themeMode]);
    useEffect(() => { localStorage.setItem(settingsKey(user), JSON.stringify(settings)); }, [settings]);

    const handleLogout = () => logoutAndRedirect();
    const patchSetting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

    const handleSaveProfile = async () => {
        try {
            // Assumed: PATCH /api/users/me — adjust to your real profile endpoint.
            await api.patch("/api/users/me", { name, email });
            setToast({ message: "Profile updated.", type: "success" });
        } catch (err) {
            console.error(err);
            setToast({ message: "Couldn't save profile — endpoint may not exist yet.", type: "error" });
        }
    };

    const handleChangePassword = async () => {
        if (!pwCurrent || !pwNew) { setToast({ message: "Fill in both password fields.", type: "error" }); return; }
        if (pwNew !== pwConfirm) { setToast({ message: "New passwords don't match.", type: "error" }); return; }
        if (pwNew.length < 8) { setToast({ message: "New password must be at least 8 characters.", type: "error" }); return; }
        setPwSaving(true);
        try {
            await api.post("/api/auth/change-password", { currentPassword: pwCurrent, newPassword: pwNew });
            setToast({ message: "Password changed successfully.", type: "success" });
            setPwCurrent(""); setPwNew(""); setPwConfirm("");
        } catch (err) {
            console.error(err);
            setToast({ message: err.response?.data?.message || "Couldn't change password — check your current password.", type: "error" });
        } finally { setPwSaving(false); }
    };

    const handleExportAllData = () => {
        const blob = new Blob([JSON.stringify({ user, settings }, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `convexa-account-export-${Date.now()}.json`; a.click();
        URL.revokeObjectURL(url);
        setToast({ message: "Account data exported.", type: "success" });
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== "DELETE") return;
        setDeleting(true);
        try {
            await api.delete("/api/auth/account");
            clearSession();
            navigate("/login");
        } catch (err) {
            console.error(err);
            setToast({ message: "Couldn't delete account — endpoint may not exist yet.", type: "error" });
            setDeleting(false);
        }
    };

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>
            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={user}
                handleLogout={handleLogout} currentPath={location.pathname} needsAttentionCount={0} totalCalls={0} />

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="sticky top-0 z-30" style={{ background: T.headerBg, borderBottom: `1px solid ${T.divider}`, backdropFilter: "blur(20px)" }}>
                    <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
                        <div className="md:hidden flex items-center gap-2 flex-shrink-0"><img src={logo} alt="Convexa AI" className="h-6 w-auto" /></div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.28)" }}><SettingsIcon size={15} style={{ color: "#a78bfa" }} /></div>
                            <div><p className="text-sm font-bold" style={{ color: T.text }}>Settings</p><p className="text-[10px]" style={{ color: T.textFaint }}>Manage your account</p></div>
                        </div>
                        <div className="flex-1" />
                        <button onClick={() => setThemeMode(m => m === "dark" ? "light" : "dark")} className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}>{themeMode === "dark" ? <Sun size={14} style={{ color: T.textMuted }} /> : <Moon size={14} style={{ color: T.textMuted }} />}</button>
                        <button onClick={() => setMobileMenuOpen(o => !o)} className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: T.panelHover, border: `1px solid ${T.panelBorder}` }}><Menu size={16} style={{ color: T.textMuted }} /></button>
                    </div>
                </header>

                <main className="flex-1 px-4 sm:px-6 py-6 max-w-5xl w-full mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
                        {/* ── Tab rail ── */}
                        <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                            {TABS.map(t => (
                                <button key={t.id} onClick={() => setTab(t.id)}
                                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
                                    style={tab === t.id ? { background: "rgba(139,92,246,0.14)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" } : { color: T.textMuted, border: "1px solid transparent" }}>
                                    <t.Icon size={14} /> {t.label}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-5 min-w-0">
                            {/* ── Profile ── */}
                            {tab === "profile" && (
                                <Panel T={T}>
                                    <SectionLabel icon={User} tone="#8b5cf6">Profile</SectionLabel>
                                    <div className="mt-5 space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-white flex-shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>{name?.[0]?.toUpperCase() ?? "U"}</div>
                                            <div><p className="text-sm font-bold" style={{ color: T.text }}>{name || "User"}</p><p className="text-xs" style={{ color: T.textFaint }}>{email}</p></div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Field T={T} label="Full name"><input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle(T)} /></Field>
                                            <Field T={T} label="Email address"><input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle(T)} /></Field>
                                        </div>
                                        <button onClick={handleSaveProfile} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl text-white" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}><Save size={13} /> Save Changes</button>
                                    </div>
                                </Panel>
                            )}

                            {/* ── Security ── */}
                            {tab === "security" && (
                                <Panel T={T}>
                                    <SectionLabel icon={Lock} tone="#8b5cf6">Change Password</SectionLabel>
                                    <div className="mt-5 space-y-4 max-w-md">
                                        <Field T={T} label="Current password"><input type={showPw ? "text" : "password"} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle(T)} /></Field>
                                        <Field T={T} label="New password"><input type={showPw ? "text" : "password"} value={pwNew} onChange={e => setPwNew(e.target.value)} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle(T)} /></Field>
                                        <Field T={T} label="Confirm new password"><input type={showPw ? "text" : "password"} value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={inputStyle(T)} /></Field>
                                        <button onClick={() => setShowPw(s => !s)} className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: T.textFaint }}>{showPw ? <EyeOff size={12} /> : <Eye size={12} />} {showPw ? "Hide" : "Show"} passwords</button>
                                        <button onClick={handleChangePassword} disabled={pwSaving} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                                            <Lock size={13} /> {pwSaving ? "Updating…" : "Update Password"}
                                        </button>
                                    </div>
                                </Panel>
                            )}

                            {/* ── Notifications ── */}
                            {tab === "notifications" && (
                                <Panel T={T}>
                                    <SectionLabel icon={Bell} tone="#8b5cf6">Notifications</SectionLabel>
                                    <div className="mt-5 space-y-1">
                                        {[
                                            { key: "notifCallReady", title: "Call analysis ready", sub: "Get notified when a new upload finishes processing." },
                                            { key: "notifNeedsAttention", title: "Needs-attention alerts", sub: "Get notified when a call is flagged for review." },
                                            { key: "notifWeeklyDigest", title: "Weekly digest", sub: "A weekly summary of your scores and coaching plan." },
                                        ].map(row => (
                                            <div key={row.key} className="flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${T.divider}` }}>
                                                <div><p className="text-xs font-semibold" style={{ color: T.text }}>{row.title}</p><p className="text-[11px] mt-0.5" style={{ color: T.textFaint }}>{row.sub}</p></div>
                                                <Toggle T={T} checked={settings[row.key]} onChange={v => patchSetting(row.key, v)} />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] mt-4 flex items-center gap-1.5" style={{ color: T.textFaint }}><Info size={11} /> Saved to this device for now — server-side delivery needs a notifications endpoint.</p>
                                </Panel>
                            )}

                            {/* ── Appearance ── */}
                            {tab === "appearance" && (
                                <Panel T={T}>
                                    <SectionLabel icon={Palette} tone="#8b5cf6">Theme</SectionLabel>
                                    <div className="mt-5 grid grid-cols-2 gap-4 max-w-md">
                                        {["dark", "light"].map(mode => (
                                            <button key={mode} onClick={() => setThemeMode(mode)}
                                                className="rounded-2xl p-4 text-left transition-all"
                                                style={{ background: mode === "dark" ? "#0b0e18" : "#f4f5fb", border: `2px solid ${themeMode === mode ? "#8b5cf6" : T.panelBorder}` }}>
                                                <div className="flex items-center justify-between mb-3">
                                                    {mode === "dark" ? <Moon size={16} className="text-slate-300" /> : <Sun size={16} className="text-amber-500" />}
                                                    {themeMode === mode && <Check size={14} style={{ color: "#8b5cf6" }} />}
                                                </div>
                                                <p className="text-xs font-bold capitalize" style={{ color: mode === "dark" ? "#f8fafc" : "#0f172a" }}>{mode}</p>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] mt-4" style={{ color: T.textFaint }}>Applies instantly across Dashboard, Analytics, Library, Insights and Scorecards.</p>
                                </Panel>
                            )}

                            {/* ── Preferences ── */}
                            {tab === "preferences" && (
                                <div className="space-y-5">
                                    <Panel T={T}>
                                        <SectionLabel icon={LayoutDashboard} tone="#8b5cf6">Default Landing Page</SectionLabel>
                                        <p className="text-[11px] mt-1 mb-4" style={{ color: T.textFaint }}>Where you land right after signing in.</p>
                                        <div className="grid grid-cols-2 gap-3 max-w-md">
                                            {[{ id: "/dashboard", label: "Dashboard", Icon: LayoutDashboard }, { id: "/analytics", label: "Analytics", Icon: LineChart }].map(opt => (
                                                <button key={opt.id} onClick={() => patchSetting("defaultLanding", opt.id)}
                                                    className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all"
                                                    style={settings.defaultLanding === opt.id ? { background: "rgba(139,92,246,0.14)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.35)" } : { background: T.panelHover, color: T.textMuted, border: `1px solid ${T.panelBorder}` }}>
                                                    <opt.Icon size={13} /> {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </Panel>
                                    <Panel T={T}>
                                        <SectionLabel icon={Download} tone="#8b5cf6">Export Preferences</SectionLabel>
                                        <p className="text-[11px] mt-1 mb-4" style={{ color: T.textFaint }}>Default format used across Library and Scorecards exports.</p>
                                        <div className="flex gap-3">
                                            {["csv", "json"].map(fmt => (
                                                <button key={fmt} onClick={() => patchSetting("exportFormat", fmt)}
                                                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all"
                                                    style={settings.exportFormat === fmt ? { background: "rgba(139,92,246,0.14)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.35)" } : { background: T.panelHover, color: T.textMuted, border: `1px solid ${T.panelBorder}` }}>
                                                    {fmt}
                                                </button>
                                            ))}
                                        </div>
                                    </Panel>
                                </div>
                            )}

                            {/* ── Privacy ── */}
                            {tab === "privacy" && (
                                <Panel T={T}>
                                    <SectionLabel icon={ShieldCheck} tone="#8b5cf6">Privacy</SectionLabel>
                                    <div className="mt-5 flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${T.divider}` }}>
                                        <div><p className="text-xs font-semibold" style={{ color: T.text }}>Share anonymized data to improve AI models</p><p className="text-[11px] mt-0.5 max-w-md" style={{ color: T.textFaint }}>Your transcripts are never shared with your name or account attached. Off by default.</p></div>
                                        <Toggle T={T} checked={settings.shareAnonymizedData} onChange={v => patchSetting("shareAnonymizedData", v)} />
                                    </div>
                                    <button onClick={handleExportAllData} className="mt-4 flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl" style={{ background: T.panelHover, color: T.text }}><Download size={13} /> Export My Account Data</button>
                                </Panel>
                            )}

                            {/* ── Danger Zone ── */}
                            {tab === "danger" && (
                                <Panel T={T} style={{ background: "rgba(239,68,68,0.035)", borderColor: "rgba(239,68,68,0.25)" }}>
                                    <SectionLabel icon={AlertTriangle} tone="#ef4444">Danger Zone</SectionLabel>
                                    <p className="text-xs mt-3 mb-4" style={{ color: T.textMuted }}>Deleting your account permanently removes all calls, scorecards, and coaching history. This cannot be undone.</p>
                                    <div className="max-w-sm space-y-3">
                                        <Field T={T} label='Type "DELETE" to confirm'><input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={{ ...inputStyle(T), borderColor: "rgba(239,68,68,0.3)" }} /></Field>
                                        <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== "DELETE" || deleting}
                                            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                            style={{ background: "#dc2626" }}>
                                            <Trash2 size={13} /> {deleting ? "Deleting…" : "Permanently Delete Account"}
                                        </button>
                                    </div>
                                </Panel>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <style>{`@keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        </div>
    );
}
