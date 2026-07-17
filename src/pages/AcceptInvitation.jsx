import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api.js";
import { useTheme } from "../context/ThemeContext.jsx";
import { THEMES } from "../components/Sidebar.jsx";
import {
    Building2, Lock, User, AlertCircle, ArrowRight, CheckCircle2,
    ShieldCheck, Sparkles, Zap, Award, BookOpen
} from "lucide-react";

export default function AcceptInvitation() {
    const { token } = useParams();
    const navigate = useNavigate();
    const { themeMode } = useTheme();
    const T = THEMES[themeMode] || THEMES.dark;

    const [inviteData, setInviteData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchInvite() {
            try {
                const res = await api.get(`/api/invitations/${token}`);
                setInviteData(res.data);
                if (res.data.userExists) {
                    setName(res.data.email); // Safe default fallback
                }
            } catch (err) {
                console.error("Failed to load invitation token", err);
                setError(err.response?.data?.error || "This invitation link is invalid or has expired.");
            } finally {
                setLoading(false);
            }
        }
        fetchInvite();
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess(false);

        if (!inviteData?.userExists) {
            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }
            if (password.length < 6) {
                setError("Password must be at least 6 characters.");
                return;
            }
        }

        setSubmitting(true);
        try {
            await api.post("/api/invitations/accept", {
                token,
                name: inviteData?.userExists ? inviteData.email : name,
                password: inviteData?.userExists ? "" : password
            });
            setSuccess(true);
        } catch (err) {
            console.error("Failed to accept invitation", err);
            setError(err.response?.data?.error || "Failed to complete onboarding.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: T.pageBg }}>
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-violet-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6" style={{ background: T.pageBg }}>
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden relative"
                 style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, backdropFilter: "blur(20px)" }}>
                
                {/* Glow Accent */}
                <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />

                {/* Left Side: Product Branding & Benefits */}
                <div className="p-8 sm:p-10 flex flex-col justify-between" style={{ borderRight: `1px solid ${T.divider}`, background: "rgba(255,255,255,0.01)" }}>
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl border flex items-center justify-center text-violet-400"
                                 style={{ background: T.inputBg, borderColor: T.panelBorder }}>
                                <Building2 size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white leading-none">{inviteData?.company?.companyName || "Organization"}</h3>
                                <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>{inviteData?.company?.website || "convexa.ai"}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-xl font-black text-white leading-tight">Welcome to your new workspace</h2>
                            <p className="text-xs leading-relaxed" style={{ color: T.textMuted }}>
                                You have been invited by <span className="text-white font-semibold">{inviteData?.invitedBy}</span> to join the team as a <span className="text-violet-400 font-semibold">{inviteData?.role}</span> in the <span className="text-white font-semibold">{inviteData?.department || "General"}</span> department.
                            </p>
                        </div>

                        <div className="space-y-3.5 pt-4">
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                                    <Sparkles size={12} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-white">AI Call Insights</h4>
                                    <p className="text-[10px]" style={{ color: T.textMuted }}>Understand key customer signals and resolution outcomes.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                                    <Zap size={12} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-white">Real-Time Whisper Guidance</h4>
                                    <p className="text-[10px]" style={{ color: T.textMuted }}>Get live whisper cards and guidance in your ear during calls.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                                    <BookOpen size={12} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-white">Targeted Playbooks & Learning</h4>
                                    <p className="text-[10px]" style={{ color: T.textMuted }}>Access assigned sales modules and structured review plans.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-[10px] mt-8 flex items-center gap-1.5" style={{ color: T.textFaint }}>
                        <ShieldCheck size={12} /> Secure Single-Tenant Architecture
                    </div>
                </div>

                {/* Right Side: Accept Form & Credentials */}
                <div className="p-8 sm:p-10 flex flex-col justify-center">
                    {error ? (
                        <div className="text-center py-6 space-y-4">
                            <div className="mx-auto w-12 h-12 rounded-full bg-red-950/20 border border-red-500/30 flex items-center justify-center text-red-400">
                                <AlertCircle size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Invalid Invitation</h2>
                                <p className="text-xs mt-1 px-4 leading-relaxed" style={{ color: T.textMuted }}>{error}</p>
                            </div>
                            <button onClick={() => navigate("/login")} className="text-xs font-bold text-violet-400 hover:text-violet-300 underline">
                                Go to Login
                            </button>
                        </div>
                    ) : success ? (
                        <div className="text-center py-6 space-y-4">
                            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                <CheckCircle2 size={22} className="animate-bounce" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">
                                    {inviteData?.userExists ? "Joined Workspace Successfully" : "Account Created Successfully"}
                                </h2>
                                <p className="text-xs mt-1" style={{ color: T.textMuted }}>Click below to sign into Convexa AI and enter your workspace.</p>
                            </div>
                            <button onClick={() => navigate("/login")}
                                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer bg-violet-600 hover:bg-violet-500 text-white shadow-lg">
                                Continue to Login <ArrowRight size={13} />
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <h2 className="text-lg font-bold text-white">Accept Workspace Invite</h2>
                                <p className="text-xs" style={{ color: T.textMuted }}>Enter details below to claim your account.</p>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: T.textMuted }}>Email Address</label>
                                <input type="email" disabled value={inviteData?.email} className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none cursor-not-allowed opacity-60"
                                    style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.textMuted }} />
                            </div>

                            {inviteData?.userExists ? (
                                <div className="p-4 rounded-xl border space-y-2" style={{ background: "rgba(16,185,129,0.05)", borderColor: "rgba(16,185,129,0.2)" }}>
                                    <p className="text-xs font-bold text-emerald-400">✔ You're already a Convexa user.</p>
                                    <p className="text-[11px] leading-relaxed" style={{ color: T.textMuted }}>
                                        This workspace will be added to your account.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: T.textMuted }}>Full Name</label>
                                        <div className="relative">
                                            <input type="text" required placeholder="Jane Doe" value={name} onChange={e => setName(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold outline-none"
                                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }} />
                                            <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: T.textMuted }}>Create Password</label>
                                        <div className="relative">
                                            <input type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold outline-none"
                                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }} />
                                            <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: T.textMuted }}>Confirm Password</label>
                                        <div className="relative">
                                            <input type="password" required placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-semibold outline-none"
                                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: T.text }} />
                                            <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        </div>
                                    </div>
                                </>
                            )}

                            <button type="submit" disabled={submitting}
                                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer bg-violet-600 hover:bg-violet-500 text-white shadow-lg disabled:opacity-50">
                                {inviteData?.userExists ? "Accept Invitation & Join Company" : "Accept Invitation & Create Account"} <ArrowRight size={13} />
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
