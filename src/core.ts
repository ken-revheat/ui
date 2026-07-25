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

const UPSELL_STATES: ProductState[] = ["available", "locked_billing", "needs_grant"];

function withCatalog(products: MeProduct[], byCode: Map<string, ProductDef>): RailProduct[] {
  return products
    .map((mp) => {
      const cat = byCode.get(mp.code);
      return cat ? { ...cat, ...mp } : null;
    })
    .filter((p): p is RailProduct => p !== null)
    .filter((p) => !p.isBundle && !p.consultingOnly);
}

export function buildRailModel(input: RailInput): RailModel {
  const byCode = new Map(input.catalog.map((p) => [p.code, p]));
  const usingFallback = input.degraded || input.me === null;

  if (usingFallback) {
    const codes = new Set(input.productCodesFallback);
    const entitled: RailProduct[] = input.catalog
      .filter((p) => codes.has(p.code) && !p.isBundle && !p.consultingOnly)
      .map((p) => ({ ...p, state: "launch" as const, lockReason: null, billingStatus: null }));
    return { entitled, upsell: [], canBuy: false, isViewerAdmin: false };
  }

  const me = input.me as MeProductsResponse;
  const entitled = withCatalog(me.products.filter((p) => p.state === "launch"), byCode);
  const upsell = withCatalog(me.products.filter((p) => UPSELL_STATES.includes(p.state)), byCode);
  const canBuy = me.viewerRole !== "rep" || me.isPrimaryBuyer;
  const isViewerAdmin = me.viewerRole === "admin";
  return { entitled, upsell, canBuy, isViewerAdmin };
}

export function isActiveProduct(p: RailProduct, currentPath: string): boolean {
  return p.code === "training_vault" && currentPath.startsWith("/vault");
}

export function withSource(appUrl: string, source = "sidebar"): string {
  try {
    const url = new URL(appUrl);
    url.searchParams.set("source", source);
    return url.toString();
  } catch {
    return appUrl;
  }
}

export function upgradeHref(slug: string, source: "sidebar" | "renew"): string {
  return `/products/${slug}/upgrade?source=${source}`;
}
