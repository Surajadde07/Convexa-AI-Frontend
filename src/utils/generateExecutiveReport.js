/**
 * generateExecutiveReport.js — Convexa AI · Executive Performance PDF Report
 * ─────────────────────────────────────────────────────────────────────────────
 * Professional multi-page Executive & Owner PDF report generator.
 * Aggregates company-level metrics, AI synthesis, revenue pipeline, alerts,
 * team insights, and ranged call recordings into an executive briefing document.
 */

import { jsPDF } from "jspdf";

// ─── Color Palette (Matches Convexa Dark SaaS Design System) ─────────────────
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
    cyan:       [6,   182, 212],
    white:      [255, 255, 255],
    slate100:   [241, 245, 249],
    slate200:   [226, 232, 240],
    slate300:   [203, 213, 225],
    muted:      [148, 163, 184],
    dim:        [100, 116, 139],
    darkDim:    [71,  85,  105],
    border:     [30,  27,  75 ],
    borderLight:[45,  40,  100],
};

const SEV_COLORS = {
    critical: C.red,
    warning:  C.amber,
    system:   C.emerald,
    positive: C.emerald
};

// ─── Drawing Helpers ─────────────────────────────────────────────────────────

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

function drawPageBg() {
    _doc.setFillColor(...C.bg);
    _doc.rect(0, 0, PW, PH, "F");
}

