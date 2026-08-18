import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the web package's pure logic.
 *
 * Component and flow coverage stays in Playwright (`npm run test:e2e`) — this
 * project exists for the plain functions that decide what the UI says, where a
 * browser adds nothing but latency. Auto-discovered by the root
 * `vitest.config.ts` via `packages/*\/vitest.config.ts`, so it runs in the same
 * CI job as the agents tests.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
  },
});
