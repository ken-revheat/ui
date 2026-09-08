import type { ProductDef } from "./catalog.js";
export type ProductState = "launch" | "locked_billing" | "available" | "needs_grant";
export interface MeProduct {
    code: string;
    state: ProductState;
    appUrl: string;
    lockReason: string | null;
    billingStatus: string | null;
    grantedBy?: string | null;
    isBundle?: boolean;
    /**
     * Per-org sidebar switch (admin-set in the portal; served by
     * /api/me/products). True = hide this row from the rail. VISIBILITY ONLY:
     * `state` is untouched, so entitlement gates must never read this field.
     * The API only ever sets it on products the org OWNS — hidden products it
     * does not own are dropped from the response entirely.
     */
    sidebarHidden?: boolean;
}
export interface MeProductsResponse {
    viewerRole: "rep" | "manager" | "admin";
    isPrimaryBuyer: boolean;
    products: MeProduct[];
    trialDays?: number;
}
export interface RailProduct extends ProductDef {
    state: ProductState;
    lockReason: string | null;
    billingStatus: string | null;
    /** Per-org sidebar switch — see MeProduct.sidebarHidden. */
    sidebarHidden?: boolean;
}
export interface RailModel {
    entitled: RailProduct[];
    upsell: RailProduct[];
    canBuy: boolean;
    isViewerAdmin: boolean;
}
export interface RailInput {
    me: MeProductsResponse | null;
    degraded: boolean;
    productCodesFallback: string[];
    catalog: ProductDef[];
}
export declare function buildRailModel(input: RailInput): RailModel;
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
export declare function isActiveProduct(p: RailProduct, currentPath: string, currentProductCode?: string): boolean;
export declare function withSource(appUrl: string, source?: string): string;
/**
 * The portal owns identity, billing and admin. Every link this package renders
 * to one of those surfaces must be ABSOLUTE: a product app served from
 * icp.revheat.com / readiness.revheat.com resolves a relative "/products/…"
 * against ITS OWN origin, where no such route exists.
 */
export declare const PORTAL_ORIGIN = "https://app.revheat.com";
/**
 * Checkout / reactivate link for a product the viewer does not have.
 *
 * Absolute on purpose — see PORTAL_ORIGIN. Until v1.4.0 this returned a
 * relative path, so "See plans →" 404'd in every React product app: the route
 * `/products/[slug]/upgrade` exists only on the portal.
 */
export declare function upgradeHref(slug: string, source: "sidebar" | "renew"): string;
/**
 * One item in the horizontal in-product screen menu (`.rh-menu`). The rail
 * switches PRODUCT; this switches SCREEN within a product — see the shell v2
 * nav-model design doc. `active` is optional: pass it to force a tab active,
 * or omit it everywhere and let `resolveActiveScreen` derive it from the path.
 */
export interface ShellScreen {
    label: string;
    href: string;
    active?: boolean;
    external?: boolean;
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
export declare function resolveActiveScreen(screens: ShellScreen[], activePath: string): ShellScreen[];
/**
 * Portal home, tagged as a sidebar referral. The rail's trailing "All
 * products →" row and the banner's "← Portal" link both point here.
 *
 * Declared at the END of the file, after `withSource` and `PORTAL_ORIGIN`:
 * module-scope `const` initialisers run top-to-bottom, so declaring this
 * before either of them would evaluate to "undefined/?source=sidebar" with no
 * error.
 */
export declare const ALL_PRODUCTS_HREF: string;
/**
 * The catalog title for a product code, or `undefined` — never a fabricated
 * name. `undefined` for `code === undefined`, `""`, or any code the catalog
 * does not have. `catalog` is taken explicitly (rather than importing
 * PRODUCT_CATALOG here) so this file keeps its type-only import of
 * `catalog.js` and gains no runtime dependency on it.
 */
export declare function productTitle(code: string | undefined, catalog: ProductDef[]): string | undefined;
//# sourceMappingURL=core.d.ts.map