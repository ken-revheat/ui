import type { ProductDef } from "./catalog";
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
export declare function isActiveProduct(p: RailProduct, currentPath: string): boolean;
export declare function withSource(appUrl: string, source?: string): string;
export declare function upgradeHref(slug: string, source: "sidebar" | "renew"): string;
//# sourceMappingURL=core.d.ts.map