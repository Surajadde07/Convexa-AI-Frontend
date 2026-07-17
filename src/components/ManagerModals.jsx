import { useState } from "react";
import { X, Calendar, Clock, BookOpen, ShieldAlert, Award, FileText, CheckCircle2, Copy } from "lucide-react";
import api from "../services/api.js";

// Custom Toast/Notification Helper matching the theme
function showNotification(message, T) {
    const el = document.createElement("div");
    el.className = "fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border text-sm font-semibold transition-all duration-300 transform translate-y-10 opacity-0";
    el.style.background = "rgba(10,10,26,0.95)";
    el.style.borderColor = "rgba(139,92,246,0.3)";
    el.style.color = "#c4b5fd";
    el.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></span>
        <span>${message}</span>
    `;
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.transform = "translateY(0)";
        el.style.opacity = "1";
    }, 50);
    setTimeout(() => {
        el.style.transform = "translateY(10px)";
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

export function BaseModal({ open, onClose, title, T, children }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl border transition-all duration-300 animate-in fade-in zoom-in-95"
                 style={{ background: "rgba(15, 12, 38, 0.98)", borderColor: "rgba(255,255,255,0.09)", backdropFilter: "blur(20px)" }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-black tracking-tight text-white">{title}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
                            style={{ background: "rgba(255,255,255,0.05)" }}>
                        <X size={15} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

// 1. Schedule Coaching Modal
export function ScheduleCoachingModal({ open, onClose, employeeId, T, onSave }) {
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [reason, setReason] = useState("Call Review");
    const [priority, setPriority] = useState("Medium");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post(`/api/company/employee/${employeeId}/coaching`, {
                sessionDate: date,
                sessionTime: time,
                reason,
                priority,
                notes,
                status: "Pending"
            });
            showNotification("Coaching session scheduled successfully", T);
            onSave();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to schedule coaching session.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <BaseModal open={open} onClose={onClose} title="Schedule Coaching Session" T={T}>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-300">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Date</label>
                        <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                               className="w-full px-3 py-2 rounded-xl outline-none"
                               style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }} />
                    </div>
                    <div>
                        <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Time</label>
                        <input type="time" required value={time} onChange={e => setTime(e.target.value)}
                               className="w-full px-3 py-2 rounded-xl outline-none"
                               style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }} />
                    </div>
                </div>
                <div>
                    <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Reason / Subject</label>
                    <select value={reason} onChange={e => setReason(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl outline-none appearance-none"
                            style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }}>
                        <option value="Call Review">Call Review</option>
                        <option value="Negotiation Prep">Negotiation Prep</option>
                        <option value="Objection Handling">Objection Handling</option>
                        <option value="General Performance">General Performance</option>
                        <option value="1-on-1 Review">1-on-1 Review</option>
                    </select>
                </div>
                <div>
                    <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Priority</label>
                    <select value={priority} onChange={e => setPriority(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl outline-none appearance-none"
                            style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }}>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                    </select>
                </div>
                <div>
                    <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Notes</label>
                    <textarea rows="3" value={notes} onChange={e => setNotes(e.target.value)}
                              placeholder="Coaching focus areas, preparation items..."
                              className="w-full px-3 py-2 rounded-xl outline-none resize-none"
                              style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl transition-colors hover:bg-white/5"
                            style={{ border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl font-bold transition-all bg-violet-600 hover:bg-violet-500 text-white">
                        {submitting ? "Scheduling..." : "Schedule Session"}
                    </button>
                </div>
            </form>
        </BaseModal>
    );
}

// 2. Assign Learning Module Modal
export function AssignLearningModal({ open, onClose, employeeId, T, onSave }) {
    const [moduleName, setModuleName] = useState("Communication");
    const [deadline, setDeadline] = useState("");
    const [priority, setPriority] = useState("Medium");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post(`/api/company/employee/${employeeId}/learning`, {
                moduleName,
                deadline,
                priority,
                status: "Assigned"
            });
            showNotification(`Module "${moduleName}" assigned successfully`, T);
            onSave();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to assign learning module.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <BaseModal open={open} onClose={onClose} title="Assign Learning Module" T={T}>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-300">
                <div>
                    <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Select Module</label>
                    <select value={moduleName} onChange={e => setModuleName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl outline-none appearance-none"
                            style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }}>
                        <option value="Communication">Communication</option>
                        <option value="Closing">Closing</option>
                        <option value="Negotiation">Negotiation</option>
                        <option value="Professionalism">Professionalism</option>
                        <option value="Problem Resolution">Problem Resolution</option>
                        <option value="Discovery">Discovery</option>
                        <option value="Objection Handling">Objection Handling</option>
                    </select>
                </div>
                <div>
                    <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Deadline</label>
                    <input type="date" required value={deadline} onChange={e => setDeadline(e.target.value)}
                           className="w-full px-3 py-2 rounded-xl outline-none"
                           style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }} />
                </div>
                <div>
                    <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Priority</label>
                    <select value={priority} onChange={e => setPriority(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl outline-none appearance-none"
                            style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }}>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                    </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl transition-colors hover:bg-white/5"
                            style={{ border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl font-bold transition-all bg-violet-600 hover:bg-violet-500 text-white">
                        {submitting ? "Assigning..." : "Assign Module"}
                    </button>
                </div>
            </form>
        </BaseModal>
    );
}

// 3. Create Improvement Plan Modal
export function CreateImprovementPlanModal({ open, onClose, employeeId, T, onSave }) {
    const [targetQA, setTargetQA] = useState(80);
    const [targetSentiment, setTargetSentiment] = useState("POSITIVE");
    const [deadline, setDeadline] = useState("");
    const [modules, setModules] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post(`/api/company/employee/${employeeId}/improvements`, {
                targetQA: parseInt(targetQA),
                targetSentiment,
                deadline,
                assignedModules: modules,
                progress: 0,
                status: "Active"
            });
            showNotification("Performance Improvement Plan (PIP) created successfully", T);
            onSave();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to create improvement plan.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <BaseModal open={open} onClose={onClose} title="Create Performance Improvement Plan (PIP)" T={T}>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-300">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Target QA Score</label>
                        <input type="number" min="50" max="100" required value={targetQA} onChange={e => setTargetQA(e.target.value)}
                               className="w-full px-3 py-2 rounded-xl outline-none"
                               style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }} />
                    </div>
                    <div>
                        <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Target Sentiment</label>
                        <select value={targetSentiment} onChange={e => setTargetSentiment(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl outline-none appearance-none"
                                style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }}>
                            <option value="POSITIVE">Positive</option>
                            <option value="NEUTRAL">Neutral</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Deadline</label>
                    <input type="date" required value={deadline} onChange={e => setDeadline(e.target.value)}
                           className="w-full px-3 py-2 rounded-xl outline-none"
                           style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }} />
                </div>
                <div>
                    <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Assigned Modules</label>
                    <input type="text" placeholder="e.g. Communication, Negotiation" value={modules} onChange={e => setModules(e.target.value)}
                           className="w-full px-3 py-2 rounded-xl outline-none"
                           style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl transition-colors hover:bg-white/5"
                            style={{ border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl font-bold transition-all bg-violet-600 hover:bg-violet-500 text-white">
                        {submitting ? "Creating..." : "Create Plan"}
                    </button>
                </div>
            </form>
        </BaseModal>
    );
}

// 4. Add Manager Note Modal
export function AddNoteModal({ open, onClose, employeeId, T, onSave }) {
    const [text, setText] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setSubmitting(true);
        try {
            await api.post(`/api/company/employee/${employeeId}/notes`, { text: text.trim() });
            showNotification("Manager note saved", T);
            setText("");
            onSave();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to save note.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <BaseModal open={open} onClose={onClose} title="Add Manager Coaching Note" T={T}>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-300">
                <div>
                    <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Coaching Note</label>
                    <textarea rows="4" required value={text} onChange={e => setText(e.target.value)}
                              placeholder="Record coaching feedback, feedback response, call observation..."
                              className="w-full px-3 py-2 rounded-xl outline-none resize-none"
                              style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl transition-colors hover:bg-white/5"
                            style={{ border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl font-bold transition-all bg-violet-600 hover:bg-violet-500 text-white">
                        {submitting ? "Saving..." : "Save Note"}
                    </button>
                </div>
            </form>
        </BaseModal>
    );
}

// 5. Mark Employee Improved Modal
export function MarkImprovedModal({ open, onClose, employeeId, T, onSave }) {
    const [reason, setReason] = useState("QA Benchmark Met");
    const [pct, setPct] = useState(10);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const text = `Uncovered positive improvement (${pct}% increase) due to: "${reason}". Comment: ${comment}`;
            await api.post(`/api/company/employee/${employeeId}/notes`, { text });
            showNotification(`Marked employee improved by +${pct}%!`, T);
            onSave();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to save improvement.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <BaseModal open={open} onClose={onClose} title="Mark Employee Improved" T={T}>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-300">
                <div>
                    <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Reason</label>
                    <select value={reason} onChange={e => setReason(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl outline-none appearance-none"
                            style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }}>
                        <option value="QA Benchmark Met">QA Benchmark Met</option>
                        <option value="Objection Handling Mastery">Objection Handling Mastery</option>
                        <option value="Closing Confidence Spike">Closing Confidence Spike</option>
                        <option value="Active Listening Upgrades">Active Listening Upgrades</option>
                        <option value="CSAT Uplift">CSAT Uplift</option>
                    </select>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-slate-400">Estimated Improvement %</label>
                        <span className="text-violet-400 font-bold">+{pct}%</span>
                    </div>
                    <input type="range" min="5" max="50" step="5" value={pct} onChange={e => setPct(parseInt(e.target.value))}
                           className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-700" />
                </div>
                <div>
                    <label className="block mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">Manager Comment</label>
                    <textarea rows="3" required value={comment} onChange={e => setComment(e.target.value)}
                              placeholder="Detail how they demonstrated improvement..."
                              className="w-full px-3 py-2 rounded-xl outline-none resize-none"
                              style={{ background: T.inputBg, border: `1px solid ${T.panelBorder}`, color: "#fff" }} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl transition-colors hover:bg-white/5"
                            style={{ border: `1px solid ${T.panelBorder}`, color: T.textMuted }}>Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl font-bold transition-all bg-violet-600 hover:bg-violet-500 text-white">
                        {submitting ? "Saving..." : "Save Improvement"}
                    </button>
                </div>
            </form>
        </BaseModal>
    );
}

// 6. Share Report Success Alert / Link Copy
export function shareReportLink(employeeId, T) {
    const link = `${window.location.origin}/company/employee/${employeeId}`;
    navigator.clipboard.writeText(link);
    showNotification("Workspace link copied to clipboard!", T);
}
