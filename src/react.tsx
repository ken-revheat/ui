"use client";
import * as React from "react";
import { PRODUCT_CATALOG } from "./catalog";
import { buildRailModel, withSource, upgradeHref, isActiveProduct, type MeProduct, type RailProduct } from "./core";

export interface AppShellIdentity {
  email: string | null;
  isInternal: boolean;
  roleLabel: string | null;
}
export interface AppShellProps {
  identity: AppShellIdentity;
  products: MeProduct[];
  degraded?: boolean;
  productCodesFallback?: string[];
  activePath: string;
  adminHref?: string;
  accountMenu?: React.ReactNode;
  onSignOut?: () => void;
  children: React.ReactNode;
}

// ── Product icons ──────────────────────────────────────────────────────────
// Code → inline-SVG path list, consumed at currentColor inside the icon tile.
// The first six are ported verbatim from the LA portal's RhProductIcon.vue
// interim set; readiness_audit, trend_finder and icp_builder are added here as
// tasteful on-brand glyphs (checklist, trending-up, bullseye). The `<svg>` sets
// fill-rule evenodd so the ring-based glyphs render as outlines, not solids.
const PRODUCT_ICON_PATHS: Record<string, string[]> = {
  // All-Access — stacked layers (the whole platform in one).
  all_access: [
    "M12 2 2 7l10 5 10-5-10-5z",
    "M2 17l10 5 10-5",
    "M2 12l10 5 10-5",
  ],
  lead_accelerator: ["M13 2 4 14h6l-1 8 9-12h-6l1-8z"],
  call_analyzer: ["M3 11h3v9H3zM8 4h3v16H8zM13 8h3v12h-3zM18 13h3v7h-3z"],
  quotafit: [
    "M9 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
    "M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6z",
    "m15.5 10.5 2.2 2.2 4.3-4.3-1.4-1.4-2.9 2.9-.8-.8z",
  ],
  training_vault: ["M7 4v16l13-8z"],
  ask_revheat: ["M3 4h18v12h-11l-7 5z"],
  // Website Readiness Audit — a hollow checklist frame (evenodd ring) with two
  // ticked line items inside it.
  readiness_audit: [
    "M4.5 4h15v16h-15z M6.1 5.6h11.8v12.8H6.1z",
    "m7 9.6 1.3 1.3 2.3-2.3 1 1-3.3 3.3-2.3-2.3z",
    "M12.6 9.4h4.8v1.5h-4.8z",
    "m7 14.6 1.3 1.3 2.3-2.3 1 1-3.3 3.3-2.3-2.3z",
    "M12.6 14.4h4.8v1.5h-4.8z",
  ],
  // Trend Finder — an upward diagonal line (band) with an arrowhead: trending up.
  trend_finder: [
    "M2.5 16.25 3.5 17.75 21.5 5.75 20.5 4.25z",
    "M14 4h8v8z",
  ],
  // ICP Builder — a bullseye/target: two evenodd rings plus a centre dot.
  icp_builder: [
    "M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0z M4.4 12a7.6 7.6 0 1 0 15.2 0 7.6 7.6 0 1 0-15.2 0z",
    "M6.8 12a5.2 5.2 0 1 0 10.4 0 5.2 5.2 0 1 0-10.4 0z M9.2 12a2.8 2.8 0 1 0 5.6 0 2.8 2.8 0 1 0-5.6 0z",
    "M10.6 12a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0z",
  ],
};

