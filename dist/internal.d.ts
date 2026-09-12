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
/**
 * The in-app form of a same-origin href: path + query + hash, no origin.
 *
 * ⛔ This is what the navigate hook receives, and it is NOT cosmetic. Until
 * v2.1.0 the hook only ever saw consumer-supplied screen-tab hrefs, which are
 * already paths. v2.2.0 hands it the rail, the banner and the account menu
 * too — and every one of those hrefs is ABSOLUTE (`https://app.revheat.com/…`,
 * see PORTAL_ORIGIN). `router.push("https://app.revheat.com/vault")` is not a
 * navigation in vue-router 4: it resolves the string as a path, lands on
 * "/https:/app.revheat.com/vault" and warns "No match found". Normalising
 * here rather than in each consumer keeps the README's one-liner
 * (`onNavigate: (href) => router.push(href)`) true for every link.
 *
 * The query is kept deliberately. `?source=sidebar` is how the portal's
 * upgrade page attributes a click, and dropping it in-app would silently
 * break that instrumentation.
 *
 * Only ever called from inside a click handler, i.e. in a browser, so
 * `document.baseURI` is available. Unparseable hrefs pass through untouched,
 * matching `isSameOriginHref`'s own fallback.
 */
export declare function inAppHref(href: string): string;
/** The click shape both bindings hand us: a DOM MouseEvent and React's
 *  synthetic mouse event agree on every field used here. */
export interface ShellClick {
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    button: number;
    preventDefault(): void;
}
/**
 * The ONE place that decides whether a link the shell renders becomes a
 * client-side navigation. Returns an onClick handler, or `undefined` to leave
 * the anchor as a plain browser link.
 *
 * Four things must all hold, and each is a bug someone has already hit:
 * the consumer must have supplied a navigate hook at all (v2.1.0 made this
 * opt-in so a plain-HTML app like the Advisor keeps real links); the link
 * must not be flagged `external`; it must resolve to this page's origin (the
 * rail is full of app.revheat.com URLs, which are same-origin ONLY inside the
 * portal — everywhere else they must leave the app); and the click must be
 * unmodified, so cmd/ctrl/middle-click still opens a new tab.
 *
 * What the hook RECEIVES is the in-app form of the href, never the absolute
 * one the anchor carries — see `inAppHref` for why that distinction is a bug
 * rather than a preference.
 *
 * v2.1.0 wired this to the screen tabs only. v2.2.0 applies it to every link
 * the shell renders — the product rows, "All products", the R mark, the
 * "← Portal" link and the account menu — because inside the portal all of
 * those are same-origin and a full page reload on each one is exactly the
 * regression adopting the shared shell was supposed to avoid.
 */
export declare function shellNavHandler<E extends ShellClick>(href: string, navigate: ((href: string) => void) | undefined, external?: boolean): ((e: E) => void) | undefined;
//# sourceMappingURL=internal.d.ts.map