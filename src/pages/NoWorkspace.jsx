import { useNavigate } from "react-router-dom";
import { clearSession } from "../services/api";
import { googleSignOut } from "../services/googleAuth";
import logo from "../assets/CONVEXA_AI_logo.png";
import { Building2, LogOut, ArrowLeft, ShieldOff, Mail } from "lucide-react";

/**
 * NoWorkspace — shown when a user authenticates successfully but their
 * account is not associated with any workspace (company_id = null).
 *
 * This is Model A (Company-First) behaviour:
 *   - The user's identity exists and is valid.
 *   - Their workspace access has been revoked by the organization.
 *   - They must be re-invited by an OWNER/ADMIN to regain access.
 *
 * Design mirrors mature B2B SaaS products (Slack, Linear, HubSpot).
 */
export default function NoWorkspace() {
    const navigate = useNavigate();

    const handleSignOut = () => {
        googleSignOut();
        clearSession();
        sessionStorage.clear();
        // Overwrite history so Back doesn't reach a protected page
        for (let i = 0; i < 5; i++) window.history.pushState(null, "", "/");
        window.location.replace("/");
    };

    const handleBackToLogin = () => {
        clearSession();
        navigate("/login", { replace: true });
    };

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-6"
            style={{
                background: "linear-gradient(160deg, #05060A 0%, #0B1020 45%, #070912 100%)",
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
            }}
        >
            {/* Background glow accents */}
            <div
                className="fixed pointer-events-none"
                style={{
                    top: "10%", left: "50%", transform: "translateX(-50%)",
                    width: 600, height: 600,
                    background: "radial-gradient(ellipse at center, rgba(139,92,246,0.06) 0%, transparent 70%)",
                }}
            />

            {/* Card */}
            <div
                className="w-full max-w-md relative rounded-3xl overflow-hidden"
                style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    backdropFilter: "blur(20px)",
                }}
            >
                {/* Top accent bar */}
                <div
                    style={{
                        height: 3,
                        background: "linear-gradient(90deg, #7c3aed, #4f46e5, #7c3aed)",
                    }}
                />

                <div className="p-8 sm:p-10">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5 mb-8">
                        <img src={logo} alt="Convexa AI" style={{ height: 28, width: "auto", objectFit: "contain" }} />
                        <span
                            className="font-black tracking-tight"
                            style={{ fontSize: 15, color: "#f8fafc" }}
                        >
                            Convexa AI
                        </span>
                    </div>

                    {/* Icon */}
                    <div
                        className="mx-auto mb-6 w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{
                            background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.1))",
                            border: "1px solid rgba(139,92,246,0.25)",
                        }}
                    >
                        <ShieldOff size={28} className="text-violet-400" />
                    </div>

                    {/* Headline */}
                    <h1
                        className="text-xl font-black text-white mb-3 leading-tight"
                    >
                        You are no longer part of a workspace
                    </h1>

                    {/* Description */}
                    <p
                        className="text-sm leading-relaxed mb-6"
                        style={{ color: "#94a3b8" }}
                    >
                        Your account is currently not associated with any company workspace.
                        Please contact your company administrator if you believe this is a
                        mistake, or request a new invitation.
                    </p>

                    {/* Info box */}
                    <div
                        className="rounded-2xl p-4 mb-6 space-y-3"
                        style={{
                            background: "rgba(139,92,246,0.05)",
                            border: "1px solid rgba(139,92,246,0.15)",
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <Building2 size={15} className="text-violet-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
                                <span className="text-white font-semibold">Company-controlled access.</span>{" "}
                                Workspace membership is managed by your organization's administrator.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <Mail size={15} className="text-violet-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
                                <span className="text-white font-semibold">Re-invitation restores access.</span>{" "}
                                Your existing account will be reused if you are invited again — no new password needed.
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={handleBackToLogin}
                            className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl transition-all cursor-pointer"
                            style={{
                                background: "rgba(139,92,246,0.12)",
                                border: "1px solid rgba(139,92,246,0.3)",
                                color: "#c4b5fd",
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = "rgba(139,92,246,0.2)";
                                e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)";
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = "rgba(139,92,246,0.12)";
                                e.currentTarget.style.borderColor = "rgba(139,92,246,0.3)";
                            }}
                        >
                            <ArrowLeft size={15} /> Back to Login
                        </button>

                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl transition-all cursor-pointer"
                            style={{
                                background: "rgba(239,68,68,0.06)",
                                border: "1px solid rgba(239,68,68,0.15)",
                                color: "#f87171",
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = "rgba(239,68,68,0.12)";
                                e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = "rgba(239,68,68,0.06)";
                                e.currentTarget.style.borderColor = "rgba(239,68,68,0.15)";
                            }}
                        >
                            <LogOut size={15} /> Sign Out
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <p className="mt-8 text-xs" style={{ color: "#334155" }}>
                © {new Date().getFullYear()} Convexa AI — All rights reserved
            </p>
        </div>
    );
}
