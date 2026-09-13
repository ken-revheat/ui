import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { AppShell, type AppShellIdentity } from "../src/react";

/**
 * happy-dom reports innerWidth 1024 and ships no matchMedia that tracks it, so
 * `useIsNarrow` is false unless we say otherwise — i.e. every test below runs on
 * a "desktop" unless it opts in. `setViewport(true)` installs a controllable
 * matchMedia so the narrow path (the ONLY path where the drawer is reachable in
 * production) can be exercised, and so a resize past the breakpoint can be fired.
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
// happy-dom really follows an un-prevented anchor click (the off-origin
// "Portal"/"Docs" links in the navigate tests), which moves the shared
// document's URL — and with it the origin every later same-origin check
// compares against. Put it back after every test.
const INITIAL_HREF = window.location.href;
afterEach(() => {
  vi.useRealTimers();
  if (window.location.href !== INITIAL_HREF) window.location.href = INITIAL_HREF;
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

function renderShell(props: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  return render(
    <AppShell identity={member} products={products} activePath="/app" {...props}>
      <main>content</main>
    </AppShell>,
  );
}

// The vault is the ONE product the portal's original path rule knows about, so
// it is the only fixture that can prove `currentProductCode` overrides it.
const vaultProducts = [
  ...products,
  {
    code: "training_vault",
    state: "launch" as const,
    appUrl: "https://app.revheat.com/vault",
    lockReason: null,
    billingStatus: "active",
  },
];
const currentLinks = () =>
  screen
    .getAllByRole("link")
    .filter((el) => el.getAttribute("aria-current") === "page")
    .map((el) => el.textContent);

// Shared fixtures for the v2 navigation-model tests below — see
// shell-v2-nav-model plan §4.2. `hiddenProducts` adds a launched-but-hidden
// row (the per-org sidebar switch) on top of `products`.
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

describe("active product row", () => {
  it("marks the row named by currentProductCode, and only that row", () => {
    renderShell({ currentProductCode: "trend_finder" });
    expect(currentLinks()).toEqual(["Trend Finder"]);
  });

  it("keeps the portal's vault rule for callers that pass no product code", () => {
    renderShell({ products: vaultProducts, activePath: "/vault/module-3" });
    expect(currentLinks()).toEqual(["Training Vault"]);
  });

  it("lets an explicit product code override the vault rule", () => {
    // A product app can legitimately be on a /vault path of its own. Its own
    // code is the reliable signal and must win.
    renderShell({
      products: vaultProducts,
      activePath: "/vault/module-3",
      currentProductCode: "trend_finder",
    });
    expect(currentLinks()).toEqual(["Trend Finder"]);
  });

  it("marks nothing when an app computes an empty product code", () => {
    // "" is a bug in the caller, not a request for the vault fallback.
    renderShell({ products: vaultProducts, activePath: "/vault", currentProductCode: "" });
    expect(currentLinks()).toEqual([]);
  });

  it("marks nothing when the app names no product and the path is not the vault", () => {
    renderShell({ activePath: "/app/reports" });
    expect(screen.queryByRole("link", { current: "page" })).toBeNull();
  });
});

// The hamburger also carries aria-expanded, so identify the account trigger by
// the one thing only it shows: the signed-in address.
const accountTrigger = (scope: HTMLElement = document.body) =>
  within(scope).getByRole("button", { name: /rep@acme\.com/ });

describe("account menu", () => {
  it("is closed until the trigger is used", () => {
    renderShell();
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(accountTrigger());
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("lists the portal's items, absolutely resolved, with no Admin for a normal member", () => {
    renderShell();
    fireEvent.click(accountTrigger());
    const items = screen.getAllByRole("menuitem");
    expect(items.map((el) => el.textContent)).toEqual([
      "Account settings",
      "Team & Access",
      "Manage products",
      "Sign out",
    ]);
    // A product app is on its own origin — a relative href would 404 there.
    expect(items[0]!.getAttribute("href")).toBe("https://app.revheat.com/account");
    expect(items[2]!.getAttribute("href")).toBe("https://app.revheat.com/");
  });

  it("adds Admin for staff", () => {
    renderShell({ identity: { ...member, isStaff: true }, adminHref: "https://app.revheat.com/admin/orgs" });
    fireEvent.click(accountTrigger());
    expect(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Admin" })).toBeTruthy();
  });

  it("treats an internal org as staff when the app does not send the staff flag", () => {
    renderShell({ identity: { ...member, isInternal: true }, adminHref: "/admin/orgs" });
    fireEvent.click(accountTrigger());
    expect(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Admin" })).toBeTruthy();
  });

  it("hides Admin from staff until the app says where Admin lives", () => {
    // Same gate as the header link. Defaulting the href would have switched
    // Admin on for every RevHeat-org member in every app that bumps this
    // package, with no code change on their side.
    renderShell({ identity: { ...member, isStaff: true } });
    fireEvent.click(accountTrigger());
    expect(within(screen.getByRole("menu")).queryByRole("menuitem", { name: "Admin" })).toBeNull();
  });

  it("signs out through the portal by default, because a product app cannot clear the portal cookie", () => {
    renderShell();
    fireEvent.click(accountTrigger());
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });
    expect(signOut.tagName).toBe("A");
    // The whole href, not a prefix: an empty or wrong `next` sends the user to
    // portal home after sign-out instead of back to the app they were in.
    expect(signOut.getAttribute("href")).toBe(
      `https://app.revheat.com/logout?next=${encodeURIComponent(window.location.origin)}`,
    );
  });

  it("takes Tab out of the menu deliberately, rather than letting focus fall to the page", () => {
    // Tab's default target is the NEXT menu item, which the same keystroke
    // unmounts — focus would land on <body> and the next Tab would restart from
    // the top of the document.
    renderShell();
    const trigger = accountTrigger();
    fireEvent.click(trigger);
    const first = screen.getAllByRole("menuitem")[0]!;
    expect(document.activeElement).toBe(first);
    const evt = fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab", cancelable: true });
    expect(evt).toBe(false); // preventDefault was called
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps menu items out of the tab order, per the ARIA menu pattern", () => {
    renderShell();
    fireEvent.click(accountTrigger());
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item.getAttribute("tabindex")).toBe("-1");
    }
  });

  it("uses the app's own handler when one is supplied", () => {
    let called = 0;
    renderShell({ onSignOut: () => (called += 1) });
    fireEvent.click(accountTrigger());
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(called).toBe(1);
  });

  it("moves focus with the arrow keys inside the menu", () => {
    renderShell();
    fireEvent.click(accountTrigger());
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("closes on Escape and puts focus back on the trigger", () => {
    renderShell();
    const trigger = accountTrigger();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("drawer", () => {
  const menuButton = () => screen.getByRole("button", { name: "Open product menu" });
  const closeButton = () => screen.getByRole("button", { name: "Close product menu" });

  // Everything here runs on a phone-width viewport, because that is the only
  // width at which the drawer is reachable in production. At 1024px the wide
  // rail is ALSO mounted, and a suite that never narrows quietly tests a
  // two-rails-at-once DOM that no user ever sees.
  beforeEach(() => setViewport(true));

  it("replaces the rail rather than duplicating it", () => {
    renderShell();
    expect(document.querySelectorAll(".rh-rail")).toHaveLength(0);
    fireEvent.click(menuButton());
    // One rail, and it is the drawer.
    const rails = document.querySelectorAll(".rh-rail");
    expect(rails).toHaveLength(1);
    expect(rails[0]!.getAttribute("role")).toBe("dialog");
    expect(screen.getAllByRole("navigation", { name: "Your products" })).toHaveLength(1);
  });

  it("opens the rail as a modal dialog and moves focus into it", () => {
    renderShell();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(menuButton().getAttribute("aria-controls")).toBeNull();
    fireEvent.click(menuButton());
    const drawer = screen.getByRole("dialog", { name: "RevHeat products" });
    expect(drawer.getAttribute("aria-modal")).toBe("true");
    // aria-controls must name a node that EXISTS — it fails axe otherwise, and
    // the drawer is unmounted whenever it is closed.
    expect(menuButton().getAttribute("aria-controls")).toBe(drawer.id);
    expect(within(drawer).getByRole("link", { name: /Trend Finder/ })).toBeTruthy();
    expect(document.activeElement).toBe(within(drawer).getByRole("button", { name: "Close product menu" }));
  });

  it("locks the page behind the scrim and unlocks it again", () => {
    renderShell();
    fireEvent.click(menuButton());
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(closeButton());
    // Released the moment closing starts, not one animation later: the panel is
    // still mounted here and the page must already scroll.
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.body.style.overflow).toBe("");
  });

  it("stops claiming the page is inert once it starts closing", () => {
    renderShell();
    fireEvent.click(menuButton());
    fireEvent.click(closeButton());
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBeNull();
  });

  it("closes on Escape from anywhere, not only from inside the panel", () => {
    // Regression: with the handler on the panel, clicking dead space inside it
    // blurs to <body> and Escape silently stops working.
    renderShell();
    fireEvent.click(menuButton());
    (document.activeElement as HTMLElement)?.blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("returns focus to the menu button", () => {
    renderShell();
    const button = menuButton();
    button.focus();
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(button);
  });

  it("leaves focus alone when the app has already moved it elsewhere", () => {
    // An SPA route change focuses the new page's heading and THEN the drawer
    // closes. Yanking focus back to the hamburger from there is worse than
    // doing nothing.
    //
    // Focus the heading BEFORE the close, so the close effect is deciding
    // against focus that is genuinely not ours. Asserting after the close would
    // pass no matter what the effect did.
    const { rerender } = renderShell();
    fireEvent.click(menuButton());
    const heading = document.createElement("h1");
    heading.tabIndex = -1;
    document.body.appendChild(heading);
    heading.focus();
    expect(document.activeElement).toBe(heading);
    rerender(
      <AppShell identity={member} products={products} activePath="/app/reports">
        <main>content</main>
      </AppShell>,
    );
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(heading);
    heading.remove();
  });

  it("lets Escape close the account menu without also closing the drawer", () => {
    renderShell();
    fireEvent.click(menuButton());
    const drawer = screen.getByRole("dialog");
    fireEvent.click(accountTrigger(drawer));
    fireEvent.keyDown(within(drawer).getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    // Still open — one Escape, one layer. The portal closes both.
    //
    // Assert on aria-expanded, NOT on the dialog still being in the DOM: the
    // panel lingers for one exit animation after close, so a presence check
    // passes even when the Escape wrongly closed the drawer too.
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("keeps Tab inside the panel, and skips elements that cannot take focus", () => {
    // The custom account block carries a disabled button. A trap that hands
    // focus to it silently does nothing, and the user's Tab key appears to
    // stop working — so it must not be part of the cycle.
    // The disabled button goes LAST on purpose: if the trap counted it, the
    // link before it would no longer be the wrap point and Tab from there
    // would do nothing at all.
    renderShell({
      accountMenu: (
        <>
          <a href="https://app.revheat.com/account">Account</a>
          <button type="button" disabled>
            Request access
          </button>
        </>
      ),
    });
    fireEvent.click(menuButton());
    const drawer = screen.getByRole("dialog");
    const last = within(drawer).getByRole("link", { name: "Account" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton());
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("pulls focus back when it has escaped the panel", () => {
    renderShell();
    fireEvent.click(menuButton());
    (document.activeElement as HTMLElement)?.blur();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton());
  });

  it("closes itself when the app navigates", () => {
    const { rerender } = renderShell();
    fireEvent.click(menuButton());
    expect(screen.getByRole("dialog")).toBeTruthy();
    rerender(
      <AppShell identity={member} products={products} activePath="/app/reports">
        <main>content</main>
      </AppShell>,
    );
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("drops the drawer instantly when the viewport widens past the breakpoint", () => {
    // Rotating to landscape brings the wide rail back. Playing the slide-out
    // animation here would put TWO rails on screen at once for 300ms, and a
    // scrim over a page that is no longer modal. The drawer is not the wrong
    // shape at this width, it is the wrong control — so it just goes.
    renderShell();
    fireEvent.click(menuButton());
    act(() => setViewport(false));
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelectorAll(".rh-rail")).toHaveLength(1);
    expect(document.querySelector("aside.rh-rail")).toBeTruthy();
  });

  it("still owns Escape when the app's account block contains a menu of its own", () => {
    // The drawer defers Escape and Tab to the account menu when the keypress is
    // IN it. Deferring on the mere PRESENCE of a role="menu" would hand the
    // keyboard to a menu that is not even open — and headless menu libraries
    // keep theirs mounted and hidden. `accountMenu` is a public prop, so a
    // consumer can and will put one there.
    renderShell({
      accountMenu: (
        <ul role="menu" hidden>
          <li role="menuitem">Theirs</li>
        </ul>
      ),
    });
    fireEvent.click(menuButton());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  describe("the exit window", () => {
    beforeEach(() => vi.useFakeTimers());

    const unmountAfterExit = () =>
      act(() => {
        vi.advanceTimersByTime(2000);
      });

    it("still unmounts when a second close lands inside the exit animation", () => {
      // The freeze bug: a second close() during the exit used to cancel the
      // unmount timer while leaving the panel mounted forever — page
      // scroll-locked, every click swallowed by an invisible scrim, no way out
      // but a reload.
      //
      // Dismiss by tapping a product, then navigate: the app's route change
      // fires close() again a few milliseconds later. This is the reachable
      // path now that the exiting drawer is pointer-events: none — a second
      // TAP can no longer reach it, but a second close() still can.
      const { rerender } = renderShell();
      fireEvent.click(menuButton());
      fireEvent.keyDown(document, { key: "Escape" });
      rerender(
        <AppShell identity={member} products={products} activePath="/app/reports">
          <main>content</main>
        </AppShell>,
      );
      unmountAfterExit();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });

    it("reopens as a working drawer when tapped again mid-exit", () => {
      // Reopening has to REMOUNT. The `aria-modal` and scroll-lock effects key
      // on `closing`, so those two recover on a reused instance — it is FOCUS
      // that does not, because moving focus in is mount-time work. A reused
      // panel comes back on screen with nothing focused: a modal the keyboard
      // cannot reach. The activeElement assertion below is the one that
      // catches it; verified by removing the key and re-running.
      renderShell();
      fireEvent.click(menuButton());
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.click(menuButton());
      const drawer = screen.getByRole("dialog");
      expect(drawer.getAttribute("aria-modal")).toBe("true");
      expect(document.body.style.overflow).toBe("hidden");
      expect(document.activeElement).toBe(within(drawer).getByRole("button", { name: "Close product menu" }));
      // And it is still dismissible.
      fireEvent.keyDown(document, { key: "Escape" });
      unmountAfterExit();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("ignores Escape once it is already closing", () => {
      renderShell();
      fireEvent.click(menuButton());
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.keyDown(document, { key: "Escape" });
      // Not reopened, not restarted, and gone on the ORIGINAL schedule — a
      // second Escape that re-armed the timer would still be showing here.
      expect(menuButton().getAttribute("aria-expanded")).toBe("false");
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("takes the exiting panel out of the tab order", () => {
      // `pointer-events: none` handles the mouse. Without this, a Tab pressed
      // inside the exit window lands back in the panel the user just dismissed,
      // and then on <body> when it unmounts.
      renderShell();
      fireEvent.click(menuButton());
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.getByRole("dialog").hasAttribute("inert")).toBe(true);
    });
  });
});

describe("footer", () => {
  // Honest limitation: this cannot fail in 2026, because the hardcoded value it
  // replaced WAS 2026. It is a dated tripwire — it starts catching a re-hardcoded
  // year on 1 Jan 2027, which is exactly when the old copyright line went stale.
  it("shows the current year rather than a year baked in at build time", () => {
    renderShell();
    expect(screen.getByText(`© ${new Date().getFullYear()} RevHeat`)).toBeTruthy();
  });
});

// The v2 navigation model — see shell-v2-nav-model plan §4.2, tests 1-8. The
// rail switches PRODUCT, `.rh-menu` switches SCREEN within a product; the
// "Available"/upsell nav and per-row upsell UI are gone from the rendered
// rail (locked design decision — `buildRailModel().upsell` still exists but
// nothing here reads it, per R3).
describe("navigation model (v2)", () => {
  // Accessible name, not raw textContent: the rail's home link has no visible
  // text — its name comes from aria-label.
  const nameOf = (el: Element) => el.getAttribute("aria-label") ?? el.textContent?.trim();

  it("1: lists owned products only — no Available nav, no upsell rows, no hidden/unowned rows", () => {
    renderShell({ products: hiddenProducts });
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

  it("2: the All-products row is last in the rail, with the portal-home href and its label text", () => {
    renderShell();
    const rail = document.querySelector<HTMLElement>("aside.rh-rail")!;
    const links = Array.from(rail.querySelectorAll("a"));
    const allProducts = links[links.length - 1]!;
    expect(allProducts.className).toContain("rh-row--all");
    expect(allProducts.getAttribute("href")).toBe("https://app.revheat.com/?source=sidebar");
    expect(allProducts.textContent).toBe("All products →");
  });

  it("3: currentProductCode highlights its row and names the product in the banner", () => {
    renderShell({ currentProductCode: "trend_finder" });
    expect(currentLinks()).toEqual(["Trend Finder"]);
    expect(document.querySelector(".rh-banner__product")!.textContent).toBe("Trend Finder");
  });

  it("4: an unrecognised product code shows no banner title and highlights nothing", () => {
    renderShell({ currentProductCode: "not_a_product" });
    expect(document.querySelector(".rh-banner__product")).toBeNull();
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
  });

  it("5: renders the screen menu, deriving the active tab, and lets an explicit active win", () => {
    const { rerender } = renderShell({ screens: screens2, activePath: "/app/reports" });
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

    rerender(
      <AppShell
        identity={member}
        products={products}
        activePath="/app/reports"
        screens={[{ ...screens2[0]!, active: true }, screens2[1]!]}
      >
        <main>content</main>
      </AppShell>,
    );
    const menu2 = screen.getByRole("navigation", { name: "Screens" });
    expect(
      within(menu2).getByRole("link", { name: "Overview" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(menu2).getByRole("link", { name: "Reports" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("6: the screen menu does not render with fewer than two screens, or when omitted", () => {
    const empty = renderShell({ screens: [] });
    expect(document.querySelector(".rh-menu")).toBeNull();
    empty.unmount();

    const single = renderShell({ screens: [screens2[0]!] });
    expect(document.querySelector(".rh-menu")).toBeNull();
    single.unmount();

    renderShell();
    expect(document.querySelector(".rh-menu")).toBeNull();
  });

  it("6b: onNavigate intercepts plain clicks on internal tabs only, and never modified clicks", () => {
    const onNavigate = vi.fn();
    const screens = [
      ...screens2,
      { label: "Docs", href: "https://docs.revheat.com", external: true },
    ];
    renderShell({ screens, activePath: "/app", onNavigate });
    const menu = screen.getByRole("navigation", { name: "Screens" });

    // Plain left-click on an internal tab: intercepted, router gets the href.
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    within(menu).getByRole("link", { name: "Reports" }).dispatchEvent(plain);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/app/reports");
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

  it("6e: normalises a hash-only and a document-relative screen tab, which are behaviour CHANGES", () => {
    // `inAppHref` resolves every intercepted href against document.baseURI and
    // hands the router back path + search + hash, so two shapes reach it
    // differently than they did in v2.1.0. Neither is shipped by any of the
    // eight consumers today, and both land where the anchor would have — but a
    // router that treats "#a" and "/#a" as different routes would notice, so
    // the behaviour is pinned here and documented in the README rather than
    // left to be rediscovered. LOW, 2026-09-12 re-review.
    const onNavigate = vi.fn();
    renderShell({
      screens: [
        { label: "Overview", href: "#overview" },
        { label: "Reports", href: "reports" },
      ],
      activePath: "/app",
      onNavigate,
    });
    const menu = screen.getByRole("navigation", { name: "Screens" });

    within(menu)
      .getByRole("link", { name: "Overview" })
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    expect(onNavigate).toHaveBeenLastCalledWith(
      `${document.location.pathname}${document.location.search}#overview`,
    );

    within(menu)
      .getByRole("link", { name: "Reports" })
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    const resolved = new URL("reports", document.baseURI);
    expect(onNavigate).toHaveBeenLastCalledWith(`${resolved.pathname}${resolved.search}`);

    // The anchors themselves keep the author's text — "copy link address" and
    // cmd-click must still produce what the consumer wrote.
    expect(within(menu).getByRole("link", { name: "Overview" }).getAttribute("href")).toBe("#overview");
    expect(within(menu).getByRole("link", { name: "Reports" }).getAttribute("href")).toBe("reports");
  });

  it("6f: a hash-only tab KEEPS the page's query string, it does not drop it", () => {
    // The half of 6e the default test URL cannot show, because it carries no
    // query. A consumer whose list view holds its filters in the URL
    // (?source=sidebar, ?status=open) and links a section with "#overview"
    // gets those filters back — anchoring must not silently reset the view.
    // This is the behaviour a browser gives, and the README says so.
    // Found by the 2026-09-12 round-3 re-review, which caught the README and
    // the assertion above BOTH predicting the query would be dropped.
    const before = `${document.location.pathname}${document.location.search}`;
    const onNavigate = vi.fn();
    try {
      history.replaceState(null, "", "/app/list?source=sidebar&status=open");
      renderShell({
        screens: [
          { label: "Overview", href: "#overview" },
          { label: "Reports", href: "/app/reports" },
        ],
        activePath: "/app/list",
        onNavigate,
      });
      screen
        .getByRole("navigation", { name: "Screens" })
        .querySelectorAll("a")[0]!
        .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      expect(onNavigate).toHaveBeenLastCalledWith("/app/list?source=sidebar&status=open#overview");
    } finally {
      history.replaceState(null, "", before);
    }
  });

  it("6g: a document-relative tab resolves against <base href>, not against the page URL", () => {
    // `inAppHref` resolves against document.baseURI ON PURPOSE. The two differ
    // the moment a consumer ships a <base href> — an app served from a
    // sub-path, a preview build — and resolving against location.href instead
    // would send every relative sidebar link to the wrong root. Swapping the
    // two used to break NOTHING in this suite (round-3 mutation e3); this test
    // is the only thing that now notices. 2026-09-12 re-review.
    const base = document.createElement("base");
    base.setAttribute("href", "/mounted/at/");
    document.head.appendChild(base);
    const onNavigate = vi.fn();
    try {
      expect(document.baseURI).not.toBe(document.location.href);
      renderShell({
        screens: [
          { label: "Reports", href: "reports" },
          { label: "Home", href: "/app" },
        ],
        activePath: "/app",
        onNavigate,
      });
      screen
        .getByRole("navigation", { name: "Screens" })
        .querySelectorAll("a")[0]!
        .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      expect(onNavigate).toHaveBeenLastCalledWith("/mounted/at/reports");
    } finally {
      base.remove();
    }
  });

  it("6d: an off-origin href that forgot external:true is still left to the browser", () => {
    const onNavigate = vi.fn();
    // Captured up front: happy-dom really navigates on an un-prevented anchor
    // click, so the page's origin changes once the Portal link is clicked.
    const here = `${window.location.origin}/app/here`;
    renderShell({
      screens: [
        ...screens2,
        { label: "Portal", href: "https://app.revheat.com/account" },
        { label: "Here", href: here },
      ],
      activePath: "/app",
      onNavigate,
    });
    const menu = screen.getByRole("navigation", { name: "Screens" });
    // A same-origin ABSOLUTE href is routed like a relative one — and the
    // hook is handed the IN-APP form, stripped of the origin. `href` still
    // carries what the caller passed; only what reaches `onNavigate` is
    // normalised, because `router.push("http://localhost:3000/app/here")` is
    // not a route in any of the four routers, it is a path called
    // "/http:/localhost:3000/app/here".
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

  it("6c: without onNavigate, screen tabs are plain links (default not prevented)", () => {
    renderShell({ screens: screens2, activePath: "/app" });
    const menu = screen.getByRole("navigation", { name: "Screens" });
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    within(menu).getByRole("link", { name: "Reports" }).dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
  });

  it("7: renders headerActions inside .rh-banner__actions, and omits the wrapper when absent", () => {
    const withActions = renderShell({
      headerActions: (
        <button type="button" key="export">
          Export
        </button>
      ),
    });
    const banner = document.querySelector(".rh-banner")!;
    const actions = banner.querySelector(".rh-banner__actions");
    expect(actions).not.toBeNull();
    expect(within(actions as HTMLElement).getByRole("button", { name: "Export" })).toBeTruthy();
    withActions.unmount();

    renderShell();
    expect(document.querySelector(".rh-banner__actions")).toBeNull();
  });

  it("8: degraded mode still lists fallback products (minus a bundle), with the All-products row present", () => {
    renderShell({ degraded: true, products: [], productCodesFallback: ["all_access", "quotafit"] });
    expect(screen.getByRole("link", { name: "QuotaFit" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "All-Access" })).toBeNull();
    const rail = document.querySelector<HTMLElement>("aside.rh-rail")!;
    expect(within(rail).getByRole("link", { name: "All products →" })).toBeTruthy();
  });
});

// ── v2.2.0 ──────────────────────────────────────────────────────────────
// Mirror of test/vue.spec.ts's "client-side navigation reaches the whole rail
// (v2.2)". v2.1.0 wired the click-to-route hook to the screen tabs only;
// inside the portal EVERY link the shell renders is same-origin, and leaving
// the rail on plain anchors would have traded in-app navigation for a full
// page reload on each one. The same interception must never fire in a React
// product app, where those hrefs are off-origin and MUST leave the app.
describe("client-side navigation reaches the whole rail (v2.2)", () => {
  // The portal is served FROM app.revheat.com — the one origin where the
  // rail's own links are same-origin. afterEach puts the URL back.
  const asPortal = () => {
    window.location.href = "https://app.revheat.com/vault";
  };

  const clickPlain = (el: Element): MouseEvent => {
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    act(() => {
      el.dispatchEvent(ev);
    });
    return ev;
  };

  const renderAsPortal = (props: Partial<React.ComponentProps<typeof AppShell>> = {}) => {
    asPortal();
    const onNavigate = vi.fn();
    renderShell({
      products: vaultProducts,
      activePath: "/vault",
      currentProductCode: "training_vault",
      onNavigate,
      ...props,
    });
    return onNavigate;
  };

  const rail = () => screen.getByRole("complementary", { name: "RevHeat products" });

  it("routes a same-origin product row, handing the router a PATH not a URL", () => {
    const onNavigate = renderAsPortal();
    const row = within(rail()).getByRole("link", { name: "Training Vault" });
    // The anchor keeps the absolute href — cmd-click and "copy link address"
    // have to keep working, and outside the portal this href really is
    // cross-origin.
    expect(row.getAttribute("href")).toBe("https://app.revheat.com/vault?source=sidebar");
    expect(clickPlain(row).defaultPrevented).toBe(true);
    // …but the hook gets path+query. Absolute is not a no-op to a SPA router:
    // vue-router 4 resolves the whole string as a path and lands on
    // "/https:/app.revheat.com/vault" with "No match found".
    expect(onNavigate).toHaveBeenCalledWith("/vault?source=sidebar");
    // The query survives on purpose — `?source=sidebar` is how the portal's
    // upgrade page attributes the click.
  });

  it("routes All products, the R mark and the banner's ← Portal link", () => {
    const onNavigate = renderAsPortal();
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

  it("routes the account-menu items but never Sign out", () => {
    const onNavigate = renderAsPortal({ onSignOut: () => {} });
    for (const label of ["Account settings", "Team & Access", "Manage products"]) {
      // Reopened each pass: from v2.2.0 an in-app route CLOSES the pop-up
      // (see the next test), so the menu is gone after the first click.
      fireEvent.click(accountTrigger());
      onNavigate.mockClear();
      const item = screen.getByRole("menuitem", { name: label });
      expect(clickPlain(item).defaultPrevented, label).toBe(true);
      expect(onNavigate, label).toHaveBeenCalledTimes(1);
    }
    // Sign out must reach the server, so it is never routed. With onSignOut
    // supplied it is a BUTTON, and a button has no href to intercept.
    fireEvent.click(accountTrigger());
    expect(screen.getByRole("menuitem", { name: "Sign out" }).tagName).toBe("BUTTON");
  });

  it("leaves Sign out a plain link in its ANCHOR form, where interception WOULD be possible", () => {
    // The other half of the test above, which used to claim this in a comment
    // and never exercise it (LOW, 2026-09-12 re-review). Without onSignOut the
    // shell renders Sign out as an <a> to the portal's logout URL — which,
    // inside the portal, is same-origin and therefore exactly the shape
    // `shellNavHandler` would otherwise intercept. It must not: signing out is
    // a server round-trip that clears a cookie, and routing it client-side
    // would leave the user signed in looking at a logged-out page.
    const onNavigate = renderAsPortal();
    fireEvent.click(accountTrigger());
    const signOut = screen.getByRole("menuitem", { name: "Sign out" });
    expect(signOut.tagName).toBe("A");
    expect(signOut.getAttribute("href")).toContain("/logout?next=");
    expect(clickPlain(signOut).defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("closes the account pop-up once a menu item routes in-app", () => {
    // Until v2.2.0 nothing ever closed this menu on its own: every item was a
    // full page load, which took the whole DOM with it. Now the page survives
    // the click, so the pop-up would sit open over the destination — and the
    // trigger's aria-expanded would lie to a screen reader.
    const onNavigate = renderAsPortal({ onSignOut: () => {} });
    fireEvent.click(accountTrigger());
    expect(screen.getByRole("menu")).toBeTruthy();
    clickPlain(screen.getByRole("menuitem", { name: "Account settings" }));
    expect(onNavigate).toHaveBeenCalledWith("/account");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(accountTrigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("leaves the account pop-up open on a cmd-click, which opens a new tab", () => {
    // The close is keyed on `defaultPrevented`, not on "a handler exists" —
    // a modified click is NOT a navigation of this page, so the menu the user
    // is still looking at must stay put.
    const onNavigate = renderAsPortal({ onSignOut: () => {} });
    fireEvent.click(accountTrigger());
    const item = screen.getByRole("menuitem", { name: "Account settings" });
    const ev = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    });
    act(() => {
      item.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("routes the banner's Admin link, including a RELATIVE adminHref", () => {
    // `adminHref` is the only consumer-supplied href in the intercepted set,
    // so it is the only one that can be relative — and a relative href is
    // same-origin in EVERY app, not just the portal. That is the contract
    // (same origin + a navigate hook = route in-app), asserted here so nobody
    // "fixes" it into an origin check against PORTAL_ORIGIN.
    const onNavigate = renderAsPortal({
      identity: { ...member, isStaff: true },
      adminHref: "/admin/orgs",
    });
    const link = document.querySelector<HTMLAnchorElement>(".rh-banner__admin")!;
    expect(link.getAttribute("href")).toBe("/admin/orgs");
    expect(clickPlain(link).defaultPrevented).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith("/admin/orgs");
  });

  it("routes the banner's Admin link when it is the absolute portal URL", () => {
    // What all five product consumers actually pass. It is same-origin ONLY
    // here, inside the portal.
    const onNavigate = renderAsPortal({
      identity: { ...member, isStaff: true },
      adminHref: "https://app.revheat.com/admin/orgs",
    });
    const link = document.querySelector<HTMLAnchorElement>(".rh-banner__admin")!;
    expect(clickPlain(link).defaultPrevented).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith("/admin/orgs");
  });

  it("leaves the banner's Admin link alone in a product app, where it is off-origin", () => {
    // No `asPortal()` — this is Trend Finder / ICP / QuotaFit, on their own
    // origin. Routing app.revheat.com/admin/orgs through THEIR router would
    // land on their own 404. (happy-dom really follows the un-prevented
    // click; the suite's afterEach puts the URL back.)
    const onNavigate = vi.fn();
    renderShell({
      identity: { ...member, isStaff: true },
      adminHref: "https://app.revheat.com/admin/orgs",
      currentProductCode: "trend_finder",
      onNavigate,
    });
    const link = document.querySelector<HTMLAnchorElement>(".rh-banner__admin")!;
    expect(clickPlain(link).defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("never intercepts modified clicks, so cmd/ctrl/middle-click still opens a new tab", () => {
    const onNavigate = renderAsPortal();
    const row = within(rail()).getByRole("link", { name: "Training Vault" });
    for (const mod of [
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...mod });
      act(() => {
        row.dispatchEvent(ev);
      });
      expect(ev.defaultPrevented, JSON.stringify(mod)).toBe(false);
    }
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("without an onNavigate prop every rail link stays a plain browser link", () => {
    asPortal();
    renderShell({ products: vaultProducts, activePath: "/vault" });
    for (const el of [
      within(rail()).getByRole("link", { name: "Training Vault" }),
      within(rail()).getByRole("link", { name: "All products →" }),
      rail().querySelector(".rh-rail__home")!,
    ]) {
      expect(clickPlain(el).defaultPrevented, el.className).toBe(false);
    }
  });
  it("closes the account pop-up, and restores focus, even when the router THROWS", () => {
    // The `navItemOn` half of the guard the drawer tests pin for `navOn`.
    // Round 3 (2026-09-12) deleted `navItemOn`'s try/finally and the whole
    // suite stayed green — the code was right, nothing was watching it. Left
    // unwatched, a pop-up that survives a throwing route guard sits over the
    // page with focus trapped inside it and the trigger still reading
    // aria-expanded="true".
    const onNavigate = vi.fn(() => {
      throw new Error("route guard says no");
    });
    renderAsPortal({ onNavigate });
    const trigger = accountTrigger();
    // Focus the trigger the way a real click does — happy-dom's fireEvent
    // does not, and closeAndRefocus() can only return focus where it came
    // from.
    trigger.focus();
    fireEvent.click(trigger);
    // Same contract as the drawer test: how the listener's exception surfaces
    // is the DOM implementation's business, the close is ours.
    try {
      clickPlain(screen.getByRole("menuitem", { name: "Account settings" }));
    } catch {
      /* the consumer's error, on whichever path it takes */
    }
    act(() => {});
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });


  // ── the drawer ────────────────────────────────────────────────────────
  // REGRESSION, found in the v2.2.0 re-review. Through v2.1.0 a rail row was a
  // plain browser link, so tapping one inside the drawer tore the document
  // down — the drawer could not survive its own links, and never needed its
  // own close. v2.2.0 calls preventDefault on those same rows, and the only
  // remaining close path was a watcher on `activePath`.
  describe("the drawer closes on an intercepted tap", () => {
    const openDrawer = (props: Partial<React.ComponentProps<typeof AppShell>> = {}) => {
      setViewport(true);
      const onNavigate = renderAsPortal(props);
      fireEvent.click(screen.getByRole("button", { name: "Open product menu" }));
      return { onNavigate, drawer: screen.getByRole("dialog", { name: "RevHeat products" }) };
    };

    it("closes it when the row points at the page you are ALREADY on", () => {
      // The worst case, and the one `activePath` cannot cover: the shell is
      // rendered at /vault and the row goes to /vault, so the consumer
      // re-renders with the SAME activePath and the watcher never fires. Left
      // unfixed the user taps, the router does nothing visible, and the panel
      // stays over the page focus-trapped and body-scroll-locked — tapping
      // again does nothing either. Inside the portal this is reachable from
      // three rows, not one: "All products →" on the portal home, the R mark,
      // and the Training Vault row while in the vault.
      const { onNavigate, drawer } = openDrawer();
      const row = within(drawer).getByRole("link", { name: "Training Vault" });
      expect(clickPlain(row).defaultPrevented).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith("/vault?source=sidebar");
      // Asserted the way the rest of this suite asserts a close: the panel
      // stays MOUNTED for one exit animation on purpose, so "is it gone from
      // the DOM" is the wrong question. What must be true immediately is that
      // it has stopped being a modal holding the page.
      expect(screen.getByRole("button", { name: "Open product menu" }).getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });

    it("closes it on a row that DOES change the path, without waiting for the router", () => {
      // Self-heals eventually via the activePath watcher, but only once the
      // consumer's async route transition resolves — the panel should go on
      // the tap, not a few hundred ms later.
      const { drawer } = openDrawer();
      const row = within(drawer).getByRole("link", { name: "All products →" });
      expect(clickPlain(row).defaultPrevented).toBe(true);
      expect(screen.getByRole("button", { name: "Open product menu" }).getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(document.body.style.overflow).toBe("");
    });

    it("leaves it open on a cmd-click, which really does open a new tab", () => {
      // Same rule as the account pop-up: `defaultPrevented` is the signal, not
      // "a handler ran". The user is staying on this page, so the menu they
      // opened has to still be there.
      const { onNavigate, drawer } = openDrawer();
      const row = within(drawer).getByRole("link", { name: "Training Vault" });
      const ev = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        metaKey: true,
      });
      act(() => {
        row.dispatchEvent(ev);
      });
      expect(ev.defaultPrevented).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Open product menu" }).getAttribute("aria-expanded")).toBe(
        "true",
      );
      expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    });

    it("closes BOTH the account pop-up and the drawer when a menu item inside the drawer routes", () => {
      // The only click path where two closers fire on one event: `navOn`'s
      // closeDrawer() and the account menu's own closeAndRefocus(). Nothing
      // pinned it before (MEDIUM, 2026-09-12 re-review) — every other
      // account-menu test clicks the DESKTOP rail's copy. A refactor of
      // either closer could leave the drawer up over the destination, or
      // bounce focus somewhere the phone user cannot see.
      const { onNavigate, drawer } = openDrawer();
      fireEvent.click(accountTrigger(drawer));
      clickPlain(screen.getByRole("menuitem", { name: "Account settings" }));
      expect(onNavigate).toHaveBeenCalledWith("/account");
      expect(screen.queryByRole("menu")).toBeNull();
      expect(screen.getByRole("button", { name: "Open product menu" }).getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });

    it("closes even when the consumer's router THROWS on the way out", () => {
      // preventDefault() has already run by the time onNavigate is called, so
      // a router that raises synchronously (a route guard that throws, a
      // rejected push surfaced inline) used to skip the close and strand the
      // panel: focus-trapped, body scroll-locked, over a page that never
      // changed. `try/finally` in navOn is what makes this pass. MEDIUM,
      // 2026-09-12 re-review.
      const onNavigate = vi.fn(() => {
        throw new Error("route guard says no");
      });
      const { drawer } = openDrawer({ onNavigate });
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
      // The throw escapes act()'s callback, so act() never gets to flush the
      // state update `closeDrawer()` queued. An empty act() flushes it.
      //
      // This is a harness artifact, not a bug the app would hit. React 18's
      // concurrent root does not flush a discrete update synchronously at all —
      // it schedules a microtask — and it does so whether or not the handler
      // threw. Measured at the 2026-09-12 re-review: `aria-expanded` reads
      // "true" straight after dispatch and "false" one microtask later, with
      // and without the throw, identically. Dispatching with no act() and then
      // draining microtasks closes the drawer too. So the close really does
      // happen in a browser; act() just never runs its own flush after an
      // exception escapes its callback.
      act(() => {});
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Open product menu" }).getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });
  });

  // Clicked last on purpose: happy-dom really follows an un-prevented anchor,
  // which moves the document's origin for everything after it.
  it("leaves an off-origin product row to the browser", () => {
    const onNavigate = renderAsPortal();
    const row = within(rail()).getByRole("link", { name: "Trend Finder" });
    expect(clickPlain(row).defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
