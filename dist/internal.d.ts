/**
 * True for clicks the browser should keep — modifier keys (open in new
 * tab/window, add to reading list) or a non-primary button. A client-side
 * navigation hook must NOT intercept these.
 */
export declare function isModifiedClick(e: {
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    button: number;
}): boolean;
/**
 * True when `href` resolves to the current page's origin. An off-origin tab
 * that forgot `external: true` (say, a portal URL) must still leave the app
 * via the browser — handing "https://app.revheat.com/…" to a SPA router
 * lands the user on the app's own 404. Unparseable hrefs count as same-origin
 * so a relative path never loses the hook. Outside a browser (SSR) there is
 * no click to intercept, so the answer does not matter; report false.
 */
export declare function isSameOriginHref(href: string): boolean;
//# sourceMappingURL=internal.d.ts.map