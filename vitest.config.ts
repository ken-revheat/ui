import { defineConfig } from "vitest/config";
export default defineConfig({
  // globals: true is required for @testing-library/react's auto-cleanup —
  // it detects a test framework by checking for a global `afterEach` and
  // registers `cleanup()` there; without this flag that check silently
  // no-ops and DOM state leaks across tests within the same file.
  test: { environment: "happy-dom", globals: true },
});
