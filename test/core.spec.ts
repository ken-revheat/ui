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

describe("helpers", () => {
  it("withSource appends source=sidebar", () => {
    expect(withSource("https://icp.revheat.com/app")).toBe("https://icp.revheat.com/app?source=sidebar");
  });
  it("upgradeHref builds the /products/<slug>/upgrade path", () => {
    expect(upgradeHref("icp-builder", "sidebar")).toBe("/products/icp-builder/upgrade?source=sidebar");
  });
  it("isActiveProduct matches training_vault under /vault", () => {
    const vault = { code: "training_vault", slug: "training-vault", title: "", description: "", appUrl: "", state: "launch" as const, lockReason: null, billingStatus: null };
    expect(isActiveProduct(vault, "/vault/module-3")).toBe(true);
  });
});
