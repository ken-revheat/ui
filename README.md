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

## `onNavigate` / `@navigate` (v2.1.0, widened in v2.2.0)

Every link the shell renders is a plain `<a href>` — the shell never imports
a router. A single-page app that wants those clicks to stay in-app passes a
navigation hook:

```tsx
// React
<AppShell screens={screens} onNavigate={(href) => router.push(href)} … />
```

```ts
// Vue (h() render)
h(AppShell, { screens, onNavigate: (href) => router.push(href), … })
// or in a template:  <AppShell :screens="screens" @navigate="(href) => router.push(href)" />
```

With the hook present, a plain left-click on a same-origin, non-`external`
link is `preventDefault`-ed and the hook is called. The browser keeps
every click that should open elsewhere: ⌘/ctrl/shift/alt-modified clicks,
non-primary buttons, `external: true` tabs, and any href on another origin
(a portal URL that forgot `external: true` still leaves the app instead of
hitting the router's 404). Without the hook nothing changes — everything is
a plain link, exactly as in v2.0.0.

**v2.1.0 applied this to the screen tabs only. v2.2.0 applies it to every
link the shell renders**: the rail's product rows, "All products →", the R
mark, the banner's "← Portal" and wordmark, and the account-menu items.
The origin check is what makes one rule right everywhere — those hrefs all
point at `https://app.revheat.com`, so they route in-app **inside the
portal** and remain real cross-origin links in every product app, with no
per-app configuration. "Sign out" is deliberately excluded: it must reach
the server.

One behaviour follows from that: **an in-app route now closes the account
pop-up.** Through v2.1.0 nothing had to — every item was a full page load,
which took the menu with it. A ⌘-click still leaves the menu open, because
it opens a new tab and does not navigate the page the user is looking at.

### What the hook receives: a PATH, not the anchor's href

The hook is handed **path + query + hash**, with the origin stripped — not
the href the anchor carries. Clicking the Training Vault row inside the
portal calls `onNavigate("/vault?source=sidebar")` while the rendered
`href` stays `https://app.revheat.com/vault?source=sidebar`.

That split is deliberate, and both halves matter:

- The **anchor** keeps the absolute URL so ⌘-click, middle-click and "copy
  link address" still work, and so the same markup is a real cross-origin
  link in every product app.
- The **hook** gets the in-app form because no router accepts the other one.
  `router.push("https://app.revheat.com/vault")` in vue-router 4 is not a
  navigation: it resolves the whole string as a path, lands on
  `/https:/app.revheat.com/vault` and warns `No match found`. Normalising in
  the shell keeps the one-liner above correct in all four routers instead of
  making every consumer write the same `new URL(...)` dance.

The query is kept on purpose — `?source=sidebar` is how the portal's upgrade
page attributes a sidebar click.

Screen tabs are the only links v2.1.0 intercepted, and every one shipped by
the eight consumers today is a **root-relative path** (`/vault/reports`).
Those pass through `inAppHref` unchanged, so those consumers see no behaviour
change here.

Three other shapes are normalised rather than passed through, and each is a
change if you rely on the old text reaching your router:

- an **absolute same-origin** href loses its origin
  (`https://app.revheat.com/vault` → `/vault`);
- a **document-relative** one is resolved against the page's base URL — the
  document's `<base href>` if you ship one, otherwise the current URL. It is
  resolved the way the browser would, so mind the trailing slash: `reports` on
  `/vault/` → `/vault/reports`, but `reports` on `/vault` → `/reports`;
- a **hash-only** one gains the current path **and the current query string**
  (`#section` on `/vault` → `/vault#section`; on `/vault?filter=open` →
  `/vault?filter=open#section`).

All three land where the anchor would have, and the rendered `href` still
carries exactly the text you wrote — but none is what the hook received in
v2.1.0. The hash-only case is the one most likely to surprise: a router that
treats `#section` and `/vault#section` as different routes will see the
second, and the query string survives rather than being reset. Pinned by tests
6e, 6f and 6g in `test/shell.spec.tsx`.

React: `onNavigate` is a function prop, so whatever renders `<AppShell>` with
it must itself be a Client Component (`"use client"`). Both existing React
consumers mount the shell from an async Server Component — add a thin client
wrapper rather than passing the function from there.

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

## The rail is pinned to the viewport (fixed in v2.2.0)

`.rh-rail` is `position: sticky; top: 0` with a viewport height, so on a long
page the product list, "All products →" and the account block stay on screen
instead of scrolling away. Through v2.1.0 the rail had no `position` at all
and scrolled off with the content — the whole reason a product app's shell
felt worse than the portal's own sidebar.

Two things a consumer can break from the outside:

- **`overflow` on an ancestor.** Any `overflow` other than `visible` on
  `html`, `body`, or any wrapper around `.rh-shell` turns that element into
  the sticky element's scroll container and the rail silently stops sticking
  — no error, no warning. Check for it when you bump this package.
- **Wrapping `.rh-shell` in something that is not full height.** The rail's
  height is `100dvh` (with a `100vh` fallback), so it does not depend on the
  document's height, but it does need to remain a grid item of `.rh-shell`.

The rule excludes the drawer panel (`.rh-rail--drawer`), which is
`position: fixed` and must stay that way.

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
