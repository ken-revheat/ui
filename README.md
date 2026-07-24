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
- `@revheat/ui/core` — headless sidebar core (later task).
- `@revheat/ui/react` — React `<AppShell>` (later task).

## Scripts

- `npm run compile` — type-checks and emits `dist/` via
  `tsconfig.build.json`, then copies `src/styles.css` to `dist/styles.css`.
- `npm test` — runs the Vitest suite.

No script here is named `build`, `prepare`, `prepack`, or `install`. `pacote`
(npm's git-dependency installer) treats those as a trigger to run `npm
install` inside the cloned git-dep, which pulls this package's devDependencies
and crashes arborist for consumers. The compile step is deliberately named
`compile` instead.
