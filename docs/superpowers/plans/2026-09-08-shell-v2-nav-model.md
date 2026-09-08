# Shell v2 — navigation model: file-level implementation plan

Spec: `docs/superpowers/specs/2026-09-08-shell-v2-nav-model-design.md` (APPROVED, decisions locked).
Worktree: `.worktrees/feat/shell-v2-nav-model`, base `0cb4329`. Target tag **v2.0.0**.
Baseline: 67 tests green (`catalog 6 + core 14 + icons 4 + react 3 + shell 40`).

## 0. Facts pinned from the code (do not re-derive)

| Fact | Where |
|---|---|
| Installed toolchain: vitest **2.1.9**, happy-dom **15.11.7**, typescript **5.9.3**, react 18.3.1, @testing-library/dom **10.4.1** (transitive) | `package-lock.json` |
| `NARROW_QUERY = "(max-width: 900px)"`, `DRAWER_EXIT_MS = 300` | `src/react.tsx:19`, `:26` |
| `PORTAL_ORIGIN = "https://app.revheat.com"` declared *after* `withSource` | `src/core.ts:105-113`, `:121` |
| `.rh-banner__brand { margin-right: auto }` is what right-aligns Admin today | `src/styles.css:336-341` |
| `.rh-rail__account { margin-top: auto }` pins the account block | `src/styles.css:200-207` |
| Box-sizing reset enumerates blocks explicitly; a new block must be added | `src/styles.css:20-37` |
| Narrow media query uses `.rh-rail:not(.rh-rail--drawer)` | `src/styles.css:501-511` |
| `check:dist` fails on *staged* dist too → commit dist **before** `verify` | `PLAN-v1.4.0.md` "Steps, corrected" |
| React test matchMedia stub (`setViewport`) | `test/shell.spec.tsx:12-31` |

---

## 1. Toolchain decisions (exact config)