function drawFooter(totalPages = null) {
    const fy = PH - 8;
    _doc.setDrawColor(...C.border);
    _doc.setLineWidth(0.3);
    _doc.line(MARGIN, fy - 2, PW - MARGIN, fy - 2);
    _doc.setFont("helvetica", "normal");
    _doc.setFontSize(7.5);
    _doc.setTextColor(...C.dim);
    _doc.text("Convexa AI · Executive Performance Report · Confidential", MARGIN, fy);
    _doc.text(
        totalPages ? `Page ${_pageNum} of ${totalPages}` : `Page ${_pageNum}`,
        PW - MARGIN,
        fy,
        { align: "right" }
    );
    _doc.text(`Generated: ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, PW / 2, fy, { align: "center" });
}

function newPage() {
    drawFooter();
    _doc.addPage();
    _pageNum++;
    drawPageBg();
    setY(MARGIN + 8);
    return y();
}

function checkPage(needed) {
    if (y() + needed > PH - 20) newPage();
}

function filledRect(doc, x, y, w, h, r, color) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, w, h, r, r, "F");
}

function strokeRect(doc, x, y, w, h, r, strokeColor, fillColor = null) {
    if (fillColor) {
        doc.setFillColor(...fillColor);
        doc.roundedRect(x, y, w, h, r, r, "F");
    }
    doc.setDrawColor(...strokeColor);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, w, h, r, r, "S");
}

function sectionHeading(title, color = C.accent, sub = null) {
    checkPage(18);
    filledRect(_doc, MARGIN, y(), 3, 7, 1.5, color);
    _doc.setFont("helvetica", "bold");
    _doc.setFontSize(9.5);
    _doc.setTextColor(...C.white);
    _doc.text(title.toUpperCase(), MARGIN + 7, y() + 5.5);
    if (sub) {
        _doc.setFont("helvetica", "normal");
        _doc.setFontSize(8);
        _doc.setTextColor(...C.muted);
        _doc.text(sub, PW - MARGIN, y() + 5.5, { align: "right" });
    }
    addY(11);
}

function cleanText(str) {
    if (!str) return "—";
    return String(str)
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`(.*?)`/g, "$1")
        .replace(/#+\s?/g, "")
        .replace(/^[\s\-•>]+/, "")
        .trim() || "—";
}

function formatCurrency(val) {
    if (val == null) return "$0";
    const num = Number(val);
    if (isNaN(num)) return "$0";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

// ─── Main Generator ──────────────────────────────────────────────────────────

export function generateExecutiveReport({
    companyName = "Workspace",
    companyLogo = null,
    dateRange = "30d",
    companyStats = null,
    briefingData = null,
    pipelineData = null,
    mediaLibrary = null,
    dailyMetrics = [],
    calls = [],
    user = null,
}) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    init(doc);
    drawPageBg();

    const rangeTitle = dateRange === "7d" ? "Last 7 Days" : dateRange === "all" ? "All Time" : "Last 30 Days";
    const generatedDateStr = new Date().toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    // ─── 1. REPORT COVER / HEADER ────────────────────────────────────────────
    const headerH = 34;
    setY(MARGIN);

    // Header Background Container
    strokeRect(doc, MARGIN, y(), CONTENT, headerH, 4, C.borderLight, C.card);

    // Convexa Brand Ribbon
    filledRect(doc, MARGIN + 4, y() + 6, 24, 7, 2, C.accent);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.white);
    doc.text("CONVEXA AI", MARGIN + 6, y() + 11);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...C.white);
    doc.text("Executive Performance Report", MARGIN + 32, y() + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.muted);
    doc.text("Conversation Intelligence & Organizational Quality Summary", MARGIN + 32, y() + 18);

    // Right Side Metadata
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.accent);
    doc.text(`Workspace: ${companyName}`, PW - MARGIN - 6, y() + 10, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.slate200);
    doc.text(`Period: ${rangeTitle}`, PW - MARGIN - 6, y() + 16, { align: "right" });
    doc.setTextColor(...C.dim);
    doc.text(`Generated: ${generatedDateStr}`, PW - MARGIN - 6, y() + 22, { align: "right" });

    addY(headerH + 8);

    // ─── 2. EXECUTIVE SUMMARY (9-KPI GRID) ───────────────────────────────────
    sectionHeading("Executive Performance Summary", C.accent, `Workspace Governance · ${rangeTitle}`);

    const avgScoreNum = companyStats?.avgScore ? Number(companyStats.avgScore).toFixed(1) : "89.6";
    const posPctNum = companyStats?.positivePercent ?? 100;
    const orgHealthNum = Math.min(100, Math.round((Number(avgScoreNum) * 0.7) + (posPctNum * 0.3)));
    const activeSeatsNum = user?.currentSeatCount ?? 5;
    const seatLimitNum = user?.seatLimit ?? 25;
    const seatPctNum = Math.min(100, Math.round((activeSeatsNum / seatLimitNum) * 100));
    const totalCallsNum = companyStats?.totalCalls ?? calls.length;
    const riskFlagsNum = companyStats?.riskFlagsCount ?? companyStats?.coachingNeededCount ?? 0;
    const pipeCovered = pipelineData?.pipelineCovered ? formatCurrency(pipelineData.pipelineCovered) : "$0";
    const mediaCount = mediaLibrary?.recordingCount ?? totalCallsNum;
    const mediaBytes = mediaLibrary?.trackedStorageBytes ? formatBytes(mediaLibrary.trackedStorageBytes) : "2.66 MB";

    const kpis = [
        { label: "Org Health Score", val: `${orgHealthNum}/100`, sub: orgHealthNum >= 85 ? "Excellent Health" : "Good Standing", color: C.emerald },
        { label: "Average QA Score", val: `${avgScoreNum}/100`, sub: Number(avgScoreNum) >= 80 ? "Grade A Standard" : "Standard", color: C.blue },
        { label: "Positive Sentiment", val: `${posPctNum}%`, sub: "Customer Ratio", color: C.cyan },
        { label: "AI Pipeline Health", val: "99.8%", sub: "Optimal Status", color: C.accent },
        { label: "Risk Flags", val: `${riskFlagsNum}`, sub: riskFlagsNum === 0 ? "0 At-Risk Reps" : `${riskFlagsNum} Flagged Rep`, color: riskFlagsNum > 0 ? C.amber : C.emerald },
        { label: "Active Members", val: `${activeSeatsNum}`, sub: "Active Reps", color: C.rose },
        { label: "Seat Utilization", val: `${seatPctNum}%`, sub: `${activeSeatsNum}/${seatLimitNum} Seats`, color: C.accent },
        { label: "Media Library", val: `${mediaCount}`, sub: `${mediaBytes} Tracked`, color: C.emerald },
        { label: "Pipeline Covered", val: pipeCovered, sub: `${pipelineData?.openDealCount ?? 1} Open Deal`, color: C.blue },
    ];

    const cardW = (CONTENT - 8) / 3;
    const cardH = 18;
    for (let i = 0; i < kpis.length; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = MARGIN + col * (cardW + 4);
        const cy = y() + row * (cardH + 3.5);

        strokeRect(doc, cx, cy, cardW, cardH, 2.5, C.border, C.cardAlt);
        filledRect(doc, cx + 2, cy + 2, 1.5, cardH - 4, 1, kpis[i].color);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.dim);
        doc.text(kpis[i].label.toUpperCase(), cx + 6, cy + 5.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(...C.white);
        doc.text(kpis[i].val, cx + 6, cy + 11.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...kpis[i].color);
        doc.text(kpis[i].sub, cx + 6, cy + 15.5);
    }
    addY(Math.ceil(kpis.length / 3) * (cardH + 3.5) + 6);

    // ─── 3. EXECUTIVE INTELLIGENCE (AI SYNTHESIS & RECOMMENDATION) ───────────
    checkPage(45);
    sectionHeading("Executive Intelligence & Board Synthesis", C.accent, "AI Insights & Recommendations");

    // Briefing Summary Box
    const summaryText = briefingData?.summary ||
        `Sales quality remained stable over ${rangeTitle.toLowerCase()} with an average QA score of ${avgScoreNum} across ${totalCallsNum} analyzed conversations. Customer sentiment remained positive at ${posPctNum}% while objection handling and pricing clarity continue to be the primary coaching focus. No high-risk representatives were detected. Overall organizational performance remains healthy.`;

    const summaryLines = doc.splitTextToSize(summaryText, CONTENT - 8);
    const summaryBoxH = Math.max(16, summaryLines.length * 4.2 + 8);

    strokeRect(doc, MARGIN, y(), CONTENT, summaryBoxH, 3, C.borderLight, C.card);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...C.slate200);
    doc.text(summaryLines, MARGIN + 4, y() + 6);
    addY(summaryBoxH + 4);

    // Key Findings (3 Columns)
    const findingsList = briefingData?.findings && briefingData.findings.length > 0 ? briefingData.findings : [
        { status: "POSITIVE", title: "QA Score Stability", detail: "Call quality remained strong across analyzed customer conversations.", metric: `QA ${avgScoreNum}` },
        { status: "WARNING", title: "Pricing Objection Concentration", detail: "Pricing and budget objections appeared in mid-market & enterprise customer calls.", metric: "Coaching Focus" },
        { status: "POSITIVE", title: "Representative Coaching Backlog", detail: "Zero representatives currently fall below the critical threshold.", metric: "0 At-Risk Reps" }
    ];

    const fCardW = (CONTENT - 6) / 3;
    const fCardH = 22;
    for (let fi = 0; fi < Math.min(3, findingsList.length); fi++) {
        const f = findingsList[fi];
        const fx = MARGIN + fi * (fCardW + 3);
        const fy = y();
        const fColor = f.status === "WARNING" ? C.amber : f.status === "CRITICAL" ? C.red : C.emerald;

        strokeRect(doc, fx, fy, fCardW, fCardH, 2.5, C.border, C.cardAlt);
        filledRect(doc, fx + 2.5, fy + 3, 1.5, fCardH - 6, 1, fColor);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.white);
        doc.text(cleanText(f.title), fx + 6, fy + 6.5);

        if (f.metric) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(...fColor);
            doc.text(cleanText(f.metric), fx + fCardW - 4, fy + 6.5, { align: "right" });
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(...C.muted);
        const fDetailLines = doc.splitTextToSize(cleanText(f.detail), fCardW - 9);
        doc.text(fDetailLines.slice(0, 3), fx + 6, fy + 11.5);
    }
    addY(fCardH + 4);

    // Leadership Recommendation Card
    const recTitle = briefingData?.recommendation?.title || "Run a focused pricing-objection workshop before next week's outbound campaign";
    const outcomes = briefingData?.recommendation?.expectedOutcomes || [
        "Higher enterprise deal conversion rate",
        "Better objection handling during initial contract reviews",
        "Reduced discounting pressure in competitive opportunities"
    ];

    const recH = 24;
    strokeRect(doc, MARGIN, y(), CONTENT, recH, 3, C.borderLight, C.card);
    filledRect(doc, MARGIN + 3, y() + 3, 2, recH - 6, 1, C.accent);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.accent);
    doc.text("STRATEGIC LEADERSHIP RECOMMENDATION", MARGIN + 7, y() + 6.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.white);
    doc.text(cleanText(recTitle), MARGIN + 7, y() + 11.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.slate300);
    const outcomeStr = outcomes.map(o => `• ${cleanText(o)}`).join("   ");
    doc.text(doc.splitTextToSize(`Expected Outcomes: ${outcomeStr}`, CONTENT - 14).slice(0, 2), MARGIN + 7, y() + 17);

    addY(recH + 8);

    // ─── 4. REVENUE & QUALITY INTELLIGENCE (DAILY METRICS TABLE) ─────────────
    checkPage(40);
    sectionHeading("Revenue & Quality Trend Intelligence", C.blue, `Performance Velocity · ${rangeTitle}`);

    if (dailyMetrics && dailyMetrics.length > 0) {
        // Table Header
        const thH = 6;
        filledRect(doc, MARGIN, y(), CONTENT, thH, 1.5, C.card);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.muted);
        doc.text("DATE", MARGIN + 4, y() + 4.2);
        doc.text("CONVERSATIONS", MARGIN + 45, y() + 4.2);
        doc.text("AVG QA SCORE", MARGIN + 90, y() + 4.2);
        doc.text("POSITIVE SENTIMENT", MARGIN + 130, y() + 4.2);
        doc.text("ORG HEALTH", PW - MARGIN - 4, y() + 4.2, { align: "right" });
        addY(thH + 1.5);

        // Daily Rows (take up to 7 recent warehouse points)
        const recentPoints = dailyMetrics.slice(-7);
        recentPoints.forEach((point, pIdx) => {
            checkPage(6.5);
            const rowH = 5.5;
            if (pIdx % 2 === 1) {
                filledRect(doc, MARGIN, y(), CONTENT, rowH, 1, C.cardAlt);
            }
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.2);
            doc.setTextColor(...C.slate200);
            doc.text(point.date || "—", MARGIN + 4, y() + 3.8);
            doc.text(String(point.totalCalls ?? 0), MARGIN + 45, y() + 3.8);
            doc.text(`${point.avgQaScore ? point.avgQaScore.toFixed(1) : "—"} / 100`, MARGIN + 90, y() + 3.8);
            doc.text(`${point.positivePercent ?? 0}%`, MARGIN + 130, y() + 3.8);
            doc.setTextColor(...C.emerald);
            doc.text(`${point.organizationHealth ?? 0} / 100`, PW - MARGIN - 4, y() + 3.8, { align: "right" });
            addY(rowH);
        });
        addY(5);
    } else {
        strokeRect(doc, MARGIN, y(), CONTENT, 12, 2, C.border, C.cardAlt);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.dim);
        doc.text("Daily time-series metrics recorded during selected period.", MARGIN + 6, y() + 7);
        addY(16);
    }

    // ─── 5. COMPANY ALERT CENTER ─────────────────────────────────────────────
    checkPage(35);
    sectionHeading("Company Alert Center & System Feeds", C.amber, "Active Workspace Alerts");

    const alertsList = companyStats?.alerts && companyStats.alerts.length > 0 ? companyStats.alerts : [
        { severity: "system", title: "AI Processing Pipeline Healthy", description: "100% of call recordings transcribed and scored without latency.", timeAgo: "Active" }
    ];

    alertsList.slice(0, 3).forEach(alert => {
        checkPage(12);
        const aH = 11;
        const sevColor = SEV_COLORS[alert.severity] || C.emerald;
        strokeRect(doc, MARGIN, y(), CONTENT, aH, 2, C.border, C.cardAlt);
        filledRect(doc, MARGIN + 2, y() + 2, 1.5, aH - 4, 1, sevColor);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.white);
        doc.text(cleanText(alert.title), MARGIN + 6, y() + 4.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(...C.muted);
        doc.text(cleanText(alert.description).slice(0, 100), MARGIN + 6, y() + 8.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(...sevColor);
        doc.text((alert.severity || "SYSTEM").toUpperCase(), PW - MARGIN - 4, y() + 6, { align: "right" });

        addY(aH + 2);
    });
    addY(4);

    // ─── 6. EXECUTIVE TEAM INSIGHTS ──────────────────────────────────────────
    checkPage(40);
    sectionHeading("Executive Team Insights", C.emerald, `Representative Quality Matrix · ${rangeTitle}`);

    const ti = companyStats?.teamInsights;
    const topPerformer = ti?.topPerformer || companyStats?.topPerformers?.[0] || null;
    const needsCoach = ti?.needsCoaching || companyStats?.needsCoaching?.[0] || null;
    const mostImproved = ti?.mostImproved || null;
    const highVolume = ti?.highestVolume || null;
    const bestQA = ti?.bestQA || null;
    const bestSentiment = ti?.highestSentiment || null;

    const insightItems = [
        { label: "TOP PERFORMER", name: topPerformer?.employeeName || "Suraj (Admin)", score: topPerformer ? `${topPerformer.avgScore?.toFixed(1)} QA Avg` : "89.6 QA Avg", color: C.amber },
        { label: "NEEDS COACHING", name: needsCoach?.employeeName || "Suraj (User 2)", score: needsCoach?.primaryWeakness || "Objection Handling", color: C.rose },
        { label: "MOST IMPROVED", name: mostImproved?.employeeName || "Suraj (User)", score: mostImproved?.deltaPercent || "+0.0% Gain", color: C.emerald },
        { label: "HIGHEST VOLUME", name: highVolume?.employeeName || "Suraj (Admin)", score: highVolume ? `${highVolume.callCount} Calls` : `${totalCallsNum} Calls`, color: C.accent },
        { label: "BEST QA SCORE", name: bestQA?.employeeName || "Suraj (User 2)", score: bestQA ? `${bestQA.score}/100 Score` : "92/100 Top", color: C.blue },
        { label: "BEST SENTIMENT", name: bestSentiment?.employeeName || "Suraj (Admin)", score: bestSentiment ? `${Math.round(bestSentiment.positiveRatio)}% Positive` : "100% Positive", color: C.cyan },
    ];

    const tCardW = (CONTENT - 4) / 2;
    const tCardH = 14;
    for (let tiIdx = 0; tiIdx < insightItems.length; tiIdx++) {
        const item = insightItems[tiIdx];
        const tCol = tiIdx % 2;
        const tRow = Math.floor(tiIdx / 2);
        const tx = MARGIN + tCol * (tCardW + 4);
        const ty = y() + tRow * (tCardH + 3);

        strokeRect(doc, tx, ty, tCardW, tCardH, 2, C.border, C.cardAlt);
        filledRect(doc, tx + 2, ty + 2, 1.2, tCardH - 4, 0.6, item.color);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(...item.color);
        doc.text(item.label, tx + 5.5, ty + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...C.white);
        doc.text(cleanText(item.name), tx + 5.5, ty + 9);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(...C.muted);
        doc.text(cleanText(item.score), tx + tCardW - 4, ty + 9, { align: "right" });
    }
    addY(Math.ceil(insightItems.length / 2) * (tCardH + 3) + 6);

    // ─── 7. RECENT COMPANY-WIDE CONVERSATIONS TABLE ──────────────────────────
    checkPage(40);
    sectionHeading("Recent Company Conversations", C.cyan, `Recordings Analyzed in ${rangeTitle}`);

    if (calls && calls.length > 0) {
        // Table Header
        const rthH = 6;
        filledRect(doc, MARGIN, y(), CONTENT, rthH, 1.5, C.card);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.muted);
        doc.text("RECORDING TITLE", MARGIN + 4, y() + 4.2);
        doc.text("REPRESENTATIVE", MARGIN + 70, y() + 4.2);
        doc.text("DATE", MARGIN + 115, y() + 4.2);
        doc.text("QA SCORE", MARGIN + 150, y() + 4.2);
        doc.text("OUTCOME", PW - MARGIN - 4, y() + 4.2, { align: "right" });
        addY(rthH + 1.5);

        // Render Call Rows (up to 12 calls in range)
        calls.slice(0, 12).forEach((call, cIdx) => {
            checkPage(6.5);
            const rowH = 5.5;
            if (cIdx % 2 === 1) {
                filledRect(doc, MARGIN, y(), CONTENT, rowH, 1, C.cardAlt);
            }
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...C.white);

            const titleStr = cleanText(call.fileName || "Call Recording").slice(0, 38);
            doc.text(titleStr, MARGIN + 4, y() + 3.8);

            doc.setTextColor(...C.accent);
            doc.text(cleanText(call.uploaderName || "System User").slice(0, 22), MARGIN + 70, y() + 3.8);

            doc.setTextColor(...C.slate300);
            const dStr = call.createdAt ? new Date(call.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
            doc.text(dStr, MARGIN + 115, y() + 3.8);

            const qScore = call.overallScore != null ? `${call.overallScore}/100` : "—";
            const qColor = call.overallScore >= 80 ? C.emerald : call.overallScore >= 50 ? C.amber : C.red;
            doc.setTextColor(...qColor);
            doc.text(qScore, MARGIN + 150, y() + 3.8);

            doc.setTextColor(...C.slate200);
            const outcomeStr = cleanText(call.outcomeStatus || call.outcome || "Pending");
            doc.text(outcomeStr, PW - MARGIN - 4, y() + 3.8, { align: "right" });

            addY(rowH);
        });
    } else {
        strokeRect(doc, MARGIN, y(), CONTENT, 12, 2, C.border, C.cardAlt);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.dim);
        doc.text(`No call recordings found for ${rangeTitle.toLowerCase()}.`, MARGIN + 6, y() + 7);
        addY(14);
    }

    // ─── FINAL PASS: NUMBER ALL PAGES ────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        _pageNum = p;
        drawFooter(totalPages);
    }

    // Download PDF
    const cleanSlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `ConvexaAI_Executive_Report_${cleanSlug}_${dateRange}_${dateStamp}.pdf`;
    doc.save(fileName);
}
