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
export function isActiveProduct(
  p: RailProduct,
  currentPath: string,
  currentProductCode?: string,
): boolean {
  // `!== undefined`, not truthiness: an app that computes its own code and gets
  // "" should highlight nothing, not silently fall through to the vault rule.
  if (currentProductCode !== undefined) return p.code === currentProductCode;
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
export function upgradeHref(slug: string, source: "sidebar" | "renew"): string {
  return `${PORTAL_ORIGIN}/products/${slug}/upgrade?source=${source}`;
}
