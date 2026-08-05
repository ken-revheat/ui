"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { PRODUCT_CATALOG } from "./catalog.js";
import {
  buildRailModel,
  withSource,
  upgradeHref,
  isActiveProduct,
  PORTAL_ORIGIN,
  type MeProduct,
  type RailProduct,
} from "./core.js";
import { iconPathsFor } from "./icons.js";

// Matches the portal's own sidebar breakpoint (RhSidebar.vue) and the existing
// `@media (max-width: 900px)` rule in styles.css. A raw px query on purpose —
// this package has no Tailwind, so there is no `md:` screen to inherit.
const NARROW_QUERY = "(max-width: 900px)";

// Kept in sync with `--rh-duration-slow` in styles.css. The drawer stays mounted
// for this long after close so the slide-out can play; see `useDrawer`. Nothing
// user-facing depends on the two matching exactly — focus, the scroll lock and
// `aria-modal` are all released the moment closing STARTS, so a consumer that
// overrides the token only desynchronises the animation from the unmount.
const DRAWER_EXIT_MS = 300;

export interface AppShellIdentity {
  email: string | null;
  /**
   * RevHeat-internal org (an org-ID allowlist on the API side).
   * NOT the same thing as `isStaff` — see below.
   */
  isInternal: boolean;
  /**
   * Staff flag from the portal session (`revheat_session_info.isStaff`), which
   * is what the portal itself gates the Admin link on. `isInternal` is an
   * org-level allowlist and is broader: a non-staff member of the RevHeat org
   * has isInternal true and isStaff false. Pass this whenever the app has the
   * portal session; it falls back to `isInternal` so existing callers keep the
   * behaviour they have today.
   */
  isStaff?: boolean;
  roleLabel: string | null;
}

/**
 * ONE AppShell per page. It owns document-level state — a keydown listener for
 * the drawer's Escape and focus trap, and `document.body.style.overflow` for
 * the scroll lock — none of which is reference-counted. Two shells on one page
 * means one Escape closes both drawers, and whichever drawer closes first
 * unlocks the page while the other is still modal. Nothing here needs a second
 * shell: it is the page frame, not a widget.
 */
export interface AppShellProps {
  identity: AppShellIdentity;
  products: MeProduct[];
  /**
   * The viewer's role and buyer status, straight from `GET /api/me/products`.
   *
   * These drive `canBuy` (`viewerRole !== "rep" || isPrimaryBuyer`), i.e.
   * whether the "See plans →" / "Reactivate →" links render at all.
   *
   * Pass BOTH. Omitting both keeps the old guess (internal ⇒ admin, everyone
   * else ⇒ manager, always the primary buyer), which makes `canBuy`
   * unconditionally true — wrong, but it is what consumers already ship, and
   * a package bump should not silently strip their links. Passing only
   * `viewerRole` treats `isPrimaryBuyer` as false, because a half-adopted
   * consumer should fail closed rather than keep offering a rep the checkout
   * the portal would refuse.
   */
  viewerRole?: "rep" | "manager" | "admin";
  isPrimaryBuyer?: boolean;
  degraded?: boolean;
  productCodesFallback?: string[];
  activePath: string;
  /**
   * The product code of the app rendering this shell (e.g. "readiness_audit").
   * Highlights that row. Without it nothing is ever highlighted in a product
   * app — see `isActiveProduct` in core.ts for why the path rule alone cannot
   * work off-portal.
   */
  currentProductCode?: string;
  adminHref?: string;
  /** Replaces the built-in account block entirely. */
  accountMenu?: React.ReactNode;
  /**
   * Sign out handler. Omit it and the shell links to the portal's logout
   * instead — a cross-origin product app cannot clear the portal's
   * `.revheat.com` session cookie itself, so a local handler is only correct
   * for an app that shares the portal's origin.
   */
  onSignOut?: () => void;
  children: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/* focus / media helpers                                               */
/* ------------------------------------------------------------------ */

// `:not([disabled])` and `:not([hidden])` matter: the rail renders a muted,
// non-interactive row for products the viewer cannot buy, and a trap that
// hands focus to an unfocusable element silently does nothing — the user's Tab
// key appears to stop working.
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  '[tabindex]:not([tabindex="-1"])',
]
  .map((s) => `${s}:not([disabled]):not([hidden]):not([aria-hidden="true"])`)
  .join(",");

function focusablesIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(NARROW_QUERY);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

