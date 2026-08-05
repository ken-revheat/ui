"use client";
import * as React from "react";
import { PRODUCT_CATALOG } from "./catalog.js";
import { buildRailModel, withSource, upgradeHref, isActiveProduct, type MeProduct, type RailProduct } from "./core.js";
import { iconPathsFor } from "./icons.js";

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

function ProductIcon({ code }: { code: string }) {
  const paths = iconPathsFor(code);
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

// The full RevHeat wordmark (per-letter stepped gradient purple→red per brand
// guidelines). Geometry + fills ported verbatim from the design-tokens
// revheat-wordmark.svg asset. Colors are the brand gradient — deliberately NOT
// tokenized/currentColor.
function BrandWordmark() {
  return (
    <svg
      className="rh-banner__wordmark"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="272.297 347.964 479.41 72.08"
      role="img"
      aria-label="RevHeat"
    >
      <path d="m310.29 394.81c5.3539-1.5444 9.5753-4.2214 12.458-8.1338 2.8829-3.9125 4.4273-8.6486 4.4273-14.414 0-7.5161-2.574-13.488-7.722-17.812-5.148-4.3243-12.252-6.4865-21.313-6.4865h-25.843v4.7362h25.843c7.619 0 13.488 1.7503 17.606 5.148 4.0154 3.3977 6.0746 8.2368 6.0746 14.414 0 6.2806-2.0592 11.12-6.0746 14.517-4.1184 3.3977-9.9871 5.045-17.606 5.045h-25.84v28.22h5.251v-23.578h20.592c2.0592 0 4.4273-0.10296 7.0013-0.5148l17.194 24.093h5.9717z" fill="#6143f9" />
      <path d="m393.14 381.12h-46.641v4.6332h46.641zm0-33.153h-46.641v4.7362h46.641zm-46.641 67.336v4.7362h46.641v-4.7362z" fill="#7841da" />
      <path d="m472.02 347.96h-5.45l-29.14 65.28-29.14-65.28h-5.7658l32.124 72.072h5.251z" fill="#903fbb" />
      <path d="m542.33 347.96h-5.251v33.153h-48.18v-33.15h-5.251v72.072h5.251v-34.286h48.185v34.3h5.251z" fill="#a73d9c" />
      <path d="m614.14 381.12h-46.641v4.6332h46.641zm0-33.153h-46.641v4.7362h46.641zm-46.641 67.336v4.7362h46.641v-4.7362z" fill="#be3a7c" />
      <path d="m720.51 352.7v67.34h5.251v-67.336h25.946v-4.74h-57.143v4.7362z" fill="#ed363e" />
      <path d="m659.71 348.45c-0.006 0-1.9228 3.7574-4.2604 8.3496-2.3374 4.5926-4.25 8.3566-4.25 8.3648 0 0.008 3.8295 0.0151 8.5101 0.0151s8.5101-0.007 8.5101-0.0149c0-0.008-1.9125-3.7723-4.25-8.3648-2.3368-4.5926-4.2537-8.35-4.2612-8.35zm0.0002 6.3602c0.006 0 0.87479 1.6595 1.9313 3.6874 1.0563 2.0282 1.9239 3.6967 1.9276 3.7077 0.005 0.0132-1.3294 0.0202-3.7853 0.0202h-3.7923l1.8538-3.7077c1.0196-2.0393 1.8586-3.7077 1.8644-3.7077zm0.004 14.856-10.845-0.005-0.33958 0.66614c-0.18673 0.36643-1.6791 3.3152-3.316 6.553-1.6372 3.2378-2.9827 5.9032-2.9901 5.9229l-0.0132 0.0361h17.498c9.6238 0 17.498-0.007 17.498-0.0155 0-0.008-1.4953-2.9713-3.3229-6.5838l-3.3213-6.5678zm0.0706 2.9494 9.0707-0.00082 1.8522 3.6276c1.0188 1.9951 1.8487 3.6311 1.8443 3.6354-0.005 0.004-5.7528 0.006-12.774 0.003l-12.769-0.005 1.8512-3.6292 1.8512-3.6296zm-0.15009 14.706h-19.74l-0.33958 0.66614c-0.18672 0.36644-1.6791 3.3152-3.316 6.553-1.6372 3.2378-2.9827 5.9032-2.9901 5.9229l-0.0132 0.0362h26.483c14.566 0 26.483-0.007 26.483-0.0149 0-0.008-1.5314-2.9734-3.403-6.589l-3.403-6.5719zm0.0758 2.9554h17.981l1.8512 3.6294 1.8512 3.6294-10.842 0.005c-5.963 0.003-15.72 0.003-21.683 0l-10.842-0.005 1.8512-3.6294 1.8512-3.6294zm0.0797 14.561h-28.744l-3.8536 7.5527c-2.1194 4.1571-3.8596 7.5713-3.867 7.5936l-0.0132 0.0362h36.397c24.243 0 36.397-0.007 36.397-0.0206 0-0.0114-1.7033-3.4272-3.7853-7.591l-3.7853-7.5702zm-0.002 3.0984h27.033l2.3186 4.6371c1.2753 2.5506 2.3186 4.642 2.3186 4.6475 0 0.006-14.249 0.0103-31.665 0.0103-21.115 0-31.665-0.007-31.665-0.0207 0-0.0114 1.041-2.1028 2.3134-4.6475l2.3134-4.6267z" fill="#d5385d" />
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
          <a className="rh-banner__brand" href="https://app.revheat.com/" aria-label="RevHeat home">
            <BrandWordmark />
          </a>
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
