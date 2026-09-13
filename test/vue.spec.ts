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
// happy-dom really follows an un-prevented anchor click (the off-origin
// "Portal"/"Docs" links in the navigate tests), which moves the shared
// document's URL — and with it the origin every later same-origin check
// compares against. Put it back after every test.
const INITIAL_HREF = window.location.href;
afterEach(() => {
  if (window.location.href !== INITIAL_HREF) window.location.href = INITIAL_HREF;
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

  it("6b: @navigate intercepts plain clicks on internal tabs only, and never modified clicks", async () => {
    const onNavigate = vi.fn();
    const screens = [
      ...screens2,
      { label: "Docs", href: "https://docs.revheat.com", external: true },
    ];
    const wrapper = mountShell({ screens, activePath: "/app", onNavigate });
    await nextTick();
    const menu = screen.getByRole("navigation", { name: "Screens" });

    // Plain left-click on an internal tab: intercepted, router gets the href.
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    within(menu).getByRole("link", { name: "Reports" }).dispatchEvent(plain);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/app/reports");
    expect(wrapper.emitted("navigate")).toEqual([["/app/reports"]]);
    expect(plain.defaultPrevented).toBe(true);

    // Every "open elsewhere" gesture is left to the browser: ⌘ (mac new tab),
    // ctrl (Windows/Linux new tab), shift (new window), alt (download /
    // reading list), and a non-primary button.
    for (const mod of [
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...mod });
      within(menu).getByRole("link", { name: "Reports" }).dispatchEvent(ev);
      expect(onNavigate, JSON.stringify(mod)).toHaveBeenCalledTimes(1);
      expect(ev.defaultPrevented, JSON.stringify(mod)).toBe(false);
    }

    // External tabs are never intercepted.
    const ext = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    within(menu).getByRole("link", { name: "Docs" }).dispatchEvent(ext);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(ext.defaultPrevented).toBe(false);
  });

  it("6d: an off-origin href that forgot external:true is still left to the browser", async () => {
    const onNavigate = vi.fn();
    // Captured up front: happy-dom really navigates on an un-prevented anchor
    // click, so the page's origin changes once the Portal link is clicked.
    const here = `${window.location.origin}/app/here`;
    mountShell({
      screens: [
        ...screens2,
        { label: "Portal", href: "https://app.revheat.com/account" },
        { label: "Here", href: here },
      ],
      activePath: "/app",
      onNavigate,
    });
    await nextTick();
    const menu = screen.getByRole("navigation", { name: "Screens" });
    // A same-origin ABSOLUTE href is routed like a relative one — and the
    // hook is handed the IN-APP form, stripped of the origin. `href` still
    // carries what the caller passed; only what reaches the navigate listener
    // is normalised, because `router.push("http://localhost:3000/app/here")`
    // is not a route in vue-router 4, it is a path called
    // "/http:/localhost:3000/app/here" that warns "No match found".
    const same = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    const hereLink = within(menu).getByRole("link", { name: "Here" });
    expect(hereLink.getAttribute("href")).toBe(here);
    hereLink.dispatchEvent(same);
    expect(onNavigate).toHaveBeenCalledWith("/app/here");
    expect(same.defaultPrevented).toBe(true);
    // …while the off-origin one is not intercepted. Clicked last: the browser
    // follows it, and the page's origin is app.revheat.com from here on.
    onNavigate.mockClear();
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    within(menu).getByRole("link", { name: "Portal" }).dispatchEvent(ev);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it("6c: without a navigate listener, screen tabs are plain links (default not prevented)", async () => {
    mountShell({ screens: screens2, activePath: "/app" });
    await nextTick();
    const menu = screen.getByRole("navigation", { name: "Screens" });
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    within(menu).getByRole("link", { name: "Reports" }).dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
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

// ── v2.2.0 ──────────────────────────────────────────────────────────────
// v2.1.0 wired the click-to-route hook to the screen tabs only. Inside the
// portal EVERY link the shell renders is same-origin, so leaving the rail on
// plain anchors meant adopting the shared shell would have traded the
// portal's instant in-app navigation for a full page reload on every product
// row, on "All products", on the R mark and on each account-menu item. The
// same interception must never fire in a product app, where those same hrefs
// are off-origin and MUST leave the app.
describe("client-side navigation reaches the whole rail (v2.2)", () => {
  // The portal is served FROM app.revheat.com — the one origin where the
  // rail's own links are same-origin. afterEach puts the URL back.
  const asPortal = () => {
    window.location.href = "https://app.revheat.com/vault";
  };

  const clickPlain = (el: Element): MouseEvent => {
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    el.dispatchEvent(ev);
    return ev;
  };

  // `training_vault`'s catalog appUrl is https://app.revheat.com/vault — the
  // one owned product the portal hosts itself.
  const portalProducts = [
    ...products,
    {
      code: "training_vault",
      state: "launch" as const,
      appUrl: "https://app.revheat.com/vault",
      lockReason: null,
      billingStatus: "active",
    },
  ];

  const mountAsPortal = async (props: Record<string, unknown> = {}) => {
    asPortal();
    const onNavigate = vi.fn();
    mountShell({
      products: portalProducts,
      activePath: "/vault",
      currentProductCode: "training_vault",
      onNavigate,
      ...props,
    });
    await nextTick();
    return onNavigate;
  };

  const rail = () => screen.getByRole("complementary", { name: "RevHeat products" });

  it("routes a same-origin product row, handing the router a PATH not a URL", async () => {
    const onNavigate = await mountAsPortal();
    const row = within(rail()).getByRole("link", { name: "Training Vault" });
    // The anchor keeps the absolute href — cmd-click and "copy link address"
    // have to keep working, and outside the portal this href really is
    // cross-origin.
    expect(row.getAttribute("href")).toBe("https://app.revheat.com/vault?source=sidebar");
    expect(clickPlain(row).defaultPrevented).toBe(true);
    // …but the listener gets path+query. Absolute is not a no-op to
    // vue-router 4: it resolves the whole string as a path and lands on
    // "/https:/app.revheat.com/vault" with "No match found".
    expect(onNavigate).toHaveBeenCalledWith("/vault?source=sidebar");
    // The query survives on purpose — `?source=sidebar` is how the portal's
    // upgrade page attributes the click.
  });

  it("routes All products, the R mark and the banner's ← Portal link", async () => {
    const onNavigate = await mountAsPortal();
    for (const el of [
      within(rail()).getByRole("link", { name: "All products →" }),
      rail().querySelector(".rh-rail__home")!,
      document.querySelector(".rh-banner__portal")!,
      document.querySelector(".rh-banner__brand")!,
    ]) {
      onNavigate.mockClear();
      expect(clickPlain(el).defaultPrevented, el.className).toBe(true);
      expect(onNavigate, el.className).toHaveBeenCalledTimes(1);
    }
  });

  it("routes the account-menu items but never Sign out", async () => {
    const onNavigate = await mountAsPortal({ onSignOut: () => {} });
    for (const label of ["Account settings", "Team & Access", "Manage products"]) {
      // Reopened each pass: from v2.2.0 an in-app route CLOSES the pop-up
      // (see the next test), so the menu is gone after the first click.
      fireEvent.click(accountTrigger());
      await nextTick();
      onNavigate.mockClear();
      const item = screen.getByRole("menuitem", { name: label });
      expect(clickPlain(item).defaultPrevented, label).toBe(true);
      expect(onNavigate, label).toHaveBeenCalledTimes(1);
      await nextTick();
    }
    // Sign out must reach the server, so it is never routed. With a sign-out
    // listener it is a BUTTON, and a button has no href to intercept.
    fireEvent.click(accountTrigger());
    await nextTick();
    expect(screen.getByRole("menuitem", { name: "Sign out" }).tagName).toBe("BUTTON");
  });

  it("leaves Sign out a plain link in its ANCHOR form, where interception WOULD be possible", async () => {
    // The other half of the test above, which used to claim this in a comment
    // and never exercise it (LOW, 2026-09-12 re-review). With no sign-out
    // listener the shell renders Sign out as an <a> to the portal's logout
    // URL — which, inside the portal, is same-origin and therefore exactly
    // the shape `shellNavHandler` would otherwise intercept. It must not:
    // signing out is a server round-trip that clears a cookie, and routing it
    // client-side would leave the user signed in on a logged-out page.
    const onNavigate = await mountAsPortal();
    fireEvent.click(accountTrigger());
    await nextTick();
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });
    expect(signOut.tagName).toBe("A");
    expect(signOut.getAttribute("href")).toContain("/logout?next=");
    expect(clickPlain(signOut).defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("closes the account pop-up once a menu item routes in-app", async () => {
    // Until v2.2.0 nothing ever closed this menu on its own: every item was a
    // full page load, which took the whole DOM with it. Now the page survives
    // the click, so the pop-up would sit open over the destination — and the
    // trigger's aria-expanded would lie to a screen reader.
    const onNavigate = await mountAsPortal({ onSignOut: () => {} });
    fireEvent.click(accountTrigger());
    await nextTick();
    expect(screen.getByRole("menu")).toBeTruthy();
    clickPlain(screen.getByRole("menuitem", { name: "Account settings" }));
    await nextTick();
    expect(onNavigate).toHaveBeenCalledWith("/account");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(accountTrigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("leaves the account pop-up open on a cmd-click, which opens a new tab", async () => {
    // The close is keyed on `defaultPrevented`, not on "a handler exists" —
    // a modified click is NOT a navigation of this page, so the menu the user
    // is still looking at must stay put.
    const onNavigate = await mountAsPortal({ onSignOut: () => {} });
    fireEvent.click(accountTrigger());
    await nextTick();
    const item = screen.getByRole("menuitem", { name: "Account settings" });
    const ev = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    });
    item.dispatchEvent(ev);
    await nextTick();
    expect(ev.defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("routes the banner's Admin link, including a RELATIVE adminHref", async () => {
    // `adminHref` is the only consumer-supplied href in the intercepted set,
    // so it is the only one that can be relative — and a relative href is
    // same-origin in EVERY app, not just the portal. That is the contract
    // (same origin + a navigate listener = route in-app), asserted here so
    // nobody "fixes" it into an origin check against PORTAL_ORIGIN.
    const onNavigate = await mountAsPortal({
      identity: { ...member, isStaff: true },
      adminHref: "/admin/orgs",
    });
    const link = document.querySelector<HTMLAnchorElement>(".rh-banner__admin")!;
    expect(link.getAttribute("href")).toBe("/admin/orgs");
    expect(clickPlain(link).defaultPrevented).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith("/admin/orgs");
  });

  it("leaves the banner's Admin link alone in a product app, where it is off-origin", async () => {
    // No `asPortal()` — this is Call Analyzer / Directive on its own origin.
    // Routing app.revheat.com/admin/orgs through THEIR router would land on
    // their own 404. (happy-dom really follows the un-prevented click; the
    // suite's afterEach puts the URL back.)
    const onNavigate = vi.fn();
    mountShell({
      identity: { ...member, isStaff: true },
      adminHref: "https://app.revheat.com/admin/orgs",
      currentProductCode: "call_analyzer",
      onNavigate,
    });
    await nextTick();
    const link = document.querySelector<HTMLAnchorElement>(".rh-banner__admin")!;
    expect(clickPlain(link).defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("never intercepts modified clicks, so cmd/ctrl/middle-click still opens a new tab", async () => {
    const onNavigate = await mountAsPortal();
    const row = within(rail()).getByRole("link", { name: "Training Vault" });
    for (const mod of [
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...mod });
      row.dispatchEvent(ev);
      expect(ev.defaultPrevented, JSON.stringify(mod)).toBe(false);
    }
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("without a navigate listener every rail link stays a plain browser link", async () => {
    asPortal();
    mountShell({ products: portalProducts, activePath: "/vault" });
    await nextTick();
    for (const el of [
      within(rail()).getByRole("link", { name: "Training Vault" }),
      within(rail()).getByRole("link", { name: "All products →" }),
      rail().querySelector(".rh-rail__home")!,
    ]) {
      expect(clickPlain(el).defaultPrevented, el.className).toBe(false);
    }
  });

  it("routes the banner's Admin link when it is the absolute portal URL", async () => {
    // What all five product consumers actually pass. It is same-origin ONLY
    // here, inside the portal. (Added in the v2.2.0 re-review — the React
    // suite had this case and the Vue mirror did not.)
    const onNavigate = await mountAsPortal({
      identity: { ...member, isStaff: true },
      adminHref: "https://app.revheat.com/admin/orgs",
    });
    const link = document.querySelector<HTMLAnchorElement>(".rh-banner__admin")!;
    expect(clickPlain(link).defaultPrevented).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith("/admin/orgs");
  });
  it("closes the account pop-up even when the router THROWS", async () => {
    // The `navItemOn` half of the guard the drawer tests pin for `navOn`.
    // Round 3 (2026-09-12) deleted `navItemOn`'s try/finally and the whole
    // suite stayed green — the code was right, nothing was watching it. Left
    // unwatched, a pop-up that survives a throwing route guard sits over the
    // page with focus trapped inside it and the trigger still reading
    // aria-expanded="true".
    const onNavigate = vi.fn(() => {
      throw new Error("route guard says no");
    });
    await mountAsPortal({ onNavigate });
    const trigger = accountTrigger();
    // Focus the trigger the way a real click does — fireEvent does not.
    trigger.focus();
    fireEvent.click(trigger);
    await nextTick();
    // Same contract as the drawer test: how the listener's exception surfaces
    // is the DOM implementation's business, the close is ours.
    try {
      clickPlain(screen.getByRole("menuitem", { name: "Account settings" }));
    } catch {
      /* the consumer's error, on whichever path it takes */
    }
    await nextTick();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // The React mirror also asserts focus is back on the trigger. Not asserted
    // here, and it is the HARNESS not the shell: Vue removes the menu on the
    // next tick, AFTER closeAndRefocus() has already focused the trigger, and
    // happy-dom resets activeElement to <body> on that removal. Measured
    // 2026-09-12 with the router NOT throwing either — same result — so this
    // is not the throw path losing focus.
  });


  // ── the drawer ────────────────────────────────────────────────────────
  // Mirror of test/shell.spec.tsx's "the drawer closes on an intercepted tap".
  // REGRESSION found in the v2.2.0 re-review: through v2.1.0 a rail row was a
  // plain browser link, so tapping one inside the drawer tore the document
  // down and the drawer never needed a close of its own. v2.2.0 calls
  // preventDefault on those same rows.
  describe("the drawer closes on an intercepted tap", () => {
    const menuButton = () => screen.getByRole("button", { name: "Open product menu" });

    const openDrawer = async (props: Record<string, unknown> = {}) => {
      setViewport(true);
      const onNavigate = await mountAsPortal(props);
      fireEvent.click(menuButton());
      await nextTick();
      return { onNavigate, drawer: screen.getByRole("dialog", { name: "RevHeat products" }) };
    };

    it("closes it when the row points at the page you are ALREADY on", async () => {
      // The case the `activePath` watcher cannot cover: the shell is mounted
      // at /vault and the row goes to /vault, so the consumer re-renders with
      // the SAME path and the watcher never fires. Left unfixed the panel
      // stays over the page focus-trapped and body-scroll-locked, and the tap
      // looks like it did nothing.
      const { onNavigate, drawer } = await openDrawer();
      const row = within(drawer).getByRole("link", { name: "Training Vault" });
      expect(clickPlain(row).defaultPrevented).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith("/vault?source=sidebar");
      await nextTick();
      // The panel stays MOUNTED for one exit animation by design, so "gone
      // from the DOM" is the wrong question — what must be true immediately is
      // that it has stopped being a modal holding the page.
      expect(menuButton().getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });

    it("closes it on a row that DOES change the path, without waiting for the router", async () => {
      const { drawer } = await openDrawer();
      const row = within(drawer).getByRole("link", { name: "All products →" });
      expect(clickPlain(row).defaultPrevented).toBe(true);
      await nextTick();
      expect(menuButton().getAttribute("aria-expanded")).toBe("false");
      expect(document.body.style.overflow).toBe("");
    });

    it("leaves it open on a cmd-click, which really does open a new tab", async () => {
      // Same rule as the account pop-up: `defaultPrevented` is the signal, not
      // "a handler ran". The user is staying on this page.
      const { onNavigate, drawer } = await openDrawer();
      const row = within(drawer).getByRole("link", { name: "Training Vault" });
      const ev = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        metaKey: true,
      });
      row.dispatchEvent(ev);
      await nextTick();
      expect(ev.defaultPrevented).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
      expect(menuButton().getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    });

    it("closes BOTH the account pop-up and the drawer when a menu item inside the drawer routes", async () => {
      // The only click path where two closers fire on one event: `navOn`'s
      // closeDrawer() and the account menu's own closeAndRefocus(). Nothing
      // pinned it before (MEDIUM, 2026-09-12 re-review) — every other
      // account-menu test clicks the DESKTOP rail's copy. A refactor of
      // either closer could leave the drawer up over the destination, or
      // bounce focus somewhere the phone user cannot see.
      const { onNavigate, drawer } = await openDrawer();
      fireEvent.click(accountTrigger(drawer));
      await nextTick();
      clickPlain(screen.getByRole("menuitem", { name: "Account settings" }));
      await nextTick();
      expect(onNavigate).toHaveBeenCalledWith("/account");
      expect(screen.queryByRole("menu")).toBeNull();
      expect(menuButton().getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });

    it("closes even when the consumer's router THROWS on the way out", async () => {
      // preventDefault() has already run by the time `navigate` is emitted, so
      // a consumer whose router raises synchronously (a route guard that
      // throws, a rejected push surfaced inline) used to skip the close and
      // strand the panel: focus-trapped, body scroll-locked, over a page that
      // never changed. `try/finally` in navOn is what makes this pass.
      // MEDIUM, 2026-09-12 re-review.
      const onNavigate = vi.fn(() => {
        throw new Error("route guard says no");
      });
      const { drawer } = await openDrawer({ onNavigate });
      const row = within(drawer).getByRole("link", { name: "Training Vault" });
      // Deliberately does not assert HOW the error surfaces — a listener
      // exception may be rethrown out of dispatchEvent or reported to the
      // window, and which one is the DOM implementation's business. What this
      // test owns is that the drawer did not survive it either way.
      try {
        clickPlain(row);
      } catch {
        /* the consumer's error, on whichever path it takes */
      }
      await nextTick();
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(menuButton().getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });
  });

  // Clicked last on purpose: happy-dom really follows an un-prevented anchor,
  // which moves the document's origin for everything after it.
  it("leaves an off-origin product row to the browser", async () => {
    const onNavigate = await mountAsPortal();
    const row = within(rail()).getByRole("link", { name: "Trend Finder" });
    expect(clickPlain(row).defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
