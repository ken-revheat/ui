// Source of truth for the sidebar product list across every RevHeat portal app.
// ⚠️ slug MUST equal code.replace(/_/g,"-") — billing.service builds Stripe's
// success_url as /products/${code.replace(/_/g,"-")}/upgrade; a divergent slug
// 404s a paying customer. Enforced by the API repo parity spec (Task 8).
export const PRODUCT_CATALOG = [
    { code: "all_access", slug: "all-access", title: "All-Access",
        description: "Every RevHeat product, one subscription. Priced by seats.",
        appUrl: "https://app.revheat.com/", isBundle: true },
    { code: "lead_accelerator", slug: "lead-accelerator", title: "The RevHeat Directive",
        description: "Outbound openers — every draft built on something we actually found on the prospect's site. You pick one and send it.",
        appUrl: "https://leadaccelerator.revheat.com/app" },
    { code: "call_analyzer", slug: "call-analyzer", title: "Call Analyzer",
        description: "Sales transcript analysis — surface objections, win signals, and coaching moments.",
        appUrl: "https://callanalyzer.revheat.com/app" },
    { code: "ask_revheat", slug: "ask-revheat", title: "The RevHeat Advisor",
        description: "Your AI sales coach — answers grounded in the RevHeat method, not in whatever sounds right.",
        appUrl: "https://coach.revheat.com/app" },
    { code: "quotafit", slug: "quotafit", title: "QuotaFit",
        description: "Sales-hire fit — role scorecards your panel scores blind, then the places they disagreed.",
        appUrl: "https://hire.revheat.com/app" },
    { code: "training_vault", slug: "training-vault", title: "Training Vault",
        description: "Your sales team's training library — 12 modules of video coaching, scripts, and worksheets.",
        appUrl: "https://app.revheat.com/vault", internal: true },
    { code: "trend_finder", slug: "trend-finder", title: "Trend Finder",
        description: "LinkedIn posts from the trends your buyers are reading.",
        appUrl: "https://trendfinder.revheat.com/app", unlaunched: true },
    { code: "readiness_audit", slug: "readiness-audit", title: "Website Readiness Audit",
        description: "Score your website on what moves revenue — with a prioritized fix list, assigned by owner.",
        appUrl: "https://readiness.revheat.com/app" },
    { code: "icp_builder", slug: "icp-builder", title: "ICP Builder",
        description: "Your Ideal Customer Profile — the accounts worth chasing, who to reach inside them, and the message that lands.",
        appUrl: "https://icp.revheat.com/app" },
];
export function findProductByCode(code) {
    return PRODUCT_CATALOG.find((p) => p.code === code) ?? null;
}
export function findProductBySlug(slug) {
    return PRODUCT_CATALOG.find((p) => p.slug === slug) ?? null;
}
//# sourceMappingURL=catalog.js.map