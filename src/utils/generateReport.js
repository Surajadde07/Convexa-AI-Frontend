/**
 * generateReport.js  —  Convexa AI · Call Analytics PDF Report
 *
 * Premium executive-report redesign
 * ─────────────────────────────────────────────────────────────
 * This report now mirrors the depth of the Call Details page instead of a
 * plain data dump: a cover header, a hero AI Overall Score card, a call
 * context strip (sentiment / outcome / call type / buying intent /
 * confidence), and dedicated sections for Action Items, Risk Flags,
 * Follow-Up Suggestions, Buying Signals, Objections and the Conversation
 * Timeline — all reading from the exact same fields the UI already
 * renders, so nothing here is invented. Sections whose underlying field is
 * empty are simply skipped.
 *
 * Carried over unchanged from the previous version (still correct):
 *  - Two-pass AI Insights parser (structured label match → fallback bullets).
 *  - Bullet dot vertical-centering fix.
 *  - Page-overflow guards (checkPage) before every drawn block.
 *  - Keyword chip line-wrapping logic.
 */

import { jsPDF } from "jspdf";

// ─── Brand palette (matches the in-app dark theme) ───────────────────────────
const C = {
    bg:         [10,  10,  26 ],
    card:       [20,  17,  55 ],
    cardAlt:    [15,  13,  42 ],
    accent:     [139, 92,  246],
    accentDark: [109, 40,  217],
    blue:       [59,  130, 246],
    emerald:    [16,  185, 129],
    amber:      [245, 158, 11 ],
    red:        [239, 68,  68 ],
    rose:       [244, 114, 182],
    white:      [255, 255, 255],
    muted:      [148, 163, 184],
    dim:        [71,  85,  105],
    border:     [30,  27,  75 ],
};

// Canonical insight sections (colour only — no emoji, since core PDF fonts
// can't render them reliably; the coloured left bar carries the identity).
const INSIGHT_DEFS = [
    { key: "Customer Intent",   color: C.accent  },
    { key: "Main Issue",        color: C.blue    },
    { key: "Customer Concern",  color: C.amber   },
    { key: "Outcome",           color: C.emerald },
    { key: "Agent Performance", color: C.rose    },
];

const RISK_COLORS    = { High: C.red, Medium: C.amber, Low: [234, 179, 8] };
const OUTCOME_COLORS = {
    "Won": C.emerald, "Lost": C.red, "Follow Up Required": C.amber,
    "Escalated": [249, 115, 22], "Pending": C.amber,
};
const INTENT_COLORS = { High: C.emerald, Medium: C.amber, Low: [249, 115, 22] };

// ─── Primitive helpers ────────────────────────────────────────────────────────

function filledRect(doc, x, y, w, h, r, color) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, w, h, r, r, "F");
}

function scoreBar(doc, x, y, w, h, score, color) {
    const pct = Math.min((score || 0) / 100, 1);
    doc.setFillColor(...C.border);
    doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
    if (pct > 0) {
        doc.setFillColor(...color);
        doc.roundedRect(x, y, Math.max(w * pct, h), h, h / 2, h / 2, "F");
    }
}

function wrapText(doc, text, maxWidth) {
    if (!text) return ["—"];
    return doc.splitTextToSize(String(text), maxWidth);
}

/** Strip common markdown artifacts */
function clean(str) {
    if (!str) return "—";
    return String(str)
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`(.*?)`/g, "$1")
        .replace(/#+\s?/g, "")
        .replace(/^[\s\-•>]+/, "")
        .trim() || "—";
}

function parseList(str) {
    if (!str) return [];
    return str
        .split(/,|\n/)
        .map(s => s.replace(/^[\s*\-•]+/, "").trim())
        .filter(Boolean);
}

/** Parses fields that may already be an array, a JSON array string, or
 *  absent — mirrors the same helper used on the Call Details page so the
 *  report never shows data the UI wouldn't. */
function parseJSONArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function fmtDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("en-US", {
            weekday: "long", year: "numeric", month: "long",
            day: "numeric", hour: "2-digit", minute: "2-digit",
        });
    } catch { return iso; }
}

function fmtDateShort(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return iso; }
}

function scoreColor(score) {
    if (score == null) return C.accent;
    return score >= 70 ? C.emerald : score >= 50 ? C.amber : C.red;
}

function scoreQualitative(score) {
    if (score == null) return "Not scored";
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Fair";
    return "Needs Improvement";
}

/** Fallback conversation-phase detector — same heuristic as the Call Details
 *  page's client-side fallback, used only when the call has no stored
 *  `timeline` field so the report still has something meaningful to show. */
function buildFallbackTimeline(transcript) {
    if (!transcript) return [];
    const PHASES = [
        { keywords: ["hello","hi","good morning","good afternoon","good evening","welcome","how can i"], title: "Greeting" },
        { keywords: ["problem","issue","trouble","not working","error","complaint","concern","unable"], title: "Customer Problem" },
        { keywords: ["let me check","looking into","verify","account","searching"], title: "Investigation" },
        { keywords: ["solution","can help","i can","fix","resolve","offer","provide","discount","waive"], title: "Solution Discussion" },
        { keywords: ["payment","billing","charge","invoice","refund","credit"], title: "Payment / Billing" },
        { keywords: ["escalat","transfer","supervisor","manager"], title: "Escalation" },
        { keywords: ["anything else","is there anything","satisfied","happy","resolved","closed"], title: "Call Closure" },
    ];
    const words = transcript.split(/\s+/);
    const WPM = 150;
    const timeline = [];
    let lastIdx = -1;
    PHASES.forEach(phase => {
        for (let wi = 0; wi < words.length; wi++) {
            const chunk = words.slice(wi, wi + 6).join(" ").toLowerCase();
            if (phase.keywords.some(kw => chunk.includes(kw))) {
                if (wi > lastIdx + 30) {
                    const totalSec = Math.round((wi / WPM) * 60);
                    const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
                    const ss = String(totalSec % 60).padStart(2, "0");
                    timeline.push({ time: `${mm}:${ss}`, title: phase.title });
                    lastIdx = wi;
                    break;
                }
            }
        }
    });
    if (timeline.length === 0 || timeline[0].time !== "00:00") {
        timeline.unshift({ time: "00:00", title: "Opening" });
    }
    return timeline;
}

// ─── PDF state (module-level, reset on each call) ────────────────────────────

let _doc, PW, PH, MARGIN, CONTENT, _y, _pageNum;