/**
 * Drawer open/closing state.
 *
 * `closing` keeps the panel mounted for one animation so the slide-out is
 * visible; everywhere else "not open" means "not in the DOM", which is what
 * keeps its links out of the tab order without needing `inert`.
 *
 * Two invariants this hook exists to hold, both learned from bugs:
 *
 *  1. **The exit timer belongs to the effect and to nobody else.** An earlier
 *     version cleared it from `close()` as well. A second `close()` inside the
 *     exit window (Escape twice, or a double-tap on the scrim — easy on a
 *     phone, where the first tap looks like it did nothing) cleared the timer
 *     while leaving the phase at "closing", so the effect never re-ran and the
 *     panel stayed mounted forever: page scroll-locked, every click swallowed
 *     by an invisible scrim, unrecoverable without a reload.
 *  2. **Every open is a NEW drawer.** `openId` is handed to the `Drawer` as its
 *     `key`, so reopening during the exit animation remounts it. Without that,
 *     the phase flips "closing" → "open" but the panel's mount-time work
 *     (focus in, scroll lock) never re-runs.
 */
function useDrawer() {
  const [phase, setPhase] = React.useState<"closed" | "open" | "closing">("closed");
  const [openId, setOpenId] = React.useState(0);

  const open = React.useCallback(() => {
    setOpenId((n) => n + 1);
    setPhase("open");
  }, []);

  const close = React.useCallback(() => {
    setPhase((prev) => (prev === "open" ? "closing" : prev));
  }, []);

  // No exit animation — the drawer is simply not the right control any more.
  // Used when the viewport widens past the breakpoint: the wide rail is back,
  // and sliding the drawer out over it would show two rails, two "Your
  // products" landmarks and two account menus for the length of the animation.
  const dismiss = React.useCallback(() => setPhase("closed"), []);

  React.useEffect(() => {
    if (phase !== "closing") return;
    const timer = setTimeout(() => setPhase("closed"), DRAWER_EXIT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return {
    phase,
    openId,
    open,
    close,
    dismiss,
    isOpen: phase === "open",
    isMounted: phase !== "closed",
  };
}

/* ------------------------------------------------------------------ */
/* glyphs                                                              */
/* ------------------------------------------------------------------ */

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

// Lucide "Menu" / "X", drawn inline so this package keeps its zero-dependency
// install (the portal imports them from lucide-vue-next).
function StrokeIcon({ d, className }: { d: string[]; className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {d.map((path, i) => (
        <path key={i} d={path} />
      ))}
    </svg>
  );
}

const MENU_ICON = ["M4 6h16", "M4 12h16", "M4 18h16"];
const CLOSE_ICON = ["M18 6 6 18", "m6 6 12 12"];
const CHEVRON_ICON = ["m6 9 6 6 6-6"];

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

/* ------------------------------------------------------------------ */
/* rail rows                                                           */
/* ------------------------------------------------------------------ */

function EntitledRow({
  p,
  activePath,
  currentProductCode,
}: {
  p: RailProduct;
  activePath: string;
  currentProductCode?: string;
}) {
  const href = withSource(p.appUrl);
  const active = isActiveProduct(p, activePath, currentProductCode);
  return (
    // `aria-current="page"` is the whole hook — it is what styles.css targets
    // and what a screen reader announces. No parallel `--active` class: an
    // emitted class with no rule behind it is a trap for the next reader.
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

/* ------------------------------------------------------------------ */
/* account menu                                                        */
/* ------------------------------------------------------------------ */

interface AccountMenuProps {
  identity: AppShellIdentity;
  isStaff: boolean;
  adminHref?: string;
  onSignOut?: () => void;
}

// Same items, same order and same destinations as the portal's own account menu
// (RhSidebarRail.vue). "Account settings" and "Team & Access" both point at
// /account on purpose — that page owns both — and Admin is repeated here even
// though the header shows it too. Matching the portal exactly is the point.
//
// Admin needs BOTH the staff flag and an explicit `adminHref`, exactly like the
// header link. Defaulting the href would have made every app that bumps this
// package start showing Admin to anyone in a RevHeat org, with no code change
// on their side — a behaviour change nobody opted into.
function accountItemsFor(isStaff: boolean, adminHref?: string) {
  const items = [
    { key: "account", label: "Account settings", href: `${PORTAL_ORIGIN}/account` },
    { key: "team", label: "Team & Access", href: `${PORTAL_ORIGIN}/account` },
    { key: "products", label: "Manage products", href: `${PORTAL_ORIGIN}/` },
  ];
  if (isStaff && adminHref) {
    items.push({ key: "admin", label: "Admin", href: adminHref });
  }
  return items;
}

function AccountMenu({ identity, isStaff, adminHref, onSignOut }: AccountMenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuId = React.useId();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const initial = (identity.email ?? "?").charAt(0).toUpperCase();
  const items = accountItemsFor(isStaff, adminHref);

  // Built in an effect, not during render: `window.location.origin` differs
  // between the server and the browser, and an href that changes between the
  // two is a hydration mismatch.
  //
  // The portal validates `next` against revheat.com and its subdomains, so from
  // localhost or a *.pages.dev preview it drops the parameter and lands on
  // portal home. Correct on every production hostname; harmless everywhere else.
  const [signOutHref, setSignOutHref] = React.useState(`${PORTAL_ORIGIN}/logout`);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setSignOutHref(`${PORTAL_ORIGIN}/logout?next=${encodeURIComponent(window.location.origin)}`);
  }, []);

  const closeAndRefocus = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const focusItem = (index: number) => {
    const focusables = focusablesIn(menuRef.current);
    if (focusables.length === 0) return;
    const wrapped = ((index % focusables.length) + focusables.length) % focusables.length;
    focusables[wrapped]!.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // Only this layer. Inside the drawer the panel has its own Escape
      // handler; without this the one keypress would close both, which is what
      // the portal does today.
      e.stopPropagation();
      closeAndRefocus();
      return;
    }
    if (e.key === "Tab") {
      // preventDefault matters: the browser's default Tab targets the NEXT
      // menu item, which this same keystroke unmounts — focus would land on
      // <body> and the next Tab would restart from the top of the document.
      // Place it on the trigger ourselves instead.
      e.preventDefault();
      e.stopPropagation();
      closeAndRefocus();
      return;
    }
    const focusables = focusablesIn(menuRef.current);
    const current = focusables.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(current + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(focusables.length - 1);
    }
  };

  // The menu does not exist until the open render commits, so the focus move
  // has to wait for the effect rather than happen inside the click handler.
  const focusFirstOnOpen = React.useRef(false);
  React.useEffect(() => {
    if (!open || !focusFirstOnOpen.current) return;
    focusFirstOnOpen.current = false;
    focusItem(0);
  });

  const openAndFocusFirst = () => {
    focusFirstOnOpen.current = true;
    setOpen(true);
  };

  return (
    <div className="rh-rail__account-menu" ref={rootRef}>
      {open && (
        <div
          className="rh-rail__menu"
          id={menuId}
          role="menu"
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
        >
          {/*
            tabIndex -1 on every item is the ARIA menu pattern's roving focus:
            the menu itself moves focus (arrows / Home / End), and Tab leaves
            the menu rather than walking it. They stay reachable by
            FOCUSABLE_SELECTOR because they are still `a[href]` / `button`.
          */}
          {items.map((item) => (
            <a
              key={item.key}
              className="rh-rail__menu-item"
              role="menuitem"
              tabIndex={-1}
              href={item.href}
            >
              {item.label}
            </a>
          ))}
          {onSignOut ? (
            <button
              type="button"
              className="rh-rail__menu-item rh-rail__menu-item--signout"
              role="menuitem"
              tabIndex={-1}
              onClick={onSignOut}
            >
              Sign out
            </button>
          ) : (
            <a
              className="rh-rail__menu-item rh-rail__menu-item--signout"
              role="menuitem"
              tabIndex={-1}
              href={signOutHref}
            >
              Sign out
            </a>
          )}
        </div>
      )}

      <button
        type="button"
        className="rh-rail__account-trigger"
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? setOpen(false) : openAndFocusFirst())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            openAndFocusFirst();
          }
        }}
      >
        <span className="rh-rail__avatar" aria-hidden>
          {initial}
        </span>
        <span className="rh-rail__account-meta">
          <span className="rh-rail__email">{identity.email}</span>
          {identity.roleLabel && <span className="rh-rail__role">{identity.roleLabel}</span>}
        </span>
        <StrokeIcon className="rh-rail__caret" d={CHEVRON_ICON} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* drawer                                                              */
