import { defineComponent, h, ref, watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance, Teleport, } from "vue";
import { PRODUCT_CATALOG } from "./catalog.js";
import { buildRailModel, withSource, isActiveProduct, PORTAL_ORIGIN, ALL_PRODUCTS_HREF, productTitle, resolveActiveScreen, } from "./core.js";
import { iconPathsFor } from "./icons.js";
// Matches the portal's own sidebar breakpoint (RhSidebar.vue), the
// `@media (max-width: 900px)` rule in styles.css, and `src/react.tsx`'s
// NARROW_QUERY. A raw px query on purpose — this package has no Tailwind.
const NARROW_QUERY = "(max-width: 900px)";
// Kept in sync with `--rh-duration-slow` in styles.css and `src/react.tsx`'s
// DRAWER_EXIT_MS. The drawer stays mounted this long after close so the
// slide-out can play; focus, the scroll lock and `aria-modal` are all
// released the moment closing STARTS (see the `closing` watcher below).
const DRAWER_EXIT_MS = 300;
/* ------------------------------------------------------------------ */
/* focus / media helpers — copied verbatim from src/react.tsx:108-139  */
/* ------------------------------------------------------------------ */
// `:not([disabled])` and `:not([hidden])` matter: a focus trap that hands
// focus to an unfocusable element silently does nothing — the user's Tab key
// appears to stop working.
const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    '[tabindex]:not([tabindex="-1"])',
]
    .map((s) => `${s}:not([disabled]):not([hidden]):not([aria-hidden="true"])`)
    .join(",");
