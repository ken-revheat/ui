import { type PropType, type VNode } from "vue";
import { type MeProduct, type ShellScreen } from "./core.js";
/**
 * Re-declared here rather than imported from `src/react.tsx` — importing it
 * would drag `"use client"` and the whole React import graph into
 * `dist/vue.js`. Keep this byte-identical to `AppShellIdentity` in
 * `src/react.tsx:31-48`.
 */
export interface AppShellIdentity {
    email: string | null;
    /**
     * RevHeat-internal org (an org-ID allowlist on the API side). NOT the same
     * thing as `isStaff` — see below.
     */
    isInternal: boolean;
    /**
     * Staff flag from the portal session (`revheat_session_info.isStaff`),
     * which is what the portal itself gates the Admin link on. `isInternal` is
     * an org-level allowlist and is broader: a non-staff member of the RevHeat
     * org has isInternal true and isStaff false. Pass this whenever the app has
     * the portal session; it falls back to `isInternal` so existing callers
     * keep the behaviour they have today.
     */
    isStaff?: boolean;
    roleLabel: string | null;
}
/**
 * ONE AppShell per page — same caveat as the React version (src/react.tsx
 * :50-57): it owns document-level state (a keydown listener, the body scroll
 * lock) that is not reference-counted.
 */
export declare const AppShell: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    identity: {
        type: PropType<AppShellIdentity>;
        required: true;
    };
    products: {
        type: PropType<MeProduct[]>;
        required: true;
    };
    /**
     * The viewer's role and buyer status, straight from
     * `GET /api/me/products`. See `src/react.tsx:64-74` for why both should
     * be passed together.
     */
    viewerRole: {
        type: PropType<"rep" | "manager" | "admin">;
        default: undefined;
    };
    isPrimaryBuyer: {
        type: PropType<boolean | undefined>;
        default: undefined;
    };
    degraded: {
        type: BooleanConstructor;
        default: boolean;
    };
    productCodesFallback: {
        type: PropType<string[]>;
        default: () => never[];
    };
    activePath: {
        type: StringConstructor;
        required: true;
    };
    /** The product code of the app rendering this shell. Highlights that row. */
    currentProductCode: {
        type: StringConstructor;
        default: undefined;
    };
    adminHref: {
        type: StringConstructor;
        default: undefined;
    };
    /** Horizontal in-product screen menu. Rendered only when 2+ items. */
    screens: {
        type: PropType<ShellScreen[]>;
        default: undefined;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("sign-out" | "navigate")[], "sign-out" | "navigate", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    identity: {
        type: PropType<AppShellIdentity>;
        required: true;
    };
    products: {
        type: PropType<MeProduct[]>;
        required: true;
    };
    /**
     * The viewer's role and buyer status, straight from
     * `GET /api/me/products`. See `src/react.tsx:64-74` for why both should
     * be passed together.
     */
    viewerRole: {
        type: PropType<"rep" | "manager" | "admin">;
        default: undefined;
    };
    isPrimaryBuyer: {
        type: PropType<boolean | undefined>;
        default: undefined;
    };
    degraded: {
        type: BooleanConstructor;
        default: boolean;
    };
    productCodesFallback: {
        type: PropType<string[]>;
        default: () => never[];
    };
    activePath: {
        type: StringConstructor;
        required: true;
    };
    /** The product code of the app rendering this shell. Highlights that row. */
    currentProductCode: {
        type: StringConstructor;
        default: undefined;
    };
    adminHref: {
        type: StringConstructor;
        default: undefined;
    };
    /** Horizontal in-product screen menu. Rendered only when 2+ items. */
    screens: {
        type: PropType<ShellScreen[]>;
        default: undefined;
    };
}>> & Readonly<{
    onNavigate?: ((...args: any[]) => any) | undefined;
    "onSign-out"?: ((...args: any[]) => any) | undefined;
}>, {
    currentProductCode: string;
    adminHref: string;
    viewerRole: "rep" | "manager" | "admin";
    isPrimaryBuyer: boolean | undefined;
    degraded: boolean;
    productCodesFallback: string[];
    screens: ShellScreen[];
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
export default AppShell;
//# sourceMappingURL=vue.d.ts.map