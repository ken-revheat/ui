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
export declare function AppShell({ identity, products, viewerRole, isPrimaryBuyer, degraded, productCodesFallback, activePath, currentProductCode, adminHref, screens, headerActions, accountMenu, onSignOut, children, }: AppShellProps): React.JSX.Element;
//# sourceMappingURL=react.d.ts.map