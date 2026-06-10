/**
 * generateReport.js
 *
 * Produces a multi-page PDF call analytics report entirely in the browser
 * using jsPDF (already available as an npm package or CDN).
 *
 * Install once:
 *   npm install jspdf
 *
 * Usage:
 *   import { generateCallReport } from "../utils/generateReport";
 *   generateCallReport(call);           // downloads immediately
 */

import { jsPDF } from "jspdf";

// ─── Brand colours ────────────────────────────────────────────────────────────
const C = {
    bg:           [10,  10,  26 ],   // #0a0a1a
    card:         [22,  18,  60 ],   // #16123c
    accent:       [139, 92,  246],   // violet-500
    accentDark:   [109, 40,  217],   // violet-700
    blue:         [59,  130, 246],   // blue-500
    emerald:      [16,  185, 129],   // emerald-500
    amber:        [245, 158, 11 ],   // amber-500
    red:          [239, 68,  68 ],   // red-500
    white:        [255, 255, 255],
    muted:        [148, 163, 184],   // slate-400
    dim:          [71,  85,  105],   // slate-600
    border:       [30,  27,  75 ],   // indigo-950
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert an [r,g,b] array into the three separate args jsPDF expects */
function rgb(arr) { return arr; }

/**
 * Word-wrap a string to fit within maxWidth at the current font size.
 * Returns an array of lines.
 */
function wrapText(doc, text, maxWidth) {
    if (!text) return ["—"];
    return doc.splitTextToSize(String(text), maxWidth);
}

/**
 * Draw a filled rounded rectangle.
 * jsPDF's roundedRect uses (x,y,w,h,rx,ry,'F')
 */
function filledRect(doc, x, y, w, h, r, color) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, w, h, r, r, "F");
}

/**
 * Draw a score bar.
 *   track = dimmed background, fill = coloured progress.
 */
function scoreBar(doc, x, y, w, h, score, color) {
    const pct = Math.min((score || 0) / 100, 1);
    // Track
    doc.setFillColor(...C.border);
    doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
    // Fill
    if (pct > 0) {
        doc.setFillColor(...color);
        doc.roundedRect(x, y, w * pct, h, h / 2, h / 2, "F");
    }
}

/**
 * Section header: coloured left accent bar + bold white label.
 * Returns the Y position after the header so the caller can continue.
 */
function sectionHeader(doc, label, y, color = C.accent) {
    filledRect(doc, 14, y, 3, 7, 1.5, color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C.muted);
    doc.text(label.toUpperCase(), 20, y + 5.5);
    return y + 14;
}

/**
 * Bullet point row.
 * Returns updated Y after the row (with multi-line support).
 */
function bullet(doc, text, x, y, pageH, newPage, dotColor = C.accent) {
    const maxW = 170 - (x - 14);
    const lines = wrapText(doc, text, maxW);
    if (y + lines.length * 5.5 > pageH - 20) {
        y = newPage();
    }
    // Dot
    doc.setFillColor(...dotColor);
    doc.circle(x - 3, y + 1.8, 1.2, "F");
    doc.setTextColor(...C.white);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    lines.forEach((line, i) => {
        doc.text(line, x, y + i * 5.4);
    });
    return y + lines.length * 5.4 + 3;
}

/**
 * Clean markdown artifacts from a string.
 */
function clean(str) {
    if (!str) return "—";
    return str
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/#+\s?/g, "")
        .replace(/^[\s\-•>]+/, "")
        .trim() || "—";
}

function parseList(str) {
    if (!str) return [];
    return str.split(/,|\n/).map(s => s.replace(/^[\s*\-•]+/, "").trim()).filter(Boolean);
}

