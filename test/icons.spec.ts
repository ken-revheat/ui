import { describe, it, expect } from "vitest";
import { PRODUCT_CATALOG } from "../src/catalog.js";
import { buildRailModel } from "../src/core.js";
import { PRODUCT_ICON_PATHS, FALLBACK_ICON_PATHS, iconPathsFor } from "../src/icons.js";

describe("product icons", () => {
  it("every RAIL-RENDERABLE product has its OWN glyph — none silently falls back", () => {
    // The fallback is the Advisor speech bubble. Before this was pinned, the
    // three products the shared catalog exists to surface (Trend Finder,
    // Readiness Audit, ICP Builder) all rendered that same bubble, making them
    // indistinguishable from Advisor and from each other in the sidebar.
    //
    // "Rail-renderable" is ASKED OF buildRailModel rather than re-derived here:
    // a hand-copied predicate drifts from the real one (it already had, by
    // omitting the bundle filter), and this test would then go red demanding a
    // glyph for a product no rail can draw. Feed it every product in the
    // catalog and let the real projection decide what actually renders.
    const rendered = buildRailModel({
      me: {
        viewerRole: "admin",
        isPrimaryBuyer: true,
        products: PRODUCT_CATALOG.map((p) => ({
          code: p.code,
          state: "launch" as const,
          appUrl: p.appUrl,
          lockReason: null,
          billingStatus: null,
        })),
      },
      degraded: false,
      productCodesFallback: [],
      catalog: PRODUCT_CATALOG,
    });

    expect(rendered.entitled.length).toBeGreaterThan(0);
    const missing = rendered.entitled
      .filter((p) => p.code !== "ask_revheat" && !PRODUCT_ICON_PATHS[p.code])
      .map((p) => p.code);

    expect(missing).toEqual([]);
  });

  it("falls back to the Advisor bubble for a code the catalog does not know", () => {
    // Asserted against the hoisted const, not `PRODUCT_ICON_PATHS.ask_revheat`.
    // Read back out of the map, this degenerates to expect(undefined).toEqual(
    // undefined) the moment someone deletes that entry — green test, white
    // screen. Also pin the fallback is real data, not accidentally empty.
    expect(FALLBACK_ICON_PATHS.length).toBeGreaterThan(0);
    expect(iconPathsFor("not_a_product")).toEqual(FALLBACK_ICON_PATHS);
    expect(PRODUCT_ICON_PATHS.ask_revheat).toEqual(FALLBACK_ICON_PATHS);
  });

  it("falls back for inherited Object.prototype keys, not just unknown ones", () => {
    // A plain `map[code] ?? FALLBACK` lookup also resolves the prototype chain,
    // so these return a function or `{}` and the `??` never fires — then
    // `paths.map(...)` throws mid-render and white-screens the sidebar. Not
    // reachable via PRODUCT_CATALOG, but iconPathsFor is public API and the Vue
    // apps pass it a product code straight off an API response.
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(iconPathsFor(key), key).toEqual(FALLBACK_ICON_PATHS);
      expect(Array.isArray(iconPathsFor(key)), key).toBe(true);
    }
  });

  it("returns non-empty path data for every entry", () => {
    for (const [code, paths] of Object.entries(PRODUCT_ICON_PATHS)) {
      expect(paths.length, code).toBeGreaterThan(0);
      expect(paths.every((d) => d.trim().length > 0), code).toBe(true);
    }
  });
});
