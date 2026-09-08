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
/**
 * Fills in `active` on every item. Two modes:
 *
 * 1. **Explicit wins, for the whole array.** If ANY item carries `active`,
 *    each item's `active` becomes exactly its own `active === true` (so
 *    undefined/false → false, and only explicitly-true items light up) and
 *    no derivation happens at all — a caller that knows better is trusted
 *    completely, not blended with a guess.
 * 2. **Otherwise, longest-prefix-of-path wins.** `activePath` is normalised by
 *    stripping its query and hash. Each non-external item's `href` is reduced
 *    to a pathname (resolved against a throwaway base so a relative href still
 *    works); it is a candidate when `activePath` equals that pathname or
 *    starts with it at a "/" boundary (so `/app` matches `/app/reports` but
 *    NOT `/appendix`). The candidate with the longest pathname wins; ties keep
 *    the earliest array index. `external: true` items are never candidates.
 *
 * Pure — never mutates `screens` or its items.
 */
export function resolveActiveScreen(screens, activePath) {
    const hasExplicit = screens.some((s) => s.active !== undefined);
    if (hasExplicit) {
        return screens.map((s) => ({ ...s, active: s.active === true }));
    }
    const path = activePath.split("?")[0].split("#")[0];
    const pathOf = (href) => {
        try {
            return new URL(href, "https://rh.invalid").pathname;
        }
        catch {
            return href;
        }
    };
    let winner;
    let winnerLength = -1;
    for (const s of screens) {
        if (s.external === true)
            continue;
        const p = pathOf(s.href);
        // A trailing slash on `href` (e.g. "/app/") must not defeat the match
        // against an `activePath` of "/app" — normalize it away before
        // comparing. `href: "/"` stays a catch-all: it is left as "/" (not
        // stripped to ""), so it is handled as its own case below rather than
        // producing an empty-string prefix.
        const norm = p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
        const matches = norm === "/" ? true : path === norm || path.startsWith(`${norm}/`);
        if (matches && norm.length > winnerLength) {
            winner = s;
            winnerLength = norm.length;
        }
    }
    return screens.map((s) => ({ ...s, active: s === winner }));
}
/**
 * Portal home, tagged as a sidebar referral. The rail's trailing "All
 * products →" row and the banner's "← Portal" link both point here.
 *
 * Declared at the END of the file, after `withSource` and `PORTAL_ORIGIN`:
 * module-scope `const` initialisers run top-to-bottom, so declaring this
 * before either of them would evaluate to "undefined/?source=sidebar" with no
 * error.
 */
export const ALL_PRODUCTS_HREF = withSource(`${PORTAL_ORIGIN}/`);
/**
 * The catalog title for a product code, or `undefined` — never a fabricated
 * name. `undefined` for `code === undefined`, `""`, or any code the catalog
 * does not have. `catalog` is taken explicitly (rather than importing
 * PRODUCT_CATALOG here) so this file keeps its type-only import of
 * `catalog.js` and gains no runtime dependency on it.
 */
export function productTitle(code, catalog) {
    if (code === undefined)
        return undefined;
    return catalog.find((p) => p.code === code)?.title;
}
//# sourceMappingURL=core.js.map