function ProductIcon({ code }: { code: string }) {
  const paths = PRODUCT_ICON_PATHS[code] ?? PRODUCT_ICON_PATHS.ask_revheat!;
  return (
    <svg
      className="rh-rail__glyph"
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

// The RevHeat "R" letterform mark (currentColor) — rail head, replacing the old
// text link. Geometry ported verbatim from the design-tokens wordmark R glyph.
function BrandMarkR() {
  return (
    <svg
      className="rh-rail__mark"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="264.263 347.964 72.08 72.08"
      role="img"
      aria-label="RevHeat"
    >
      <path
        fill="currentColor"
        d="m310.29 394.81c5.3539-1.5444 9.5753-4.2214 12.458-8.1338 2.8829-3.9125 4.4273-8.6486 4.4273-14.414 0-7.5161-2.574-13.488-7.722-17.812-5.148-4.3243-12.252-6.4865-21.313-6.4865h-25.843v4.7362h25.843c7.619 0 13.488 1.7503 17.606 5.148 4.0154 3.3977 6.0746 8.2368 6.0746 14.414 0 6.2806-2.0592 11.12-6.0746 14.517-4.1184 3.3977-9.9871 5.045-17.606 5.045h-25.84v28.22h5.251v-23.578h20.592c2.0592 0 4.4273-0.10296 7.0013-0.5148l17.194 24.093h5.9717z"
      />
    </svg>
  );
}

function EntitledRow({ p, activePath }: { p: RailProduct; activePath: string }) {
  const href = withSource(p.appUrl);
  const active = isActiveProduct(p, activePath);
  return (
    <li className="rh-rail__item">
      <a className="rh-rail__link" href={href} aria-current={active ? "page" : undefined}>
        <span className="rh-rail__tile" aria-hidden>
          <ProductIcon code={p.code} />
        </span>
        <span className="rh-rail__label">{p.title}</span>
      </a>
    </li>
  );
}

function UpsellRow({ p, canBuy }: { p: RailProduct; canBuy: boolean }) {
  if (p.unlaunched) {
    return (
      <li className="rh-rail__item rh-rail__item--upsell rh-rail__item--soon">
        <span className="rh-rail__link rh-rail__link--muted">
          <span className="rh-rail__tile" aria-hidden>
            <ProductIcon code={p.code} />
          </span>
          <span className="rh-rail__col">
            <span className="rh-rail__label">{p.title}</span>
            <span className="rh-rail__soon">Coming soon</span>
          </span>
        </span>
      </li>
    );
  }
  const isRenew = p.state === "locked_billing";
  const href = canBuy ? upgradeHref(p.slug, isRenew ? "renew" : "sidebar") : undefined;
  const cta = isRenew ? "Reactivate →" : "See plans →";
  return (
    <li className="rh-rail__item rh-rail__item--upsell">
      {href ? (
        <a className="rh-rail__link" href={href}>
          <span className="rh-rail__tile" aria-hidden>
            <ProductIcon code={p.code} />
          </span>
          <span className="rh-rail__col">
            <span className="rh-rail__label">{p.title}</span>
            <span className="rh-rail__go">{cta}</span>
          </span>
        </a>
      ) : (
        <span className="rh-rail__link rh-rail__link--muted">
          <span className="rh-rail__tile" aria-hidden>
            <ProductIcon code={p.code} />
          </span>
          <span className="rh-rail__col">
            <span className="rh-rail__label">{p.title}</span>
          </span>
        </span>
      )}
    </li>
  );
}

export function AppShell({ identity, products, degraded = false, productCodesFallback = [], activePath, adminHref, accountMenu, onSignOut, children }: AppShellProps) {
  const model = buildRailModel({
    me: degraded ? null : { viewerRole: identity.isInternal ? "admin" : "manager", isPrimaryBuyer: true, products },
    degraded,
    productCodesFallback,
    catalog: PRODUCT_CATALOG,
  });
  const initial = (identity.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="rh-shell">
      <aside className="rh-rail" aria-label="RevHeat products">
        <a className="rh-rail__home" href="https://app.revheat.com/" aria-label="RevHeat home">
          <BrandMarkR />
        </a>

        {model.entitled.length > 0 && (
          <nav className="rh-rail__section" aria-label="Your products">
            <p className="rh-rail__heading">Your products</p>
            <ul>{model.entitled.map((p) => <EntitledRow key={p.code} p={p} activePath={activePath} />)}</ul>
          </nav>
        )}

        {model.upsell.length > 0 && (
          <nav className="rh-rail__section" aria-label="Available">
            <p className="rh-rail__heading">Available</p>
            <ul>{model.upsell.map((p) => <UpsellRow key={p.code} p={p} canBuy={model.canBuy} />)}</ul>
          </nav>
        )}

        <div className="rh-rail__account">
          {accountMenu ?? (
            <>
              <div className="rh-rail__account-id">
                <span className="rh-rail__avatar" aria-hidden>{initial}</span>
                <span className="rh-rail__account-meta">
                  <span className="rh-rail__email">{identity.email}</span>
                  {identity.roleLabel && <span className="rh-rail__role">{identity.roleLabel}</span>}
                </span>
              </div>
              {onSignOut && <button type="button" className="rh-rail__signout" onClick={onSignOut}>Sign out</button>}
            </>
          )}
        </div>
      </aside>

      <div className="rh-shell__main">
        <header className="rh-banner">
          <a className="rh-banner__brand" href="https://app.revheat.com/">RevHeat</a>
          {identity.isInternal && adminHref && <a className="rh-banner__admin" href={adminHref}>Admin</a>}
        </header>
        {children}
        <footer className="rh-footer">
          <span>© {"2026"} RevHeat</span>
          <a href="https://revheat.com/terms">Terms</a>
          <a href="https://revheat.com/privacy">Privacy</a>
          <a href="mailto:support@revheat.com">Support</a>
        </footer>
      </div>
    </div>
  );
}
