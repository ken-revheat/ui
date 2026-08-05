# @revheat/ui v1.4.0 — mobile drawer, account menu, active row, real viewer role

Branch `shell-drawer-account`, worktree `.worktrees/shell-drawer-account`, base origin/main 7e3bc14.
Ken's locked scope (2026-08-05): drawer = "slide-out menu, same as the portal";
account menu = "match the portal". NOT building a Vue adapter — CA and the portal
keep their own sidebars.

## Reference (canonical portal, read-only)
`~/Projects/lead accelerator/RevHeat-lead-accelerator/apps/portal/`
- `components/RhSidebar.vue` — drawer mode owner, scrim, focus trap, 900px matchMedia
- `components/RhSidebarRail.vue` — rail contents, account chip + menu, sign-out
- `layouts/default.vue` — hamburger, header composition
- Design spec: `~/Projects/revheat-design-system/docs/2026-07-10-shell-v2-universal-ux-spec.md` §2.3, §4.3

## Facts pinned from research (do not re-derive)
- Breakpoint is **900px**, a raw px media query, NOT a Tailwind screen. Already
  used at `src/styles.css:311`.
- Drawer: 288px wide, slides from left, `role="dialog" aria-modal="true"`,
  `aria-label="RevHeat products"`. Scrim `color-mix(in oklab, var(--rh-ink) 40%, transparent)`.
  z: overlay 1200, modal 1300, popover 1400.
- Motion: transform-only slide, `--rh-duration-slow: 300ms`,
  `--rh-ease-out: cubic-bezier(0.16,1,0.3,1)` in, `--rh-ease-in: cubic-bezier(0.55,0,1,0.45)` out.
- Hamburger accessible name is exactly **"Open product menu"**; close button
  **"Close product menu"**.
- Account menu items, in order: Account settings → `/account`; Team & Access →
  `/account` (SAME destination, deliberate per RhSidebarRail.vue:224-230);
  Manage products → `/`; Admin → `/admin/orgs` (staff only); Sign out.
  From a React app these must be ABSOLUTE `https://app.revheat.com/...`.
- Admin gate in the portal is `session.isStaff` (from the `revheat_session_info`
  cookie), NOT `viewerRole`. The React shell's `identity.isInternal` is an
  org-ID allowlist — a DIFFERENT thing.
- `viewerRole` values: `rep | manager | admin`. `canBuy = viewerRole !== "rep" || isPrimaryBuyer`.
  `isViewerAdmin = viewerRole === "admin"`. Role badge is null in degraded mode.
- Package has NO Tailwind and NO design-tokens dep. styles.css is plain CSS,
  every value `var(--rh-token, literal-fallback)`. Do NOT @import design-tokens.
- `styles.css:18-31` enumerates box-sizing reset selectors per block. A portaled
  `.rh-drawer` sits outside `.rh-rail`/`.rh-banner`/`.rh-footer` and MUST be added
  or it inherits the consumer app's box model.
- dist/ is committed; `npm run verify` = compile + test + check:dist.

## Decisions — MATCH vs IMPROVE (locked, do not re-litigate)

MATCH the portal:
- 900px breakpoint, 288px panel, scrim colour, motion tokens, aria labels.
- All five account-menu items including the two that share `/account`, and the
  Admin item even though the header already shows Admin on staff screens.
  (Ken chose "match the portal". Duplication is faithful, not a defect.)

IMPROVE on the portal (each is a KNOWN portal gap; call out in the PR):
1. **Body scroll-lock** while the drawer is open. Portal has none — the page
   scrolls behind the scrim on touch.
2. **Close the drawer on every navigation**, via an effect on the active route.
   Portal only closes on rows that emit `navigate`; its own "RevHeat home" link
   leaves the drawer open over the new page.
3. **Esc closes the innermost layer only.** Portal has two independent
   document-level handlers, so one Esc closes menu AND drawer together.
4. **Focus-trap selector filters `[disabled]` and `[hidden]`.** Portal's does not,
   so a disabled "Request access" button joins the tab cycle and `.focus()` no-ops.
5. **`aria-controls` + ids** on hamburger→drawer and account trigger→menu.
6. **Arrow-key / Home / End roving** inside `role="menu"`. Portal ships `role="menu"`
   with no arrow keys, which is an ARIA conformance gap.
