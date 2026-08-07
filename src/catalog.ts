export type ProductDef = {
  code: string;
  slug: string;
  title: string;
  description: string;
  appUrl: string;
  internal?: boolean;
  unlaunched?: boolean;
  isBundle?: boolean;
  // Consulting-delivered, staff-arranged product. NEVER shown in a self-serve
  // sidebar — not as an owned tile, not as an upsell — even once it launches.
  // This is a permanent property of the product, distinct from `unlaunched`
  // (a temporary "coming soon"): a consulting engagement is reached through the
  // engagement, never sold or navigated from the self-serve rail. Excluded in
  // core.ts buildRailModel (both rails, both the live and degraded paths).
  consultingOnly?: boolean;
};

// Source of truth for the sidebar product list across every RevHeat portal app.
//
// ⛔ THIS REPO IS PUBLIC, AND ITS HISTORY IS PERMANENT. Anything added here is
// readable by anyone, forever — deleting it later does not un-publish it.
// So: do NOT add a product that has not been announced. No pre-launch names, no
// pre-launch descriptions, no `unlaunched: true` entry for something the market
// has not seen, and no new `consultingOnly` engagement. Those arrive here on the
// day they go public, not before.
// Decided 2026-08-07: making this repo private was considered and REJECTED —
// ~8 build surfaces (incl. the Lead Accelerator / ICP Builder / Website
// Readiness production deploys) fetch it over git+ssh with no credential, so a
// flip breaks deploys, and it would not un-publish the existing history anyway.
// This comment is the control that replaced it. `sell_playbook_consulting`
// below predates the rule and is grandfathered — it is not a precedent.
//
// ⚠️ slug MUST equal code.replace(/_/g,"-") — billing.service builds Stripe's
// success_url as /products/${code.replace(/_/g,"-")}/upgrade; a divergent slug
// 404s a paying customer. Enforced by the API repo parity spec (Task 8).
export const PRODUCT_CATALOG: ProductDef[] = [
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
    appUrl: "https://trendfinder.revheat.com/app" },
  { code: "readiness_audit", slug: "readiness-audit", title: "Website Readiness Audit",
    description: "Score your website on what moves revenue — with a prioritized fix list, assigned by owner.",
    appUrl: "https://readiness.revheat.com/app" },
  { code: "sell_playbook_consulting", slug: "sell-playbook-consulting", title: "Sell Playbook (Consulting)",
    description: "A consulting engagement, staff-arranged only.",
    appUrl: "https://app.revheat.com", unlaunched: true, consultingOnly: true },
  { code: "icp_builder", slug: "icp-builder", title: "ICP Builder",
    description: "Your Ideal Customer Profile — the accounts worth chasing, who to reach inside them, and the message that lands.",
    appUrl: "https://icp.revheat.com/app" },
];

export function findProductByCode(code: string): ProductDef | null {
  return PRODUCT_CATALOG.find((p) => p.code === code) ?? null;
}
export function findProductBySlug(slug: string): ProductDef | null {
  return PRODUCT_CATALOG.find((p) => p.slug === slug) ?? null;
}
