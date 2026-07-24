const UPSELL_STATES = ["available", "locked_billing", "needs_grant"];
function withCatalog(products, byCode) {
    return products
        .map((mp) => {
        const cat = byCode.get(mp.code);
        return cat ? { ...cat, ...mp } : null;
    })
        .filter((p) => p !== null)
        .filter((p) => !p.isBundle);
}
export function buildRailModel(input) {
    const byCode = new Map(input.catalog.map((p) => [p.code, p]));
    const usingFallback = input.degraded || input.me === null;
    if (usingFallback) {
        const codes = new Set(input.productCodesFallback);
        const entitled = input.catalog
            .filter((p) => codes.has(p.code) && !p.isBundle)
            .map((p) => ({ ...p, state: "launch", lockReason: null, billingStatus: null }));
        return { entitled, upsell: [], canBuy: false, isViewerAdmin: false };
    }
    const me = input.me;
    const entitled = withCatalog(me.products.filter((p) => p.state === "launch"), byCode);
    const upsell = withCatalog(me.products.filter((p) => UPSELL_STATES.includes(p.state)), byCode);
    const canBuy = me.viewerRole !== "rep" || me.isPrimaryBuyer;
    const isViewerAdmin = me.viewerRole === "admin";
    return { entitled, upsell, canBuy, isViewerAdmin };
}
export function isActiveProduct(p, currentPath) {
    return p.code === "training_vault" && currentPath.startsWith("/vault");
}
export function withSource(appUrl, source = "sidebar") {
    try {
        const url = new URL(appUrl);
        url.searchParams.set("source", source);
        return url.toString();
    }
    catch {
        return appUrl;
    }
}
export function upgradeHref(slug, source) {
    return `/products/${slug}/upgrade?source=${source}`;
}
//# sourceMappingURL=core.js.map