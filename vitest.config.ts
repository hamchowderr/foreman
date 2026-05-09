import { defineConfig } from "vitest/config";

// Root vitest config delegates to each workspace's local vitest.config.ts.
// Tests run with the same path aliases, mocks, and setup hooks they would
// use when invoked from inside the workspace. To add web-side tests later,
// drop in `packages/web/vitest.config.ts` and it'll be auto-discovered.
export default defineConfig({
  test: {
    // Only include packages that have an explicit vitest.config.ts. This
    // skips packages/web (Playwright-only) until it adds vitest tests.
    projects: ["packages/*/vitest.config.ts"],
  },
});
