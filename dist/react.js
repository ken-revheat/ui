"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { PRODUCT_CATALOG } from "./catalog";
import { buildRailModel, withSource, upgradeHref } from "./core";
function EntitledRow({ p }) {
    const href = p.internal ? withSource(p.appUrl) : withSource(p.appUrl);
    return (_jsx("li", { className: "rh-rail__item", children: _jsx("a", { className: "rh-rail__link", href: href, children: p.title }) }));
}
function UpsellRow({ p, canBuy }) {
    if (p.unlaunched) {
        return _jsxs("li", { className: "rh-rail__item rh-rail__item--soon", children: [p.title, " ", _jsx("span", { className: "rh-rail__soon", children: "Coming soon" })] });
    }
    const href = canBuy ? upgradeHref(p.slug, p.state === "locked_billing" ? "renew" : "sidebar") : undefined;
    return (_jsx("li", { className: "rh-rail__item rh-rail__item--upsell", children: href ? _jsx("a", { className: "rh-rail__link", href: href, children: p.title }) : _jsx("span", { className: "rh-rail__link rh-rail__link--muted", children: p.title }) }));
}
export function AppShell({ identity, products, degraded = false, productCodesFallback = [], activePath, adminHref, accountMenu, onSignOut, children }) {
    const model = buildRailModel({
        me: degraded ? null : { viewerRole: identity.isInternal ? "admin" : "manager", isPrimaryBuyer: true, products },
        degraded,
        productCodesFallback,
        catalog: PRODUCT_CATALOG,
    });
    const initial = (identity.email ?? "?").charAt(0).toUpperCase();
    return (_jsxs("div", { className: "rh-shell", children: [_jsxs("aside", { className: "rh-rail", "aria-label": "RevHeat products", children: [_jsx("a", { className: "rh-rail__home", href: "https://app.revheat.com/", children: "RevHeat" }), model.entitled.length > 0 && (_jsxs("nav", { className: "rh-rail__section", "aria-label": "Your products", children: [_jsx("p", { className: "rh-rail__heading", children: "Your products" }), _jsx("ul", { children: model.entitled.map((p) => _jsx(EntitledRow, { p: p }, p.code)) })] })), model.upsell.length > 0 && (_jsxs("nav", { className: "rh-rail__section", "aria-label": "Available", children: [_jsx("p", { className: "rh-rail__heading", children: "Available" }), _jsx("ul", { children: model.upsell.map((p) => _jsx(UpsellRow, { p: p, canBuy: model.canBuy }, p.code)) })] })), _jsx("div", { className: "rh-rail__account", children: accountMenu ?? (_jsxs(_Fragment, { children: [_jsx("span", { className: "rh-rail__avatar", "aria-hidden": true, children: initial }), _jsx("span", { className: "rh-rail__email", children: identity.email }), identity.roleLabel && _jsx("span", { className: "rh-rail__role", children: identity.roleLabel }), onSignOut && _jsx("button", { type: "button", className: "rh-rail__signout", onClick: onSignOut, children: "Sign out" })] })) })] }), _jsxs("div", { className: "rh-shell__main", children: [_jsxs("header", { className: "rh-banner", children: [_jsx("a", { className: "rh-banner__brand", href: "https://app.revheat.com/", children: "RevHeat" }), identity.isInternal && adminHref && _jsx("a", { className: "rh-banner__admin", href: adminHref, children: "Admin" })] }), children, _jsxs("footer", { className: "rh-footer", children: [_jsxs("span", { children: ["\u00A9 ", "2026", " RevHeat"] }), _jsx("a", { href: "https://revheat.com/terms", children: "Terms" }), _jsx("a", { href: "https://revheat.com/privacy", children: "Privacy" }), _jsx("a", { href: "mailto:support@revheat.com", children: "Support" })] })] })] }));
}
//# sourceMappingURL=react.js.map