7. **Active row via explicit `currentProductCode` prop.** Portal hardcodes
   `training_vault` + `/vault`, so NO React product app ever highlights anything.
   `isActiveProduct` gains an optional third arg; existing 2-arg behaviour preserved.
8. **Sign out defaults to `https://app.revheat.com/logout?next=<origin>`**, not the
   portal's local `POST /api/auth/logout` + cookie clear — a cross-origin React app
   cannot clear the portal cookie itself. Keep the `onSignOut` escape hatch.
   (This follows design spec §4.3; the portal's own implementation diverges from it.)
9. **Stop fabricating `viewerRole`/`isPrimaryBuyer`** (currently hardcoded at
   `src/react.tsx:146` → `canBuy` is unconditionally true in React apps, so a rep
   who is not the primary buyer is shown checkout links the portal would deny).
   Add optional props; keep the old values only as a documented fallback.
10. **Dynamic footer year.**

OUT OF SCOPE (do not build): the portal's 260px↔64px collapse control +
`localStorage["rh-sidebar-collapsed"]`; any Vue adapter.

## Steps
1. `src/core.ts` — `isActiveProduct(p, currentPath, currentProductCode?)`.
2. `src/react.tsx` — hamburger, drawer + scrim (portal), focus trap/restore,
   scroll lock, account popover w/ roving focus, real viewer role props,
   dynamic year, `currentProductCode`.
3. `src/styles.css` — new blocks + box-sizing reset entries + reduced-motion.
4. Tests in `test/` — focus trap, Esc layering, close-on-navigate, canBuy from
   real role, active row by code, menu item list + staff gating.
5. `npm run verify`, commit dist/, tag v1.4.0, review, PR.

## Steps, corrected
Step 5's order does not work as written. `check:dist` uses `git status --porcelain
-- dist`, which reports STAGED changes too, so dist must be COMMITTED before
`verify` can pass: compile → commit dist → verify → tag → review → PR.

## Status
- [x] Worktree created, research done, plan written
- [x] Implementation — core.ts, react.tsx, styles.css
- [x] Tests — test/shell.spec.tsx, 64 total, every assertion mutation-verified
      except the footer-year tripwire (cannot fail until 2027, noted in-file) and
      the StrictMode trigger-capture guard (see round 2)
- [x] Review round 1 — two adversarial reviewers, all findings fixed (below)
- [x] Review round 2 — two adversarial reviewers, all findings fixed (below)
- [ ] verify + dist committed + tag + PR

## Review round 1 — what changed

One BLOCKER, reproduced by the reviewer before it was reported:

**The drawer could freeze the page.** Two dismissals inside the 300ms exit
animation — Escape twice, or the scrim tap you repeat because the first appeared
to do nothing — cancelled the unmount timer while leaving the phase at
"closing". The panel then stayed mounted forever: body `overflow: hidden`, and
an invisible full-viewport scrim at z-index 1200 swallowing every click, with
the hamburger underneath it. No recovery without a reload. Root cause: the exit
timer was owned by two places. It now belongs to the effect alone, and
`useDrawer` carries a comment saying why.

The rest were one root-cause family — **the drawer's focus and keyboard
lifecycle was keyed to mount/unmount and to the panel element, when it needed to
be keyed to open/close and to the document**:
- Escape and the focus trap moved to document-level listeners. On the panel they
  only fired while focus was inside it, and a click on any non-interactive part
  of the panel blurs to `<body>` — after which Escape did nothing and Tab walked
  into the page behind the scrim. RhSidebar.vue documents the same trap.
- Focus is handed back when closing STARTS, and only if focus is still ours.
  Restoring on unmount meant a route change that focused the new page's heading
  got the focus yanked to the hamburger 300ms later.
- Scroll lock and `aria-modal` are likewise released at the start of the exit,
  not the end. Under `prefers-reduced-motion` the panel is gone in 1ms, so
  holding them for 300ms was the only thing the user would have noticed.
- `key={openId}` on the Drawer, so reopening mid-exit is a real remount. Without
  it the phase flipped back to "open" but nothing re-ran: visible panel, nothing
  focused, no scroll lock.

Also fixed:
- **`upgradeHref` was relative** — so "See plans →" resolved against
  icp.revheat.com and 404'd. The upgrade page exists only on the portal. Now
  absolute, like every other cross-surface link here. (Pre-existing, not
  introduced by this branch, but this is the release that touches `canBuy`.)
- `isPrimaryBuyer` defaults to false once `viewerRole` is supplied — a
  half-adopted consumer fails closed. It stays true only when neither prop is
  passed, so a bump alone cannot strip a consumer's links.
- The Admin menu item now needs an explicit `adminHref`, exactly like the header
  link. Defaulting it would have switched Admin on for every RevHeat-org member
  in every app that bumps the package.
- `aria-controls` only while the drawer exists; menu items get `tabIndex={-1}`
  and Tab leaves the menu deliberately (both ARIA menu-pattern conformance).
- `.rh-drawer--closing { pointer-events: none }`, an rgba fallback ahead of
  `color-mix`, and the dead `.rh-rail__account-id` / `.rh-rail__signout` rules
  deleted (confirmed zero references across all four consumers).
- `npm run check:client` asserts `dist/react.js` still opens with `"use client"`.
  That directive was decorative through v1.3.0 (AppShell used no hooks); from
  v1.4.0 losing it is a hard build failure in both Next.js consumers.
- Dropped the `rh-rail__item--active` class — nothing styled it. `aria-current`
  is the hook.

**Two features in this release are inert until adoption**, and the PR must say
so: close-on-navigate needs a real `activePath` (both consumers hardcode
`"/app"`), and the active row needs `currentProductCode` (neither passes it).
They land with task #3, not with this tag.

## Review round 2 — what changed

Round 2 reproduced the round-1 blocker as fixed and walked the state machine
exhaustively: no way left to strand the drawer mounted. Six new findings, all
applied, all but one mutation-verified.

- **The round-1 Escape fix had a hole.** "Does the account menu own this
  keypress?" was answered by asking whether a `role="menu"` node EXISTS in the
  panel, not whether the keypress is IN it. `accountMenu` is a public prop and
  headless menu libraries keep their menu mounted-and-hidden, so a consumer
  passing one would have killed Escape and the focus trap outright. Now
  `menu.contains(e.target)`.
- The exiting panel gets `inert`. `pointer-events: none` handled the mouse;
  Tab during the exit still walked into the drawer the user just dismissed.
- Widening the viewport (rotate to landscape) now **drops** the drawer rather
  than animating it out — otherwise two rails share the screen for 300ms with a
  scrim over a page that is no longer modal.
- The trigger element is captured once, so React StrictMode's double-invoked
  mount effect cannot overwrite it with the drawer's own first focusable. Dev
  only. **Not covered by a test** — the suite does not render under StrictMode,
  and adding it there would change the timing of every drawer test.
- `AppShellProps` now documents that there is **one AppShell per page**: it owns
  a document keydown listener and `document.body.style.overflow`, neither
  reference-counted.
- Two weak tests replaced. `expect(getByRole("dialog")).toBe(closing)` asserts
  node identity and passes for any no-op; and the "second close mid-exit" test
  was driving the freeze through a scrim click, which `pointer-events: none` has
  since made unreachable — it now uses Escape-then-navigate, the path a real app
  still takes.

## Implementation notes (decisions taken during the build)
- `@types/react-dom` added as a devDep — `./react` now imports `createPortal`
  so the drawer's fixed-position scrim cannot be trapped by an ancestor
  `transform` in a consumer app. react-dom stays an OPTIONAL peer: the Vue
  consumer imports only `./icons` + `./catalog` and never resolves it.
- The drawer is conditionally MOUNTED rather than CSS-hidden, so "closed" means
  "not in the tab order" with no `inert` polyfill. It lingers one
  `--rh-duration-slow` (`useDrawer`'s "closing" state) purely so the slide-out
  animation can play. Tests must not use "dialog still present" as a proxy for
  "still open" — assert `aria-expanded` (one weak test was caught this way).
- `isNarrow` starts false so SSR and the first client render agree; the existing
  `@media (max-width: 900px)` rule hides the rail before hydration, so no flash.
- `.rh-rail:not(.rh-rail--drawer)` in the media query — the drawer panel IS a
  `.rh-rail`, and the old blanket `display: none` would have hidden it.
- `.rh-banner` moved from `space-between` to `margin-right: auto` on the brand,
  which survives the hamburger becoming a third child.
