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
//# sourceMappingURL=core.d.ts.map