function focusablesIn(root) {
    if (!root)
        return [];
    return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
}
// Module-scope id counter. Deliberately NOT Vue's `useId()` — that lands in
// 3.5, and the peer floor declared in package.json is `vue >= 3.4`.
let uid = 0;
/* ------------------------------------------------------------------ */
/* glyphs — geometry ported verbatim from src/react.tsx                */
/* ------------------------------------------------------------------ */
function productIcon(code) {
    const paths = iconPathsFor(code);
    return h("svg", {
        class: "rh-rail__glyph",
        viewBox: "0 0 24 24",
        fill: "currentColor",
        "fill-rule": "evenodd",
        "aria-hidden": "true",
    }, paths.map((d, i) => h("path", { key: i, d })));
}
// Lucide "Menu" / "X", drawn inline so this package keeps its zero-dependency
// install (the portal imports them from lucide-vue-next).
function strokeIcon(d, className) {
    return h("svg", {
        class: className,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": 2,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "aria-hidden": "true",
    }, d.map((path, i) => h("path", { key: i, d: path })));
}
const MENU_ICON = ["M4 6h16", "M4 12h16", "M4 18h16"];
const CLOSE_ICON = ["M18 6 6 18", "m6 6 12 12"];
const CHEVRON_ICON = ["m6 9 6 6 6-6"];
// The RevHeat "R" letterform mark (currentColor) — rail head. Geometry ported
// verbatim from src/react.tsx's BrandMarkR.
function brandMarkR() {
    return h("svg", {
        class: "rh-rail__mark",
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "264.263 347.964 72.08 72.08",
        role: "img",
        "aria-label": "RevHeat",
    }, [
        h("path", {
            fill: "currentColor",
            d: "m310.29 394.81c5.3539-1.5444 9.5753-4.2214 12.458-8.1338 2.8829-3.9125 4.4273-8.6486 4.4273-14.414 0-7.5161-2.574-13.488-7.722-17.812-5.148-4.3243-12.252-6.4865-21.313-6.4865h-25.843v4.7362h25.843c7.619 0 13.488 1.7503 17.606 5.148 4.0154 3.3977 6.0746 8.2368 6.0746 14.414 0 6.2806-2.0592 11.12-6.0746 14.517-4.1184 3.3977-9.9871 5.045-17.606 5.045h-25.84v28.22h5.251v-23.578h20.592c2.0592 0 4.4273-0.10296 7.0013-0.5148l17.194 24.093h5.9717z",
        }),
    ]);
}
// The full RevHeat wordmark (per-letter stepped gradient purple→red). Geometry
// + fills ported verbatim from src/react.tsx's BrandWordmark. Colors are the
// brand gradient — deliberately NOT tokenized/currentColor.
function brandWordmark() {
    return h("svg", {
        class: "rh-banner__wordmark",
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "272.297 347.964 479.41 72.08",
        role: "img",
        "aria-label": "RevHeat",
    }, [
        h("path", {
            d: "m310.29 394.81c5.3539-1.5444 9.5753-4.2214 12.458-8.1338 2.8829-3.9125 4.4273-8.6486 4.4273-14.414 0-7.5161-2.574-13.488-7.722-17.812-5.148-4.3243-12.252-6.4865-21.313-6.4865h-25.843v4.7362h25.843c7.619 0 13.488 1.7503 17.606 5.148 4.0154 3.3977 6.0746 8.2368 6.0746 14.414 0 6.2806-2.0592 11.12-6.0746 14.517-4.1184 3.3977-9.9871 5.045-17.606 5.045h-25.84v28.22h5.251v-23.578h20.592c2.0592 0 4.4273-0.10296 7.0013-0.5148l17.194 24.093h5.9717z",
            fill: "#6143f9",
        }),
        h("path", {
            d: "m393.14 381.12h-46.641v4.6332h46.641zm0-33.153h-46.641v4.7362h46.641zm-46.641 67.336v4.7362h46.641v-4.7362z",
            fill: "#7841da",
        }),
        h("path", {
            d: "m472.02 347.96h-5.45l-29.14 65.28-29.14-65.28h-5.7658l32.124 72.072h5.251z",
            fill: "#903fbb",
        }),
        h("path", {
            d: "m542.33 347.96h-5.251v33.153h-48.18v-33.15h-5.251v72.072h5.251v-34.286h48.185v34.3h5.251z",
            fill: "#a73d9c",
        }),
        h("path", {
            d: "m614.14 381.12h-46.641v4.6332h46.641zm0-33.153h-46.641v4.7362h46.641zm-46.641 67.336v4.7362h46.641v-4.7362z",
            fill: "#be3a7c",
        }),
        h("path", {
            d: "m720.51 352.7v67.34h5.251v-67.336h25.946v-4.74h-57.143v4.7362z",
            fill: "#ed363e",
        }),
        h("path", {
            d: "m659.71 348.45c-0.006 0-1.9228 3.7574-4.2604 8.3496-2.3374 4.5926-4.25 8.3566-4.25 8.3648 0 0.008 3.8295 0.0151 8.5101 0.0151s8.5101-0.007 8.5101-0.0149c0-0.008-1.9125-3.7723-4.25-8.3648-2.3368-4.5926-4.2537-8.35-4.2612-8.35zm0.0002 6.3602c0.006 0 0.87479 1.6595 1.9313 3.6874 1.0563 2.0282 1.9239 3.6967 1.9276 3.7077 0.005 0.0132-1.3294 0.0202-3.7853 0.0202h-3.7923l1.8538-3.7077c1.0196-2.0393 1.8586-3.7077 1.8644-3.7077zm0.004 14.856-10.845-0.005-0.33958 0.66614c-0.18673 0.36643-1.6791 3.3152-3.316 6.553-1.6372 3.2378-2.9827 5.9032-2.9901 5.9229l-0.0132 0.0361h17.498c9.6238 0 17.498-0.007 17.498-0.0155 0-0.008-1.4953-2.9713-3.3229-6.5838l-3.3213-6.5678zm0.0706 2.9494 9.0707-0.00082 1.8522 3.6276c1.0188 1.9951 1.8487 3.6311 1.8443 3.6354-0.005 0.004-5.7528 0.006-12.774 0.003l-12.769-0.005 1.8512-3.6292 1.8512-3.6296zm-0.15009 14.706h-19.74l-0.33958 0.66614c-0.18672 0.36644-1.6791 3.3152-3.316 6.553-1.6372 3.2378-2.9827 5.9032-2.9901 5.9229l-0.0132 0.0362h26.483c14.566 0 26.483-0.007 26.483-0.0149 0-0.008-1.5314-2.9734-3.403-6.589l-3.403-6.5719zm0.0758 2.9554h17.981l1.8512 3.6294 1.8512 3.6294-10.842 0.005c-5.963 0.003-15.72 0.003-21.683 0l-10.842-0.005 1.8512-3.6294 1.8512-3.6294zm0.0797 14.561h-28.744l-3.8536 7.5527c-2.1194 4.1571-3.8596 7.5713-3.867 7.5936l-0.0132 0.0362h36.397c24.243 0 36.397-0.007 36.397-0.0206 0-0.0114-1.7033-3.4272-3.7853-7.591l-3.7853-7.5702zm-0.002 3.0984h27.033l2.3186 4.6371c1.2753 2.5506 2.3186 4.642 2.3186 4.6475 0 0.006-14.249 0.0103-31.665 0.0103-21.115 0-31.665-0.007-31.665-0.0207 0-0.0114 1.041-2.1028 2.3134-4.6475l2.3134-4.6267z",
            fill: "#d5385d",
        }),
    ]);
}
/* ------------------------------------------------------------------ */
/* rail rows                                                           */
/* ------------------------------------------------------------------ */
function entitledRowVNode(p, activePath, currentProductCode) {
    const href = withSource(p.appUrl);
    const active = isActiveProduct(p, activePath, currentProductCode);
    // `aria-current="page"` is the whole hook — it is what styles.css targets
    // and what a screen reader announces. No parallel `--active` class: an
    // emitted class with no rule behind it is a trap for the next reader.
    return h("li", { class: "rh-rail__item", key: p.code }, [
        h("a", { class: "rh-rail__link", href, "aria-current": active ? "page" : undefined }, [
            h("span", { class: "rh-rail__tile", "aria-hidden": "true" }, productIcon(p.code)),
            h("span", { class: "rh-rail__label" }, p.title),
        ]),
    ]);
}
/* ------------------------------------------------------------------ */
/* account menu — mirrors src/react.tsx AccountMenu (337-519)          */
/* ------------------------------------------------------------------ */
// Same items, same order and same destinations as the portal's own account
// menu (RhSidebarRail.vue). "Account settings" and "Team & Access" both point
// at /account on purpose — that page owns both — and Admin is repeated here
// even though the header shows it too. Matching the portal exactly is the
// point.
//
// Admin needs BOTH the staff flag and an explicit `adminHref`, exactly like
// the header link. Defaulting the href would have made every app that bumps
// this package start showing Admin to anyone in a RevHeat org, with no code
// change on their side — a behaviour change nobody opted into.
function accountItemsFor(isStaff, adminHref) {
    const items = [
        { key: "account", label: "Account settings", href: `${PORTAL_ORIGIN}/account` },
        { key: "team", label: "Team & Access", href: `${PORTAL_ORIGIN}/account` },
        { key: "products", label: "Manage products", href: `${PORTAL_ORIGIN}/` },
    ];
    if (isStaff && adminHref) {
        items.push({ key: "admin", label: "Admin", href: adminHref });
    }
    return items;
}
const RhAccountMenu = defineComponent({
    name: "RhAccountMenu",
    props: {
        identity: { type: Object, required: true },
        isStaff: { type: Boolean, default: false },
        adminHref: { type: String, default: undefined },
        // Whether the parent AppShell has a `sign-out` listener attached. Passed
        // in rather than inferred here, because "does the CONSUMER's AppShell
        // have an onSignOut listener" is only knowable from AppShell's own
        // instance (see `hasSignOut` in AppShell's setup below).
        hasSignOut: { type: Boolean, default: false },
    },
    emits: ["sign-out"],
    setup(props, { emit }) {
        const open = ref(false);
        const menuId = `rh-menu-${++uid}`;
        const rootRef = ref(null);
        const triggerRef = ref(null);
        const menuRef = ref(null);
        // Built onMounted, not during render: `window.location.origin` differs
        // between the server and the browser, and an href that changes between
        // the two is a hydration mismatch.
        const signOutHref = ref(`${PORTAL_ORIGIN}/logout`);
        onMounted(() => {
            if (typeof window === "undefined")
                return;
            signOutHref.value = `${PORTAL_ORIGIN}/logout?next=${encodeURIComponent(window.location.origin)}`;
        });
        function closeAndRefocus() {
            open.value = false;
            triggerRef.value?.focus();
        }
        // Outside-pointerdown closes the menu. Only installed while open — this
        // is the reason `open` starts false and this watcher never no-ops on
        // mount.
        watch(open, (isOpen, _prev, onCleanup) => {
            if (!isOpen)
                return;
            const onPointerDown = (e) => {
                if (!rootRef.value?.contains(e.target))
                    open.value = false;
            };
            document.addEventListener("pointerdown", onPointerDown);
            onCleanup(() => document.removeEventListener("pointerdown", onPointerDown));
        });
        function focusItem(index) {
            const focusables = focusablesIn(menuRef.value);
            if (focusables.length === 0)
                return;
            const wrapped = ((index % focusables.length) + focusables.length) % focusables.length;
            focusables[wrapped].focus();
        }
        // `open` is driven to `true` from exactly two call sites below (the
        // trigger's click and its ArrowDown handler), both of which mean "open
        // AND focus the first item" — so focusing on every open→true transition
        // is equivalent to React's `focusFirstOnOpen` ref-flag effect.
        watch(open, async (isOpen) => {
            if (!isOpen)
                return;
            await nextTick();
            focusItem(0);
        });
        function onMenuKeydown(e) {
            if (e.key === "Escape") {
                // Only this layer. Inside the drawer the panel has its own Escape
                // handler; without this the one keypress would close both.
                e.stopPropagation();
                closeAndRefocus();
                return;
            }
            if (e.key === "Tab") {
                // preventDefault matters: the browser's default Tab targets the NEXT
                // menu item, which this same keystroke unmounts — focus would land
                // on <body>. Place it on the trigger ourselves instead.
                e.preventDefault();
                e.stopPropagation();
                closeAndRefocus();
                return;
            }
            const focusables = focusablesIn(menuRef.value);
            const current = focusables.indexOf(document.activeElement);
            if (e.key === "ArrowDown") {
                e.preventDefault();
                focusItem(current + 1);
            }
            else if (e.key === "ArrowUp") {
                e.preventDefault();
                focusItem(current - 1);
            }
            else if (e.key === "Home") {
                e.preventDefault();
                focusItem(0);
            }
            else if (e.key === "End") {
                e.preventDefault();
                focusItem(focusables.length - 1);
            }
        }
        function onTriggerClick() {
            open.value = !open.value;
        }
        function onTriggerKeydown(e) {
            if (e.key === "ArrowDown" && !open.value) {
                e.preventDefault();
                open.value = true;
            }
        }
        return () => {
            const initial = (props.identity.email ?? "?").charAt(0).toUpperCase();
            const items = accountItemsFor(props.isStaff, props.adminHref);
            return h("div", { class: "rh-rail__account-menu", ref: rootRef }, [
                open.value
                    ? h("div", {
                        class: "rh-rail__menu",
                        id: menuId,
                        role: "menu",
                        ref: menuRef,
                        onKeydown: onMenuKeydown,
                    }, [
                        // tabIndex -1 on every item is the ARIA menu pattern's roving
                        // focus: the menu itself moves focus (arrows / Home / End),
                        // and Tab leaves the menu rather than walking it.
                        ...items.map((item) => h("a", {
                            key: item.key,
                            class: "rh-rail__menu-item",
                            role: "menuitem",
                            tabindex: -1,
                            href: item.href,
                        }, item.label)),
                        props.hasSignOut
                            ? h("button", {
                                type: "button",
                                class: "rh-rail__menu-item rh-rail__menu-item--signout",
                                role: "menuitem",
                                tabindex: -1,
                                onClick: () => emit("sign-out"),
                            }, "Sign out")
                            : h("a", {
                                class: "rh-rail__menu-item rh-rail__menu-item--signout",
                                role: "menuitem",
                                tabindex: -1,
                                href: signOutHref.value,
                            }, "Sign out"),
                    ])
                    : null,
                h("button", {
                    type: "button",
                    class: "rh-rail__account-trigger",
                    ref: triggerRef,
                    "aria-haspopup": "menu",
                    "aria-expanded": open.value,
                    "aria-controls": open.value ? menuId : undefined,
                    onClick: onTriggerClick,
                    onKeydown: onTriggerKeydown,
                }, [
                    h("span", { class: "rh-rail__avatar", "aria-hidden": "true" }, initial),
                    h("span", { class: "rh-rail__account-meta" }, [
                        h("span", { class: "rh-rail__email" }, props.identity.email ?? ""),
                        props.identity.roleLabel
                            ? h("span", { class: "rh-rail__role" }, props.identity.roleLabel)
                            : null,
                    ]),
                    strokeIcon(CHEVRON_ICON, "rh-rail__caret"),
                ]),
            ]);
        };
    },
});
/* ------------------------------------------------------------------ */
/* drawer — mirrors src/react.tsx Drawer (525-670)                     */
/* ------------------------------------------------------------------ */
const RhDrawer = defineComponent({
    name: "RhDrawer",
    props: {
        id: { type: String, required: true },
        closing: { type: Boolean, required: true },
    },
    emits: ["close"],
    setup(props, { emit, slots }) {
        const panelRef = ref(null);
        // Plain closure variable, not a ref: it is read only from lifecycle
        // hooks, never from the render function, so it needs no reactivity.
        let capturedTrigger = null;
        let previousOverflow = null;
        let keydownHandler = null;
        // Set the moment onBeforeUnmount runs. The mount hook below awaits a
        // `nextTick()` for the focus step only — if the component unmounts
        // during that await, the continuation must not touch the DOM/document at
        // all (it would re-apply a scroll lock and an orphan keydown listener
        // against a dead instance).
        let disposed = false;
        function onClose() {
            emit("close");
        }
        // Move focus into the panel, and remember what opened us so we can give
        // it back. Mount-time is correct: `openId` keys this component in
        // AppShell's render, so a reopen during the exit animation is a fresh
        // mount, not a reused one — this effect runs again from scratch.
        //
        // The scroll lock and the document keydown trap are taken BEFORE the
        // `await nextTick()` below — neither needs the panel's DOM, and taking
        // them synchronously on mount means there is no window in which this
        // component can unmount having promised a lock/trap it never delivered.
        onMounted(async () => {
            if (typeof document === "undefined")
                return;
            capturedTrigger = document.activeElement;
            // The portal has no scroll lock, so on a phone the page scrolls behind
            // the scrim while the menu is open.
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            // Escape and the focus trap live on the DOCUMENT, not on the panel — a
            // click on any non-interactive part of the panel blurs to <body>, at
            // which point a panel-level handler would stop hearing Escape/Tab.
            const handler = (e) => {
                // Defer to the innermost layer — but only for a keypress that is
                // actually IN it. One keypress closes one layer; asking "is a
                // [role=menu] present anywhere in the panel?" instead would hand the
                // keyboard to a menu that is not even open (headless menu libraries
                // keep theirs mounted and hidden).
                const menu = panelRef.value?.querySelector('[role="menu"]');
                if (menu?.contains(e.target))
                    return;
                if (e.key === "Escape") {
                    e.preventDefault();
                    onClose();
                    return;
                }
                if (e.key !== "Tab")
                    return;
                const focusables = focusablesIn(panelRef.value);
                if (focusables.length === 0) {
                    e.preventDefault();
                    return;
                }
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                const active = document.activeElement;
                const outside = !panelRef.value?.contains(active);
                if (e.shiftKey && (active === first || outside)) {
                    e.preventDefault();
                    last.focus();
                }
                else if (!e.shiftKey && (active === last || outside)) {
                    e.preventDefault();
                    first.focus();
                }
            };
            keydownHandler = handler;
            document.addEventListener("keydown", handler);
            await nextTick();
            if (disposed)
                return;
            focusablesIn(panelRef.value)[0]?.focus();
        });
        // Order matters (R11): restore focus → set inert → release the scroll
        // lock → remove the keydown listener. `inert` blurs whatever is focused
        // inside the panel, so setting it before the focus restore silently
        // loses focus to <body>.
        watch(() => props.closing, (closing) => {
            if (!closing || typeof document === "undefined")
                return;
            const active = document.activeElement;
            const ours = !active || active === document.body || panelRef.value?.contains(active);
            if (ours)
                capturedTrigger?.focus?.();
            // Take the exiting panel out of the tab order entirely.
            // `pointer-events: none` handles the mouse; this handles Tab.
            panelRef.value?.setAttribute("inert", "");
            if (typeof document !== "undefined") {
                document.body.style.overflow = previousOverflow ?? "";
            }
            if (keydownHandler) {
                document.removeEventListener("keydown", keydownHandler);
                keydownHandler = null;
            }
        });
        onBeforeUnmount(() => {
            disposed = true;
            if (typeof document === "undefined")
                return;
            document.body.style.overflow = previousOverflow ?? "";
            if (keydownHandler) {
                document.removeEventListener("keydown", keydownHandler);
                keydownHandler = null;
            }
        });
        return () => {
            const body = slots.default ? slots.default() : [];
            return h(Teleport, { to: "body" }, [
                h("div", { class: `rh-drawer${props.closing ? " rh-drawer--closing" : ""}` }, [
                    h("div", { class: "rh-drawer__scrim", "aria-hidden": "true", onClick: onClose }),
                    h("div", {
                        class: "rh-drawer__panel rh-rail rh-rail--drawer",
                        id: props.id,
                        role: "dialog",
                        // Dropped while closing, in step with the scroll lock and the
                        // focus trap: a screen reader should not still be told the
                        // rest of the page is inert once the drawer is on its way out.
                        "aria-modal": props.closing ? undefined : "true",
                        "aria-label": "RevHeat products",
                        ref: panelRef,
                        tabindex: -1,
                    }, [
                        h("button", {
                            type: "button",
                            class: "rh-drawer__close",
                            "aria-label": "Close product menu",
                            onClick: onClose,
                        }, strokeIcon(CLOSE_ICON, "rh-drawer__close-glyph")),
                        ...body,
                    ]),
                ]),
            ]);
        };
    },
});
/* ------------------------------------------------------------------ */
/* shell                                                               */
/* ------------------------------------------------------------------ */
/**
 * ONE AppShell per page — same caveat as the React version (src/react.tsx
 * :50-57): it owns document-level state (a keydown listener, the body scroll
 * lock) that is not reference-counted.
 */
