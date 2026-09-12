// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { AppShell as ReactAppShell, type AppShellIdentity } from "../src/react";
import { AppShell as VueAppShell } from "../src/vue";

/**
 * ⚠️ NODE environment, not happy-dom — the `@vitest-environment node` line
 * above is the whole point of this file. Everywhere else in the suite
 * `document` exists. Five of the eight consumers server-render the shell
 * (Directive, Call Analyzer, Website Readiness, ICP, QuotaFit — the portal
 * alone is `ssr: false`), and this is the only place that runs it the way
 * they do.
 *
 * **What this file proves: a server render does not throw, and produces the
 * markup.** The regression it is aimed at is a `document`/`window` read
 * migrating onto the RENDER path — out of a `useEffect`/`onMounted`, where
 * every one of them lives today, into a component body during some later
 * tidy-up. Verified by mutation: a bare `document.title` at the top of the
 * React shell's body fails this file immediately.
 *
 * ⛔ What it does NOT prove, so nobody re-derives it the hard way: it cannot
 * fail if you delete `isSameOriginHref`'s or `inAppHref`'s `typeof document`
 * guards in src/internal.ts. Both bodies are already inside a try/catch, so
 * the ReferenceError is swallowed and the fallback returns the same answer
 * the guard would have. Those guards are documentation and speed, not the
 * thing standing between us and a broken server render.
 *
 * `props` still passes an `onNavigate` on purpose. It is what all five SSR
 * consumers pass, and without it `shellNavHandler` short-circuits on
 * `!navigate` and the whole interception path — the newest code in v2.2.0 —
 * is never rendered at all here.
 *
 * The href assertions are the render's receipt: they prove real markup came
 * out, carrying the anchors the five apps ship, rather than an empty string
 * passing vacuously. They are NOT where the href-leak invariant is enforced.
 * That lives in test/shell.spec.tsx's "routes a same-origin product row,
 * handing the router a PATH not a URL" — the only environment where
 * `inAppHref` can rewrite anything. Same for the `onclick` check: with no
 * document there is no handler to serialise, so it can only ever pass. Both
 * negatives stay as cheap belt-and-braces, not as guarantees.
 */
const identity: AppShellIdentity = {
  email: "rep@acme.com",
  isInternal: false,
  roleLabel: "Rep",
  isStaff: true,
};

const products = [
  {
    code: "training_vault",
    state: "launch" as const,
    appUrl: "https://app.revheat.com/vault",
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
];

const props = {
  identity,
  products,
  // Deliberate — see the note above. Without a navigate hook
  // `shellNavHandler` returns early and none of v2.2.0's click-interception
  // code is exercised by the server render at all.
  onNavigate: () => {},
  activePath: "/vault",
  currentProductCode: "training_vault",
  adminHref: "/admin/orgs",
  screens: [
    { label: "Overview", href: "/vault" },
    { label: "Reports", href: "/vault/reports" },
  ],
};

/** The hrefs that must survive a server render byte-for-byte. The first is
 *  the one `inAppHref` would rewrite to "/vault?source=sidebar" if it ever
 *  escaped into the attribute. */
const EXPECTED_HREFS = [
  "https://app.revheat.com/vault?source=sidebar",
  "https://trends.revheat.com/app?source=sidebar",
  "https://app.revheat.com/?source=sidebar",
  "/admin/orgs",
  "/vault/reports",
];

function assertServerHtml(html: string) {
  for (const href of EXPECTED_HREFS) {
    expect(html, href).toContain(`href="${href}"`);
  }
  // The normalised in-app form must not appear as a rendered href.
  expect(html).not.toContain('href="/vault?source=sidebar"');
  expect(html).not.toContain("onclick");
}

describe("server render (no document)", () => {
  it("React: hrefs are untouched and no onclick reaches the HTML", () => {
    // Would throw if any code path read `document`/`window` unguarded — which
    // is itself half the value of this test.
    // `children` is a required prop on the React shell, so it goes in the
    // props object rather than as a createElement child argument.
    assertServerHtml(
      renderToStaticMarkup(React.createElement(ReactAppShell, { ...props, children: "page content" })),
    );
  });

  it("Vue: hrefs are untouched and no onclick reaches the HTML", async () => {
    const app = createSSRApp({
      render: () => h(VueAppShell, props, { default: () => "page content" }),
    });
    assertServerHtml(await renderToString(app));
  });
});