/* ------------------------------------------------------------------ */

function Drawer({
  id,
  closing,
  onClose,
  children,
}: {
  id: string;
  closing: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  // Move focus into the panel, and remember what opened us so we can give it
  // back. Mount-time is correct for BOTH: `openId` keys this component, so a
  // reopen during the exit animation is a fresh mount, not a reused one.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    // Capture ONCE. StrictMode runs mount effects twice on the same instance,
    // and a second capture would record whatever the first one focused — i.e.
    // the drawer's own close button — as "the thing to give focus back to".
    if (triggerRef.current === null) {
      triggerRef.current = document.activeElement as HTMLElement | null;
    }
    focusablesIn(panelRef.current)[0]?.focus();
  }, []);

  // Hand focus back when closing STARTS, not when the panel unmounts one
  // animation later — by then an SPA route change may have moved focus to the
  // new page's heading, and yanking it back to the hamburger is worse than
  // doing nothing. Only reclaim focus if it is still ours (or nowhere).
  React.useEffect(() => {
    if (!closing || typeof document === "undefined") return;
    const active = document.activeElement;
    const ours = !active || active === document.body || panelRef.current?.contains(active);
    if (ours) triggerRef.current?.focus?.();
    // Then take the exiting panel out of the tab order entirely. `pointer-events:
    // none` handles the mouse, but a Tab pressed inside the exit window would
    // otherwise land back in the panel we just left — and then on <body> when it
    // unmounts. Set AFTER the focus restore above, since `inert` blurs whatever
    // is focused inside. Browsers without `inert` are no worse than before.
    panelRef.current?.setAttribute("inert", "");
  }, [closing]);

  // The portal has no scroll lock, so on a phone the page scrolls behind the
  // scrim while the menu is open. Released the moment closing starts: holding
  // it for the exit animation leaves the page frozen for 300ms after the user
  // has already dismissed the menu — and under `prefers-reduced-motion` the
  // panel is gone in 1ms, so the freeze would be the only thing they notice.
  React.useEffect(() => {
    if (closing || typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [closing]);

  // Escape and the focus trap live on the DOCUMENT, not on the panel.
  //
  // A React `onKeyDown` on the panel only fires for keys pressed while focus is
  // INSIDE it — and a click on any non-interactive part of the panel (its
  // padding, a heading) blurs to <body>, at which point Escape stops working
  // and Tab is no longer intercepted, so the user tabs straight into the page
  // behind the scrim. The portal's own RhSidebar.vue documents exactly this and
  // uses document-level handlers for the same reason.
  React.useEffect(() => {
    if (closing || typeof document === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Defer to the innermost layer — but only for a keypress that is actually
      // IN it. One keypress closes one layer; the portal closes both at once.
      //
      // Asking "is a [role=menu] present anywhere in the panel?" instead is the
      // same class of mistake this whole effect exists to fix. `accountMenu` is
      // a public prop, and a consumer that renders a force-mounted or hidden
      // menu (every headless menu library does) would satisfy that question
      // forever — leaving the drawer with no keyboard exit at all. Even with
      // the built-in menu it misfires: click the menu's padding ring, focus
      // blurs to <body>, and neither layer would answer the keyboard.
      const menu = panelRef.current?.querySelector('[role="menu"]');
      if (menu?.contains(e.target as Node)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = focusablesIn(panelRef.current);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      const outside = !panelRef.current?.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closing, onClose]);

  const tree = (
    <div className={`rh-drawer${closing ? " rh-drawer--closing" : ""}`}>
      <div className="rh-drawer__scrim" onClick={onClose} aria-hidden />
      <div
        className="rh-drawer__panel rh-rail rh-rail--drawer"
        id={id}
        role="dialog"
        // Dropped while closing, in step with the scroll lock and the focus
        // trap: a screen reader should not still be told the rest of the page
        // is inert once the drawer is on its way out.
        aria-modal={closing ? undefined : "true"}
        aria-label="RevHeat products"
        ref={panelRef}
        // Clicking dead space inside the panel keeps focus on the panel rather
        // than dropping it to <body>. The document-level handlers above cope
        // either way; this keeps the focus ring somewhere sensible.
        tabIndex={-1}
      >
        <button
          type="button"
          className="rh-drawer__close"
          aria-label="Close product menu"
          onClick={onClose}
        >
          <StrokeIcon className="rh-drawer__close-glyph" d={CLOSE_ICON} />
        </button>
        {children}
      </div>
    </div>
  );

  // Portaled to <body> so an ancestor `transform`/`filter` in the consumer app
  // cannot become the containing block for our position:fixed scrim — the
  // failure mode there is a scrim that covers only part of the viewport.
  if (typeof document === "undefined") return tree;
  return createPortal(tree, document.body);
}

/* ------------------------------------------------------------------ */
/* shell                                                               */
/* ------------------------------------------------------------------ */

export function AppShell({
  identity,
  products,
  viewerRole,
  isPrimaryBuyer,
  degraded = false,
  productCodesFallback = [],
  activePath,
  currentProductCode,
  adminHref,
  accountMenu,
  onSignOut,
  children,
}: AppShellProps) {
  const isNarrow = useIsNarrow();
  const drawer = useDrawer();
  const drawerId = React.useId();
  const { close: closeDrawer, dismiss: dismissDrawer } = drawer;

  // The portal only closes its drawer from rows that emit `navigate`, so its
  // own "RevHeat home" link leaves the menu sitting open over the new page.
  React.useEffect(() => {
    closeDrawer();
  }, [activePath, closeDrawer]);

  // Widening past the breakpoint puts the real rail back; leaving the drawer up
  // would stack two copies of it. Dismissed outright rather than animated out,
  // for the same reason the portal does it with a plain `v-if`.
  React.useEffect(() => {
    if (!isNarrow) dismissDrawer();
  }, [isNarrow, dismissDrawer]);

  const isStaff = identity.isStaff ?? identity.isInternal;

  const model = buildRailModel({
    me: degraded
      ? null
      : {
          viewerRole: viewerRole ?? (identity.isInternal ? "admin" : "manager"),
          // `true` only on the fully-legacy path, where a consumer passes
          // neither prop and would otherwise LOSE links it shows today. Once an
          // app starts sending a real `viewerRole`, an omitted `isPrimaryBuyer`
          // is a gap in its adoption, not a request for the old guess — and
          // guessing `true` there hands checkout to a rep the portal refuses.
          isPrimaryBuyer: isPrimaryBuyer ?? viewerRole === undefined,
          products,
        },
    degraded,
    productCodesFallback,
    catalog: PRODUCT_CATALOG,
  });

  const railBody = (
    <>
      <a className="rh-rail__home" href={`${PORTAL_ORIGIN}/`} aria-label="RevHeat home">
        <BrandMarkR />
      </a>

      {model.entitled.length > 0 && (
        <nav className="rh-rail__section" aria-label="Your products">
          <p className="rh-rail__heading">Your products</p>
          <ul>
            {model.entitled.map((p) => (
              <EntitledRow
                key={p.code}
                p={p}
                activePath={activePath}
                currentProductCode={currentProductCode}
              />
            ))}
          </ul>
        </nav>
      )}

      {model.upsell.length > 0 && (
        <nav className="rh-rail__section" aria-label="Available">
          <p className="rh-rail__heading">Available</p>
          <ul>
            {model.upsell.map((p) => (
              <UpsellRow key={p.code} p={p} canBuy={model.canBuy} />
            ))}
          </ul>
        </nav>
      )}

      <div className="rh-rail__account">
        {accountMenu ?? (
          <AccountMenu
            identity={identity}
            isStaff={isStaff}
            adminHref={adminHref}
            onSignOut={onSignOut}
          />
        )}
      </div>
    </>
  );

  return (
    <div className="rh-shell">
      {/*
        Rendered only on wide viewports. `isNarrow` starts false so the server
        and the first client render agree; the CSS rule at the bottom of
        styles.css keeps the rail hidden on a narrow screen until the effect
        runs, so there is no flash.
      */}
      {!isNarrow && (
        <aside className="rh-rail" aria-label="RevHeat products">
          {railBody}
        </aside>
      )}

      {drawer.isMounted && (
        <Drawer
          // Every open is a fresh Drawer — see `useDrawer`. Without the key,
          // reopening mid-exit reuses the instance and none of its mount work
          // (focus in, scroll lock) happens.
          key={drawer.openId}
          id={drawerId}
          closing={drawer.phase === "closing"}
          onClose={drawer.close}
        >
          {railBody}
        </Drawer>
      )}

      <div className="rh-shell__main">
        <header className="rh-banner">
          <button
            type="button"
            className="rh-banner__menu"
            aria-label="Open product menu"
            // Only while the drawer exists — `aria-controls` pointing at an id
            // that is not in the document fails axe `aria-valid-attr-value`,
            // and the drawer is unmounted whenever it is closed.
            aria-controls={drawer.isMounted ? drawerId : undefined}
            aria-expanded={drawer.isOpen}
            onClick={drawer.open}
          >
            <StrokeIcon className="rh-banner__menu-glyph" d={MENU_ICON} />
          </button>
          <a className="rh-banner__brand" href={`${PORTAL_ORIGIN}/`} aria-label="RevHeat home">
            <BrandWordmark />
          </a>
          {isStaff && adminHref && (
            <a className="rh-banner__admin" href={adminHref}>
              Admin
            </a>
          )}
        </header>
        {children}
        <footer className="rh-footer">
          <span>© {new Date().getFullYear()} RevHeat</span>
          <a href="https://revheat.com/terms">Terms</a>
          <a href="https://revheat.com/privacy">Privacy</a>
          <a href="mailto:support@revheat.com">Support</a>
        </footer>
      </div>
    </div>
  );
}