export const AppShell = defineComponent({
    name: "AppShell",
    props: {
        identity: { type: Object, required: true },
        products: { type: Array, required: true },
        /**
         * The viewer's role and buyer status, straight from
         * `GET /api/me/products`. See `src/react.tsx:64-74` for why both should
         * be passed together.
         */
        viewerRole: { type: String, default: undefined },
        isPrimaryBuyer: { type: Boolean, default: undefined },
        degraded: { type: Boolean, default: false },
        productCodesFallback: { type: Array, default: () => [] },
        activePath: { type: String, required: true },
        /** The product code of the app rendering this shell. Highlights that row. */
        currentProductCode: { type: String, default: undefined },
        adminHref: { type: String, default: undefined },
        /** Horizontal in-product screen menu. Rendered only when 2+ items. */
        screens: { type: Array, default: undefined },
    },
    emits: ["sign-out"],
    setup(props, { emit, slots }) {
        // Declared emits are stripped from `attrs`, so the only way to ask "does
        // the consumer actually listen for sign-out" is the component's own
        // vnode props at render time.
        const instance = getCurrentInstance();
        const hasSignOut = () => Boolean(instance?.vnode.props?.["onSignOut"]);
        const isNarrow = ref(false);
        let mq = null;
        let mqHandler = null;
        // Read matchMedia in onMounted ONLY — not during setup — so the server
        // and the first client render agree, and so tests can install their
        // matchMedia stub before mount.
        onMounted(() => {
            if (typeof window === "undefined" || typeof window.matchMedia !== "function")
                return;
            mq = window.matchMedia(NARROW_QUERY);
            mqHandler = () => {
                isNarrow.value = mq.matches;
            };
            mqHandler();
            mq.addEventListener("change", mqHandler);
        });
        onBeforeUnmount(() => {
            if (mq && mqHandler)
                mq.removeEventListener("change", mqHandler);
        });
        // Drawer open/closing state — mirrors src/react.tsx's useDrawer
        // (141-196). `closing` keeps the panel mounted for one animation;
        // everywhere else "not open" means "not in the DOM".
        const phase = ref("closed");
        const openId = ref(0);
        function openDrawer() {
            // Every open is a NEW drawer: `openId` keys the RhDrawer vnode below,
            // so reopening during the exit animation remounts it rather than
            // reusing an instance whose mount-time work (focus in, scroll lock)
            // would never re-run.
            openId.value += 1;
            phase.value = "open";
        }
        function closeDrawer() {
            phase.value = phase.value === "open" ? "closing" : phase.value;
        }
        // No exit animation — used when the viewport widens past the breakpoint:
        // the wide rail is back, and sliding the drawer out over it would show
        // two rails for the length of the animation.
        function dismissDrawer() {
            phase.value = "closed";
        }
        // The exit timer belongs to this watcher and to nobody else. A second
        // close() inside the exit window must not cancel it while leaving the
        // phase at "closing" — that is the freeze bug from PLAN-v1.4.0.md.
        let exitTimer = null;
        watch(phase, (p) => {
            if (exitTimer) {
                clearTimeout(exitTimer);
                exitTimer = null;
            }
            if (p !== "closing")
                return;
            exitTimer = setTimeout(() => {
                phase.value = "closed";
            }, DRAWER_EXIT_MS);
        });
        onBeforeUnmount(() => {
            if (exitTimer)
                clearTimeout(exitTimer);
        });
        // The portal only closes its drawer from rows that emit `navigate`, so
        // its own "RevHeat home" link leaves the menu sitting open over the new
        // page.
        watch(() => props.activePath, () => closeDrawer());
        // Widening past the breakpoint puts the real rail back; leaving the
        // drawer up would stack two copies of it.
        watch(isNarrow, (n) => {
            if (!n)
                dismissDrawer();
        });
        const drawerId = `rh-drawer-${++uid}`;
        return () => {
            const isStaff = Boolean(props.identity.isStaff ?? props.identity.isInternal);
            const title = productTitle(props.currentProductCode, PRODUCT_CATALOG);
            const menuItems = props.screens && props.screens.length >= 2
                ? resolveActiveScreen(props.screens, props.activePath)
                : null;
            const model = buildRailModel({
                me: props.degraded
                    ? null
                    : {
                        viewerRole: props.viewerRole ?? (props.identity.isInternal ? "admin" : "manager"),
                        // `true` only on the fully-legacy path — see src/react.tsx
                        // :717-727 for the full rationale. `canBuy` (derived below) is
                        // retained on the model for API stability but renders nothing
                        // in v2; it is exercised in core.spec.ts, not in this file's
                        // DOM.
                        isPrimaryBuyer: props.isPrimaryBuyer ?? props.viewerRole === undefined,
                        products: props.products,
                    },
                degraded: props.degraded,
                productCodesFallback: props.productCodesFallback,
                catalog: PRODUCT_CATALOG,
            });
            function railBody() {
                return [
                    h("a", { class: "rh-rail__home", href: `${PORTAL_ORIGIN}/`, "aria-label": "RevHeat home" }, brandMarkR()),
                    model.entitled.length > 0
                        ? h("nav", { class: "rh-rail__section", "aria-label": "Your products" }, [
                            h("p", { class: "rh-rail__heading" }, "Your products"),
                            h("ul", {}, model.entitled.map((p) => entitledRowVNode(p, props.activePath, props.currentProductCode))),
                        ])
                        : null,
                    h("a", { class: "rh-row rh-row--all", href: ALL_PRODUCTS_HREF }, "All products →"),
                    h("div", { class: "rh-rail__account" }, [
                        slots["account-menu"]
                            ? slots["account-menu"]()
                            : h(RhAccountMenu, {
                                identity: props.identity,
                                isStaff,
                                adminHref: props.adminHref,
                                hasSignOut: hasSignOut(),
                                onSignOut: () => emit("sign-out"),
                            }),
                    ]),
                ];
            }
            return h("div", { class: "rh-shell" }, [
                // Rendered only on wide viewports. `isNarrow` starts false so the
                // server and the first client render agree; the CSS rule at the
                // bottom of styles.css keeps the rail hidden on a narrow screen
                // until onMounted runs, so there is no flash.
                !isNarrow.value
                    ? h("aside", { class: "rh-rail", "aria-label": "RevHeat products" }, railBody())
                    : null,
                phase.value !== "closed"
                    ? h(RhDrawer, {
                        key: openId.value,
                        id: drawerId,
                        closing: phase.value === "closing",
                        onClose: closeDrawer,
                    }, () => railBody())
                    : null,
                h("div", { class: "rh-shell__main" }, [
                    h("header", { class: "rh-banner" }, [
                        h("div", { class: "rh-banner__lead" }, [
                            h("button", {
                                type: "button",
                                class: "rh-banner__menu",
                                "aria-label": "Open product menu",
                                // Only while the drawer exists — `aria-controls` pointing
                                // at an id that is not in the document fails axe
                                // `aria-valid-attr-value`.
                                "aria-controls": phase.value !== "closed" ? drawerId : undefined,
                                "aria-expanded": phase.value === "open",
                                onClick: openDrawer,
                            }, strokeIcon(MENU_ICON, "rh-banner__menu-glyph")),
                            h("a", { class: "rh-banner__portal", href: ALL_PRODUCTS_HREF }, [
                                h("span", { "aria-hidden": "true" }, "←"),
                                " Portal",
                            ]),
                            h("a", { class: "rh-banner__brand", href: `${PORTAL_ORIGIN}/`, "aria-label": "RevHeat home" }, brandWordmark()),
                            title !== undefined ? h("span", { class: "rh-banner__product" }, title) : null,
                        ]),
                        slots["header-actions"]
                            ? h("div", { class: "rh-banner__actions" }, slots["header-actions"]())
                            : null,
                        isStaff && props.adminHref
                            ? h("a", { class: "rh-banner__admin", href: props.adminHref }, "Admin")
                            : null,
                    ]),
                    menuItems
                        ? h("nav", { class: "rh-menu", "aria-label": "Screens" }, menuItems.map((s) => h("a", {
                            key: s.href,
                            class: "rh-menu__tab",
                            href: s.href,
                            "aria-current": s.active ? "page" : undefined,
                            rel: s.external ? "noopener noreferrer" : undefined,
                        }, s.label)))
                        : null,
                    slots.default ? slots.default() : null,
                    h("footer", { class: "rh-footer" }, [
                        h("span", {}, `© ${new Date().getFullYear()} RevHeat`),
                        h("a", { href: "https://revheat.com/terms" }, "Terms"),
                        h("a", { href: "https://revheat.com/privacy" }, "Privacy"),
                        h("a", { href: "mailto:support@revheat.com" }, "Support"),
                    ]),
                ]),
            ]);
        };
    },
});
export default AppShell;
//# sourceMappingURL=vue.js.map