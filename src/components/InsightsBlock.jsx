import { parseInsights } from "../utils/insightsFormatter";

// ─────────────────────────────────────────────────────────────────────────────
//  InsightsBlock
//
//  Drop-in replacement for every place that renders call.insights.
//  Accepts the raw string; formats and displays it consistently.
//
//  Usage:
//    import InsightsBlock from "../components/InsightsBlock";
//    <InsightsBlock insights={call.insights} />
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_ICONS = {
    "Customer Intent":   "🎯",
    "Main Issue":        "⚠️",
    "Customer Concern":  "💬",
    "Outcome":           "✅",
    "Agent Performance": "🌟",
    "AI Insights":       "🧠",
};

export default function InsightsBlock({ insights }) {
    const sections = parseInsights(insights);

    if (sections.length === 0) {
        return (
            <p className="text-sm text-slate-500 italic">No insights available</p>
        );
    }

    return (
        <div className="space-y-4">
            {sections.map(({ heading, body }) => (
                <div
                    key={heading}
                    className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-4"
                >
                    {/* Section header */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-base leading-none">
                            {SECTION_ICONS[heading] ?? "📌"}
                        </span>
                        <p className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                            {heading}
                        </p>
                    </div>

                    {/* Body — render as paragraphs split by double newline */}
                    <div className="space-y-1.5">
                        {body.split("\n\n").map((para, i) => (
                            <p
                                key={i}
                                className="text-sm text-slate-300 leading-relaxed"
                            >
                                {para}
                            </p>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
