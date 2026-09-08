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

const UPSELL_STATES: ProductState[] = ["available", "locked_billing", "needs_grant"];

function withCatalog(products: MeProduct[], byCode: Map<string, ProductDef>): RailProduct[] {
  return products
    .map((mp) => {
      const cat = byCode.get(mp.code);
      return cat ? { ...cat, ...mp } : null;
    })
    .filter((p): p is RailProduct => p !== null)
    .filter((p) => !p.isBundle && !p.consultingOnly && !p.sidebarHidden);
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
export function resolveActiveScreen(screens: ShellScreen[], activePath: string): ShellScreen[] {
  const hasExplicit = screens.some((s) => s.active !== undefined);
  if (hasExplicit) {
    return screens.map((s) => ({ ...s, active: s.active === true }));
  }

  const path = activePath.split("?")[0]!.split("#")[0]!;
  const pathOf = (href: string): string => {
    try {
      return new URL(href, "https://rh.invalid").pathname;
    } catch {
      return href;
    }
  };

  let winner: ShellScreen | undefined;
  let winnerLength = -1;
  for (const s of screens) {
    if (s.external === true) continue;
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
export function productTitle(code: string | undefined, catalog: ProductDef[]): string | undefined {
  if (code === undefined) return undefined;
  return catalog.find((p) => p.code === code)?.title;
}
