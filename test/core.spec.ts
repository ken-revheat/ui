import { describe, it, expect } from "vitest";
import { PRODUCT_CATALOG } from "../src/catalog";
import { buildRailModel, withSource, upgradeHref, isActiveProduct } from "../src/core";

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
