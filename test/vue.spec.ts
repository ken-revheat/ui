import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { screen, within, fireEvent, waitFor } from "@testing-library/dom";
import { h, nextTick } from "vue";
import { AppShell, type AppShellIdentity } from "../src/vue.js";

/**
 * Same stub as test/shell.spec.tsx:12-31 — happy-dom reports innerWidth 1024
 * and ships no matchMedia that tracks it, so the shell is "desktop" unless a
 * test opts in with `setViewport(true)`.
 */
let listeners: Array<() => void> = [];
let narrow = false;
function setViewport(isNarrow: boolean) {
  narrow = isNarrow;
  listeners.forEach((fn) => fn());
}
beforeEach(() => {
  listeners = [];
  narrow = false;
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return narrow;
    },
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    removeEventListener: (_: string, fn: () => void) => {
      listeners = listeners.filter((l) => l !== fn);
    },
  })) as unknown as typeof window.matchMedia;
});

const products = [
  {
    code: "readiness_audit",
    state: "launch" as const,
    appUrl: "https://readiness.revheat.com/app",
    lockReason: null,
    billingStatus: "active",
  },
  {
    code: "trend_finder",
    state: "launch" as const,
    appUrl: "https://trends.revheat.com/app",
    lockReason: null,
    billingStatus: "active",
  },
  {
    code: "icp_builder",
    state: "available" as const,
    appUrl: "https://icp.revheat.com/app",
    lockReason: null,
    billingStatus: null,
  },
];

const member: AppShellIdentity = { email: "rep@acme.com", isInternal: false, roleLabel: "Rep" };

// Shared fixtures for the v2 navigation-model tests — see shell-v2-nav-model
// plan §4.2. `hiddenProducts` adds a launched-but-hidden row (the per-org
// sidebar switch) on top of `products`.
const hiddenProducts = [
  ...products,
  {
    code: "quotafit",
    state: "launch" as const,
    appUrl: "https://hire.revheat.com/app",
    lockReason: null,
    billingStatus: "active",
    sidebarHidden: true,
  },
];
const screens2 = [
  { label: "Overview", href: "/app" },
  { label: "Reports", href: "/app/reports" },
];

const currentLinks = () =>
  screen
    .getAllByRole("link")
    .filter((el) => el.getAttribute("aria-current") === "page")
    .map((el) => el.textContent);

// Mounted wrappers accumulate here so `afterEach` can clean every one of
// them up, even the ones a test unmounted itself along the way (VTU has no
// auto-cleanup, unlike @testing-library/react).
let mounts: VueWrapper[] = [];
function mountShell(
  props: Record<string, unknown> = {},
  slots: Record<string, unknown> = {},
): VueWrapper {
  const wrapper = mount(AppShell as any, {
    attachTo: document.body,
    props: { identity: member, products, activePath: "/app", ...props },
    // Slot content is built with h(), never a template string — this
    // package resolves plain "vue" (no compiler build guaranteed), and the
    // whole point of src/vue.ts is that it needs no SFC compiler either.
    slots: { default: () => h("main", {}, "content"), ...slots },
  });
  mounts.push(wrapper);
  return wrapper;
}
afterEach(() => {
  for (const w of mounts) {
    try {
      w.unmount();
    } catch {
      // already unmounted by the test itself
    }
  }
  mounts = [];
  document.body.innerHTML = "";
  vi.useRealTimers();
});

