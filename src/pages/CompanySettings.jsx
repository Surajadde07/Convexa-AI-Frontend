import { useEffect, useState } from "react";
import api, { getUser } from "../services/api.js";
import { logoutAndRedirect } from "../components/ProtectedRoute";
import { Sidebar } from "../components/Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import {
    Building2, SlidersHorizontal, Sun, Moon, Menu, X, Save, Check
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
    const user = getUser();
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
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

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
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error("Failed to update company profile", err);
            setError("Failed to update company profile.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex" style={{ background: T.pageBg, color: T.text, transition: "background 0.3s ease" }}>
            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} T={T} user={user}
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
                                            placeholder="e.g. Convexa Corp" className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none"
                                            style={inputStyle(T)} />
                                    </Field>

                                    <Field label="Industry" T={T}>
                                        <select value={industry} onChange={e => setIndustry(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none appearance-none"
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
                                            placeholder="https://example.com" className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none"
                                            style={inputStyle(T)} />
                                    </Field>

                                    <Field label="Company Size" T={T}>
                                        <select value={companySize} onChange={e => setCompanySize(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none appearance-none"
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

                                <Field label="Company Logo URL" T={T}>
                                    <div className="flex gap-4 items-center">
                                        <div className="w-12 h-12 rounded-xl border flex items-center justify-center text-slate-500 overflow-hidden flex-shrink-0"
                                            style={{ background: T.inputBg, borderColor: T.panelBorder }}>
                                            {companyLogo ? (
                                                <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                <Building2 size={16} />
                                            )}
                                        </div>
                                        <input type="text" value={companyLogo} onChange={e => setCompanyLogo(e.target.value)}
                                            placeholder="https://example.com/logo.png" className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none"
                                            style={inputStyle(T)} />
                                    </div>
                                </Field>

                                <div className="flex justify-end pt-4" style={{ borderTop: `1px solid ${T.divider}` }}>
                                    <button type="submit" disabled={saving} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer bg-violet-600 hover:bg-violet-500 text-white shadow-lg disabled:opacity-50">
                                        <Save size={13} /> {saving ? "Saving Changes..." : "Save Settings"}
                                    </button>
                                </div>
                            </Panel>
                        </form>
                    )}
                </main>
            </div>
        </div>
    );
}
