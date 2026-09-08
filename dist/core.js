const UPSELL_STATES = ["available", "locked_billing", "needs_grant"];
function withCatalog(products, byCode) {
    return products
        .map((mp) => {
        const cat = byCode.get(mp.code);
        return cat ? { ...cat, ...mp } : null;
    })
        .filter((p) => p !== null)
        .filter((p) => !p.isBundle && !p.consultingOnly && !p.sidebarHidden);
}
export function buildRailModel(input) {
    const byCode = new Map(input.catalog.map((p) => [p.code, p]));
    const usingFallback = input.degraded || input.me === null;
    if (usingFallback) {
        const codes = new Set(input.productCodesFallback);
        const entitled = input.catalog
            .filter((p) => codes.has(p.code) && !p.isBundle && !p.consultingOnly)
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
/**
 * Is this rail row the product the viewer is currently inside?
 *
 * `currentProductCode` is the RELIABLE signal and takes priority. The path rule
 * below it is the portal's original behaviour, kept only so the portal keeps
 * working unchanged.
 *
 * Why the path rule alone was not enough: on the portal, every product's app is
 * a different origin, so the only route that is "inside" a product is the
 * locally-hosted vault — hence the hardcoded pair. But a product app mounting
 * this shell IS inside a product, and it knows which one; matching its own path
 * against "/vault" is false for every row, so nothing was ever highlighted in
 * any React app. An app passes its own code and gets the right answer.
 */
export function isActiveProduct(p, currentPath, currentProductCode) {
    // `!== undefined`, not truthiness: an app that computes its own code and gets
    // "" should highlight nothing, not silently fall through to the vault rule.
    if (currentProductCode !== undefined)
        return p.code === currentProductCode;
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
/**
 * The portal owns identity, billing and admin. Every link this package renders
 * to one of those surfaces must be ABSOLUTE: a product app served from
 * icp.revheat.com / readiness.revheat.com resolves a relative "/products/…"
 * against ITS OWN origin, where no such route exists.
 */
export const PORTAL_ORIGIN = "https://app.revheat.com";
/**
 * Checkout / reactivate link for a product the viewer does not have.
 *
 * Absolute on purpose — see PORTAL_ORIGIN. Until v1.4.0 this returned a
 * relative path, so "See plans →" 404'd in every React product app: the route
 * `/products/[slug]/upgrade` exists only on the portal.
 */
export function upgradeHref(slug, source) {
    return `${PORTAL_ORIGIN}/products/${slug}/upgrade?source=${source}`;
}
//# sourceMappingURL=core.js.map