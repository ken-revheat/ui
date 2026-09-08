# Shell v2 — the navigation model, built once (design)

Date: 2026-09-08 · Owner: Ken (ruled) · Package: `@revheat/ui` → tag **v2.0.0**
Status: APPROVED by Ken 2026-09-08 ("go") on the one-screen plan below. Do not re-litigate rulings.

## Why
Eight front-ends, six hand-rolled product sidebars, one flat list mixing owned / for-sale /
coming-soon rows. Ken: "We need all to share the sidebar … the sidebar is legacy and confusing."
Step 3 (per-org visibility switch, `sidebarHidden`) is live. Step 4 = this document.

## Rulings (Ken, 2026-09-08) — locked
- Nav model: the **left rail switches PRODUCT**; a **horizontal menu under the header switches SCREEN**
  within the product. Buy / coming-soon rows LEAVE the rail; they live on the portal home.
- Rail shows **owned + org-enabled products only** (`state === "launch"` and not `sidebarHidden`).
- Visibility override is **org-level only** (already built, step 3).
- Page container, breadcrumb row, empty states, disclosure = **LATER**, not this release.
- Portal home tiles stay exactly as they are.
- Order after this: step 5 adopts apps Call Analyzer → Directive → QuotaFit → Advisor → Trend Finder → portal.

## Three design calls (Claude, approved by Ken's "go")
1. The rail keeps ONE trailing row, **"All products"**, linking to the portal home
   (`PORTAL_ORIGIN + "/?source=sidebar"`), so people can still find what they don't own.
2. The **shell draws the screen menu**; the app supplies only `{label, href, active?}` items.
3. Breadcrumb waits for the page-container release (out of scope here).

## What the shell renders (identical in React and Vue)
```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ R mark   │ ← Portal · wordmark · {current product title}   [app slot] [Admin] │  banner
│          ├──────────────────────────────────────────────────────────────┤
│ product  │ Screen · Screen · Screen                (scrolls sideways <900px) │  screen menu (omitted when 0 or 1 screen)
│ product  ├──────────────────────────────────────────────────────────────┤
│ (active) │                                                              │
│ …        │  {children / default slot}                                   │  content
│          │                                                              │
│ All      │                                                              │
│ products ├──────────────────────────────────────────────────────────────┤
│ [account]│ footer (© · Terms · Privacy · Support)                       │
└──────────┴──────────────────────────────────────────────────────────────┘
```
- **Rail** (260px wide, existing `.rh-rail`): brand mark → nav `aria-label="Your products"` listing
  `RailModel.entitled` rows (unchanged row component, `aria-current="page"` on the active product)
  → one row "All products →" (class `rh-row rh-row--all`, `href = withSource(PORTAL_ORIGIN + "/", "sidebar")`)
  → account block (unchanged). **The "Available" nav and every upsell/coming-soon row are removed**
  from the rendered rail. `buildRailModel` keeps returning `upsell` (core API stays additive/stable) —
  renderers simply no longer draw it.
- **Banner/header**: left = hamburger (<900px) · "← Portal" link to `PORTAL_ORIGIN` (with `?source=sidebar`)
  · wordmark · current product title (from catalog via `currentProductCode`; omitted when the code is
  unknown, never a fabricated name). Right = app slot (`headerActions` React prop / `#header-actions`
  Vue slot) · Admin link when `isStaff && adminHref` (as today).
- **Screen menu**: new `screens?: ShellScreen[]` where `ShellScreen = {label: string; href: string; active?: boolean; external?: boolean}`.
  Rendered as `<nav class="rh-menu" aria-label="Screens">` directly under the banner, 48px tall, tabs
  13px/500, active tab = brand tint + brand colour + 600 + `aria-current="page"`. If `active` is not
  supplied on any item, the shell derives it: the item whose `href` (path part) is the longest prefix
  of `activePath`. Rendered ONLY when `screens.length >= 2`. Items with `external: true` render a
  plain `<a>` (no client-side routing assumptions; the shell never imports a router).
- **Mobile (<900px)**: the rail is unmounted and the existing drawer carries the same rail content
  (products + "All products" + account). The screen menu stays in flow and scrolls horizontally
  (`overflow-x: auto`, no wrapping).
- **Print**: `.rh-rail, .rh-banner, .rh-menu, .rh-footer { display: none }` under `@media print`.

## Core changes (`src/core.ts`) — additive only
- `export interface ShellScreen { label: string; href: string; active?: boolean; external?: boolean }`
- `export function resolveActiveScreen(screens: ShellScreen[], activePath: string): ShellScreen[]`
  (pure; returns items with `active` filled in per the rule above; explicit `active` wins).
- `export const ALL_PRODUCTS_HREF = withSource(PORTAL_ORIGIN + "/", "sidebar")`.
- `export function productTitle(code: string | undefined, catalog): string | undefined`.
- `buildRailModel`, `withCatalog`, `isActiveProduct`, `withSource`, `upgradeHref` unchanged in signature.

## Renderers
### React (`src/react.tsx`, `@revheat/ui/react`)
- `AppShellProps` gains `screens?: ShellScreen[]` and `headerActions?: ReactNode`. Everything else unchanged
  (identity, products, viewerRole, isPrimaryBuyer, degraded, productCodesFallback, activePath,
  currentProductCode, adminHref, accountMenu, onSignOut, children).
