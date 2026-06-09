/**
 * insightsFormatter.js
 *
 * Root cause of Bug #1:
 * The LLM sometimes returns insights as newline-separated sections,
 * sometimes as a single run-on string with labels inline, and sometimes
 * with Markdown formatting. parseMarkdownToBullets() just splits on newlines,
 * so single-line responses produce one giant bullet while multi-line ones
 * produce many — inconsistent across call records.
 *
 * Fix: Always extract the five canonical section labels by regex regardless
 * of whether they appear on their own line or inline. Fall back to
 * bullet-splitting only when none of the canonical labels are found.
 */

const INSIGHT_SECTIONS = [
    { key: "customerIntent",   labels: ["Customer Intent"],    emoji: "🎯", color: "#8b5cf6", border: "rgba(139,92,246,0.25)", bg: "rgba(139,92,246,0.08)" },
    { key: "mainIssue",        labels: ["Main Issue"],         emoji: "🔍", color: "#3b82f6", border: "rgba(59,130,246,0.25)",  bg: "rgba(59,130,246,0.08)"  },
    { key: "customerConcern",  labels: ["Customer Concern"],   emoji: "⚠️", color: "#f59e0b", border: "rgba(245,158,11,0.25)", bg: "rgba(245,158,11,0.08)" },
    { key: "outcome",          labels: ["Outcome"],            emoji: "✅", color: "#10b981", border: "rgba(16,185,129,0.25)", bg: "rgba(16,185,129,0.08)" },
    { key: "agentPerformance", labels: ["Agent Performance"],  emoji: "👤", color: "#ec4899", border: "rgba(236,72,153,0.25)",  bg: "rgba(236,72,153,0.08)"  },
];

/**
 * Strip leading markdown / bullet symbols from a string.
 */
function cleanValue(str) {
    return str
        .replace(/^[\s*\-•>#:]+/, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`(.*?)`/g, "$1")
        .replace(/#+\s?/g, "")
        .trim();
}

/**
 * parseInsights(text)
 *
 * Returns an array of { key, emoji, label, value, color, border, bg }
 * objects in canonical order.  Sections that cannot be found in the text
 * are included with value: null so callers can show a "–" placeholder
 * rather than silently hiding a section.
 *
 * Handles all three formats observed in the wild:
 *
 * Format A (newline-separated):
 *   Customer Intent: The customer wants a refund\nMain Issue: …
 *
 * Format B (run-on single line):
 *   Customer Intent: … Main Issue: … Customer Concern: …
 *
 * Format C (Markdown headings):
 *   ## Customer Intent\nThe customer…\n## Main Issue\n…
 */
export function parseInsights(text) {
    if (!text) return INSIGHT_SECTIONS.map(s => ({ ...s, label: s.labels[0], value: null }));

    // Build a single regex that matches any known label (case-insensitive)
    // followed by an optional colon/newline, capturing the value up to the
    // next known label or end-of-string.
    const allLabels = INSIGHT_SECTIONS.flatMap(s => s.labels);
    const labelPattern = allLabels
        .map(l => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");

    // This regex finds "Label: value" or "## Label\nvalue" sections
    const sectionRegex = new RegExp(
        `(?:#{1,3}\\s*)?(?:${labelPattern})\\s*[:\\n]([\\s\\S]*?)(?=(?:#{1,3}\\s*)?(?:${labelPattern})\\s*[:\\n]|$)`,
        "gi"
    );

    // Extract all matches into a map: normalisedLabel → value
    const found = {};
    let match;
    while ((match = sectionRegex.exec(text)) !== null) {
        // Identify which label was matched by checking which section owns it
        const matchedText = match[0];
        for (const section of INSIGHT_SECTIONS) {
            for (const label of section.labels) {
                if (matchedText.toLowerCase().startsWith(label.toLowerCase()) ||
                    matchedText.toLowerCase().includes(`# ${label.toLowerCase()}`)) {
                    const raw = match[1] || "";
                    found[section.key] = cleanValue(raw.split(/\n/)[0]) || cleanValue(raw);
                    break;
                }
            }
        }
    }

    // If the regex found nothing (no canonical labels present at all),
    // fall back to bullet-splitting and put everything in a "general" bucket
    const hasAny = Object.keys(found).length > 0;
    if (!hasAny) {
        return [{ key: "general", emoji: "🧠", label: "AI Insights", color: "#3b82f6",
            border: "rgba(59,130,246,0.25)", bg: "rgba(59,130,246,0.08)",
            value: null,
            bullets: text
                .split(/\n|(?<=\.)\s{2,}/)
                .map(l => cleanValue(l))
                .filter(l => l.length > 3),
        }];
    }

    return INSIGHT_SECTIONS.map(s => ({
        ...s,
        label: s.labels[0],
        value: found[s.key] || null,
    }));
}

export { INSIGHT_SECTIONS };
