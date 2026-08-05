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
// ── Product icons ──────────────────────────────────────────────────────────
// Code → inline-SVG path list, consumed at currentColor inside the icon tile.
// The first six are ported verbatim from the LA portal's RhProductIcon.vue
// interim set; readiness_audit, trend_finder and icp_builder are added here as
// tasteful on-brand glyphs (checklist, trending-up, bullseye). The `<svg>` sets
// fill-rule evenodd so the ring-based glyphs render as outlines, not solids.
/**
 * The glyph every unknown code falls back to (the Advisor speech bubble).
 *
 * Hoisted out of the map ON PURPOSE. When the fallback was read back out of the
 * map as `PRODUCT_ICON_PATHS.ask_revheat!`, deleting that one entry type-checked,
 * passed every test, and then threw `undefined.map` at render — white-screening
 * the sidebar in all four apps for any code the map doesn't know. A separate
 * const cannot be deleted by editing the map.
 */
export const FALLBACK_ICON_PATHS = ["M3 4h18v12h-11l-7 5z"];
export const PRODUCT_ICON_PATHS = {
    // All-Access — stacked layers (the whole platform in one).
    all_access: [
        "M12 2 2 7l10 5 10-5-10-5z",
        "M2 17l10 5 10-5",
        "M2 12l10 5 10-5",
    ],
    lead_accelerator: ["M13 2 4 14h6l-1 8 9-12h-6l1-8z"],
    call_analyzer: ["M3 11h3v9H3zM8 4h3v16H8zM13 8h3v12h-3zM18 13h3v7h-3z"],
    quotafit: [
        "M9 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
        "M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6z",
        "m15.5 10.5 2.2 2.2 4.3-4.3-1.4-1.4-2.9 2.9-.8-.8z",
    ],
    training_vault: ["M7 4v16l13-8z"],
    ask_revheat: FALLBACK_ICON_PATHS,
    // Website Readiness Audit — a hollow checklist frame (evenodd ring) with two
    // ticked line items inside it.
    readiness_audit: [
        "M4.5 4h15v16h-15z M6.1 5.6h11.8v12.8H6.1z",
        "m7 9.6 1.3 1.3 2.3-2.3 1 1-3.3 3.3-2.3-2.3z",
        "M12.6 9.4h4.8v1.5h-4.8z",
        "m7 14.6 1.3 1.3 2.3-2.3 1 1-3.3 3.3-2.3-2.3z",
        "M12.6 14.4h4.8v1.5h-4.8z",
    ],
    // Trend Finder — an upward diagonal line (band) with an arrowhead: trending up.
    trend_finder: [
        "M2.5 16.25 3.5 17.75 21.5 5.75 20.5 4.25z",
        "M14 4h8v8z",
    ],
    // ICP Builder — a bullseye/target: two evenodd rings plus a centre dot.
    icp_builder: [
        "M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0z M4.4 12a7.6 7.6 0 1 0 15.2 0 7.6 7.6 0 1 0-15.2 0z",
        "M6.8 12a5.2 5.2 0 1 0 10.4 0 5.2 5.2 0 1 0-10.4 0z M9.2 12a2.8 2.8 0 1 0 5.6 0 2.8 2.8 0 1 0-5.6 0z",
        "M10.6 12a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0z",
    ],
};
/**
 * The glyph for `code`, falling back to the Advisor speech bubble.
 *
 * The return is `readonly` because the array is the LIVE instance out of the
 * module map, shared across every consumer in the bundle graph — a caller that
 * sorted or pushed onto it would silently corrupt that glyph for everyone else.
 */
export function iconPathsFor(code) {
    // `Object.hasOwn`, not `?? FALLBACK`. A plain lookup also sees Object.prototype,
    // so `iconPathsFor("constructor" | "toString" | "__proto__")` returns a function
    // or `{}` — the `??` never fires — and `paths.map` then throws during render.
    // Unreachable through PRODUCT_CATALOG, but this is public API now: a Vue app
    // may hand it a product code straight off an API response.
    // `hasOwnProperty.call`, not `Object.hasOwn`: this package's build lib target is
    // below ES2022 and four consumer apps compile against it, so don't raise it here.
    return Object.prototype.hasOwnProperty.call(PRODUCT_ICON_PATHS, code)
        ? PRODUCT_ICON_PATHS[code]
        : FALLBACK_ICON_PATHS;
}
//# sourceMappingURL=icons.js.map