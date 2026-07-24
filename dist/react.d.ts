import * as React from "react";
import { type MeProduct } from "./core";
export interface AppShellIdentity {
    email: string | null;
    isInternal: boolean;
    roleLabel: string | null;
}
export interface AppShellProps {
    identity: AppShellIdentity;
    products: MeProduct[];
    degraded?: boolean;
    productCodesFallback?: string[];
    activePath: string;
    adminHref?: string;
    accountMenu?: React.ReactNode;
    onSignOut?: () => void;
    children: React.ReactNode;
}
export declare function AppShell({ identity, products, degraded, productCodesFallback, activePath, adminHref, accountMenu, onSignOut, children }: AppShellProps): React.JSX.Element;
//# sourceMappingURL=react.d.ts.map