// The v2 navigation model — ports shell-v2-nav-model plan §4.2 tests 1-8
// (identical fixtures/assertions to test/shell.spec.tsx's "navigation model
// (v2)" describe) plus 5 of the drawer tests, proving the Vue renderer
// produces the same DOM contract as React.
describe("navigation model (v2)", () => {
  const nameOf = (el: Element) => el.getAttribute("aria-label") ?? el.textContent?.trim();

  it("1: lists owned products only — no Available nav, no upsell rows, no hidden/unowned rows", async () => {
    mountShell({ products: hiddenProducts });
    await nextTick();
    const rail = document.querySelector<HTMLElement>("aside.rh-rail")!;
    const linkNames = within(rail)
      .getAllByRole("link")
      .map((el) => nameOf(el));
    expect(linkNames).toEqual([
      "RevHeat home",
      "Website Readiness Audit",
      "Trend Finder",
      "All products →",
    ]);
    expect(screen.queryByRole("navigation", { name: "Available" })).toBeNull();
    expect(document.querySelectorAll(".rh-rail__item--upsell")).toHaveLength(0);
    expect(screen.queryByText(/QuotaFit/)).toBeNull();
    expect(screen.queryByText(/ICP Builder/)).toBeNull();
  });

  it("2: the All-products row is last in the rail, with the portal-home href and its label text", async () => {
    mountShell();
    await nextTick();
    const rail = document.querySelector<HTMLElement>("aside.rh-rail")!;
    const links = Array.from(rail.querySelectorAll("a"));
    const allProducts = links[links.length - 1]!;
    expect(allProducts.className).toContain("rh-row--all");
    expect(allProducts.getAttribute("href")).toBe("https://app.revheat.com/?source=sidebar");
    expect(allProducts.textContent).toBe("All products →");
  });

  it("3: currentProductCode highlights its row and names the product in the banner", async () => {
    mountShell({ currentProductCode: "trend_finder" });
    await nextTick();
    expect(currentLinks()).toEqual(["Trend Finder"]);
    expect(document.querySelector(".rh-banner__product")!.textContent).toBe("Trend Finder");
  });

  it("4: an unrecognised product code shows no banner title and highlights nothing", async () => {
    mountShell({ currentProductCode: "not_a_product" });
    await nextTick();
    expect(document.querySelector(".rh-banner__product")).toBeNull();
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
  });

  it("5: renders the screen menu, deriving the active tab, and lets an explicit active win", async () => {
    const wrapper = mountShell({ screens: screens2, activePath: "/app/reports" });
    await nextTick();
    const menu = screen.getByRole("navigation", { name: "Screens" });
    expect(within(menu).getAllByRole("link").map((el) => el.textContent)).toEqual([
      "Overview",
      "Reports",
    ]);
    expect(within(menu).getByRole("link", { name: "Reports" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      within(menu).getByRole("link", { name: "Overview" }).getAttribute("aria-current"),
    ).toBeNull();

    await wrapper.setProps({
      screens: [{ ...screens2[0]!, active: true }, screens2[1]!],
    });
    const menu2 = screen.getByRole("navigation", { name: "Screens" });
    expect(
      within(menu2).getByRole("link", { name: "Overview" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(menu2).getByRole("link", { name: "Reports" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("6: the screen menu does not render with fewer than two screens, or when omitted", async () => {
    const empty = mountShell({ screens: [] });
    await nextTick();
    expect(document.querySelector(".rh-menu")).toBeNull();
    empty.unmount();
    document.body.innerHTML = "";

    const single = mountShell({ screens: [screens2[0]!] });
    await nextTick();
    expect(document.querySelector(".rh-menu")).toBeNull();
    single.unmount();
    document.body.innerHTML = "";

    mountShell();
    await nextTick();
    expect(document.querySelector(".rh-menu")).toBeNull();
  });

  it("7: renders headerActions inside .rh-banner__actions, and omits the wrapper when absent", async () => {
    const withActions = mountShell(
      {},
      { "header-actions": () => h("button", { type: "button" }, "Export") },
    );
    await nextTick();
    const banner = document.querySelector(".rh-banner")!;
    const actions = banner.querySelector(".rh-banner__actions");
    expect(actions).not.toBeNull();
    expect(within(actions as HTMLElement).getByRole("button", { name: "Export" })).toBeTruthy();
    withActions.unmount();
    document.body.innerHTML = "";

    mountShell();
    await nextTick();
    expect(document.querySelector(".rh-banner__actions")).toBeNull();
  });

  it("8: degraded mode still lists fallback products (minus a bundle), with the All-products row present", async () => {
    mountShell({ degraded: true, products: [], productCodesFallback: ["all_access", "quotafit"] });
    await nextTick();
    expect(screen.getByRole("link", { name: "QuotaFit" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "All-Access" })).toBeNull();
    const rail = document.querySelector<HTMLElement>("aside.rh-rail")!;
    expect(within(rail).getByRole("link", { name: "All products →" })).toBeTruthy();
  });
});

// Ported from test/shell.spec.tsx's "drawer" describe — 5 of the 17 React
// cases, enough to prove the Teleport-based drawer produces the same modal
// contract (dialog role, aria-modal, aria-controls, focus trap, scroll
// lock) as React's createPortal one. Everything here runs at phone width;
// at 1024px the wide rail is mounted instead and the drawer is unreachable.
describe("drawer (ported)", () => {
  beforeEach(() => setViewport(true));

  const menuButton = () => screen.getByRole("button", { name: "Open product menu" });
  const closeButton = () => screen.getByRole("button", { name: "Close product menu" });

  it("opens the rail as a modal dialog and moves focus into it", async () => {
    mountShell();
    await nextTick();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(menuButton().getAttribute("aria-controls")).toBeNull();

    fireEvent.click(menuButton());
    await nextTick();
    const drawer = screen.getByRole("dialog", { name: "RevHeat products" });
    expect(drawer.getAttribute("aria-modal")).toBe("true");
    // aria-controls must name a node that EXISTS — it fails axe otherwise, and
    // the drawer is unmounted whenever it is closed.
    expect(menuButton().getAttribute("aria-controls")).toBe(drawer.id);
    expect(within(drawer).getByRole("link", { name: /Trend Finder/ })).toBeTruthy();

    // Focusing the first focusable happens inside RhDrawer's onMounted, past
    // its own internal `await nextTick()` — poll for it rather than guessing
    // how many microtask hops that takes.
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(drawer).getByRole("button", { name: "Close product menu" }),
      );
    });
  });

  it("locks the page behind the scrim and unlocks it again", async () => {
    mountShell();
    await nextTick();
    fireEvent.click(menuButton());
    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    fireEvent.click(closeButton());
    await nextTick();
    // Released the moment closing starts, not one animation later: the panel
    // is still mounted here and the page must already scroll.
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape from anywhere, not only from inside the panel", async () => {
    // Regression: with the handler on the panel, clicking dead space inside it
    // blurs to <body> and Escape silently stops working.
    mountShell();
    await nextTick();
    fireEvent.click(menuButton());
    await nextTick();
    const drawer = screen.getByRole("dialog");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(drawer).getByRole("button", { name: "Close product menu" }),
      );
    });

    (document.activeElement as HTMLElement)?.blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document, { key: "Escape" });
    await nextTick();
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps Tab inside the panel, and skips elements that cannot take focus", async () => {
    // The custom account block carries a disabled button. A trap that hands
    // focus to it silently does nothing, and the user's Tab key appears to
    // stop working — so it must not be part of the cycle.
    mountShell(
      {},
      {
        "account-menu": () => [
          h("a", { href: "https://app.revheat.com/account" }, "Account"),
          h("button", { type: "button", disabled: true }, "Request access"),
        ],
      },
    );
    await nextTick();
    fireEvent.click(menuButton());
    await nextTick();
    const drawer = screen.getByRole("dialog");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(drawer).getByRole("button", { name: "Close product menu" }),
      );
    });

    const last = within(drawer).getByRole("link", { name: "Account" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton());
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("pulls focus back when it has escaped the panel", async () => {
    mountShell();
    await nextTick();
    fireEvent.click(menuButton());
    await nextTick();
    const drawer = screen.getByRole("dialog");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(drawer).getByRole("button", { name: "Close product menu" }),
      );
    });

    (document.activeElement as HTMLElement)?.blur();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton());
  });
});

