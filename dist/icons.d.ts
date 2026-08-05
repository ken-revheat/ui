/**
 * Product icon path data — framework-NEUTRAL on purpose.
 *
 * Lives here rather than inside react.tsx so the Vue portals (app.revheat.com,
 * Call Analyzer) consume the SAME glyphs as the React shell instead of keeping
 * a fourth hand-copied set. A hand-copied product list is precisely what put
 * Call Analyzer's sidebar four products behind what RevHeat actually sells;
 * do not reintroduce a per-app copy of this map.
 *
 * Consumed at `currentColor` inside the icon tile. Render with
 * `fill-rule="evenodd"` so the ring-based glyphs (readiness_audit, icp_builder)
 * come out as outlines rather than solid blobs.
 */
/**
 * The glyph every unknown code falls back to (the Advisor speech bubble).
 *
 * Hoisted out of the map ON PURPOSE. When the fallback was read back out of the
 * map as `PRODUCT_ICON_PATHS.ask_revheat!`, deleting that one entry type-checked,
 * passed every test, and then threw `undefined.map` at render — white-screening
 * the sidebar in all four apps for any code the map doesn't know. A separate
 * const cannot be deleted by editing the map.
 */
export declare const FALLBACK_ICON_PATHS: readonly string[];
export declare const PRODUCT_ICON_PATHS: Readonly<Record<string, readonly string[]>>;
/**
 * The glyph for `code`, falling back to the Advisor speech bubble.
 *
 * The return is `readonly` because the array is the LIVE instance out of the
 * module map, shared across every consumer in the bundle graph — a caller that
 * sorted or pushed onto it would silently corrupt that glyph for everyone else.
 */
export declare function iconPathsFor(code: string): readonly string[];
//# sourceMappingURL=icons.d.ts.map