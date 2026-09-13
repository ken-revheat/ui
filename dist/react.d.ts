import * as React from "react";
import { type MeProduct, type ShellScreen } from "./core.js";
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
    /** Horizontal in-product screen menu. Rendered only when 2+ items. */
    screens?: ShellScreen[];
    /**
     * Client-side navigation hook. When present, a plain left-click on a
     * same-origin link is intercepted (`preventDefault`) and `onNavigate(href)`
     * is called instead of letting the browser load the page — wire it to your
     * router's push.
     *
     * ⚠️ As of v2.2.0 this is the WHOLE shell, not just the screen menu: the
     * rail's home link, every entitled product row, "All products →", the
     * account menu's items and the staff Admin link all route through it too.
     * Before v2.2.0 only the screen tabs did, and everything else was a full
     * page load. If your handler assumes it only ever sees a screen tab's href,
     * that assumption broke here.
     *
     * The href you receive is normalised, never the raw attribute: it is
     * resolved against the document's base URL and handed back as
     * path + search + hash. So an absolute same-origin href loses its origin, a
     * document-relative one is resolved (against `<base href>` if you ship
     * one), and a hash-only one keeps the current path AND query string.
     *
     * Modified clicks (⌘/ctrl/shift/alt, middle button) and `external: true`
     * tabs keep the browser's default so open-in-new-tab still works, and so
     * does an off-origin href that forgot `external: true`. Omit the prop and
     * every one of these is a plain link.
     *
     * This is a function prop: whatever renders `<AppShell onNavigate>` must
     * itself be a Client Component ("use client") — a Server Component cannot
     * pass functions across the boundary.
     */
    onNavigate?: (href: string) => void;
    /** App-supplied controls, rendered in the banner between the title and Admin. */
    headerActions?: React.ReactNode;
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
export declare function AppShell({ identity, products, viewerRole, isPrimaryBuyer, degraded, productCodesFallback, activePath, currentProductCode, adminHref, screens, onNavigate, headerActions, accountMenu, onSignOut, children, }: AppShellProps): React.JSX.Element;
//# sourceMappingURL=react.d.ts.map