// The hamburger also carries aria-expanded, so identify the account trigger
// by the one thing only it shows: the signed-in address. Same approach as
// test/shell.spec.tsx's accountTrigger().
const accountTrigger = (scope: HTMLElement = document.body) =>
  within(scope).getByRole("button", { name: /rep@acme\.com/ });

describe("account menu", () => {
  it("does not warn when identity carries neither isStaff nor isInternal", async () => {
    // Regression: RhAccountMenu's `isStaff` prop was declared `required:
    // true`, so an identity lacking BOTH flags (isStaff ?? isInternal ===
    // undefined) fed it `undefined` and Vue warned on every mount.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bareIdentity = { email: "bare@acme.com", roleLabel: null } as unknown as AppShellIdentity;
    mountShell({ identity: bareIdentity });
    await nextTick();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("renders a button that emits sign-out when the app listens for it", async () => {
    let called = 0;
    mountShell({ onSignOut: () => (called += 1) });
    await nextTick();
    fireEvent.click(accountTrigger());
    await nextTick();
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });
    expect(signOut.tagName).toBe("BUTTON");
    fireEvent.click(signOut);
    expect(called).toBe(1);
  });

  it("renders the portal logout anchor when the app does not listen for sign-out", async () => {
    mountShell();
    await nextTick();
    fireEvent.click(accountTrigger());
    await nextTick();
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });
    expect(signOut.tagName).toBe("A");
    expect(signOut.getAttribute("href")).toBe(
      `https://app.revheat.com/logout?next=${encodeURIComponent(window.location.origin)}`,
    );
  });
});

describe("drawer unmount race", () => {
  const menuButton = () => screen.getByRole("button", { name: "Open product menu" });

  beforeEach(() => setViewport(true));

  it("releases the scroll lock and drops the keydown trap when unmounted before the mount hook's own nextTick resolves", async () => {
    // Regression: the scroll lock and the document keydown trap used to be
    // taken AFTER `await nextTick()` in RhDrawer's onMounted. Unmounting the
    // component inside that window meant onBeforeUnmount had already run by
    // the time the continuation resumed, so it re-applied
    // `body.style.overflow = "hidden"` and an orphan keydown listener
    // against a dead instance — the page could never scroll again, and Tab
    // was silently swallowed forever.
    const wrapper = mountShell();
    await nextTick();
    fireEvent.click(menuButton());
    // One test-level `await nextTick()` flushes Vue's pending update, which
    // mounts RhDrawer and runs its onMounted synchronously up to (but not
    // past) its OWN internal `await nextTick()` — the lock and the listener
    // are taken before that point, so they are already live here, while
    // the focus step past the await has not run yet.
    await nextTick();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");

    wrapper.unmount();
    await nextTick();
    await nextTick();

    expect(document.body.style.overflow).toBe("");
    const evt = fireEvent.keyDown(document, { key: "Tab", cancelable: true });
    expect(evt).toBe(true); // not defaultPrevented — no orphan listener caught it
  });
});
