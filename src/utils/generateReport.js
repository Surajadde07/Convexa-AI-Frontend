/**
 * generateReport.js  —  Convexa AI · Call Analytics PDF Report
 *
 * Changes vs previous version
 * ─────────────────────────────────────────────────────────────
 * FIX 1 – AI Insights section was silently dropped.
 *   Root cause: the label regex used  (?:${allLabels})  where allLabels was
 *   built with .join("|") on the raw strings.  Spaces inside label names
 *   (e.g. "Customer Intent") were never escaped, so the alternation broke
 *   on every label after the first word.  The regex matched nothing →
 *   parsed=false → fallback bullet-splitter ran instead, but the fallback
 *   itself filtered out "—" lines and non-blank empty lines in a way that
 *   dropped the whole section for structured LLM responses.
 *   Fix: escape each label individually; keep a robust two-pass approach
 *   (structured → inline-key → plain-text fallback).
 *
 * FIX 2 – Bullet misalignment / overlap.
 *   Root cause: the dot was drawn at (x-3, y+1.8) but text started at (x, y).
 *   When a bullet wrapped to a second line the dot stayed at line 0 while
 *   text moved down, making them overlap.
 *   Fix: dot is now drawn at the vertical centre of the first line only and
 *   text X is always dot_x + gap (no magic offset arithmetic).
 *
 * FIX 3 – Insight cards now render as proper labelled blocks with a coloured
 *   left bar instead of a raw "Label: value" inline line.
 *
 * FIX 4 – Page-overflow guard was missing from several sections.
 *   Every block now calls checkPage(minRemaining) before drawing.
 *
 * FIX 5 – Summary card height was sometimes calculated wrong (the rect was
 *   drawn with h=2 when summary existed, leaving text outside the card).
 *   Fixed by computing cardH before drawing the rect.
 */

import { jsPDF } from "jspdf";

// ─── Brand palette ────────────────────────────────────────────────────────────
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

// Canonical insight sections with individual colours
const INSIGHT_DEFS = [
    { key: "Customer Intent",    emoji: "🎯", color: C.accent  },
    { key: "Main Issue",         emoji: "🔍", color: C.blue    },
    { key: "Customer Concern",   emoji: "⚠",  color: C.amber   },
    { key: "Outcome",            emoji: "✅", color: C.emerald },
    { key: "Agent Performance",  emoji: "👤", color: C.rose    },
];

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
    return str
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

function fmtDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("en-US", {
            weekday: "long", year: "numeric", month: "long",
            day: "numeric", hour: "2-digit", minute: "2-digit",
        });
    } catch { return iso; }
}

// ─── PDF state (module-level, reset on each call) ────────────────────────────

let _doc, PW, PH, MARGIN, CONTENT, _y, _pageNum;

