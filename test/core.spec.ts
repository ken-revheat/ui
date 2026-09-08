import { describe, it, expect } from "vitest";
import { PRODUCT_CATALOG } from "../src/catalog";
import {
  buildRailModel,
  withSource,
  upgradeHref,
  isActiveProduct,
  resolveActiveScreen,
  productTitle,
  ALL_PRODUCTS_HREF,
  type ShellScreen,
} from "../src/core";

const me = {
  viewerRole: "admin" as const,
  isPrimaryBuyer: true,
  products: [
    { code: "call_analyzer", state: "launch" as const, appUrl: "https://callanalyzer.revheat.com/app", lockReason: null, billingStatus: "active" },
    { code: "all_access", state: "launch" as const, appUrl: "https://app.revheat.com/", lockReason: null, billingStatus: "active", isBundle: true },
    { code: "icp_builder", state: "available" as const, appUrl: "https://icp.revheat.com/app", lockReason: null, billingStatus: null },
  ],
};

describe("buildRailModel (live path)", () => {
  const m = buildRailModel({ me, degraded: false, productCodesFallback: [], catalog: PRODUCT_CATALOG });
  it("puts launched non-bundle products in entitled", () => {
    expect(m.entitled.map((p) => p.code)).toEqual(["call_analyzer"]);
  });
  it("never puts the bundle in entitled", () => {
    expect(m.entitled.some((p) => p.isBundle)).toBe(false);
  });
  it("puts available/locked/needs_grant in upsell", () => {
    expect(m.upsell.map((p) => p.code)).toEqual(["icp_builder"]);
  });
  it("admin buyer canBuy", () => {
    expect(m.canBuy).toBe(true);
    expect(m.isViewerAdmin).toBe(true);
  });
});

describe("buildRailModel (degraded path)", () => {
  it("synthesizes entitled from productCodesFallback, minus bundle", () => {
    const m = buildRailModel({ me: null, degraded: true, productCodesFallback: ["all_access", "quotafit"], catalog: PRODUCT_CATALOG });
    expect(m.entitled.map((p) => p.code)).toEqual(["quotafit"]);
    expect(m.upsell).toEqual([]);
    expect(m.canBuy).toBe(false);
  });
});

describe("buildRailModel (consulting-only exclusion)", () => {
  it("never shows a consultingOnly product in entitled, even when launched + owned", () => {
    const meWithConsulting = {
      viewerRole: "admin" as const,
      isPrimaryBuyer: true,
      products: [
        { code: "sell_playbook_consulting", state: "launch" as const, appUrl: "https://app.revheat.com", lockReason: null, billingStatus: "active" },
      ],
    };
    const m = buildRailModel({ me: meWithConsulting, degraded: false, productCodesFallback: [], catalog: PRODUCT_CATALOG });
    expect(m.entitled.map((p) => p.code)).toEqual([]);
  });
  it("never offers a consultingOnly product in upsell", () => {
    const meWithConsulting = {
      viewerRole: "admin" as const,
      isPrimaryBuyer: true,
      products: [
        { code: "sell_playbook_consulting", state: "available" as const, appUrl: "https://app.revheat.com", lockReason: null, billingStatus: null },
      ],
    };
    const m = buildRailModel({ me: meWithConsulting, degraded: false, productCodesFallback: [], catalog: PRODUCT_CATALOG });
    expect(m.upsell.map((p) => p.code)).toEqual([]);
  });
  it("excludes a consultingOnly product from the degraded fallback rail", () => {
    const m = buildRailModel({ me: null, degraded: true, productCodesFallback: ["sell_playbook_consulting", "quotafit"], catalog: PRODUCT_CATALOG });
    expect(m.entitled.map((p) => p.code)).toEqual(["quotafit"]);
  });
});

describe("helpers", () => {
  it("withSource appends source=sidebar", () => {
    expect(withSource("https://icp.revheat.com/app")).toBe("https://icp.revheat.com/app?source=sidebar");
  });
  it("upgradeHref points at the PORTAL's upgrade page, absolutely", () => {
    // Relative would resolve against icp.revheat.com / readiness.revheat.com,
    // neither of which has a /products route — the link 404'd until v1.4.0.
    expect(upgradeHref("icp-builder", "sidebar")).toBe(
      "https://app.revheat.com/products/icp-builder/upgrade?source=sidebar",
    );
  });
  it("isActiveProduct matches training_vault under /vault", () => {
    const vault = { code: "training_vault", slug: "training-vault", title: "", description: "", appUrl: "", state: "launch" as const, lockReason: null, billingStatus: null };
    expect(isActiveProduct(vault, "/vault/module-3")).toBe(true);
  });
});

describe("buildRailModel (per-org sidebar switch)", () => {
  const hiddenMe = {
    ...me,
    products: [
      { ...me.products[0], sidebarHidden: true },
      me.products[1],
      { ...me.products[2], sidebarHidden: true },
      { code: "trend_finder", state: "launch" as const, appUrl: "https://trends.revheat.com/app", lockReason: null, billingStatus: "active", sidebarHidden: false },
    ],
  };
  const m = buildRailModel({ me: hiddenMe, degraded: false, productCodesFallback: [], catalog: PRODUCT_CATALOG });
  it("drops a hidden owned product from entitled without touching the others", () => {
    expect(m.entitled.map((p) => p.code)).toEqual(["trend_finder"]);
  });
  it("drops a hidden row from upsell too", () => {
    expect(m.upsell).toEqual([]);
  });
  it("treats an absent flag as shown", () => {
    const plain = buildRailModel({ me, degraded: false, productCodesFallback: [], catalog: PRODUCT_CATALOG });
    expect(plain.entitled.map((p) => p.code)).toEqual(["call_analyzer"]);
  });
});

