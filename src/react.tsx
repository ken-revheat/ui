"use client";
import * as React from "react";
import { PRODUCT_CATALOG } from "./catalog";
import { buildRailModel, withSource, upgradeHref, type MeProduct, type RailProduct } from "./core";

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

function EntitledRow({ p }: { p: RailProduct }) {
  const href = p.internal ? withSource(p.appUrl) : withSource(p.appUrl);
  return (
    <li className="rh-rail__item">
      <a className="rh-rail__link" href={href}>{p.title}</a>
    </li>
  );
}

function UpsellRow({ p, canBuy }: { p: RailProduct; canBuy: boolean }) {
  if (p.unlaunched) {
    return <li className="rh-rail__item rh-rail__item--soon">{p.title} <span className="rh-rail__soon">Coming soon</span></li>;
  }
  const href = canBuy ? upgradeHref(p.slug, p.state === "locked_billing" ? "renew" : "sidebar") : undefined;
  return (
    <li className="rh-rail__item rh-rail__item--upsell">
      {href ? <a className="rh-rail__link" href={href}>{p.title}</a> : <span className="rh-rail__link rh-rail__link--muted">{p.title}</span>}
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
        <a className="rh-rail__home" href="https://app.revheat.com/">RevHeat</a>

        {model.entitled.length > 0 && (
          <nav className="rh-rail__section" aria-label="Your products">
            <p className="rh-rail__heading">Your products</p>
            <ul>{model.entitled.map((p) => <EntitledRow key={p.code} p={p} />)}</ul>
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
              <span className="rh-rail__avatar" aria-hidden>{initial}</span>
              <span className="rh-rail__email">{identity.email}</span>
              {identity.roleLabel && <span className="rh-rail__role">{identity.roleLabel}</span>}
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
