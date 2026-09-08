# @revheat/ui

Shared RevHeat portal UI: catalog, headless sidebar core, React AppShell.

Consumers install this as a git dependency, pinned to a tag (e.g.
`github:ken-revheat/ui#v1.0.0`) — never a moving branch. `dist/` is committed
to the repo (not gitignored) so consumers never need to build this package;
after editing `src/`, run `npm run compile` and commit the updated `dist/`.

## Package is private

This is a private GitHub repo. Every consumer needs read auth to `npm ci`
against it (a GitHub token with `repo` scope, or SSH deploy key, configured
in that consumer's environment).

## Exports

- `@revheat/ui/catalog` — the canonical product catalog (`PRODUCT_CATALOG`,
  `findProductByCode`, `findProductBySlug`) shared by every portal app's
  product list / sidebar.
- `@revheat/ui/core` — headless sidebar core (`buildRailModel` and friends).
- `@revheat/ui/icons` — product glyph path data (`PRODUCT_ICON_PATHS`,
  `iconPathsFor`). Framework-neutral inline-SVG `d` strings so the Vue portals
  render the SAME glyphs as the React shell. Draw them at `currentColor` with
  `fill-rule="evenodd"` (the ring glyphs are outlines, not solids).
- `@revheat/ui/react` — React `<AppShell>`.
- `@revheat/ui/vue` — Vue 3 `AppShell`, written as `defineComponent` + `h()`
  (no SFC, no template compiler needed). Same DOM, same classes, same
  `styles.css` as the React shell. Requires `vue >= 3.4` — an optional peer.

## The v2 navigation model

The rail switches **product**; the screen menu switches **screen** within a
product. The rail only ever shows products the viewer is entitled to and the
org has not hidden (`state === "launch"`, not `sidebarHidden`) — there is no
"Available"/buy section in the rail itself. Buy and coming-soon products live
on the portal home, reached from the rail's trailing **All products →** row.

`buildRailModel().upsell` and `.canBuy` are still computed (for API
stability and for anything that reads the model directly) but neither
`AppShell` renders anything from them.

## `screens`

`screens` is the shell's horizontal in-product screen menu (`.rh-menu`),
rendered only when 2 or more items are passed:

```ts
interface ShellScreen {
  label: string;
  href: string;
  active?: boolean;   // omit and let the shell derive it
  external?: boolean; // never a derivation candidate
}
```

Each item's `active` is filled in by `resolveActiveScreen`:

- **If any item in the array sets `active` explicitly, that wins for the
  whole array** — each item's `active` becomes exactly its own
  `active === true` (every other item is `false`), and nothing is derived.
- **Otherwise**, the item whose `href` is the longest prefix of `activePath`
  (matched at a `/` boundary, so `/app` matches `/app/reports` but not
  `/appendix`) is marked active. `external: true` items are never
  candidates for this derivation.

## `headerActions` / `#header-actions`

App-supplied controls, rendered in the banner between the product title and
the Admin link.

React:

```tsx
<AppShell headerActions={<button onClick={onExport}>Export</button>} …>
```

Vue:

```html
<AppShell …>
  <template #header-actions>
    <button @click="onExport">Export</button>
  </template>
</AppShell>
```

## Vue usage

```ts
import { AppShell } from "@revheat/ui/vue";
```

```html
<AppShell
  :identity="identity"
  :products="products"
  active-path="/app"
  @sign-out="onSignOut"
>
  <template #header-actions>…</template>
  <template #account-menu>…</template>
  <router-view />
</AppShell>
```

- `@sign-out` mirrors React's `onSignOut` — omit it and the shell links to
  the portal's logout instead.
- Three slots: the default slot (the app's own content), `#header-actions`,
  and `#account-menu` (replaces the built-in account block entirely).
- The shell fetches nothing itself. The app is responsible for calling
  `GET /api/me/products` and passing the result in via `products` (and
  `viewerRole`/`isPrimaryBuyer`, `degraded`, `productCodesFallback` as
  needed).

## Breaking change in v2.0.0

The upsell/"Available" section and its buy / coming-soon rows are gone from
the rendered rail in both `AppShell`s — see "The v2 navigation model" above.
`buildRailModel().upsell` and `.canBuy` are unchanged and still exported from
`@revheat/ui/core` for consumers that read the model directly.

## Scripts

- `npm run compile` — type-checks and emits `dist/` via
  `tsconfig.build.json`, then copies `src/styles.css` to `dist/styles.css`.
- `npm test` — runs the Vitest suite.

No script here is named `build`, `prepare`, `prepack`, or `install`. `pacote`
(npm's git-dependency installer) treats those as a trigger to run `npm
install` inside the cloned git-dep, which pulls this package's devDependencies
and crashes arborist for consumers. The compile step is deliberately named
`compile` instead.