function fmt(s) {
    if (!s && s !== 0) return "—";
    return `${s}`;
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

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateCallReport(call) {
    if (!call) return;

    const doc      = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const PW       = doc.internal.pageSize.getWidth();   // 210
    const PH       = doc.internal.pageSize.getHeight();  // 297
    const MARGIN   = 14;
    const CONTENT  = PW - MARGIN * 2;  // 182
    let   y        = 0;

    // ── New page helper ──────────────────────────────────────────────────────
    let pageNum = 1;

    function newPage() {
        doc.addPage();
        pageNum++;
        drawPageBackground();
        drawPageFooter();
        return MARGIN + 10;
    }

    function drawPageBackground() {
        // Dark background
        doc.setFillColor(...C.bg);
        doc.rect(0, 0, PW, PH, "F");
    }

    function drawPageFooter() {
        const footerY = PH - 8;
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, footerY - 2, PW - MARGIN, footerY - 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.dim);
        doc.text("Convexa AI · Conversation Intelligence Platform", MARGIN, footerY);
        doc.text(`Page ${pageNum}`, PW - MARGIN, footerY, { align: "right" });
        doc.text(`Generated: ${new Date().toLocaleString()}`, PW / 2, footerY, { align: "center" });
    }

    // ── PAGE 1 BACKGROUND ────────────────────────────────────────────────────
    drawPageBackground();

    // ── HEADER GRADIENT BAND ─────────────────────────────────────────────────
    // Simulate gradient with stacked rectangles
    const steps = 20;
    for (let i = 0; i < steps; i++) {
        const t   = i / steps;
        const r   = Math.round(C.accentDark[0] + t * (C.bg[0] - C.accentDark[0]));
        const g   = Math.round(C.accentDark[1] + t * (C.bg[1] - C.accentDark[1]));
        const b   = Math.round(C.accentDark[2] + t * (C.bg[2] - C.accentDark[2]));
        doc.setFillColor(r, g, b);
        doc.rect(0, i * (52 / steps), PW, 52 / steps + 0.5, "F");
    }

    // Subtle left accent bar
    filledRect(doc, 0, 0, 4, 52, 0, C.accent);

    // Logo text
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

    // Report title (right-aligned)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.white);
    doc.text("Call Analytics Report", PW - MARGIN, 18, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("Confidential · For Internal Use", PW - MARGIN, 25, { align: "right" });

    // Divider under header
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, 52, PW - MARGIN, 52);

    y = 60;

    // ── SECTION 1: CALL INFORMATION ──────────────────────────────────────────
    y = sectionHeader(doc, "Call Information", y, C.accent);

    // Info card background
    filledRect(doc, MARGIN, y - 2, CONTENT, 42, 3, C.card);

    const infoRows = [
        ["File Name",   call.fileName || "—"],
        ["Call ID",     `#${call.id || "—"}`],
        ["Date",        fmtDate(call.createdAt)],
        ["Status",      call.status || "COMPLETED"],
    ];

    doc.setFontSize(9);
    infoRows.forEach(([label, value], i) => {
        const rowX = MARGIN + 6;
        const rowY = y + 5 + i * 9;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.muted);
        doc.text(label + ":", rowX, rowY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.white);
        const valLines = wrapText(doc, value, CONTENT - 55);
        doc.text(valLines[0], rowX + 32, rowY);
    });

    y += 48;

    // ── SECTION 2: EXECUTIVE SUMMARY ─────────────────────────────────────────
    y = sectionHeader(doc, "Executive Summary", y, C.blue);

    if (call.summary) {
        filledRect(doc, MARGIN, y - 2, CONTENT, 2, 0, C.card);
        const summaryLines = wrapText(doc, clean(call.summary), CONTENT - 10);
        const cardH = summaryLines.length * 5.5 + 10;
        filledRect(doc, MARGIN, y - 2, CONTENT, cardH, 3, C.card);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(...C.muted);
        summaryLines.forEach((line, i) => doc.text(line, MARGIN + 5, y + 5 + i * 5.5));
        y += cardH + 6;
    }

    // ── SECTION 3: SENTIMENT + OVERALL SCORE (side by side) ──────────────────
    y = sectionHeader(doc, "Sentiment & Overall Score", y, C.emerald);

    // Sentiment card
    const sentColor = call.sentiment === "POSITIVE" ? C.emerald
                    : call.sentiment === "NEGATIVE" ? C.red
                    : C.amber;
    const sentEmoji = call.sentiment === "POSITIVE" ? "Positive"
                    : call.sentiment === "NEGATIVE" ? "Negative"
                    : "Neutral";

    filledRect(doc, MARGIN, y - 2, 85, 22, 3, C.card);
    doc.setFillColor(...sentColor);
    doc.roundedRect(MARGIN + 5, y + 2, 18, 12, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.bg);
    doc.text(sentEmoji.charAt(0), MARGIN + 11, y + 10, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...sentColor);
    doc.text(sentEmoji, MARGIN + 28, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("Sentiment Analysis", MARGIN + 6, y + 18);

    // Overall score card
    if (call.overallScore != null) {
        filledRect(doc, MARGIN + 95, y - 2, 85, 22, 3, C.card);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(...C.accent);
        doc.text(`${call.overallScore}`, MARGIN + 118, y + 13, { align: "center" });
        doc.setFontSize(10);
        doc.setTextColor(...C.muted);
        doc.text("/ 100", MARGIN + 126, y + 13);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Overall QA Score", MARGIN + 100, y + 18);
        scoreBar(doc, MARGIN + 100, y + 19, 74, 2.5, call.overallScore, C.accent);
    }

    y += 30;

    // ── SECTION 4: QA SCORE BREAKDOWN ────────────────────────────────────────
    if (call.communication || call.professionalism || call.problemResolution || call.customerSatisfaction) {
        y = sectionHeader(doc, "QA Score Breakdown", y, C.accent);

        const dims = [
            { label: "Communication",       key: "communication",       color: C.accent  },
            { label: "Professionalism",      key: "professionalism",     color: C.emerald },
            { label: "Problem Resolution",   key: "problemResolution",   color: C.blue    },
            { label: "Customer Satisfaction",key: "customerSatisfaction",color: C.amber   },
        ];

        // 2×2 grid of score cards
        dims.forEach(({ label, key, color }, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx  = MARGIN + col * (CONTENT / 2 + 2);
            const cy  = y + row * 20;
            const cw  = CONTENT / 2 - 2;

            filledRect(doc, cx, cy - 2, cw, 17, 3, C.card);

            const score = call[key];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(...color);
            doc.text(score != null ? `${score}` : "—", cx + 10, cy + 9);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...C.muted);
            doc.text(label, cx + 10 + (score != null ? doc.getTextWidth(`${score}`) + 3 : 8), cy + 9);
            scoreBar(doc, cx + 6, cy + 11, cw - 12, 2, score, color);
        });

        y += 46;
    }

    drawPageFooter();

    // ── PAGE 2 ────────────────────────────────────────────────────────────────
    y = newPage();

    // ── SECTION 5: KEYWORDS ───────────────────────────────────────────────────
    const keywords = parseList(call.keywords);
    if (keywords.length > 0) {
        y = sectionHeader(doc, "Keywords", y, C.blue);

        let kx = MARGIN;
        let ky = y;
        const maxKW = PW - MARGIN;

        keywords.forEach(kw => {
            const kw_clean = clean(kw);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            const kw_w = doc.getTextWidth(kw_clean) + 10;

            if (kx + kw_w > maxKW) {
                kx = MARGIN;
                ky += 9;
            }

            filledRect(doc, kx, ky - 5, kw_w, 7, 3.5, [30, 25, 80]);
            doc.setTextColor(...C.accent);
            doc.text(kw_clean, kx + 5, ky);
            kx += kw_w + 4;
        });

        y = ky + 12;
    }

    // ── SECTION 6: STRENGTHS ──────────────────────────────────────────────────
    const strengths = parseList(call.strengths);
    if (strengths.length > 0) {
        y = sectionHeader(doc, "Strengths", y, C.emerald);
        strengths.forEach(s => {
            if (y > PH - 30) y = newPage();
            y = bullet(doc, clean(s), MARGIN + 8, y, PH, newPage, C.emerald);
        });
        y += 4;
    }

    // ── SECTION 7: AREAS FOR IMPROVEMENT ─────────────────────────────────────
    const improvements = parseList(call.improvements);
    if (improvements.length > 0) {
        if (y > PH - 50) y = newPage();
        y = sectionHeader(doc, "Areas for Improvement", y, C.amber);
        improvements.forEach(s => {
            if (y > PH - 30) y = newPage();
            y = bullet(doc, clean(s), MARGIN + 8, y, PH, newPage, C.amber);
        });
        y += 4;
    }

    // ── SECTION 8: AI INSIGHTS ────────────────────────────────────────────────
    if (call.insights) {
        if (y > PH - 60) y = newPage();
        y = sectionHeader(doc, "AI Insights", y, C.blue);

        const INSIGHT_LABELS = [
            "Customer Intent",
            "Main Issue",
            "Customer Concern",
            "Outcome",
            "Agent Performance",
        ];

        // Try structured parse first
        const allLabels   = INSIGHT_LABELS.join("|").replace(/\s/g, "\\s*");
        const labelRegex  = new RegExp(
            `(?:#{1,3}\\s*)?(?:${allLabels})\\s*[:\\n]([\\s\\S]*?)(?=(?:${allLabels})\\s*[:\\n]|$)`,
            "gi"
        );

        let parsed = false;
        let m;
        while ((m = labelRegex.exec(call.insights)) !== null) {
            parsed = true;
            const header = m[0].split(/[:\n]/)[0].replace(/^#+\s*/, "").trim();
            const value  = clean(m[1]?.split("\n")[0] || m[1]);
            if (!value || value === "—") continue;

            if (y > PH - 30) y = newPage();

            // Label
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(...C.blue);
            doc.text(header + ":", MARGIN + 5, y);
            // Value
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...C.white);
            const lines = wrapText(doc, value, CONTENT - 12);
            lines.forEach((ln, li) => doc.text(ln, MARGIN + 8, y + 5.5 + li * 5.2));
            y += 5.5 + lines.length * 5.2 + 4;
        }

        if (!parsed) {
            // Fallback: bullet list
            const bullets = call.insights
                .split(/\n/)
                .map(l => clean(l))
                .filter(l => l && l !== "—");
            bullets.forEach(b => {
                if (y > PH - 30) y = newPage();
                y = bullet(doc, b, MARGIN + 8, y, PH, newPage, C.blue);
            });
        }

        y += 6;
    }

    // ── PAGE 3: TRANSCRIPT ────────────────────────────────────────────────────
    if (call.transcript) {
        y = newPage();
        y = sectionHeader(doc, "Full Transcript", y, C.muted);

        doc.setFont("courier", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...C.muted);

        const transcriptLines = wrapText(doc, call.transcript, CONTENT - 4);

        transcriptLines.forEach(line => {
            if (y > PH - 18) {
                y = newPage();
                doc.setFont("courier", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(...C.muted);
            }
            doc.text(line, MARGIN + 2, y);
            y += 4.8;
        });
    }

    drawPageFooter();

    // ── SAVE ──────────────────────────────────────────────────────────────────
    const safeName = (call.fileName || "call-report")
        .replace(/[^a-zA-Z0-9_\-]/g, "_")
        .substring(0, 60);
    doc.save(`${safeName}_report.pdf`);
}
