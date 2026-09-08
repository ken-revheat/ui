// Private helpers shared by the React and Vue shells. NOT in package.json's
// exports map on purpose — nothing here is consumer API, so nothing here is
// frozen by semver.
/**
 * True for clicks the browser should keep — modifier keys (open in new
 * tab/window, add to reading list) or a non-primary button. A client-side
 * navigation hook must NOT intercept these.
 */
export function isModifiedClick(e) {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}
/**
 * True when `href` resolves to the current page's origin. An off-origin tab
 * that forgot `external: true` (say, a portal URL) must still leave the app
 * via the browser — handing "https://app.revheat.com/…" to a SPA router
 * lands the user on the app's own 404. Unparseable hrefs count as same-origin
 * so a relative path never loses the hook. Outside a browser (SSR) there is
 * no click to intercept, so the answer does not matter; report false.
 */
export function isSameOriginHref(href) {
    if (typeof document === "undefined")
        return false;
    try {
        // Resolve against the document's base (a <base href> can point a relative
        // link off-origin) — the same base the rendered anchor resolves against.
        return new URL(href, document.baseURI).origin === document.location.origin;
    }
    catch {
        return true;
    }
}
//# sourceMappingURL=internal.js.map