function init(doc) {
    _doc     = doc;
    PW       = doc.internal.pageSize.getWidth();
    PH       = doc.internal.pageSize.getHeight();
    MARGIN   = 14;
    CONTENT  = PW - MARGIN * 2;
    _y       = 0;
    _pageNum = 1;
}

function y()       { return _y; }
function setY(val) { _y = val; }
function addY(val) { _y += val; }

// ─── Page management ──────────────────────────────────────────────────────────

function drawPageBg() {
    _doc.setFillColor(...C.bg);
    _doc.rect(0, 0, PW, PH, "F");
}

function drawFooter() {
    const fy = PH - 8;
    _doc.setDrawColor(...C.border);
    _doc.setLineWidth(0.3);
    _doc.line(MARGIN, fy - 2, PW - MARGIN, fy - 2);
    _doc.setFont("helvetica", "normal");
    _doc.setFontSize(7.5);
    _doc.setTextColor(...C.dim);
    _doc.text("Convexa AI · Conversation Intelligence Platform · Confidential Report", MARGIN, fy);
    _doc.text(`Page ${_pageNum}`, PW - MARGIN, fy, { align: "right" });
    _doc.text(`Generated: ${new Date().toLocaleString()}`, PW / 2, fy, { align: "center" });
}

function newPage() {
    drawFooter();
    _doc.addPage();
    _pageNum++;
    drawPageBg();
    setY(MARGIN + 8);
    return y();
}

/** Ensure at least `needed` mm remain on the page; add a new page if not. */
function checkPage(needed) {
    if (y() + needed > PH - 20) newPage();
}

// ─── Reusable layout blocks ───────────────────────────────────────────────────

function sectionHeader(label, color = C.accent, sub = null) {
    checkPage(18);
    filledRect(_doc, MARGIN, y(), 3, 7, 1.5, color);
    _doc.setFont("helvetica", "bold");
    _doc.setFontSize(9.5);
    _doc.setTextColor(...C.muted);
    _doc.text(label.toUpperCase(), MARGIN + 7, y() + 5.5);
    if (sub) {
        _doc.setFont("helvetica", "normal");
        _doc.setFontSize(8);
        _doc.setTextColor(...C.dim);
        _doc.text(sub, PW - MARGIN, y() + 5.5, { align: "right" });
    }
    addY(14);
}

/** Bullet with the dot vertically centred on the first text line only. */
function bullet(text, xIndent, dotColor = C.accent) {
    const x     = MARGIN + xIndent;
    const maxW  = CONTENT - xIndent - 2;
    const lines = wrapText(_doc, text, maxW);
    const lineH = 5.4;

    checkPage(lines.length * lineH + 4);

    _doc.setFillColor(...dotColor);
    _doc.circle(x - 4, y() + lineH / 2 - 0.8, 1.2, "F");

    _doc.setFont("helvetica", "normal");
    _doc.setFontSize(9.5);
    _doc.setTextColor(...C.white);
    lines.forEach((line, i) => {
        _doc.text(line, x, y() + i * lineH);
    });
    addY(lines.length * lineH + 3.5);
}

// ─── AI Insights parser (unchanged logic) ────────────────────────────────────

