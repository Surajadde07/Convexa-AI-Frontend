import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sidebar, THEMES } from "../components/Sidebar.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import api, { getUser } from "../services/api.js";
import {
    CreditCard, ShieldCheck, Sparkles, CheckCircle2,
    Users, HardDrive, Download, ArrowUpRight, Check,
    AlertCircle, FileText, ArrowRight, Zap, Crown
} from "lucide-react";

export default function BillingSeatsPage() {
    const { currentTheme } = useTheme();
    const T = THEMES[currentTheme] || THEMES.dark;
    const { currentWorkspace } = useWorkspace();
    const user = getUser();

    const [collapsed, setCollapsed] = useState(false);
    const [membersData, setMembersData] = useState(null);
    const [toast, setToast] = useState(null);

    const companySlug = user?.companySlug || currentWorkspace?.company?.slug || "default";

    useEffect(() => {
        const fetchMembersData = async () => {
            try {
                const res = await api.get("/api/company/members");
                setMembersData(res.data || null);
            } catch (err) {
                console.error("Failed to load members data for billing:", err);
            }
        };
        fetchMembersData();
    }, []);

    const activeSeats = membersData?.currentSeatCount ?? user?.currentSeatCount ?? 1;
    const seatLimit = membersData?.seatLimit ?? user?.seatLimit ?? 25;
    const seatPct = Math.min(100, Math.round((activeSeats / seatLimit) * 100));

    const trialDaysLeft = user?.trialEndsAt ? Math.max(0, Math.ceil((new Date(user.trialEndsAt) - new Date()) / 86400000)) : 12;

    const invoices = [
        { id: "INV-2026-004", date: "Jul 1, 2026", plan: "Business Plan (Monthly)", amount: "$499.00", status: "Paid" },
        { id: "INV-2026-003", date: "Jun 1, 2026", plan: "Business Plan (Monthly)", amount: "$499.00", status: "Paid" },
        { id: "INV-2026-002", date: "May 1, 2026", plan: "Business Plan (Monthly)", amount: "$499.00", status: "Paid" },
        { id: "INV-2026-001", date: "Apr 1, 2026", plan: "Trial Activation ($0)", amount: "$0.00", status: "Paid" },
    ];

    const plans = [
        { name: "Starter", price: "$99", seats: "5 Seats", storage: "10 GB", current: false },
        { name: "Growth", price: "$249", seats: "15 Seats", storage: "25 GB", current: false },
        { name: "Business", price: "$499", seats: "25 Seats", storage: "50 GB", current: true },
        { name: "Enterprise", price: "$999+", seats: "Unlimited Seats", storage: "500 GB+", current: false },
    ];

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: T.pageBg }}>
            <Sidebar
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                T={T}
                user={user}
                currentPath="/company/billing"
                totalCalls={0}
            />

            <div className="flex-1 overflow-y-auto min-w-0">
                <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                                    <Crown size={11} className="text-violet-300" /> Owner Exclusive Portal
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                                <CreditCard className="text-violet-400" /> Billing, Seats & Quotas
                            </h1>
                            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                                Manage enterprise subscription, seat capacity guardrails, storage quotas, and billing receipts.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button onClick={() => setToast("Seat expansion portal opened.")}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg hover:brightness-110 flex items-center gap-1.5"
                                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                                <Sparkles size={14} /> Add Seats & Storage
                            </button>
                        </div>
                    </div>

                    {toast && (
                        <div className="p-3 rounded-xl bg-violet-500/15 border border-violet-500/30 text-xs font-bold text-violet-300 flex items-center justify-between">
                            <span>{toast}</span>
                            <button onClick={() => setToast(null)} className="text-white hover:text-slate-300">✕</button>
                        </div>
                    )}

                    {/* Current Plan & Quota Hero Card */}
                    <div className="p-6 rounded-2xl border relative overflow-hidden"
                        style={{
                            background: "linear-gradient(145deg, rgba(124,58,237,0.14) 0%, rgba(37,99,235,0.08) 100%)",
                            borderColor: "rgba(139,92,246,0.3)"
                        }}>
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        {user?.subscriptionStatus === "TRIALING" ? "Business Trial Active" : "Business Plan"}
                                    </span>
                                    <span className="text-xs text-slate-400 font-semibold">{trialDaysLeft} days remaining</span>
                                </div>
                                <h2 className="text-2xl font-black text-white">Enterprise Business Plan</h2>
                                <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                                    Includes AI Whisper transcription, custom scorecards, unlimited team calls, role-based access control, and dedicated SLA support.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center min-w-[120px]">
                                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Seats Used</span>
                                    <span className="text-xl font-black text-white">{activeSeats} / {seatLimit}</span>
                                </div>
                                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center min-w-[120px]">
                                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Storage Used</span>
                                    <span className="text-xl font-black text-white">4.2 / 50 GB</span>
                                </div>
                            </div>
                        </div>

                        {/* Capacity Meters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                            <div>
                                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                                    <span className="text-violet-300 flex items-center gap-1.5">
                                        <Users size={14} /> Seat Capacity Meter
                                    </span>
                                    <span className="text-white">{seatPct}% Occupied ({activeSeats} of {seatLimit})</span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                    <div className="bg-gradient-to-r from-violet-500 to-blue-500 h-full rounded-full" style={{ width: `${seatPct}%` }} />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                                    <span className="text-emerald-300 flex items-center gap-1.5">
                                        <HardDrive size={14} /> Storage Meter
                                    </span>
                                    <span className="text-white">8.4% Occupied (4.2 GB of 50 GB)</span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                    <div className="bg-emerald-400 h-full rounded-full" style={{ width: "8.4%" }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Subscription Plans Grid */}
                    <div className="space-y-4">
                        <h3 className="text-base font-black text-white flex items-center gap-2">
                            <Sparkles className="text-violet-400" size={16} /> Available Enterprise Plans
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {plans.map((p, idx) => (
                                <div key={idx} className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${p.current ? "bg-violet-500/10 border-violet-500/40 shadow-xl" : "bg-white/5 border-white/10"}`}>
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-extrabold text-white">{p.name}</h4>
                                            {p.current && (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase">
                                                    Current Plan
                                                </span>
                                            )}
                                        </div>
                                        <div className="my-3">
                                            <span className="text-2xl font-black text-white">{p.price}</span>
                                            <span className="text-xs text-slate-400 font-medium"> / month</span>
                                        </div>
                                        <ul className="space-y-2 text-xs text-slate-300 my-4">
                                            <li className="flex items-center gap-2">
                                                <Check size={13} className="text-emerald-400" /> {p.seats}
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check size={13} className="text-emerald-400" /> {p.storage} Cloud Audio
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check size={13} className="text-emerald-400" /> AI Insights Engine
                                            </li>
                                        </ul>
                                    </div>

                                    <button onClick={() => setToast(`Plan switch requested for ${p.name}`)}
                                        className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${p.current ? "bg-white/10 text-white cursor-default" : "bg-violet-600 text-white hover:bg-violet-500"}`}>
                                        {p.current ? "Active Plan" : "Upgrade Plan"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Invoice History & Payment Method */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Billing Receipts Table */}
                        <div className="lg:col-span-8 p-5 rounded-2xl border bg-white/5 border-white/10 space-y-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <FileText size={16} className="text-blue-400" /> Billing History & PDF Invoices
                            </h3>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                            <th className="pb-3">Invoice ID</th>
                                            <th className="pb-3">Date</th>
                                            <th className="pb-3">Description</th>
                                            <th className="pb-3">Amount</th>
                                            <th className="pb-3">Status</th>
                                            <th className="pb-3 text-right">Receipt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {invoices.map(inv => (
                                            <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3 font-bold text-white">{inv.id}</td>
                                                <td className="py-3 text-slate-400">{inv.date}</td>
                                                <td className="py-3 text-slate-300">{inv.plan}</td>
                                                <td className="py-3 font-bold text-white">{inv.amount}</td>
                                                <td className="py-3">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300">
                                                        {inv.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <button onClick={() => setToast(`Downloaded ${inv.id}.pdf`)}
                                                        className="px-2 py-1 rounded bg-white/10 text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1 text-[10px] font-bold">
                                                        <Download size={10} /> PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Payment Method Details */}
                        <div className="lg:col-span-4 p-5 rounded-2xl border bg-white/5 border-white/10 flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                                    <CreditCard size={16} className="text-emerald-400" /> Payment Method & Contacts
                                </h3>

                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-white">Visa ending in 4242</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Default</span>
                                    </div>
                                    <p className="text-slate-400 text-[11px]">Expires 12/2028 · Auto-renewal active</p>
                                    <div className="pt-2 border-t border-white/10 text-[11px] space-y-1">
                                        <p className="text-slate-400">Billing Email: <span className="text-white font-medium">{user?.email || "owner@company.com"}</span></p>
                                        <p className="text-slate-400">VAT / Tax ID: <span className="text-white font-medium">US942048123</span></p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/10 mt-4">
                                <button onClick={() => setToast("Update payment modal opened.")}
                                    className="w-full py-2 rounded-xl text-xs font-bold bg-white/10 text-white hover:bg-white/15 transition-all">
                                    Update Payment Method
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
