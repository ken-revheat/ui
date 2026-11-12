import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AppShell } from "../src/react";

const products = [
  { code: "readiness_audit", state: "launch" as const, appUrl: "https://readiness.revheat.com/app", lockReason: null, billingStatus: "active" },
  { code: "icp_builder", state: "available" as const, appUrl: "https://icp.revheat.com/app", lockReason: null, billingStatus: null },
];

describe("AppShell", () => {
  it("renders the sidebar as a complementary landmark labelled 'RevHeat products'", () => {
    render(
      <AppShell
        identity={{ email: "ken@revheat.com", isInternal: true, roleLabel: "Admin" }}
        products={products}
        activePath="/app"
      >
        <main>content</main>
      </AppShell>
    );
    const rail = screen.getByRole("complementary", { name: "RevHeat products" });
    expect(rail).toBeTruthy();
  });

  it("lists owned products only, and never an unowned one", () => {
    render(
      <AppShell identity={{ email: "ken@revheat.com", isInternal: false, roleLabel: null }} products={products} activePath="/app">
        <main>content</main>
      </AppShell>
    );
    expect(screen.getByRole("link", { name: /Website Readiness Audit/ })).toBeTruthy();
    expect(screen.queryByText(/ICP Builder/)).toBeNull();
  });

  it("offers RevHeat staff admin in the account menu only when isInternal, never as a header link", () => {
    const { rerender } = render(
      <AppShell identity={{ email: "x@y.com", isInternal: false, roleLabel: null }} products={[]} activePath="/app" adminHref="/admin/orgs">
        <main />
      </AppShell>
    );
    fireEvent.click(screen.getByRole("button", { name: /x@y\.com/ }));
    expect(screen.queryByRole("menuitem", { name: "RevHeat staff admin" })).toBeNull();
    rerender(
      <AppShell identity={{ email: "x@y.com", isInternal: true, roleLabel: "Admin" }} products={[]} activePath="/app" adminHref="/admin/orgs">
        <main />
      </AppShell>
    );
    expect(screen.getByRole("menuitem", { name: "RevHeat staff admin" }).getAttribute("href")).toBe("/admin/orgs");
    expect(within(document.querySelector("header")!).queryByRole("link", { name: /Admin/ })).toBeNull();
  });
});
