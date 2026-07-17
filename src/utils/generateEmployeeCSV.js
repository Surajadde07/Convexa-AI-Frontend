/**
 * generateEmployeeCSV.js
 *
 * No existing CSV export logic exists anywhere in this app to reuse —
 * generateReport.js is PDF-only (jsPDF). This is a small, self-contained
 * CSV builder, not a duplicate of anything.
 *
 * Covers the same content as generateEmployeeReport() (PDF): employee info,
 * KPI summary, QA scores, sentiment breakdown, recent calls, strengths,
 * weaknesses, action items, risk flags — same source object
 * (EmployeeProfileResponse), just a different output format.
 */

function csvEscape(value) {
    if (value == null) return "";
    const str = String(value);
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function row(cells) {
    return cells.map(csvEscape).join(",");
}

export function generateEmployeeCSV(profile) {
    if (!profile) return;

    const dashboard = profile.dashboard || {};
    const analytics = profile.analytics || {};
    const coaching = profile.coachingSummary || {};
    const recentCalls = profile.recentCalls || [];

    const lines = [];

    lines.push(row(["Employee Information"]));
    lines.push(row(["Name", profile.name || ""]));
    lines.push(row(["Email", profile.email || ""]));
    lines.push(row(["Role", profile.role || ""]));
    lines.push(row(["Joined", profile.joinedDate || ""]));
    lines.push("");

    lines.push(row(["KPI Summary"]));
    lines.push(row(["Total Calls", dashboard.totalCalls ?? 0]));
    lines.push(row(["Average Score", dashboard.avgScore ?? 0]));
    lines.push(row(["Positive %", dashboard.positivePercent ?? 0]));
    lines.push(row(["Calls Needing Coaching", dashboard.needsAttention?.length ?? 0]));
    lines.push("");

    lines.push(row(["QA Score Breakdown"]));
    lines.push(row(["Communication", dashboard.avgCommunication ?? 0]));
    lines.push(row(["Problem Resolution", dashboard.avgProblemResolution ?? 0]));
    lines.push(row(["Professionalism", dashboard.avgProfessionalism ?? 0]));
    lines.push(row(["Cust. Satisfaction", dashboard.avgCustomerSatisfaction ?? 0]));
    lines.push("");

    lines.push(row(["Sentiment Breakdown"]));
    lines.push(row(["Positive %", analytics.positivePercent ?? 0]));
    lines.push(row(["Neutral %", analytics.neutralPercent ?? 0]));
    lines.push(row(["Negative %", analytics.negativePercent ?? 0]));
    lines.push("");

    lines.push(row(["Recent Calls"]));
    lines.push(row(["Date", "File", "Score", "Sentiment", "Outcome"]));
    recentCalls.forEach(c => {
        lines.push(row([c.createdAt || "", c.fileName || "", c.overallScore ?? "", c.sentiment || "", c.outcomeStatus || ""]));
    });
    lines.push("");

    lines.push(row(["Strengths"]));
    lines.push(row([coaching.strengths || ""]));
    lines.push("");

    lines.push(row(["Weaknesses"]));
    lines.push(row([coaching.weaknesses || ""]));
    lines.push("");

    lines.push(row(["Open Action Items"]));
    (coaching.openActionItems || []).forEach(a => lines.push(row([a])));
    lines.push("");

    lines.push(row(["Risk Flags"]));
    lines.push(row(["Severity", "Message"]));
    (coaching.riskFlags || []).forEach(f => lines.push(row([f.severity || "", f.message || ""])));

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (profile.name || "employee-report").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 60);
    a.download = `${safeName}_performance_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
