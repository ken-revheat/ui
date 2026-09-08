import { defineConfig } from "vitest/config";
export default defineConfig({
  // Vue's compile-time feature flags. Without these the bundler build of
  // `vue` (resolved via its default "browser"/ESM conditions under vitest)
  // warns at import time — see shell-v2-nav-model plan §1.6.
  define: {
    __VUE_OPTIONS_API__: "true",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
  // globals: true is required for @testing-library/react's auto-cleanup —
  // it detects a test framework by checking for a global `afterEach` and
  // registers `cleanup()` there; without this flag that check silently
  // no-ops and DOM state leaks across tests within the same file.
  test: { environment: "happy-dom", globals: true },
});