function parseInsightSections(raw) {
    if (!raw?.trim()) return [];
    const results = [];

    for (const def of INSIGHT_DEFS) {
        const escapedLabel = def.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const nextLabels = INSIGHT_DEFS
            .filter(d => d.key !== def.key)
            .map(d => d.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|");

        const pattern = new RegExp(
            `(?:#{1,3}\\s*)?${escapedLabel}\\s*:?\\s*([\\s\\S]*?)` +
            (nextLabels ? `(?=(?:#{1,3}\\s*)?(?:${nextLabels})\\s*:?|$)` : `(?=$)`),
            "i"
        );

        const m = pattern.exec(raw);
        if (m && m[1]?.trim()) {
            const value = clean(m[1].split("\n")[0]) || clean(m[1]);
            if (value && value !== "—") {
                results.push({ label: def.key, color: def.color, lines: wrapText(_doc, value, CONTENT - 20) });
            }
        }
    }

    if (results.length === 0) {
        const bullets = raw
            .split(/\n/)
            .map(l => clean(l))
            .filter(l => l && l !== "—");
        return bullets.map(b => ({ label: null, color: C.blue, lines: [b] }));
    }

    return results;
}

// ─── Section renderers ────────────────────────────────────────────────────────

function drawActionItems(items) {
    sectionHeader("Action Items", C.accent);
    const lineH = 5.4;
    items.forEach(item => {
        const title     = typeof item === "string" ? item : (item?.title || "—");
        const completed = typeof item === "object" && !!item?.completed;
        const lines     = wrapText(_doc, clean(title), CONTENT - 14);
        const blockH    = Math.max(lines.length * lineH, 6) + 3;

        checkPage(blockH + 2);

        if (completed) {
            filledRect(_doc, MARGIN, y() + 0.5, 4.2, 4.2, 1, C.emerald);
            _doc.setDrawColor(...C.white);
            _doc.setLineWidth(0.5);
            _doc.line(MARGIN + 0.9, y() + 2.7, MARGIN + 1.8, y() + 3.6);
            _doc.line(MARGIN + 1.8, y() + 3.6, MARGIN + 3.4, y() + 1.2);
        } else {
            _doc.setDrawColor(...C.dim);
            _doc.setLineWidth(0.4);
            _doc.roundedRect(MARGIN, y() + 0.5, 4.2, 4.2, 1, 1, "S");
        }

        _doc.setFont("helvetica", "normal");
        _doc.setFontSize(9.5);
        _doc.setTextColor(...(completed ? C.dim : C.white));
        lines.forEach((line, i) => _doc.text(line, MARGIN + 8, y() + 4 + i * lineH));

        addY(blockH);
    });
    addY(4);
}

function drawRiskFlags(flags) {
    sectionHeader("Risk Flags", C.amber);

    if (flags.length === 0) {
        checkPage(14);
        filledRect(_doc, MARGIN, y(), CONTENT, 12, 3, C.card);
        _doc.setFont("helvetica", "normal");
        _doc.setFontSize(9);
        _doc.setTextColor(...C.emerald);
        _doc.text("No active risks detected.", MARGIN + 6, y() + 7.5);
        addY(16);
        return;
    }

    flags.forEach(flag => {
        const severity = typeof flag === "object" ? flag?.severity : null;
        const message  = clean(typeof flag === "string" ? flag : flag?.message);
        const color    = RISK_COLORS[severity] || C.amber;
        const lines    = wrapText(_doc, message, CONTENT - 16);
        const cardH    = Math.max(lines.length * 5.2 + (severity ? 11 : 7), 14);

        checkPage(cardH + 4);
        filledRect(_doc, MARGIN, y(), CONTENT, cardH, 3, C.card);
        filledRect(_doc, MARGIN, y(), 3, cardH, 1.5, color);

        let ty = y() + 6.5;
        if (severity) {
            _doc.setFont("helvetica", "bold");
            _doc.setFontSize(7.5);
            _doc.setTextColor(...color);
            _doc.text(`${severity.toUpperCase()} RISK`, MARGIN + 8, ty);
            ty += 5.2;
        }
        _doc.setFont("helvetica", "normal");
        _doc.setFontSize(9.5);
        _doc.setTextColor(...C.white);
        lines.forEach((line, i) => _doc.text(line, MARGIN + 8, ty + i * 5.2));

        addY(cardH + 4);
    });
    addY(2);
}

function drawFollowUps(suggestions) {
    sectionHeader("Follow-Up Suggestions", C.blue);
    suggestions.forEach(s => bullet(clean(s), 8, C.blue));
    addY(4);
}

function drawBuyingSignals(signals) {
    sectionHeader("Buying Signals", C.emerald);
    let kx = MARGIN;
    let ky = y();
    signals.forEach(sig => {
        const text = clean(sig);
        _doc.setFont("helvetica", "bold");
        _doc.setFontSize(8.5);
        const w = _doc.getTextWidth(text) + 14;

        if (kx + w > PW - MARGIN) {
            kx = MARGIN;
            ky += 10;
            if (ky > PH - 20) {
                setY(ky);
                newPage();
                ky = y();
            }
        }

        filledRect(_doc, kx, ky - 5.5, w, 8, 4, [16, 40, 32]);
        _doc.setFillColor(...C.emerald);
        _doc.circle(kx + 5.5, ky - 1.7, 1, "F");
        _doc.setTextColor(...C.emerald);
        _doc.text(text, kx + 9, ky);
        kx += w + 5;
    });
    setY(ky + 13);
}

function drawObjections(objections) {
    sectionHeader("Objections", C.rose);
    objections.forEach(obj => {
        const text     = clean(typeof obj === "string" ? obj : obj?.objection);
        const resolved = typeof obj === "object" && !!obj?.resolved;
        const lines    = wrapText(_doc, text, CONTENT - 40);
        const cardH    = Math.max(lines.length * 5.2 + 7, 13);

        checkPage(cardH + 4);
        filledRect(_doc, MARGIN, y(), CONTENT, cardH, 3, C.card);

        _doc.setFont("helvetica", "normal");
        _doc.setFontSize(9.5);
        _doc.setTextColor(...C.white);
        lines.forEach((line, i) => _doc.text(line, MARGIN + 6, y() + 6 + i * 5.2));

        const tagColor = resolved ? C.emerald : C.red;
        const tagLabel = resolved ? "RESOLVED" : "UNRESOLVED";
        _doc.setFont("helvetica", "bold");
        _doc.setFontSize(7);
        const tagW = _doc.getTextWidth(tagLabel) + 6;
        filledRect(_doc, MARGIN + CONTENT - tagW - 4, y() + 4, tagW, 5.5, 2.5, tagColor);
        _doc.setTextColor(...C.bg);
        _doc.text(tagLabel, MARGIN + CONTENT - tagW - 4 + tagW / 2, y() + 7.7, { align: "center" });

        addY(cardH + 4);
    });
    addY(2);
}

function drawTimeline(timeline) {
    sectionHeader("Conversation Timeline", C.blue, `${timeline.length} phase${timeline.length !== 1 ? "s" : ""}`);
    const PHASE_COLORS = [C.accent, C.blue, C.emerald, C.amber, C.rose, [6, 182, 212], [249, 115, 22]];
    timeline.forEach((seg, i) => {
        checkPage(11);
        const color = PHASE_COLORS[i % PHASE_COLORS.length];
        filledRect(_doc, MARGIN, y(), CONTENT, 9, 2.5, C.cardAlt);
        _doc.setFillColor(...color);
        _doc.circle(MARGIN + 5, y() + 4.5, 1.6, "F");
        _doc.setFont("helvetica", "bold");
        _doc.setFontSize(8.5);
        _doc.setTextColor(...color);
        _doc.text(String(seg.time || "—"), MARGIN + 10, y() + 6);
        _doc.setFont("helvetica", "normal");
        _doc.setFontSize(9);
        _doc.setTextColor(...C.white);
        _doc.text(clean(seg.title), MARGIN + 30, y() + 6);
        addY(11);
    });
    addY(3);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateCallReport(call) {
    if (!call) return;

    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    init(doc);

    const callName = call.customerName || call.fileName || "Untitled Call";

    // ═════════════════════════════════════════
    //  PAGE 1 — COVER
    // ═════════════════════════════════════════
    drawPageBg();

    const BAND_H = 56;
    const steps  = 24;
    for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const r = Math.round(C.accentDark[0] + t * (C.bg[0] - C.accentDark[0]));
        const g = Math.round(C.accentDark[1] + t * (C.bg[1] - C.accentDark[1]));
        const b = Math.round(C.accentDark[2] + t * (C.bg[2] - C.accentDark[2]));
        doc.setFillColor(r, g, b);
        doc.rect(0, i * (BAND_H / steps), PW, BAND_H / steps + 0.5, "F");
    }
    filledRect(doc, 0, 0, 4, BAND_H, 0, C.accent);

    // Logo + tagline
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...C.white);
    doc.text("CONVEXA", MARGIN + 4, 16);
    doc.setTextColor(...C.accent);
    doc.text(" AI", MARGIN + 4 + doc.getTextWidth("CONVEXA"), 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("CONVERSATION INTELLIGENCE PLATFORM", MARGIN + 4, 22);

    // Call name (cover title)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...C.white);
    const nameLine = wrapText(doc, callName, PW * 0.5)[0];
    doc.text(nameLine, MARGIN + 4, 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text("CALL NAME", MARGIN + 4, 42);

    // Report title + analysis date (right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.white);
    doc.text("Call Analytics Report", PW - MARGIN, 16, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("Confidential · For Internal Use", PW - MARGIN, 22, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.accent);
    doc.text(fmtDateShort(call.createdAt), PW - MARGIN, 36, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text("ANALYSIS DATE", PW - MARGIN, 42, { align: "right" });

    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, BAND_H, PW - MARGIN, BAND_H);

    setY(BAND_H + 8);

    // ── CALL INFORMATION ──────────────────────────────────────────────────
    sectionHeader("Call Information", C.accent);
    const infoRows = [
        ["File Name", call.fileName || "—"],
        ["Call ID",   `#${call.id || "—"}`],
        ["Date",      fmtDate(call.createdAt)],
        ["Status",    call.status || "COMPLETED"],
    ];
    const INFO_H = infoRows.length * 9 + 6;
    filledRect(doc, MARGIN, y(), CONTENT, INFO_H, 3, C.card);
    doc.setFontSize(9);
    infoRows.forEach(([label, value], i) => {
        const ry = y() + 6 + i * 9;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.muted);
        doc.text(label + ":", MARGIN + 6, ry);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.white);
        const vLines = wrapText(doc, value, CONTENT - 55);
        doc.text(vLines[0] || "—", MARGIN + 40, ry);
    });
    addY(INFO_H + 8);

    // ── EXECUTIVE SUMMARY ────────────────────────────────────────────────
    if (call.summary) {
        sectionHeader("Executive Summary", C.blue);
        const summaryLines = wrapText(doc, clean(call.summary), CONTENT - 10);
        const cardH = summaryLines.length * 5.5 + 12;
        checkPage(cardH + 8);
        filledRect(doc, MARGIN, y(), CONTENT, cardH, 3, C.card);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(...C.muted);
        summaryLines.forEach((line, i) => doc.text(line, MARGIN + 6, y() + 7 + i * 5.5));
        addY(cardH + 8);
    }

    // ── AI OVERALL SCORE (hero card) ─────────────────────────────────────
    if (call.overallScore != null) {
        sectionHeader("AI Overall Score", C.accent);
        const HERO_H = 34;
        checkPage(HERO_H + 8);
        const sColor = scoreColor(call.overallScore);
        filledRect(doc, MARGIN, y(), CONTENT, HERO_H, 4, C.card);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(30);
        doc.setTextColor(...sColor);
        doc.text(`${call.overallScore}`, MARGIN + 10, y() + 21);
        const numW = doc.getTextWidth(`${call.overallScore}`);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(...C.muted);
        doc.text("/ 100", MARGIN + 10 + numW + 3, y() + 21);

        const qualLabel = scoreQualitative(call.overallScore);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const pillW = doc.getTextWidth(qualLabel) + 12;
        filledRect(doc, MARGIN + CONTENT - pillW - 8, y() + 9, pillW, 8, 4, sColor);
        doc.setTextColor(...C.bg);
        doc.text(qualLabel, MARGIN + CONTENT - pillW - 8 + pillW / 2, y() + 14.5, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.dim);
        doc.text("Overall QA score across the full conversation", MARGIN + 10, y() + 27);

        scoreBar(doc, MARGIN + 8, y() + HERO_H - 5, CONTENT - 16, 3, call.overallScore, sColor);
        addY(HERO_H + 8);
    }

    // ── PERFORMANCE BREAKDOWN ────────────────────────────────────────────
    const hasDims = call.communication != null || call.professionalism != null
                 || call.problemResolution != null || call.customerSatisfaction != null;
    if (hasDims) {
        sectionHeader("Performance Breakdown", C.accent);
        const dims = [
            { label: "Communication",        key: "communication",        color: C.accent  },
            { label: "Professionalism",       key: "professionalism",      color: C.emerald },
            { label: "Problem Resolution",    key: "problemResolution",    color: C.blue    },
            { label: "Customer Satisfaction", key: "customerSatisfaction", color: C.amber   },
        ];
        checkPage(48);
        const CW = (CONTENT - 4) / 2;
        dims.forEach(({ label, key, color }, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx  = MARGIN + col * (CW + 4);
            const cy  = y() + row * 22;
            filledRect(doc, cx, cy, CW, 18, 3, C.card);
            const score = call[key];
            const scoreStr = score != null ? `${score}` : "—";
            doc.setFont("helvetica", "bold");
            doc.setFontSize(15);
            doc.setTextColor(...color);
            doc.text(scoreStr, cx + 10, cy + 11);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...C.muted);
            doc.text(label, cx + 10 + doc.getTextWidth(scoreStr) + 4, cy + 11);
            scoreBar(doc, cx + 7, cy + 13, CW - 14, 2.2, score, color);
        });
        addY(48);
    }

    // ── CALL CONTEXT STRIP (sentiment / outcome / call type / intent / confidence) ──
    const hasContext = call.sentiment || call.outcomeStatus || call.callType
        || call.buyingIntent || call.confidence != null;
    if (hasContext) {
        sectionHeader("Call Context", C.blue);
        const items = [];
        if (call.sentiment) {
            const s = call.sentiment;
            items.push({ label: "Sentiment", value: s.charAt(0) + s.slice(1).toLowerCase(), color: s === "POSITIVE" ? C.emerald : s === "NEGATIVE" ? C.red : C.amber });
        }
        if (call.outcomeStatus) items.push({ label: "Outcome", value: call.outcomeStatus, color: OUTCOME_COLORS[call.outcomeStatus] || C.muted });
        if (call.callType) items.push({ label: "Call Type", value: call.callType, color: C.blue });
        if (call.buyingIntent) items.push({ label: "Buying Intent", value: call.buyingIntent, color: INTENT_COLORS[call.buyingIntent] || C.muted });
        if (call.confidence != null) {
            const conf = Math.max(0, Math.min(100, call.confidence));
            items.push({ label: "AI Confidence", value: `${conf}%`, color: conf >= 80 ? C.emerald : conf >= 50 ? C.amber : C.red });
        }

        const STRIP_H = 20;
        checkPage(STRIP_H + 8);
        filledRect(doc, MARGIN, y(), CONTENT, STRIP_H, 3, C.card);
        const cw = CONTENT / items.length;
        items.forEach((it, i) => {
            const cx = MARGIN + i * cw + 6;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(...C.dim);
            doc.text(it.label.toUpperCase(), cx, y() + 7);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(...it.color);
            const val = wrapText(doc, it.value, cw - 8)[0];
            doc.text(val, cx, y() + 14.5);
            if (i > 0) {
                doc.setDrawColor(...C.border);
                doc.setLineWidth(0.3);
                doc.line(MARGIN + i * cw, y() + 4, MARGIN + i * cw, y() + STRIP_H - 4);
            }
        });
        addY(STRIP_H + 8);
    }

    drawFooter();

    // ═════════════════════════════════════════
    //  PAGE 2 — INSIGHTS, ACTIONS, RISKS
    // ═════════════════════════════════════════
    newPage();

    // ── KEY INSIGHTS ─────────────────────────────────────────────────────
    if (call.insights) {
        sectionHeader("Key Insights", C.blue);
        const sections = parseInsightSections(call.insights);

        if (sections.length > 0 && sections[0].label !== null) {
            sections.forEach(({ label, color, lines }) => {
                const cardH = Math.max(lines.length * 5.5 + 14, 20);
                checkPage(cardH + 6);
                filledRect(doc, MARGIN, y(), CONTENT, cardH, 3, C.card);
                filledRect(doc, MARGIN, y(), 3, cardH, 1.5, color);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8);
                doc.setTextColor(...color);
                doc.text(label.toUpperCase(), MARGIN + 8, y() + 6);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9.5);
                doc.setTextColor(...C.white);
                lines.forEach((line, i) => doc.text(line, MARGIN + 8, y() + 12 + i * 5.5));
                addY(cardH + 4);
            });
        } else {
            sections.forEach(({ lines }) => lines.forEach(line => bullet(line, 8, C.blue)));
        }
        addY(4);
    }

    // ── ACTION ITEMS ─────────────────────────────────────────────────────
    const actionItems = parseJSONArray(call.actionItems);
    if (actionItems.length > 0) {
        checkPage(24);
        drawActionItems(actionItems);
    }

    // ── RISK FLAGS (rendered whenever Action Items rendered too, or on its own) ──
    const riskFlags = parseJSONArray(call.riskFlags);
    if (actionItems.length > 0 || riskFlags.length > 0) {
        checkPage(24);
        drawRiskFlags(riskFlags);
    }

    // ── FOLLOW-UP SUGGESTIONS ─────────────────────────────────────────────
    const followUps = parseJSONArray(call.followUpSuggestions);
    if (followUps.length > 0) {
        checkPage(24);
        drawFollowUps(followUps);
    }

    // ── BUYING SIGNALS ────────────────────────────────────────────────────
    const buyingSignals = parseJSONArray(call.buyingSignals);
    if (buyingSignals.length > 0) {
        checkPage(24);
        drawBuyingSignals(buyingSignals);
    }

    // ── OBJECTIONS ────────────────────────────────────────────────────────
    const objections = parseJSONArray(call.objections);
    if (objections.length > 0) {
        checkPage(24);
        drawObjections(objections);
    }

    // ── KEYWORDS ──────────────────────────────────────────────────────────
    const keywords = parseList(call.keywords);
    if (keywords.length > 0) {
        checkPage(20);
        sectionHeader("Keywords", C.blue);
        let kx = MARGIN, ky = y();
        keywords.forEach(kw => {
            const kw_clean = clean(kw);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            const kwW = doc.getTextWidth(kw_clean) + 12;
            if (kx + kwW > PW - MARGIN) {
                kx = MARGIN;
                ky += 10;
                if (ky > PH - 20) { setY(ky); newPage(); ky = y(); }
            }
            filledRect(doc, kx, ky - 5.5, kwW, 8, 4, [28, 24, 78]);
            doc.setTextColor(...C.accent);
            doc.text(kw_clean, kx + 6, ky);
            kx += kwW + 5;
        });
        setY(ky + 13);
    }

    // ── STRENGTHS ─────────────────────────────────────────────────────────
    const strengths = parseList(call.strengths);
    if (strengths.length > 0) {
        checkPage(24);
        sectionHeader("Strengths", C.emerald);
        strengths.forEach(s => bullet(clean(s), 8, C.emerald));
        addY(4);
    }

    // ── AREAS FOR IMPROVEMENT ─────────────────────────────────────────────
    const improvements = parseList(call.improvements);
    if (improvements.length > 0) {
        checkPage(24);
        sectionHeader("Areas for Improvement", C.amber);
        improvements.forEach(s => bullet(clean(s), 8, C.amber));
        addY(4);
    }

    // ── CONVERSATION TIMELINE ─────────────────────────────────────────────
    let timeline = [];
    if (call.timeline) {
        try {
            const parsed = JSON.parse(call.timeline);
            if (Array.isArray(parsed) && parsed.length > 0) timeline = parsed;
        } catch { /* fall through to the transcript-derived fallback below */ }
    }
    if (timeline.length === 0 && call.transcript) {
        timeline = buildFallbackTimeline(call.transcript);
    }
    if (timeline.length > 0) {
        checkPage(24);
        drawTimeline(timeline);
    }

    drawFooter();

    // ═════════════════════════════════════════
    //  PAGE 3+ — FULL TRANSCRIPT
    // ═════════════════════════════════════════
    if (call.transcript) {
        newPage();
        sectionHeader("Full Transcript", C.muted);

        doc.setFont("courier", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...C.muted);

        const transcriptLines = wrapText(doc, call.transcript, CONTENT - 4);
        transcriptLines.forEach(line => {
            if (y() > PH - 20) {
                newPage();
                doc.setFont("courier", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(...C.muted);
            }
            doc.text(line, MARGIN + 2, y());
            addY(4.8);
        });
    }

    drawFooter();

    // ── SAVE ─────────────────────────────────────────────────────────────────
    const safeName = (call.fileName || "call-report")
        .replace(/[^a-zA-Z0-9_\-]/g, "_")
        .substring(0, 60);
    doc.save(`${safeName}_report.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
//  EMPLOYEE PERFORMANCE REPORT  (Sprint 2.6)
//
//  Reuses every drawing primitive above (sectionHeader, filledRect, scoreBar,
//  bullet, drawActionItems, drawRiskFlags, drawFollowUps, scoreColor, fmtDate,
//  checkPage/newPage, the C palette) instead of building a second PDF toolkit.
//  Only the page-assembly logic below is new — the same split as
//  generateCallReport() above: reusable primitives vs. one-off layout calls.
//
//  `profile` is exactly what GET /api/company/employee/{id} already returns
//  (EmployeeProfileResponse) — nothing here re-derives or re-fetches anything.
// ═══════════════════════════════════════════════════════════════════════════

export function generateEmployeeReport(profile) {
    if (!profile) return;

    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    init(doc);

    const dashboard = profile.dashboard || {};
    const analytics = profile.analytics || {};
    const coaching = profile.coachingSummary || {};
    const recentCalls = profile.recentCalls || [];

    // ═════════════════════════════════════════
    //  COVER BAND — same visual language as generateCallReport's cover
    // ═════════════════════════════════════════
    drawPageBg();

    const BAND_H = 56;
    const steps = 24;
    for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const r = Math.round(C.accentDark[0] + t * (C.bg[0] - C.accentDark[0]));
        const g = Math.round(C.accentDark[1] + t * (C.bg[1] - C.accentDark[1]));
        const b = Math.round(C.accentDark[2] + t * (C.bg[2] - C.accentDark[2]));
        doc.setFillColor(r, g, b);
        doc.rect(0, i * (BAND_H / steps), PW, BAND_H / steps + 0.5, "F");
    }
    filledRect(doc, 0, 0, 4, BAND_H, 0, C.accent);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...C.white);
    doc.text("CONVEXA", MARGIN + 4, 16);
    doc.setTextColor(...C.accent);
    doc.text(" AI", MARGIN + 4 + doc.getTextWidth("CONVEXA"), 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("CONVERSATION INTELLIGENCE PLATFORM", MARGIN + 4, 22);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...C.white);
    doc.text(wrapText(doc, profile.name || "Employee", PW * 0.5)[0], MARGIN + 4, 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(`${profile.role || ""} · ${profile.email || ""}`, MARGIN + 4, 42);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.white);
    doc.text("Employee Performance Report", PW - MARGIN, 16, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("Confidential · For Internal Use", PW - MARGIN, 22, { align: "right" });

    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, BAND_H, PW - MARGIN, BAND_H);
    setY(BAND_H + 8);

    // ── EMPLOYEE INFORMATION ──────────────────────────────────────────────
    sectionHeader("Employee Information", C.accent);
    const infoRows = [
        ["Name", profile.name || "—"],
        ["Email", profile.email || "—"],
        ["Role", profile.role || "—"],
        ["Joined", fmtDate(profile.joinedDate)],
        ["Performance Status", profile.statusBadge || "—"],
        ["Health / Risk Level", `${profile.healthStatus || "Green"} / ${profile.riskLevel || "Low"}`],
    ];
    const INFO_H = infoRows.length * 8 + 6;
    filledRect(doc, MARGIN, y(), CONTENT, INFO_H, 3, C.card);
    doc.setFontSize(8.5);
    infoRows.forEach(([label, value], i) => {
        const ry = y() + 5 + i * 8;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.muted);
        doc.text(label + ":", MARGIN + 6, ry);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.white);
        doc.text(wrapText(doc, value, CONTENT - 55)[0] || "—", MARGIN + 40, ry);
    });
    addY(INFO_H + 8);

    // ── EXECUTIVE BRIEFING ────────────────────────────────────────────────
    if (dashboard.briefing) {
        sectionHeader("Executive Briefing", C.blue);
        const briefingLines = wrapText(doc, clean(dashboard.briefing), CONTENT - 12);
        const briefingH = briefingLines.length * 5.2 + 8;
        checkPage(briefingH + 6);
        filledRect(doc, MARGIN, y(), CONTENT, briefingH, 3, C.card);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        briefingLines.forEach((line, i) => doc.text(line, MARGIN + 6, y() + 6 + i * 5.2));
        addY(briefingH + 8);
    }

    // ── KPI SUMMARY ───────────────────────────────────────────────────────
    sectionHeader("KPI Summary", C.blue);
    const kpis = [
        ["Total Calls", dashboard.totalCalls ?? 0],
        ["Average QA", dashboard.avgScore ?? 0],
        ["Positive Sentiment %", `${dashboard.positivePercent ?? 0}%`],
        ["CSAT Avg", `${dashboard.avgCustomerSatisfaction ?? 0}%`],
    ];
    const kpiW = CONTENT / 4 - 3;
    checkPage(28);
    kpis.forEach(([label, value], i) => {
        const kx = MARGIN + i * (kpiW + 4);
        filledRect(doc, kx, y(), kpiW, 24, 3, C.card);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...C.white);
        doc.text(String(value), kx + kpiW / 2, y() + 12, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...C.muted);
        doc.text(label, kx + kpiW / 2, y() + 19, { align: "center", maxWidth: kpiW - 4 });
    });
    addY(30);

    // ── ACHIEVEMENTS & BADGES ───────────────────────────────────────────
    const achievements = [];
    if (dashboard.avgScore >= 85) achievements.push("Top Performer");
    if (analytics.scoreTrendPercent > 4.0) achievements.push("Fast Improver");
    if (dashboard.avgCustomerSatisfaction >= 80) achievements.push("Customer Favourite");
    if (dashboard.avgScore >= 80) achievements.push("High QA");
    if (dashboard.positivePercent >= 60) achievements.push("Positive Streak");
    if (achievements.length) {
        sectionHeader("Achievements & Badges", C.emerald);
        let ax = MARGIN;
        checkPage(12);
        achievements.forEach(ach => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            const w = doc.getTextWidth(ach) + 10;
            if (ax + w > PW - MARGIN) { ax = MARGIN; addY(10); checkPage(12); }
            filledRect(doc, ax, y(), w, 6, 3, [16, 40, 32]);
            doc.setTextColor(...C.emerald);
            doc.text(ach, ax + 5, y() + 4.2);
            ax += w + 4;
        });
        addY(12);
    }

    // ── QA SCORE BREAKDOWN ───────────────────────────────────────────────
    sectionHeader("QA Score Breakdown", C.emerald);
    const qaRows = [
        ["Communication", dashboard.avgCommunication],
        ["Problem Resolution", dashboard.avgProblemResolution],
        ["Professionalism", dashboard.avgProfessionalism],
        ["Cust. Satisfaction", dashboard.avgCustomerSatisfaction],
    ];
    qaRows.forEach(([label, score]) => {
        checkPage(10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.white);
        doc.text(label, MARGIN, y() + 4);
        doc.setFont("helvetica", "bold");
        doc.text(String(score ?? 0), MARGIN + 50, y() + 4);
        scoreBar(doc, MARGIN + 62, y() + 1, CONTENT - 62, 4, score ?? 0, scoreColor(score));
        addY(9);
    });
    addY(4);

    // ── PERSISTENT COACHING HISTORY ──────────────────────────────────────
    if (profile.coachingSessions && profile.coachingSessions.length > 0) {
        newPage();
        sectionHeader("Coaching Sessions History", C.accent);
        profile.coachingSessions.forEach(s => {
            const lines = wrapText(doc, s.notes || "No focus notes recorded.", CONTENT - 70);
            const rowH = Math.max(lines.length * 4.8 + 12, 22);
            checkPage(rowH + 4);
            filledRect(doc, MARGIN, y(), CONTENT, rowH, 3, C.card);
            filledRect(doc, MARGIN, y(), 3, rowH, 1.5, C.accent);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...C.white);
            doc.text(`${s.reason} (${s.sessionDate})`, MARGIN + 8, y() + 6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.muted);
            doc.text(`Time: ${s.sessionTime} | Priority: ${s.priority} | Status: ${s.status}`, MARGIN + 8, y() + 11);
            let ny = y() + 16;
            doc.setFontSize(8.5);
            doc.setTextColor(...C.white);
            lines.forEach((line, idx) => {
                doc.text(line, MARGIN + 8, ny + idx * 4.8);
            });
            addY(rowH + 4);
        });
        addY(4);
    }

    // ── LEARNING MODULES ASSIGNED ───────────────────────────────────────
    if (profile.learningAssignments && profile.learningAssignments.length > 0) {
        checkPage(24);
        sectionHeader("Learning Module Assignments", C.blue);
        profile.learningAssignments.forEach(a => {
            checkPage(16);
            filledRect(doc, MARGIN, y(), CONTENT, 12, 2, C.card);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...C.white);
            doc.text(a.moduleName, MARGIN + 6, y() + 5);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.muted);
            doc.text(`Assigned: ${a.assignedDate} | Deadline: ${a.deadline}`, MARGIN + 6, y() + 9);
            
            const badgeLabel = a.status.toUpperCase();
            const bColor = a.status === "Completed" ? C.emerald : C.amber;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            const tagW = doc.getTextWidth(badgeLabel) + 6;
            filledRect(doc, MARGIN + CONTENT - tagW - 4, y() + 3.5, tagW, 5, 2, bColor);
            doc.setTextColor(...C.bg);
            doc.text(badgeLabel, MARGIN + CONTENT - tagW - 4 + tagW / 2, y() + 7, { align: "center" });

            addY(15);
        });
        addY(4);
    }

    // ── PERSISTENT MANAGER NOTES ──────────────────────────────────────────
    if (profile.managerNotes && profile.managerNotes.length > 0) {
        newPage();
        sectionHeader("Manager Coaching Notes", C.blue);
        profile.managerNotes.forEach(n => {
            const lines = wrapText(doc, n.text, CONTENT - 16);
            const cardH = lines.length * 5 + 10;
            checkPage(cardH + 4);
            filledRect(doc, MARGIN, y(), CONTENT, cardH, 3, C.cardAlt);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.dim);
            doc.text(`LOGGED ON ${new Date(n.createdAt).toLocaleDateString()}`, MARGIN + 8, y() + 6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...C.white);
            lines.forEach((line, idx) => {
                doc.text(line, MARGIN + 8, y() + 11.5 + idx * 5);
            });
            addY(cardH + 4);
        });
        addY(4);
    }

    // ── PERFORMANCE IMPROVEMENT PLANS (PIP) ──────────────────────────────
    if (profile.improvementPlans && profile.improvementPlans.length > 0) {
        checkPage(24);
        sectionHeader("Improvement Plans (PIP)", C.rose);
        profile.improvementPlans.forEach(p => {
            checkPage(20);
            filledRect(doc, MARGIN, y(), CONTENT, 16, 2.5, C.card);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...C.white);
            doc.text(`Target QA: ${p.targetQA}% | Target Sentiment: ${p.targetSentiment}`, MARGIN + 6, y() + 6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.muted);
            doc.text(`Deadline: ${p.deadline} | Status: ${p.status} | Progress: ${p.progress}%`, MARGIN + 6, y() + 11);
            addY(20);
        });
        addY(4);
    }

    // ── RECOMMENDATIONS ──────────────────────────────────────────────────
    if (profile.overallRecommendation) {
        checkPage(24);
        sectionHeader("AI Recommendations", C.accent);
        bullet(profile.overallRecommendation, 8, C.accent);
    }

    // ── RECENT CALLS ──────────────────────────────────────────────────────
    if (recentCalls.length) {
        newPage();
        sectionHeader("Recent Call Analytics Logs", C.accent, `${recentCalls.length} most recent`);
        recentCalls.forEach(c => {
            const lines = wrapText(doc, c.fileName || "—", CONTENT - 60);
            const rowH = Math.max(lines.length * 5, 8) + 3;
            checkPage(rowH + 2);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...C.white);
            doc.text(lines[0] || "—", MARGIN, y() + 5);
            doc.setTextColor(...C.muted);
            doc.text(fmtDateShort(c.createdAt), MARGIN + 78, y() + 5);
            doc.setTextColor(...(scoreColor(c.overallScore)));
            doc.text(String(c.overallScore ?? "—"), MARGIN + 112, y() + 5);
            doc.setTextColor(...C.muted);
            doc.text(c.sentiment || "—", MARGIN + 128, y() + 5);
            doc.text(c.outcomeStatus || "—", MARGIN + 156, y() + 5);
            addY(rowH);
        });
        addY(4);
    }

    drawFooter();

    const safeName = (profile.name || "employee-report")
        .replace(/[^a-zA-Z0-9_\-]/g, "_")
        .substring(0, 60);
    doc.save(`${safeName}_performance_report.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
//  FORMAL PERFORMANCE REVIEW PDF GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
export function generatePerformanceReview(profile) {
    if (!profile) return;

    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    init(doc);

    const dashboard = profile.dashboard || {};
    const analytics = profile.analytics || {};
    const coaching = profile.coachingSummary || {};

    // ── White formal report background (differs from standard cover band)
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PW, PH, "F");

    // Formal Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text("CONVEXA AI · ENTERPRISE REVENUE INTELLIGENCE", MARGIN, 20);
    doc.setDrawColor(148, 163, 184); // Slate 400
    doc.setLineWidth(0.5);
    doc.line(MARGIN, 23, PW - MARGIN, 23);

    // Cover metadata
    setY(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105);
    doc.text("EMPLOYEE PERFORMANCE EVALUATION", MARGIN, y());
    addY(8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    
    // Evaluation info
    doc.text(`Employee Name:  ${profile.name}`, MARGIN, y());
    doc.text(`Employee Email: ${profile.email}`, PW / 2 + 10, y());
    addY(6);
    doc.text(`Role:           ${profile.role || "USER"}`, MARGIN, y());
    doc.text(`Evaluation Date: ${new Date().toLocaleDateString()}`, PW / 2 + 10, y());
    addY(6);
    doc.text(`Review Period:  Last 30 Days`, MARGIN, y());
    doc.text(`Evaluated By:   System Manager Workspace`, PW / 2 + 10, y());
    addY(10);

    // Divider
    doc.line(MARGIN, y(), PW - MARGIN, y());
    addY(8);

    // Section 1: Executive Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("1. EXECUTIVE SUMMARY & BRIEFING", MARGIN, y());
    addY(6);

    const summaryText = dashboard.briefing || "The employee has demonstrated stable engagement with normal KPI benchmarks.";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    const summaryLines = doc.splitTextToSize(summaryText, CONTENT);
    summaryLines.forEach(line => {
        doc.text(line, MARGIN, y());
        addY(5);
    });
    addY(4);

    // Section 2: Ratings
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("2. PERFORMANCE SCORECARD RATING", MARGIN, y());
    addY(6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Overall QA Score:  ${dashboard.avgScore} / 100`, MARGIN, y());
    doc.setFont("helvetica", "normal");
    doc.text(`Performance Status: ${profile.statusBadge || "Consistent Performer"}`, PW / 2 + 10, y());
    addY(8);

    // Metrics Table
    const metrics = [
        ["Communication Skills", `${dashboard.avgCommunication ?? 0}%`],
        ["Problem Resolution Capability", `${dashboard.avgProblemResolution ?? 0}%`],
        ["Professionalism & Compliance", `${dashboard.avgProfessionalism ?? 0}%`],
        ["Customer Satisfaction Index", `${dashboard.avgCustomerSatisfaction ?? 0}%`],
    ];
    metrics.forEach(([lbl, val]) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105);
        doc.text(lbl, MARGIN + 4, y());
        doc.setTextColor(30, 41, 59);
        doc.text(val, MARGIN + 100, y());
        addY(6);
    });
    addY(4);

    // Section 3: Strengths & Weaknesses
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("3. CORE STRENGTHS & OPPORTUNITIES FOR DEVELOPMENT", MARGIN, y());
    addY(6);

    // Strengths
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text("Primary Key Strengths:", MARGIN + 4, y());
    addY(5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const strText = coaching.strengths || "Demonstrates strong overall execution on core parameters.";
    const strLines = doc.splitTextToSize(strText, CONTENT - 8);
    strLines.forEach(line => {
        doc.text(line, MARGIN + 8, y());
        addY(4.8);
    });
    addY(2);

    // Weaknesses
    doc.setFont("helvetica", "bold");
    doc.setTextColor(239, 68, 68); // Red
    doc.text("Focus Areas for Development:", MARGIN + 4, y());
    addY(5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const weakText = coaching.weaknesses || "Identify and resolve objections with clearer structures.";
    const weakLines = doc.splitTextToSize(weakText, CONTENT - 8);
    weakLines.forEach(line => {
        doc.text(line, MARGIN + 8, y());
        addY(4.8);
    });
    addY(6);

    // Page 2 - Reviews, Notes & Recommendations
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PW, PH, "F");
    
    // Page 2 header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Performance Review Evaluation · Employee: ${profile.name}`, MARGIN, 15);
    doc.line(MARGIN, 18, PW - MARGIN, 18);
    
    setY(26);

    // Section 4: Goals & PIP Status
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("4. PERFORMANCE IMPROVEMENT TARGETS (PIP)", MARGIN, y());
    addY(6);

    if (profile.improvementPlans && profile.improvementPlans.length > 0) {
        const activePip = profile.improvementPlans[0];
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Active PIP Plan Details:`, MARGIN + 4, y());
        addY(5);
        doc.setFont("helvetica", "normal");
        doc.text(`Target QA: ${activePip.targetQA}% (Progress: ${activePip.progress}%)`, MARGIN + 8, y());
        doc.text(`Deadline: ${activePip.deadline} (${activePip.status})`, PW / 2 + 10, y());
        addY(6);
        doc.text(`Assigned PIP Modules: ${activePip.assignedModules || "None"}`, MARGIN + 8, y());
        addY(10);
    } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.text("No active formal Performance Improvement Plan (PIP) has been logged.", MARGIN + 4, y());
        addY(10);
    }

    // Section 5: AI Manager Recommendations
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("5. SYSTEM COACHING RECOMMENDATIONS", MARGIN, y());
    addY(6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    const recText = profile.overallRecommendation || "Maintain consistent metrics across communication and compliance.";
    const recLines = doc.splitTextToSize(recText, CONTENT);
    recLines.forEach(line => {
        doc.text(line, MARGIN, y());
        addY(5);
    });
    addY(10);

    // Section 6: Notes
    if (profile.managerNotes && profile.managerNotes.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text("6. MANAGER SESSION NOTES SUMMARY", MARGIN, y());
        addY(6);

        profile.managerNotes.slice(0, 3).forEach(n => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text(`Note date: ${new Date(n.createdAt).toLocaleDateString()}`, MARGIN + 4, y());
            addY(4.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            const nLines = doc.splitTextToSize(n.text, CONTENT - 8);
            nLines.forEach(line => {
                doc.text(line, MARGIN + 8, y());
                addY(4.5);
            });
            addY(2);
        });
        addY(8);
    }

    // Signatures
    setY(PH - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    
    doc.text("Evaluator / Manager Signature:", MARGIN, y());
    doc.text("Employee Signature:", PW / 2 + 10, y());
    addY(14);
    doc.text("________________________________", MARGIN, y());
    doc.text("________________________________", PW / 2 + 10, y());
    addY(5);
    doc.text("Date", MARGIN, y());
    doc.text("Date", PW / 2 + 10, y());

    // Footer page 2
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Convexa AI · Enterprise Performance Evaluation and Review Platform", PW / 2, PH - 6, { align: "center" });

    const safeName = (profile.name || "employee-review")
        .replace(/[^a-zA-Z0-9_\-]/g, "_")
        .substring(0, 60);
    doc.save(`${safeName}_performance_review.pdf`);
}