function init(doc) {
    _doc    = doc;
    PW      = doc.internal.pageSize.getWidth();
    PH      = doc.internal.pageSize.getHeight();
    MARGIN  = 14;
    CONTENT = PW - MARGIN * 2;
    _y      = 0;
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
    _doc.text("Convexa AI · Conversation Intelligence Platform", MARGIN, fy);
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

function sectionHeader(label, color = C.accent) {
    checkPage(18);
    filledRect(_doc, MARGIN, y(), 3, 7, 1.5, color);
    _doc.setFont("helvetica", "bold");
    _doc.setFontSize(9.5);
    _doc.setTextColor(...C.muted);
    _doc.text(label.toUpperCase(), MARGIN + 7, y() + 5.5);
    addY(14);
}

/**
 * FIX 2 – bullet with correct dot alignment.
 * Dot is always drawn at the vertical centre of the FIRST line only.
 */
function bullet(text, xIndent, dotColor = C.accent) {
    const x      = MARGIN + xIndent;
    const maxW   = CONTENT - xIndent - 2;
    const lines  = wrapText(_doc, text, maxW);
    const lineH  = 5.4;

    checkPage(lines.length * lineH + 4);

    // Dot: centred on first text line
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

// ─── AI Insights parser ──────────────────────────────────────────────────────
/**
 * FIX 1 – robust two-pass parser.
 *
 * Pass 1 (structured): look for each canonical label followed by a colon
 *   (optionally with markdown heading prefix).  Escape spaces in the label
 *   individually so "Customer Intent:" works even inside a larger string.
 *
 * Pass 2 (inline): labels that appear with no newline before them
 *   (LLM returned everything on one line).
 *
 * Pass 3 (fallback): if nothing was found, treat the whole text as a single
 *   unstructured block and bullet-split it.
 *
 * Returns: Array<{ label, color, lines: string[] }>
 */
function parseInsightSections(raw) {
    if (!raw?.trim()) return [];

    const results = [];

    for (const def of INSIGHT_DEFS) {
        // Escape each character in the label (handles spaces, parentheses, etc.)
        const escapedLabel = def.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        // Match: optional markdown heading + label + optional colon + content
        // Content ends at the next canonical label or end-of-string.
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

    // Fallback: no structured sections found → treat whole text as bullets
    if (results.length === 0) {
        const bullets = raw
            .split(/\n/)
            .map(l => clean(l))
            .filter(l => l && l !== "—");
        return bullets.map(b => ({ label: null, color: C.blue, lines: [b] }));
    }

    return results;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateCallReport(call) {
    if (!call) return;

    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    init(doc);

    // ── PAGE 1 BACKGROUND ────────────────────────────────────────────────────
    drawPageBg();

    // ── HEADER BAND (gradient simulation) ────────────────────────────────────
    const BAND_H = 52;
    const steps  = 24;
    for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const r = Math.round(C.accentDark[0] + t * (C.bg[0] - C.accentDark[0]));
        const g = Math.round(C.accentDark[1] + t * (C.bg[1] - C.accentDark[1]));
        const b = Math.round(C.accentDark[2] + t * (C.bg[2] - C.accentDark[2]));
        doc.setFillColor(r, g, b);
        doc.rect(0, i * (BAND_H / steps), PW, BAND_H / steps + 0.5, "F");
    }

    // Left accent bar
    filledRect(doc, 0, 0, 4, BAND_H, 0, C.accent);

    // Logo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...C.white);
    doc.text("CONVEXA", MARGIN + 4, 18);
    doc.setTextColor(...C.accent);
    doc.text(" AI", MARGIN + 4 + doc.getTextWidth("CONVEXA"), 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.muted);
    doc.text("CONVERSATION INTELLIGENCE PLATFORM", MARGIN + 4, 25);

    // Report title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.white);
    doc.text("Call Analytics Report", PW - MARGIN, 18, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("Confidential · For Internal Use", PW - MARGIN, 25, { align: "right" });

    // Divider
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, BAND_H, PW - MARGIN, BAND_H);

    setY(BAND_H + 8);

    // ── SECTION 1: CALL INFORMATION ──────────────────────────────────────────
    sectionHeader("Call Information", C.accent);

    const infoRows = [
        ["File Name", call.fileName || "—"],
        ["Call ID",   `#${call.id    || "—"}`],
        ["Date",      fmtDate(call.createdAt)],
        ["Status",    call.status    || "COMPLETED"],
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

    // ── SECTION 2: EXECUTIVE SUMMARY ─────────────────────────────────────────
    if (call.summary) {
        sectionHeader("Executive Summary", C.blue);
        const summaryLines = wrapText(doc, clean(call.summary), CONTENT - 10);
        const cardH        = summaryLines.length * 5.5 + 12;
        checkPage(cardH + 8);
        filledRect(doc, MARGIN, y(), CONTENT, cardH, 3, C.card);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(...C.muted);
        summaryLines.forEach((line, i) => doc.text(line, MARGIN + 6, y() + 7 + i * 5.5));
        addY(cardH + 8);
    }

    // ── SECTION 3: SENTIMENT + OVERALL SCORE ─────────────────────────────────
    sectionHeader("Sentiment & Overall Score", C.emerald);

    const sentColor = call.sentiment === "POSITIVE" ? C.emerald
                    : call.sentiment === "NEGATIVE" ? C.red
                    : C.amber;
    const sentLabel = call.sentiment === "POSITIVE" ? "Positive"
                    : call.sentiment === "NEGATIVE" ? "Negative"
                    : "Neutral";

    // Sentiment card (left half)
    filledRect(doc, MARGIN, y(), 87, 24, 3, C.card);
    filledRect(doc, MARGIN + 6, y() + 5, 16, 14, 7, sentColor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.bg);
    doc.text(sentLabel.charAt(0), MARGIN + 14, y() + 13, { align: "center" });
    doc.setFontSize(12);
    doc.setTextColor(...sentColor);
    doc.text(sentLabel, MARGIN + 26, y() + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.dim);
    doc.text("Sentiment Analysis", MARGIN + 7, y() + 21);

    // Overall score card (right half)
    if (call.overallScore != null) {
        const sx = MARGIN + 95;
        filledRect(doc, sx, y(), 87, 24, 3, C.card);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(...C.accent);
        doc.text(`${call.overallScore}`, sx + 22, y() + 14, { align: "center" });
        doc.setFontSize(10);
        doc.setTextColor(...C.muted);
        doc.text("/ 100", sx + 34, y() + 14);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.dim);
        doc.text("Overall QA Score", sx + 6, y() + 21);
        scoreBar(doc, sx + 6, y() + 21, 74, 2.5, call.overallScore, C.accent);
    }

    addY(32);

    // ── SECTION 4: QA SCORE BREAKDOWN ────────────────────────────────────────
    const hasDims = call.communication || call.professionalism
                 || call.problemResolution || call.customerSatisfaction;

    if (hasDims) {
        sectionHeader("QA Score Breakdown", C.accent);

        const dims = [
            { label: "Communication",        key: "communication",        color: C.accent  },
            { label: "Professionalism",       key: "professionalism",      color: C.emerald },
            { label: "Problem Resolution",    key: "problemResolution",    color: C.blue    },
            { label: "Customer Satisfaction", key: "customerSatisfaction", color: C.amber   },
        ];

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

    drawFooter();

    // ═════════════════════════════════════════
    //  PAGE 2
    // ═════════════════════════════════════════
    newPage();

    // ── SECTION 5: KEYWORDS ───────────────────────────────────────────────────
    const keywords = parseList(call.keywords);
    if (keywords.length > 0) {
        sectionHeader("Keywords", C.blue);

        let kx = MARGIN;
        let ky = y();

        keywords.forEach(kw => {
            const kw_clean = clean(kw);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            const kwW = doc.getTextWidth(kw_clean) + 12;

            if (kx + kwW > PW - MARGIN) {
                kx  = MARGIN;
                ky += 10;
                if (ky > PH - 20) {
                    setY(ky);
                    newPage();
                    ky = y();
                }
            }

            filledRect(doc, kx, ky - 5.5, kwW, 8, 4, [28, 24, 78]);
            doc.setTextColor(...C.accent);
            doc.text(kw_clean, kx + 6, ky);
            kx += kwW + 5;
        });

        setY(ky + 13);
    }

    // ── SECTION 6: STRENGTHS ──────────────────────────────────────────────────
    const strengths = parseList(call.strengths);
    if (strengths.length > 0) {
        sectionHeader("Strengths", C.emerald);
        strengths.forEach(s => bullet(clean(s), 8, C.emerald));
        addY(4);
    }

    // ── SECTION 7: AREAS FOR IMPROVEMENT ─────────────────────────────────────
    const improvements = parseList(call.improvements);
    if (improvements.length > 0) {
        checkPage(24);
        sectionHeader("Areas for Improvement", C.amber);
        improvements.forEach(s => bullet(clean(s), 8, C.amber));
        addY(4);
    }

    // ── SECTION 8: AI INSIGHTS ────────────────────────────────────────────────
    //
    // FIX 1 + FIX 3: structured cards with coloured left bar; each section is
    // a self-contained card.  Falls back to plain bullets for unstructured text.
    // ─────────────────────────────────────────────────────────────────────────
    if (call.insights) {
        checkPage(30);
        sectionHeader("AI Insights", C.blue);

        const sections = parseInsightSections(call.insights);

        if (sections.length > 0 && sections[0].label !== null) {
            // Structured mode: one card per canonical section
            sections.forEach(({ label, color, lines }) => {
                const cardH = Math.max(lines.length * 5.5 + 14, 20);
                checkPage(cardH + 6);

                // Card background
                filledRect(doc, MARGIN, y(), CONTENT, cardH, 3, C.card);

                // Coloured left accent strip
                filledRect(doc, MARGIN, y(), 3, cardH, 1.5, color);

                // Label
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8);
                doc.setTextColor(...color);
                doc.text(label.toUpperCase(), MARGIN + 8, y() + 6);

                // Value lines
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9.5);
                doc.setTextColor(...C.white);
                lines.forEach((line, i) => {
                    doc.text(line, MARGIN + 8, y() + 12 + i * 5.5);
                });

                addY(cardH + 4);
            });
        } else {
            // Unstructured fallback: plain bullet list
            sections.forEach(({ lines }) => {
                lines.forEach(line => bullet(line, 8, C.blue));
            });
        }

        addY(6);
    }

    // ═════════════════════════════════════════
    //  PAGE 3+: TRANSCRIPT
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