### 1.1 devDependencies (add three)
```
npm install --save-dev vue@^3.5.42 @vue/test-utils@^2.5.0 @testing-library/dom@^10.4.1
```
- `vue@^3.5.42` — latest 3.x (`npm view vue version` → 3.5.42). Satisfies the `>=3.4` peer.
- `@vue/test-utils@^2.5.0` (`npm view @vue/test-utils version` → 2.5.0). v2 is the Vue-3 line; it is a plain library with no Vite-plugin requirement and works on vitest 2.1.9 + happy-dom 15.
- `@testing-library/dom@^10.4.1` — promote the existing transitive dep to a direct devDep. The Vue tests query the teleported drawer through `screen`/`within` from `@testing-library/dom` (VTU's `wrapper.find` cannot see Teleport output). Pin to the version already in the lock so `npm ci` is a no-op resolution change.

**No vitest bump.** The spec's "vitest 3" is not what is installed; 2.1.9 + VTU 2.5 + happy-dom 15 is a supported combination. Do not upgrade.

Commit the regenerated `package-lock.json` in the same commit as `package.json`.

### 1.2 `tsconfig.build.json` — **no change required**
`include: ["src"]` already picks up `src/vue.ts`; `outDir: dist` emits `dist/vue.js` + `dist/vue.d.ts` + maps automatically. `jsx: "react-jsx"` lives in the base `tsconfig.json` and applies **only to `.tsx` files**, so `src/vue.ts` (which uses `h()`, no JSX) is unaffected. **One build tsconfig, no second config.**

Contingency (see Risk R1): if `tsc -p tsconfig.build.json` reports a duplicate/global `JSX` namespace conflict between `@types/react` and `vue`, do **not** split the tsconfig — add `"jsxImportSource": "react"` explicitly to `tsconfig.json` and re-run. Only if that fails, add `tsconfig.vue.json` (extends build, `include: ["src/vue.ts"]`, `"jsx": "preserve"`) and change `compile` to `tsc -p tsconfig.build.json && tsc -p tsconfig.vue.json && cp …`.

### 1.3 `package.json` edits
```jsonc
"version": "2.0.0",
"exports": {
  // …existing…
  "./react": { "types": "./dist/react.d.ts", "default": "./dist/react.js" },
  "./vue":   { "types": "./dist/vue.d.ts",   "default": "./dist/vue.js"   },
  "./styles.css": "./dist/styles.css",
  "./package.json": "./package.json"
},
"peerDependencies": { "react": ">=18", "react-dom": ">=18", "vue": ">=3.4" },
"peerDependenciesMeta": {
  "react": { "optional": true },
  "react-dom": { "optional": true },
  "vue": { "optional": true }
}
```
Extend the existing `"//peerDependencies"` note: `vue` is optional for the same reason `react` is — a React-only consumer never resolves it, and a required peer would only produce a spurious install warning.

`"sideEffects": ["*.css"]` — **unchanged**. `dist/vue.js` is a pure module-scope `defineComponent(...)` call with no import-time DOM work, so leaving it outside `sideEffects` lets bundlers drop it from React apps. Do not add it.

### 1.4 `"use client"` banner on `dist/vue.js` — **NO**
`"use client"` is an RSC directive consumed by Next.js/Turbopack. Vue consumers are Nuxt/Vite, which have no such boundary; the directive would be an inert string. `check:client` stays exactly as written (it only inspects `dist/react.js`).

### 1.5 Keeping `check:dist` green
`compile` emits four new files (`dist/vue.js`, `.js.map`, `.d.ts`, `.d.ts.map`). `check:dist` runs `git status --porcelain -- dist`, which reports **untracked and staged** files as dirty. Therefore: `npm run compile` → `git add dist` → **`git commit`** → *then* `npm run verify`.

### 1.6 `vitest.config.ts`
Add Vue's compile-time feature flags so the bundler build of `vue` does not warn under Vitest:
```ts
export default defineConfig({
  define: {
    __VUE_OPTIONS_API__: "true",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
  test: { environment: "happy-dom", globals: true },
});
```
No `@vitejs/plugin-vue`: there are no `.vue` files in this repo.

---

## 2. The shared DOM contract (write this once; both renderers match it exactly)

Element order is **top-to-bottom, siblings in order**. `«cond»` = rendered only when the condition holds. Attributes listed are the complete set that tests assert on.

### 2.1 `.rh-shell` (root)
1. `«!isNarrow»` `<aside class="rh-rail" aria-label="RevHeat products">` → **RAIL BODY** (§2.2)
2. `«drawerMounted»` Teleport/portal to `document.body` → **DRAWER** (§2.4)
3. `<div class="rh-shell__main">`
   1. `<header class="rh-banner">` → **BANNER** (§2.3)
   2. `«screens.length >= 2»` `<nav class="rh-menu" aria-label="Screens">` → **SCREEN MENU** (§2.5)
   3. default slot / `children`
   4. `<footer class="rh-footer">` — unchanged from `src/react.tsx:865-870`

### 2.2 RAIL BODY (identical inside `<aside>` and inside the drawer panel)
1. `<a class="rh-rail__home" href="https://app.revheat.com/" aria-label="RevHeat home">` › `<svg class="rh-rail__mark" viewBox="264.263 347.964 72.08 72.08" role="img" aria-label="RevHeat">` › one `<path fill="currentColor" d="…">`
2. `«model.entitled.length > 0»` `<nav class="rh-rail__section" aria-label="Your products">`
   1. `<p class="rh-rail__heading">Your products</p>`
   2. `<ul>` › per product, in `model.entitled` order:
      `<li class="rh-rail__item">` › `<a class="rh-rail__link" href="{withSource(p.appUrl)}" [aria-current="page" when isActiveProduct]>` › `<span class="rh-rail__tile" aria-hidden="true">` › `<svg class="rh-rail__glyph" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true">` › `<path d>`×n `</span>` › `<span class="rh-rail__label">{p.title}</span>`
3. **NEW** `<a class="rh-row rh-row--all" href="{ALL_PRODUCTS_HREF}">All products →</a>` — a bare anchor, direct child of the rail, always rendered, always immediately before the account block. (Text: `All products →`, U+2192.)
4. `<div class="rh-rail__account">` › `account-menu` slot / `accountMenu` prop **or** the built-in `<div class="rh-rail__account-menu">` (unchanged; `src/react.tsx:481-556`)

**REMOVED:** the entire `<nav class="rh-rail__section" aria-label="Available">` block and every `.rh-rail__item--upsell` / `--soon` row.

### 2.3 BANNER — `<header class="rh-banner">`
1. `<div class="rh-banner__lead">` *(NEW wrapper; carries `margin-right: auto`)*
   1. `<button type="button" class="rh-banner__menu" aria-label="Open product menu" [aria-controls={drawerId} only when the drawer is mounted] aria-expanded="{true|false}">` › `<svg class="rh-banner__menu-glyph" …>` (3 paths)
   2. **NEW** `<a class="rh-banner__portal" href="{ALL_PRODUCTS_HREF}">` › `<span aria-hidden="true">←</span>` + text node `" Portal"` — accessible name **"Portal"**, `textContent` **"← Portal"**
   3. `<a class="rh-banner__brand" href="https://app.revheat.com/" aria-label="RevHeat home">` › `<svg class="rh-banner__wordmark" …>` (6 paths, unchanged)
   4. **NEW** `«title !== undefined»` `<span class="rh-banner__product">{title}</span>` where `title = productTitle(currentProductCode, PRODUCT_CATALOG)`
2. **NEW** `«headerActions supplied»` `<div class="rh-banner__actions">{headerActions | slot header-actions}</div>`
3. `«isStaff && adminHref»` `<a class="rh-banner__admin" href="{adminHref}">Admin</a>`

Presence rule for #2, identical in both: React `headerActions == null ? null : <div…>`; Vue `slots["header-actions"] ? h("div", …) : null`.

### 2.4 DRAWER (portal/Teleport target `document.body`)
1. `<div class="rh-drawer[ rh-drawer--closing]">`
   1. `<div class="rh-drawer__scrim" aria-hidden="true">` (click → close)
   2. `<div class="rh-drawer__panel rh-rail rh-rail--drawer" id="{drawerId}" role="dialog" [aria-modal="true" — dropped while closing] aria-label="RevHeat products" tabindex="-1">`
      1. `<button type="button" class="rh-drawer__close" aria-label="Close product menu">` › `<svg class="rh-drawer__close-glyph">` (2 paths)
      2. **RAIL BODY** (§2.2)

### 2.5 SCREEN MENU — `<nav class="rh-menu" aria-label="Screens">`
Children, in `screens` array order, one per item, no wrapper list:
`<a class="rh-menu__tab" href="{s.href}" [aria-current="page" when resolved active] [rel="noopener noreferrer" when s.external]>{s.label}</a>`

Rendered **only** when `screens != null && screens.length >= 2`.

*Plan-level micro-decision (spec left it open):* `external: true` adds `rel="noopener noreferrer"`, adds **no** `target`, and excludes the item from active-derivation. It never changes the element type — every tab is a plain `<a>`.

---

## 3. Build order — step by step

### Step 1 — `src/core.ts` (additive only; no signature changes to existing exports)

Append after line 132 (i.e. after `upgradeHref`, so `withSource`/`PORTAL_ORIGIN` are initialised first — **module init order matters for `ALL_PRODUCTS_HREF`**):

```ts
export interface ShellScreen {
  label: string;
  href: string;
  active?: boolean;
  external?: boolean;
}

/** Portal home, tagged as a sidebar referral. Value: "https://app.revheat.com/?source=sidebar". */
export const ALL_PRODUCTS_HREF: string;

export function resolveActiveScreen(screens: ShellScreen[], activePath: string): ShellScreen[];

export function productTitle(code: string | undefined, catalog: ProductDef[]): string | undefined;
```

`resolveActiveScreen` algorithm (exact):
1. `const hasExplicit = screens.some((s) => s.active !== undefined)`.
2. If `hasExplicit`: return `screens.map((s) => ({ ...s, active: s.active === true }))`. **Explicit wins, and it wins for the whole array** — a single explicit item disables derivation entirely.
3. Else, normalise: `const path = activePath.split("?")[0]!.split("#")[0]!`.
4. For each item, `pathOf(href)`: `try { return new URL(href, "https://rh.invalid").pathname } catch { return href }`.
5. Candidate = item with `external !== true` whose `p = pathOf(item.href)` satisfies `path === p || path.startsWith(p.endsWith("/") ? p : p + "/")`.
6. Winner = candidate with the greatest `p.length`; ties break to the earliest array index.
7. Return `screens.map((s) => ({ ...s, active: s === winner }))`; if there is no winner every item gets `active: false`.
8. Never mutates the input array or its items.

`productTitle`: `catalog.find((p) => p.code === code)?.title` — returns `undefined` for `code === undefined`, `""`, or any unknown code. **Never fabricates.** Takes `catalog` explicitly so `core.ts` keeps its type-only import of `catalog.js` (`src/core.ts:1`) and gains no runtime dependency.

### Step 2 — `src/styles.css`

a. **Box-sizing reset** (`src/styles.css:20-37`): add `.rh-menu, .rh-menu *, .rh-menu *::before, .rh-menu *::after,` to the selector list.

b. **Banner** — remove `margin-right: auto` from `.rh-banner__brand` (`:336-341`) and add:
```css
.rh-banner__lead {
  display: flex;
  align-items: center;
  gap: var(--rh-space-3, 0.75rem);
  min-width: 0;
  margin-right: auto;
}
.rh-banner__portal {
  flex: 0 0 auto;
  font-size: var(--rh-text-sm, 0.875rem);
  font-weight: var(--rh-weight-medium, 500);
  color: var(--rh-text-secondary, #505057);
  text-decoration: none;
  white-space: nowrap;
}
.rh-banner__portal:hover { color: var(--rh-primary, #6143f9); text-decoration: underline; }
.rh-banner__product {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--rh-text-sm, 0.875rem);
  font-weight: var(--rh-weight-semibold, 600);
  color: var(--rh-ink, #19191e);
}
.rh-banner__actions { display: flex; align-items: center; gap: var(--rh-space-2, 0.5rem); flex: 0 0 auto; }
```

c. **All-products row.** Move `margin-top: auto` off `.rh-rail__account` (`:200-207` → `margin-top: 0`) onto `.rh-row--all`; `.rh-row--all` always renders and always precedes the account block, so exactly one auto margin survives and the pair stays pinned to the bottom. Then add, after the account-menu block:
```css
/* Trailing rail row → portal home. `.rh-row` is the generic row layout the
   product rows will move onto later; `.rh-row--all` is the only user today. */
.rh-row {
  display: flex;
  align-items: center;
  gap: var(--rh-space-3, 0.75rem);
  min-height: var(--rh-row-comfortable, 3rem);
  padding: var(--rh-space-2, 0.5rem) var(--rh-space-3, 0.75rem);
  border-radius: var(--rh-radius-md, 12px);
  text-decoration: none;
  font-size: var(--rh-text-sm, 0.875rem);
  line-height: var(--rh-leading-sm, 1.25rem);
  font-weight: var(--rh-weight-medium, 500);
  color: var(--rh-ink, #19191e);
  transition: background-color var(--rh-duration-fast, 120ms) var(--rh-ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}
.rh-row--all {
  margin-top: auto;
  border-top: 1px solid var(--rh-border, #e4e5ea);
  border-radius: 0;
  padding-top: var(--rh-space-3, 0.75rem);
  color: var(--rh-text-secondary, #505057);
}
a.rh-row--all:hover { color: var(--rh-primary, #6143f9); text-decoration: underline; }
```

d. **Screen menu** — add after the banner block:
```css
/* Screen menu — 48px tall, scrolls sideways below the breakpoint rather than
   wrapping, so a product with many screens never grows a second row. */
.rh-menu {
  display: flex;
  align-items: center;
  gap: var(--rh-space-1, 0.25rem);
  flex: 0 0 auto;
  height: 3rem;
  padding: 0 var(--rh-space-4, 1rem);
  border-bottom: 1px solid var(--rh-border, #e4e5ea);
  background: var(--rh-surface, #ffffff);
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  scrollbar-width: none;
}
.rh-menu::-webkit-scrollbar { display: none; }
.rh-menu__tab {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: var(--rh-space-8, 2rem);
  padding: 0 var(--rh-space-3, 0.75rem);
  border-radius: var(--rh-radius-sm, 8px);
  /* 13px per the spec; there is no --rh-text-* step at 13px, so no var here. */
  font-size: 0.8125rem;
  line-height: var(--rh-leading-sm, 1.25rem);
  font-weight: var(--rh-weight-medium, 500);
  color: var(--rh-text-secondary, #505057);
  text-decoration: none;
  transition: background-color var(--rh-duration-fast, 120ms) var(--rh-ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}
.rh-menu__tab:hover { background: var(--rh-n-100, #eff0f4); }
.rh-menu__tab[aria-current="page"] {
  background: var(--rh-primary-subtle, #edefff);
  color: var(--rh-primary, #6143f9);
  font-weight: var(--rh-weight-semibold, 600);
}
```

e. **Print** — append at the very end of the file:
```css
/* Print: chrome is navigation; only the page content is worth ink. The grid
   collapses too, or the hidden rail leaves a 260px blank gutter. */
@media print {
  .rh-rail,
  .rh-banner,
  .rh-menu,
  .rh-footer { display: none; }
  .rh-shell { grid-template-columns: 1fr; }
}
```

### Step 3 — `src/react.tsx` (precise diff)

**Delete**
- `UpsellRow` (lines **310-353**) in full.
- The `<nav aria-label="Available">` block (lines **788-797**) in full.
- `upgradeHref` from the `./core.js` import list (line **8**) — it becomes unreferenced.

**Add to the import from `./core.js`** (lines 5-13): `ALL_PRODUCTS_HREF`, `productTitle`, `resolveActiveScreen`, `type ShellScreen`.

**`AppShellProps`** (lines 55-95) — add two members, everything else byte-identical:
```ts
  /** Horizontal in-product screen menu. Rendered only when 2+ items. */
  screens?: ShellScreen[];
  /** App-supplied controls, rendered in the banner between the title and Admin. */
  headerActions?: React.ReactNode;
```
Destructure both in the `AppShell` signature (line 714-727).

**`railBody`** (lines 766-810) — between the `entitled` nav and `<div className="rh-rail__account">`, insert:
```tsx
<a className="rh-row rh-row--all" href={ALL_PRODUCTS_HREF}>
  All products →
</a>
```

**Banner** (lines 841-863) — restructure per §2.3: wrap the hamburger, the new `← Portal` link, the brand link and the new product-title span in `<div className="rh-banner__lead">`; then `{headerActions == null ? null : <div className="rh-banner__actions">{headerActions}</div>}`; then the existing Admin link unchanged.

Compute once, before `return`, alongside `isStaff` (line 746):
```ts
const title = productTitle(currentProductCode, PRODUCT_CATALOG);
const menuItems = screens && screens.length >= 2 ? resolveActiveScreen(screens, activePath) : null;
```

**Screen menu** — insert between `</header>` and `{children}` (line 863/864):
```tsx
{menuItems && (
  <nav className="rh-menu" aria-label="Screens">
    {menuItems.map((s) => (
      <a key={s.href} className="rh-menu__tab" href={s.href}
         aria-current={s.active ? "page" : undefined}
         rel={s.external ? "noopener noreferrer" : undefined}>
        {s.label}
      </a>
    ))}
  </nav>
)}
```

**Leave untouched:** `useIsNarrow` (121-132), `useDrawer` (155-189), `AccountMenu` (387-557), `Drawer` (563-708), the `buildRailModel` call (748-764) including the `isPrimaryBuyer ?? viewerRole === undefined` fallback (758). Add one comment at 758 recording that `canBuy` now feeds no rendered element in v2 (see Risk R3).

### Step 4 — `src/vue.ts` (NEW)

```ts
import {
  defineComponent, h, ref, computed, watch, onMounted, onBeforeUnmount,
  nextTick, getCurrentInstance, Teleport, Fragment,
  type PropType, type VNode,
} from "vue";
```
Plus the same `./catalog.js`, `./core.js`, `./icons.js` imports as `react.tsx`.

**Exports**
```ts
export type { AppShellIdentity } from "./react-types"; // NO — see below
export interface AppShellIdentity { email: string | null; isInternal: boolean; isStaff?: boolean; roleLabel: string | null }
export const AppShell: DefineComponent<…>;
export default AppShell;
```
> `AppShellIdentity` is **re-declared** in `src/vue.ts`, not imported from `src/react.tsx`: importing it would drag `"use client"` and the React import graph into `dist/vue.js`. Keep the two declarations byte-identical and cross-reference them in comments (`src/react.tsx:28-45`).

**Props** (runtime declarations; one-for-one with `AppShellProps`):
| prop | declaration |
|---|---|
| `identity` | `{ type: Object as PropType<AppShellIdentity>, required: true }` |
| `products` | `{ type: Array as PropType<MeProduct[]>, required: true }` |
| `viewerRole` | `{ type: String as PropType<"rep"\|"manager"\|"admin">, default: undefined }` |
| `isPrimaryBuyer` | `{ type: Boolean as PropType<boolean \| undefined>, default: undefined }` |
| `degraded` | `{ type: Boolean, default: false }` |
| `productCodesFallback` | `{ type: Array as PropType<string[]>, default: () => [] }` |
| `activePath` | `{ type: String, required: true }` |
| `currentProductCode` | `{ type: String, default: undefined }` |
| `adminHref` | `{ type: String, default: undefined }` |
| `screens` | `{ type: Array as PropType<ShellScreen[]>, default: undefined }` |

> **`default: undefined` on `isPrimaryBuyer` is load-bearing.** Vue casts an absent Boolean prop to `false` unless the options object *has* a `default` key; without it the React fallback `isPrimaryBuyer ?? viewerRole === undefined` (`src/react.tsx:758`) can never see `undefined`, and the two renderers diverge on `canBuy`.

**Emits:** `emits: ["sign-out"]`.
**Slots:** `default`, `header-actions`, `account-menu`.

**Whether a `sign-out` listener exists** (React's `onSignOut ? <button> : <a href=logout>` at `src/react.tsx:508-527`): declared emits are stripped from `attrs`, so capture the instance in `setup()` and read it at render time:
```ts
const instance = getCurrentInstance();
const hasSignOut = () => Boolean(instance?.vnode.props?.["onSignOut"]);
```

**Internal (not exported) sub-components / helpers, each mirroring a React counterpart:**

| Vue construct | Mirrors | Notes |
|---|---|---|
| `FOCUSABLE_SELECTOR`, `focusablesIn()` | `react.tsx:105-119` | copy verbatim, including `:not([disabled]):not([hidden]):not([aria-hidden="true"])` |
| `NARROW_QUERY`, `DRAWER_EXIT_MS` | `react.tsx:19`, `:26` | same literals |
| `useIsNarrow` → `isNarrow = ref(false)` + `onMounted` matchMedia + `onBeforeUnmount` removeEventListener | `react.tsx:121-132` | **must not** read `matchMedia` during `setup()` — SSR parity, and the tests install the stub before mount |
| `phase = ref<"closed"\|"open"\|"closing">`, `openId = ref(0)`, `open/close/dismiss` | `useDrawer`, `react.tsx:155-189` | `open()` increments `openId` first, then sets `"open"` |
| `watch(phase, …)` starting one 300ms `setTimeout` on entry to `"closing"`, cleared on re-entry and in `onBeforeUnmount` | `react.tsx:174-178` | the timer belongs to the watcher **and to nobody else** — this is the v1.4 freeze bug (`PLAN-v1.4.0.md` round 1) |
| `watch(() => props.activePath, () => close())` | `react.tsx:735-737` | |
| `watch(isNarrow, (n) => { if (!n) dismiss(); })` | `react.tsx:742-744` | instant drop, no exit animation |
| `drawerId` from a module-scope counter (`rh-drawer-${++uid}`) | `React.useId()`, `react.tsx:730` | **not** `useId()` from Vue — that is 3.5+, and the peer floor is `>=3.4` |
| `RhAccountMenu` | `react.tsx:387-557` | `open` ref; `pointerdown` outside listener (`:415-422`); `signOutHref` set in `onMounted` (`:404-408`); `onKeydown` with Escape → `stopPropagation` + close + refocus trigger, Tab → `preventDefault` + `stopPropagation` + close + refocus, ArrowUp/Down/Home/End roving (`:431-465`); items `tabindex="-1"`, `role="menuitem"`; trigger `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` only when open |
| `RhDrawer` | `react.tsx:563-708` | see below |

**`RhDrawer`** — props `{ id: string; closing: boolean }`, emits `close`, default slot = rail body. Renders `h(Teleport, { to: "body" }, [ …tree… ])` (mirrors `createPortal`, `react.tsx:706-707`).
- `onMounted`: if `triggerEl === null` capture `document.activeElement`; `await nextTick()`; `focusablesIn(panel.value)[0]?.focus()` — mirrors `react.tsx:580-589`. The one-shot capture guard is the StrictMode fix; keep it, it is also correct under Vue's `<KeepAlive>`.
- `onMounted` scroll lock: save `document.body.style.overflow`, set `"hidden"`; release in the `closing` watcher **and** in `onBeforeUnmount` — mirrors `react.tsx:613-620`.
- `watch(() => props.closing, (closing) => { if (!closing) return; … })`: restore focus only if `!active || active === document.body || panel.contains(active)`; then `panel.setAttribute("inert", "")`; then release the scroll lock and remove the keydown listener — mirrors `react.tsx:595-620`.
- Document-level `keydown` added in `onMounted`, removed in the `closing` watcher and `onBeforeUnmount` — mirrors `react.tsx:630-670` **including** the `panelRef.querySelector('[role="menu"]')` + `menu.contains(e.target)` deference (the round-2 fix in `PLAN-v1.4.0.md`) and the `focusables.length === 0 → preventDefault` branch.
- `aria-modal`: `closing ? null : "true"` (Vue drops `null` attributes) — mirrors `react.tsx:682`.
- Root class: `"rh-drawer"` + `" rh-drawer--closing"` when closing.

**Root render**: build `railBody(): VNode[]` once and pass the *same function* to both the `<aside>` and the drawer's default slot, exactly as React reuses `railBody` (`react.tsx:766-810, 822, 836`). Key the drawer vnode with `openId.value` — mirrors `key={drawer.openId}` (`react.tsx:831`); reopening mid-exit must be a fresh mount or focus-in never re-runs.

No data fetching, no router import, no `useX` composables beyond plain reactivity primitives.

### Step 5 — `src/index.ts` — **unchanged.** Do not re-export `./vue` (it would pull `vue` into the barrel that React apps import).

---

## 4. Test plan

### 4.1 Existing tests to delete / rewrite (7 of 67)
- **Delete** `test/shell.spec.tsx:70-94` — `describe("viewer role drives canBuy")`, 4 tests. Every assertion is on `See plans →` / `ICP Builder`, both of which the v2 rail no longer draws.
- **Delete** `test/shell.spec.tsx:96-113` — `describe("viewer role drives canBuy — partial adoption")`, 2 tests, same reason.
- **Rewrite** `test/react.spec.tsx:26-33` — "lists an entitled product as a link and an upsell product separately" → **"lists owned products only, and never an unowned one"**: keep `getByRole("link", { name: /Website Readiness Audit/ })`, replace the `getByText(/ICP Builder/)` assertion with `expect(screen.queryByText(/ICP Builder/)).toBeNull()`.

Keep the `icp_builder` `available` row in the `products` fixture at `test/shell.spec.tsx:52-57` — it is now the *negative* fixture for test 1. **60 existing tests survive unchanged.**

### 4.2 The ten spec tests

`test/core.spec.ts` — new `describe`s (test 10):

| # | Assertion | Fixture |
|---|---|---|
| 10a | `resolveActiveScreen([{label:"Overview",href:"/app"},{label:"Reports",href:"/app/reports"}], "/app/reports/42")` → only `Reports` has `active: true` (longest prefix wins) | inline |
| 10b | `…, "/app"` → only `Overview` active | same |
| 10c | `"/appendix"` does **not** match `/app` (segment-boundary rule) → all `active: false` | same |
| 10d | explicit `active` wins: `[{…href:"/app/reports"},{…href:"/app",active:true}]` with `activePath:"/app/reports"` → the `/app` item is active | inline |
| 10e | `external: true` items are never derived active | `[{label:"Docs",href:"https://docs.revheat.com/x",external:true},{label:"Home",href:"/app"}]`, path `/app` |
| 10f | absolute hrefs are compared on `pathname` only | `href: "https://trends.revheat.com/app/reports"`, path `/app/reports` |
| 10g | `productTitle("trend_finder", PRODUCT_CATALOG) === "Trend Finder"`; `productTitle("no_such_code", …)` and `productTitle(undefined, …)` are `undefined` | `PRODUCT_CATALOG` |
| 10h | `ALL_PRODUCTS_HREF === "https://app.revheat.com/?source=sidebar"` | — |

`test/shell.spec.tsx` (React) and `test/vue.spec.ts` (Vue) — the **same eight**, same fixtures:

Shared fixture (copy into `test/vue.spec.ts`; already present at `test/shell.spec.tsx:36-60`):
```
products = [readiness_audit launch, trend_finder launch, icp_builder available]
hiddenProducts = products + { code:"quotafit", state:"launch", sidebarHidden:true, appUrl:"https://hire.revheat.com/app", … }
member = { email:"rep@acme.com", isInternal:false, roleLabel:"Rep" }
screens2 = [{label:"Overview",href:"/app"},{label:"Reports",href:"/app/reports"}]
```

| # | Assertion (identical text in both files) |
|---|---|
| 1 | With `hiddenProducts`: rail links name exactly `["RevHeat home","Website Readiness Audit","Trend Finder","All products →"]`; `queryByRole("navigation",{name:"Available"})` is null; `document.querySelectorAll(".rh-rail__item--upsell")` is empty; `queryByText(/QuotaFit/)` and `queryByText(/ICP Builder/)` are null |
| 2 | `const rail = document.querySelector("aside.rh-rail")!`; `const links = [...rail.querySelectorAll("a")]`; the element with class `rh-row--all` is `links[links.length-1]` *(the account trigger is a `<button>`, so the All-products anchor is genuinely the last `<a>` in the rail)*; its `href` is `https://app.revheat.com/?source=sidebar`; its `textContent` is `All products →` |
| 3 | `currentProductCode:"trend_finder"` → the one link with `aria-current="page"` is `Trend Finder`, **and** `document.querySelector(".rh-banner__product")!.textContent === "Trend Finder"` |
| 4 | `currentProductCode:"not_a_product"` → `document.querySelector(".rh-banner__product")` is `null`; no link carries `aria-current` |
| 5 | `screens: screens2`, `activePath:"/app/reports"` → `.rh-menu` exists with `aria-label="Screens"`; its two tabs are `Overview`, `Reports`; only `Reports` has `aria-current="page"`. Second case: `screens: [{...screens2[0], active:true}, screens2[1]]`, same path → only `Overview` is current |
| 6 | `screens: []` → `.rh-menu` is null. `screens: [screens2[0]]` → `.rh-menu` is null. `screens` omitted → `.rh-menu` is null |
| 7 | React: `headerActions: <button type="button">Export</button>`. Vue: `slots: { "header-actions": () => h("button",{type:"button"},"Export") }`. Both: the button is inside `.rh-banner` and inside `.rh-banner__actions`; with the prop/slot omitted, `.rh-banner__actions` is null |
| 8 | `degraded: true`, `products: []`, `productCodesFallback: ["all_access","quotafit"]` → rail lists `QuotaFit` and **not** `All-Access` (bundle); All-products row still present |
| 9 | Drawer, at `setViewport(true)`: opens on `Open product menu` → `role="dialog"` named `RevHeat products`, `aria-modal="true"`, focus on `Close product menu`; `document.body.style.overflow === "hidden"`; Escape from `document` closes (`aria-expanded === "false"`) and unlocks; Tab from the last focusable wraps to the close button; Shift+Tab from the close button wraps to the last. *(React: these already exist at `test/shell.spec.tsx:282-551` — leave them. Vue: port these five.)* |

### 4.3 Vue mounting recipe (`test/vue.spec.ts`)

```ts
import { mount } from "@vue/test-utils";
import { screen, within } from "@testing-library/dom";
import { h } from "vue";
import { AppShell } from "../src/vue";
```
- **Copy the matchMedia helper verbatim from `test/shell.spec.tsx:12-31`** — the `listeners` array, the `narrow` flag, `setViewport()`, and the `beforeEach` that installs the stub. Vue reads `matchMedia` in `onMounted`, so the stub must be installed before `mount()`; the `beforeEach` ordering already guarantees this.
- Mount helper:
  ```ts
  let wrapper: VueWrapper | null = null;
  function mountShell(props = {}, slots = {}) {
    wrapper = mount(AppShell, {
      attachTo: document.body,               // required: Teleport target + .focus() only works in-document
      props: { identity: member, products, activePath: "/app", ...props },
      slots: { default: () => h("main", "content"), ...slots },
    });
    return wrapper;
  }
  afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = ""; });
  ```
  `wrapper.unmount()` is **mandatory** — VTU has no auto-cleanup, and the Teleported drawer plus the document keydown listener leak into the next test otherwise.
- Query the drawer via `screen.getByRole(...)` / `document.querySelector(...)`, **never** `wrapper.find(...)`: Teleport output lives outside `wrapper.element`.
- Async: after `wrapper.find("button.rh-banner__menu").trigger("click")`, `trigger` returns `nextTick()` — `await` it. For the mount-time focus move, `await nextTick()` once more (the drawer focuses in `onMounted` after its own `nextTick`).
- Fake timers for the exit window: `vi.useFakeTimers()` + `vi.advanceTimersByTime(2000)` + `await nextTick()`, mirroring `test/shell.spec.tsx:475-550`.

### 4.4 Expected suite size
`60 surviving + 8 core (10a-10h) + 8 new React (tests 1-8) + 13 Vue (tests 1-8 plus 5 drawer cases) ≈ 89`. Exact count is whatever the implementer writes; the gate is **zero failures**.

---

## 5. README additions (outline)

Insert into `README.md`:
1. **Exports** list — add `@revheat/ui/vue` between `/react` and `/styles.css`: "Vue 3 `AppShell`, written as `defineComponent` + `h()` (no SFC, no template compiler needed). Same DOM, same classes, same `styles.css` as the React shell. Requires `vue >= 3.4` — an optional peer."
2. **New section "The v2 navigation model"** — the rail switches *product*, the menu switches *screen*; the rail shows owned + org-enabled products only (`state === "launch"`, not `sidebarHidden`); buy / coming-soon rows live on the portal home and are reached through the trailing **All products →** row.
3. **New section "`screens`"** — the `ShellScreen` shape, the 2-item minimum, the longest-prefix derivation and that explicit `active` wins, and `external`.
4. **New section "`headerActions` / `#header-actions`"** — one line plus a React and a Vue snippet.
5. **New section "Vue usage"** — `import { AppShell } from "@revheat/ui/vue"`, `@sign-out`, the three slots, and the note that the shell fetches nothing (the app passes `/api/me/products` in).
6. **Breaking-change note for v2.0.0** — upsell/coming-soon rows and the "Available" nav are gone from the rendered rail; `buildRailModel().upsell` and `.canBuy` still exist and are unchanged.
7. **Scripts** — no change.

---

## 6. Verification, in order

```
cd /Users/kenlundin/Projects/revheat-ui/.worktrees/feat/shell-v2-nav-model
npm install --save-dev vue@^3.5.42 @vue/test-utils@^2.5.0 @testing-library/dom@^10.4.1
npm ci                                  # prove the lock is coherent
npx vitest run test/core.spec.ts        # step 1
npx vitest run test/react.spec.tsx test/shell.spec.tsx   # step 3
npx vitest run test/vue.spec.ts         # step 4
npm test                                # whole suite
npm run compile                         # emits dist/vue.{js,js.map,d.ts,d.ts.map}
git add dist package.json package-lock.json && git commit -m "…"   # BEFORE verify
npm run verify                          # compile + test + check:client + check:dist
```

**Definition of done**
- 60 surviving existing tests unchanged and green; the 7 obsolete ones deleted/rewritten as specified.
- New React tests 1-8 green; new core tests 10a-10h green; Vue tests 1-9 green.
- `npm run check:client` green (`dist/react.js` line 1 is still `"use client";`).
- `npm run check:dist` green (dist committed, working tree clean under `dist/`).
- `package.json` at `2.0.0` with the `./vue` export, the `vue` optional peer, and the three new devDeps; `package-lock.json` committed.
- README sections 1-6 above present.

---

## 7. Risks and gotchas found in the code

**R1 — `vue` + `@types/react` global `JSX` collision.** `@vue/runtime-dom` has shipped its `JSX` global behind an opt-in (`vue/jsx-runtime`) since 3.4, so the single build tsconfig should be fine — but it is the one thing that could make `npm run compile` fail the moment `vue` lands in `node_modules`. **Verify this first**, before writing `src/vue.ts`: `npm i -D vue@^3.5.42 && npm run compile` must stay green with zero source changes. Fallback in §1.2.

**R2 — The banner has no left/right grouping today.** `.rh-banner__brand { margin-right: auto }` (`src/styles.css:336-341`) is the *only* thing pushing Admin right, and it stops working the moment the product title becomes a fourth flat child. Two elements with `margin-right: auto` split the free space and open a gap mid-banner. The `.rh-banner__lead` wrapper in §2.3 is the fix; do not skip it and do not try to solve it with `:nth-last-child`.

**R3 — `canBuy` becomes unobservable.** `buildRailModel` still returns it and the `isPrimaryBuyer ?? viewerRole === undefined` fallback at `src/react.tsx:758` still runs, but nothing renders from it once `UpsellRow` is gone — so the six deleted DOM tests were its only coverage. `test/core.spec.ts` covers `canBuy` at the model level; add a comment at `react.tsx:758` saying the derivation is retained for API stability and is exercised in `core.spec.ts`, not in the DOM.

**R4 — Two links now share one href.** The banner `← Portal` link and the rail `All products →` row both point at `https://app.revheat.com/?source=sidebar`. Any test that queries by href alone will match both. Scope every such query to `.rh-banner` or `aside.rh-rail` (test 2 above does).

**R5 — `test/shell.spec.tsx:127-131` `currentLinks()` filters *every* link with `aria-current="page"`.** Screen-menu tabs carry that attribute. The existing tests never pass `screens`, so they stay correct — but any new test that combines `screens` with `currentLinks()` will get a false failure. Use a rail-scoped query for product rows in the new tests.

**R6 — Teleport under happy-dom.** `@vue/test-utils` needs `attachTo: document.body` for two independent reasons: Teleport needs a real `to: "body"` target, and happy-dom only honours `.focus()` / reports `document.activeElement` for in-document elements. Without it the drawer tests fail in ways that look like focus-trap bugs. VTU also does **not** auto-clean up — `wrapper.unmount()` in `afterEach` is required or the document keydown listener and the body scroll lock survive into the next test.

**R7 — Vue Boolean prop casting.** `isPrimaryBuyer: { type: Boolean }` turns "absent" into `false`, silently diverging from React's tri-state. `default: undefined` (the key must be *present*) is the fix. Same trap does **not** apply to `degraded`, where `false` is the intended default.

**R8 — `ALL_PRODUCTS_HREF` module init order.** `withSource` (`core.ts:105`) and `PORTAL_ORIGIN` (`core.ts:121`) must both be initialised before the const evaluates. Declare `ALL_PRODUCTS_HREF` at the **end** of `core.ts`; a top-of-file declaration produces `"undefined/?source=sidebar"` with no error.

**R9 — `sideEffects: ["*.css"]`.** Leave it. Adding `dist/vue.js` to that array would make bundlers keep the Vue shell in every React consumer's bundle; `src/vue.ts` must therefore do no import-time DOM work (the module-scope `uid` counter is fine, a module-scope `matchMedia` call is not).

**R10 — `check:dist` reports staged files as dirty.** This bit v1.4.0 already (`PLAN-v1.4.0.md`, "Steps, corrected"). Commit `dist/` **before** running `npm run verify`, not after.

**R11 — The two React drawer sub-systems are order-sensitive.** When porting to Vue, the sequence inside the `closing` transition is: restore focus → set `inert` → release the scroll lock → remove the keydown listener (`react.tsx:595-620`). `inert` blurs whatever is focused inside the panel, so setting it before the focus restore silently loses focus to `<body>`.
