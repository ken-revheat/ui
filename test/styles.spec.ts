import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The stylesheet's own regression guard. Back-ported from v2.2.0 onto the
 * v1.5 maintenance line, minus the print assertions — v1.5 has no `@media
 * print` block (that arrived with the v2 nav model), so a print test here
 * would assert a rule that does not exist.
 *
 * `src/styles.css` is copied byte-for-byte to `dist/styles.css` by `npm run
 * compile`, and `check:dist` fails the build if that copy is stale — so
 * asserting against the source is asserting against what ships.
 *
 * These are computed-style assertions, not string matching: happy-dom runs
 * the real cascade, so a rule that is present but LOSES (to source order, to
 * a more specific selector, to a later `@media`) still fails here. That is
 * the whole point — the defect this file guards was not a missing file, it
 * was a `.rh-rail` block that simply never said `position`.
 *
 * ⚠️ TWO happy-dom facts this file is built around, both learned the hard way:
 *
 * 1. **Computed style is CACHED per element and the cache does NOT notice a
 *    viewport change.** Reading an element, calling `setViewport`, then
 *    reading the SAME element again returns the OLD values — silently, with
 *    no error. Every test below therefore sets the viewport FIRST and mounts
 *    fresh elements after, and `afterEach` tears the mounted tree down. Never
 *    hoist a `mount()` above a viewport change.
 * 2. **`height: 100dvh` is dropped, not honoured.** happy-dom does not know
 *    the `dvh` unit, so the second `height` declaration is discarded as
 *    invalid and the computed value is the `100vh` fallback line. That is the
 *    correct CSS fallback behaviour, but it means the cascade cannot prove
 *    the `dvh` line is present — the one source-text assertion below covers
 *    it, and it is labelled as such rather than pretending to be a render.
 */
const happyDOM = (window as unknown as { happyDOM: HappyDOMControl }).happyDOM;

interface HappyDOMControl {
  setViewport(size: { width: number; height: number }): void;
}

/** Wide enough for the rail, and NOT the default 768 — so a test that reads
 *  the hard-coded default instead of the live viewport fails loudly. */
const WIDE = { width: 1024, height: 900 };
/** Under the 900px breakpoint, where the rail hands over to the drawer. */
const NARROW = { width: 480, height: 800 };

describe("styles.css — the rail is pinned to the viewport", () => {
  let styleEl: HTMLStyleElement;
  let css: string;
  const mounted: HTMLElement[] = [];

  beforeAll(() => {
    css = readFileSync("src/styles.css", "utf8");
    styleEl = document.createElement("style");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  });
  afterAll(() => styleEl.remove());

  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove();
    happyDOM.setViewport(WIDE);
  });

  /** Mounts `.rh-shell > <aside class=…>` and returns both. Call AFTER the
   *  viewport for this test is in place — see the file docstring. */
  function mount(className: string): { shell: HTMLElement; el: HTMLElement } {
    const shell = document.createElement("div");
    shell.className = "rh-shell";
    const el = document.createElement("aside");
    el.className = className;
    shell.appendChild(el);
    document.body.appendChild(shell);
    mounted.push(shell);
    return { shell, el };
  }

  it("sticks the in-flow rail to the top of the viewport, full screen height", () => {
    happyDOM.setViewport(WIDE);
    const { el } = mount("rh-rail");
    const s = getComputedStyle(el);
    expect(s.position).toBe("sticky");
    expect(s.top).toBe("0px");
    // Belt and braces, not load-bearing: the definite `height` below already
    // makes the grid's default `stretch` behave as `start`. Asserted anyway
    // because deleting it should be a deliberate act, not a tidy-up.
    expect(s.alignSelf).toBe("start");
    // A DEFINITE height, not max-height: `.rh-rail__account`'s
    // `margin-top: auto` pins the account block to the rail's bottom edge,
    // and that edge has to be the bottom of the SCREEN.
    //
    // Read from the LIVE viewport rather than hard-coded: a hard-coded
    // "768px" passes for the wrong reason the moment anyone changes the
    // default viewport, and passes even if `100vh` were replaced by a fixed
    // pixel height that happened to match.
    expect(s.height).toBe(`${window.innerHeight}px`);
    // …which in turn means a long product list has to be able to scroll.
    expect(s.overflowY).toBe("auto");
    // Above the 900px breakpoint the rail is visible (the narrow rule hides
    // it and hands over to the drawer).
    expect(s.display).toBe("flex");
    // And the shell is still the two-column grid the sticky rail lives in.
    expect(getComputedStyle(mount("rh-rail").shell).gridTemplateColumns).toBe("260px 1fr");
  });

  it("overrides the height with 100dvh for collapsing-toolbar viewports", () => {
    // ⚠️ SOURCE TEXT, not a render — happy-dom drops the `dvh` unit (see the
    // file docstring), so no computed-style assertion can see this line.
    //
    // ⛔ ORDER IS THE WHOLE MECHANISM, so the regex pins it. `100vh` must come
    // FIRST as the fallback and `100dvh` second as the override: an engine
    // that does not know `dvh` discards the second declaration and keeps the
    // first, and an engine that does know it takes the later one. Swap them
    // and every `dvh`-capable browser silently reverts to `100vh` — the exact
    // bug this line exists to fix, passing an order-blind regex the whole
    // time. `[^}]*` between them keeps the assertion tolerant of any other
    // property landing in the block.
    expect(css).toMatch(
      /\.rh-rail:not\(\.rh-rail--drawer\)\s*\{[^}]*height:\s*100vh;[^}]*height:\s*100dvh;/,
    );
  });

  it("leaves the drawer panel fixed — it is a .rh-rail too", () => {
    // The off-canvas menu carries `rh-rail` so it inherits every row style,
    // but it is `position: fixed` with its own width. Making the sticky rule
    // depend on source order beating `.rh-drawer__panel` would be a trap for
    // whoever next reorders this file, so the selector excludes it outright.
    happyDOM.setViewport(WIDE);
    const { el } = mount("rh-drawer__panel rh-rail rh-rail--drawer");
    const s = getComputedStyle(el);
    expect(s.position).toBe("fixed");
    expect(s.width).toBe("288px");
    // Positively: NO height at all. The panel is stretched by `top: 0;
    // bottom: 0`, so a height landing here — from the sticky rule leaking in
    // — would fight that.
    expect(s.height).toBe("");
    expect(s.top).toBe("0px");
    expect(s.bottom).toBe("0px");
  });

  it("hides the rail below 900px but keeps the drawer panel", () => {
    happyDOM.setViewport(NARROW);
    const { shell, el } = mount("rh-rail");
    expect(getComputedStyle(el).display).toBe("none");
    // The grid must collapse with it, or the hidden rail leaves a 260px gutter.
    expect(getComputedStyle(shell).gridTemplateColumns).toBe("1fr");
    // The whole point of `:not(.rh-rail--drawer)` in the narrow rule: the
    // drawer panel IS a `.rh-rail`, and hiding it here would leave the
    // hamburger opening nothing — which is the only navigation left at this
    // width.
    const drawer = mount("rh-drawer__panel rh-rail rh-rail--drawer");
    expect(getComputedStyle(drawer.el).display).toBe("flex");
    expect(getComputedStyle(drawer.el).position).toBe("fixed");
  });
});
