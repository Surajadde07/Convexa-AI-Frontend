import { useEffect, useState, useRef } from "react";
import api, { getUser } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import { Sidebar } from "../components/Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import {
    Building2, SlidersHorizontal, Sun, Moon, Menu, X, Save, Check, Upload, Trash2, Image
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
            <label className="text-xs font-semibold mb-1.5 block animate-fade-in" style={{ color: T.textMuted }}>{label}</label>
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

export default function CompanySettings() {
    const { themeMode, toggleTheme, T } = useTheme();
    
    // Reactive userState so sidebar updates immediately
    const [userState, setUserState] = useState(getUser());
    const handleLogout = () => logoutAndRedirect();

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const [companyName, setCompanyName] = useState("");
    const [industry, setIndustry] = useState("");
    const [website, setWebsite] = useState("");
    const [companySize, setCompanySize] = useState("");
    const [companyLogo, setCompanyLogo] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const fileInputRef = useRef(null);

    // Permission Matrix: Only OWNER and ADMIN can edit. MANAGER and USER are read-only.
    const hasEditPermission = userState?.role === "OWNER" || userState?.role === "ADMIN";

    useEffect(() => {
        async function fetchCompany() {
            try {
                const res = await api.get("/api/company/profile");
                setCompanyName(res.data.companyName || "");
                setIndustry(res.data.industry || "");
                setWebsite(res.data.website || "");
                setCompanySize(res.data.companySize || "");
                setCompanyLogo(res.data.companyLogo || "");
            } catch (err) {
                console.error("Failed to load company profile", err);
                setError("Failed to load company profile.");
            } finally {
                setLoading(false);
            }
        }
        fetchCompany();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!hasEditPermission) return;
        setSaving(true);
        setError("");
        setSuccess(false);
        try {
            await api.patch("/api/company/profile", {
                companyName,
                industry,
                website,
                companySize,
                companyLogo
            });

            // Update userState and localStorage so the changes propagate immediately
            const raw = localStorage.getItem("convexa_user");
            if (raw) {
                const u = JSON.parse(raw);
                u.companyName = companyName;
                u.companyLogo = companyLogo ? companyLogo : null;
                localStorage.setItem("convexa_user", JSON.stringify(u));
                setUserState(u);
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error("Failed to update company profile", err);
            setError(err.response?.data?.error || "Failed to update company profile.");
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 1. Validate file type: PNG, JPG, JPEG, WEBP
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
        if (!allowedTypes.includes(file.type.toLowerCase())) {
            setError("Invalid file type. Only PNG, JPG, JPEG, and WEBP are allowed.");
            return;
        }

        // 2. Validate file size: Maximum 5 MB
        if (file.size > 5 * 1024 * 1024) {
            setError("File size exceeds the maximum limit of 5 MB.");
            return;
        }

        setUploading(true);
        setError("");
        setSuccess(false);

        try {
            const formData = new FormData();
            formData.append("logo", file);

            const res = await api.post("/api/company/logo", formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });

            const newLogoUrl = res.data.companyLogo;
            setCompanyLogo(newLogoUrl || "");

            // Sync userState and localStorage
            const raw = localStorage.getItem("convexa_user");
            if (raw) {
                const u = JSON.parse(raw);
                u.companyLogo = newLogoUrl;
                localStorage.setItem("convexa_user", JSON.stringify(u));
                setUserState(u);
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error("Failed to upload logo", err);
            setError(err.response?.data?.error || "Failed to upload logo.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleRemoveLogo = async () => {
        if (!window.confirm("Are you sure you want to remove the company logo?")) return;

        setSaving(true);
        setError("");
        setSuccess(false);

        try {
            await api.patch("/api/company/profile", {
                companyName,
                industry,
                website,
                companySize,
                companyLogo: "" // blank value clears it on backend
            });

            setCompanyLogo("");

            // Sync userState and localStorage
            const raw = localStorage.getItem("convexa_user");
            if (raw) {
                const u = JSON.parse(raw);
                u.companyLogo = null;
                localStorage.setItem("convexa_user", JSON.stringify(u));
                setUserState(u);
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error("Failed to remove logo", err);
            setError(err.response?.data?.error || "Failed to remove company logo.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>
            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={userState}
                handleLogout={handleLogout} currentPath="/company/settings" needsAttentionCount={0} totalCalls={0} />

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

                <main className="flex-1 min-w-0 px-4 sm:px-6 py-7 space-y-6 max-w-4xl">
                    <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.textFaint }}>
                        <span>Company Settings</span>
                    </div>

                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h1 className="text-xl font-black text-white">Company Settings</h1>
                            <p className="text-xs mt-1" style={{ color: T.textMuted }}>Manage your organization's metadata, logo, and website details.</p>
                        </div>
                    </div>

                    {!hasEditPermission && (
                        <div className="p-3.5 text-xs font-bold rounded-xl border flex items-center gap-2.5"
                             style={{ background: "rgba(148,163,184,0.06)", borderColor: "rgba(148,163,184,0.12)", color: "#94a3b8" }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                            <span>You are viewing these settings in read-only mode. Only owners and administrators can edit company settings.</span>
                        </div>
                    )}

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
                            <Check size={14} />
                            Company profile updated successfully!
                        </div>
                    )}

                    {loading ? (
                        <Panel T={T}>
                            <div className="space-y-4 animate-pulse">
                                <div className="h-6 bg-slate-700 rounded w-1/3" />
                                <div className="h-10 bg-slate-800 rounded w-full" />
                                <div className="h-10 bg-slate-800 rounded w-full" />
                            </div>
                        </Panel>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <Panel T={T} className="space-y-5">
                                <SectionLabel icon={Building2} tone="#8b5cf6">Organization Profile</SectionLabel>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Field label="Company Name" T={T}>
                                        <input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)}
                                            disabled={!hasEditPermission || saving || uploading}
                                            placeholder="e.g. Convexa Corp" className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={inputStyle(T)} />
                                    </Field>

                                    <Field label="Industry" T={T}>
                                        <select value={industry} onChange={e => setIndustry(e.target.value)}
                                            disabled={!hasEditPermission || saving || uploading}
                                            className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={inputStyle(T)}>
                                            <option value="">Select Industry</option>
                                            <option value="Technology">Technology / SaaS</option>
                                            <option value="Finance">Finance</option>
                                            <option value="Healthcare">Healthcare</option>
                                            <option value="Retail">Retail</option>
                                            <option value="Real Estate">Real Estate</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </Field>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Field label="Website URL" T={T}>
                                        <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                                            disabled={!hasEditPermission || saving || uploading}
                                            placeholder="https://example.com" className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={inputStyle(T)} />
                                    </Field>

                                    <Field label="Company Size" T={T}>
                                        <select value={companySize} onChange={e => setCompanySize(e.target.value)}
                                            disabled={!hasEditPermission || saving || uploading}
                                            className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={inputStyle(T)}>
                                            <option value="">Select Size</option>
                                            <option value="1-10">1-10 employees</option>
                                            <option value="11-50">11-50 employees</option>
                                            <option value="51-250">51-250 employees</option>
                                            <option value="251-1000">251-1000 employees</option>
                                            <option value="1000+">1000+ employees</option>
                                        </select>
                                    </Field>
                                </div>

                                <Field label="Company Logo" T={T}>
                                    <div className="flex gap-5 items-center flex-wrap sm:flex-nowrap mt-1.5">
                                        {/* Logo display area with fallback */}
                                        <div className="w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden flex-shrink-0 relative shadow-sm"
                                            style={{ background: T.inputBg, borderColor: T.panelBorder }}>
                                            {companyLogo ? (
                                                <img src={companyLogo} alt="Logo" className="w-full h-full object-contain" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center font-black text-white text-xl select-none"
                                                    style={{ background: "linear-gradient(135deg, #8b5cf6, #4f46e5)", boxShadow: "0 2px 8px rgba(139,92,246,0.15)" }}>
                                                    {companyName ? companyName[0].toUpperCase() : "C"}
                                                </div>
                                            )}
                                        </div>

                                        {/* Upload & Remove Logo Controls */}
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleLogoUpload}
                                                    accept="image/png, image/jpeg, image/jpg, image/webp"
                                                    className="hidden"
                                                    disabled={!hasEditPermission || uploading || saving}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={!hasEditPermission || uploading || saving}
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 rounded-xl transition-all cursor-pointer bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 disabled:cursor-not-allowed border border-slate-750"
                                                >
                                                    <Upload size={11} className={uploading ? "animate-bounce" : ""} />
                                                    {uploading ? "Uploading..." : "Upload Logo"}
                                                </button>

                                                {companyLogo && (
                                                    <button
                                                        type="button"
                                                        disabled={!hasEditPermission || uploading || saving}
                                                        onClick={handleRemoveLogo}
                                                        className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 rounded-xl transition-all cursor-pointer bg-red-950/20 hover:bg-red-950/40 text-red-400 disabled:opacity-40 disabled:cursor-not-allowed border border-red-900/20"
                                                    >
                                                        <Trash2 size={11} />
                                                        Remove Logo
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-[10px]" style={{ color: T.textFaint }}>
                                                Accepted formats: PNG, JPG, JPEG, WEBP. Maximum size: 5 MB.
                                            </p>
                                        </div>
                                    </div>
                                </Field>

                                {hasEditPermission && (
                                    <div className="flex justify-end pt-4" style={{ borderTop: `1px solid ${T.divider}` }}>
                                        <button type="submit" disabled={saving || uploading} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer bg-violet-600 hover:bg-violet-500 text-white shadow-lg disabled:opacity-50">
                                            <Save size={13} /> {saving ? "Saving Changes..." : "Save Settings"}
                                        </button>
                                    </div>
                                )}
                            </Panel>
                        </form>
                    )}
                </main>
            </div>
        </div>
    );
}