- Remove `UpsellRow` rendering and the "Available" nav (delete dead code; `canBuy` stays in the model).
- Keep `"use client"` as line 1 of `dist/react.js` (`check:client`).

### Vue (`src/vue.ts`, NEW `@revheat/ui/vue` export)
- Vue 3, **written as `defineComponent` + `h()` render functions in TypeScript — no `.vue` SFC**, so the
  existing plain-`tsc` build (dist committed, `npm run compile`) needs no template compiler.
  `vue` becomes an optional peer dep (`>=3.4`), like react.
- `AppShell` component: props mirror the React ones one-for-one (`identity`, `products`, `viewerRole`,
  `isPrimaryBuyer`, `degraded`, `productCodesFallback`, `activePath`, `currentProductCode`, `adminHref`,
  `screens`); emits `sign-out`; slots: default (content), `header-actions`, `account-menu`.
- Same DOM: same element order, same class names, same aria attributes as React, so `styles.css` is
  shared unchanged and the same test list runs against both.
- Drawer: `Teleport` to `body`, focus trap, Escape, scroll lock — same behaviour as the React `Drawer`
  (the portal's `RhSidebar.vue` is the reference for the Vue-side idiom).
- No data fetching inside the shell (same rule as React): apps fetch `/api/me/products` and pass it in.

### Shared
- `src/styles.css` gains `.rh-menu` / `.rh-menu__tab` / `.rh-row--all` / print rules; all values via
  `var(--rh-*, fallback)` as today. No new stylesheet.
- `src/icons.ts` unchanged.

## Package
- `package.json`: version `2.0.0`; exports add `./vue` → `dist/vue.js` + `dist/vue.d.ts`;
  `peerDependencies.vue: ">=3.4"` (optional); devDeps add `vue`, `@vue/test-utils`.
- `tsconfig.build.json` includes `src/vue.ts`. `npm run verify` (compile + test + check:client + check:dist)
  is the release gate; dist is recompiled and committed.
- README: document `/vue`, `screens`, `headerActions`, and the v2 rail rule (owned + enabled only).

## Build gate (`ken-revheat/design-tokens`, `lib/favicon.mjs` `verify-shell`) — separate PR, v1.3.0
- Already accepts `@revheat/ui/vue` and walks `.vue` files. Extension: FAIL when the app still ships a
  product sidebar of its own next to the shared shell. Tripwire = any source file (outside
  `node_modules`, `.nuxt`, `.next`, `.output`, `dist`) whose path matches
  `/(?:^|\/)(?:Rh)?(?:Product|Sidebar)?Rail\w*\.(?:vue|[tj]sx?)$/` or `/(?:^|\/)(?:Rh)?Sidebar\.(?:vue|[tj]sx?)$/`
  or `/app-shell\/Sidebar\.tsx$/` or `/(?:^|\/)railProjection\.[tj]s$/`.
  Known copies it must catch: `RhProductRail.vue` (CA, Directive), `RhSidebar.vue` + `RhSidebarRail.vue`
  (portal), `ProductRail.tsx` (QuotaFit), `app-shell/Sidebar.tsx` (Trend Finder), `railProjection.ts` (CA).
  Must NOT catch `PageTrail.vue`. Error text names the file and says "delete it; the shared shell owns the rail".
- Tests in `test/favicon.test.mjs` for pass / each known copy / `PageTrail.vue` negative.

## Tests (vitest, happy-dom) — the same list for both renderers
1. Rail lists only `state:"launch"` products without `sidebarHidden`; no "Available" nav; no upsell rows.
2. "All products" row present, last in the rail, href = portal home with `?source=sidebar`.
3. Active product row has `aria-current="page"`; banner shows its catalog title.
4. Unknown `currentProductCode` → no title text rendered (no fabricated name).
5. `screens` with 2+ items → `.rh-menu` rendered, active tab derived from `activePath`; explicit `active` wins.
6. `screens` with 0 or 1 item → no `.rh-menu`.
7. Header actions slot/prop renders inside the banner.
8. Degraded mode (`degraded:true` + `productCodesFallback`) still lists the fallback products.
9. Drawer opens/closes (<900px), traps focus, Escape closes (existing React tests; ported to Vue).
10. Core: `resolveActiveScreen` longest-prefix rule; `productTitle`.

## Out of scope (do not build)
Page container, breadcrumb, empty states, disclosure, a shared `useMeProducts` composable, any app
migration (step 5), Sell Play catalog entry, portal home tiles, per-user visibility.

## Required reading for implementers
- `README.md`, `PLAN-v1.4.0.md` (how v1.4 was built), `src/core.ts`, `src/react.tsx`, `src/styles.css`,
  `test/shell.spec.tsx`. Portal `RhSidebar.vue` (lead-accelerator/apps/portal/components) for the Vue drawer idiom.
- Invariants: catalog repo is PUBLIC — never add pre-launch product names; every portal link absolute;
  `consultingOnly` and `sidebarHidden` rows never render; `sidebarHidden` is visibility only, never entitlement.