describe("resolveActiveScreen", () => {
  const screens: ShellScreen[] = [
    { label: "Overview", href: "/app" },
    { label: "Reports", href: "/app/reports" },
  ];

  it("10a: longest matching prefix wins", () => {
    const result = resolveActiveScreen(screens, "/app/reports/42");
    expect(result.find((s) => s.label === "Reports")!.active).toBe(true);
    expect(result.find((s) => s.label === "Overview")!.active).toBe(false);
  });

  it("10b: an exact match on the shorter path wins when the longer one is not a prefix", () => {
    const result = resolveActiveScreen(screens, "/app");
    expect(result.find((s) => s.label === "Overview")!.active).toBe(true);
    expect(result.find((s) => s.label === "Reports")!.active).toBe(false);
  });

  it("10c: segment-boundary rule — /appendix does not match /app", () => {
    const result = resolveActiveScreen(screens, "/appendix");
    expect(result.every((s) => s.active === false)).toBe(true);
  });

  it("10d: an explicit active wins over derivation, for the whole array", () => {
    const explicit: ShellScreen[] = [
      { label: "Reports", href: "/app/reports" },
      { label: "Overview", href: "/app", active: true },
    ];
    const result = resolveActiveScreen(explicit, "/app/reports");
    expect(result.find((s) => s.label === "Overview")!.active).toBe(true);
    expect(result.find((s) => s.label === "Reports")!.active).toBe(false);
  });

  it("10e: external items are never derived active", () => {
    const withExternal: ShellScreen[] = [
      { label: "Docs", href: "https://docs.revheat.com/x", external: true },
      { label: "Home", href: "/app" },
    ];
    const result = resolveActiveScreen(withExternal, "/app");
    expect(result.find((s) => s.label === "Docs")!.active).toBe(false);
    expect(result.find((s) => s.label === "Home")!.active).toBe(true);
  });

  it("10f: absolute hrefs are compared on pathname only", () => {
    const absolute: ShellScreen[] = [
      { label: "Overview", href: "/app" },
      { label: "Reports", href: "https://trends.revheat.com/app/reports" },
    ];
    const result = resolveActiveScreen(absolute, "/app/reports");
    expect(result.find((s) => s.label === "Reports")!.active).toBe(true);
    expect(result.find((s) => s.label === "Overview")!.active).toBe(false);
  });

  it("10i: a trailing slash on href does not defeat the match", () => {
    const trailing: ShellScreen[] = [{ label: "Overview", href: "/app/" }];
    const result = resolveActiveScreen(trailing, "/app");
    expect(result.find((s) => s.label === "Overview")!.active).toBe(true);
  });

  it("10j: activePath keeps matching with a query string or a hash", () => {
    const withQuery = resolveActiveScreen(screens, "/app/reports?tab=1");
    expect(withQuery.find((s) => s.label === "Reports")!.active).toBe(true);
    const withHash = resolveActiveScreen(screens, "/app#top");
    expect(withHash.find((s) => s.label === "Overview")!.active).toBe(true);
  });

  it("10k: does not mutate the input array or its items", () => {
    const input: ShellScreen[] = [{ label: "Overview", href: "/app" }];
    const snapshot = JSON.parse(JSON.stringify(input));
    resolveActiveScreen(input, "/app");
    expect(input).toEqual(snapshot);
  });

  it("10l: duplicate hrefs — the first wins the tie", () => {
    const dupes: ShellScreen[] = [
      { label: "First", href: "/app" },
      { label: "Second", href: "/app" },
    ];
    const result = resolveActiveScreen(dupes, "/app");
    expect(result.find((s) => s.label === "First")!.active).toBe(true);
    expect(result.find((s) => s.label === "Second")!.active).toBe(false);
    // Same tie after trailing-slash normalisation: "/app" and "/app/" are
    // the same path, so the earlier item still wins regardless of the slash.
    const slashDupes: ShellScreen[] = [
      { label: "Overview", href: "/app" },
      { label: "Home", href: "/app/" },
    ];
    const r2 = resolveActiveScreen(slashDupes, "/app");
    expect(r2.map((s) => s.active)).toEqual([true, false]);
    const r3 = resolveActiveScreen([...slashDupes].reverse(), "/app");
    expect(r3.map((s) => s.active)).toEqual([true, false]);
  });

  it("10m: href \"/\" is a catch-all that matches every path", () => {
    const catchAll: ShellScreen[] = [{ label: "Root", href: "/" }];
    expect(resolveActiveScreen(catchAll, "/anything/at/all")[0]!.active).toBe(true);
    expect(resolveActiveScreen(catchAll, "/")[0]!.active).toBe(true);

    const withMoreSpecific: ShellScreen[] = [
      { label: "Root", href: "/" },
      { label: "Reports", href: "/app/reports" },
    ];
    const result = resolveActiveScreen(withMoreSpecific, "/app/reports");
    expect(result.find((s) => s.label === "Reports")!.active).toBe(true);
    expect(result.find((s) => s.label === "Root")!.active).toBe(false);
  });
});

describe("productTitle", () => {
  it("10g: returns the catalog title for a known code, and undefined for unknown/undefined", () => {
    expect(productTitle("trend_finder", PRODUCT_CATALOG)).toBe("Trend Finder");
    expect(productTitle("no_such_code", PRODUCT_CATALOG)).toBeUndefined();
    expect(productTitle(undefined, PRODUCT_CATALOG)).toBeUndefined();
  });
});

describe("ALL_PRODUCTS_HREF", () => {
  it("10h: points at the portal home, tagged as a sidebar referral", () => {
    expect(ALL_PRODUCTS_HREF).toBe("https://app.revheat.com/?source=sidebar");
  });
});
