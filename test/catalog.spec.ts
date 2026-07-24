import { describe, it, expect } from "vitest";
import { PRODUCT_CATALOG, findProductByCode, findProductBySlug } from "../src/catalog";

describe("PRODUCT_CATALOG", () => {
  it("has exactly 10 products", () => {
    expect(PRODUCT_CATALOG).toHaveLength(10);
  });
  it("marks all_access as a bundle and training_vault as internal", () => {
    expect(findProductByCode("all_access")?.isBundle).toBe(true);
    expect(findProductByCode("training_vault")?.internal).toBe(true);
  });
  it("marks only sell_playbook_consulting unlaunched (trend_finder launched 2026-07-22)", () => {
    const unlaunched = PRODUCT_CATALOG.filter((p) => p.unlaunched).map((p) => p.code);
    expect(unlaunched).toEqual(["sell_playbook_consulting"]);
  });
  it("every slug is the underscore→hyphen transform of its code", () => {
    for (const p of PRODUCT_CATALOG) expect(p.slug).toBe(p.code.replace(/_/g, "-"));
  });
  it("resolves by slug", () => {
    expect(findProductBySlug("icp-builder")?.code).toBe("icp_builder");
  });
});
