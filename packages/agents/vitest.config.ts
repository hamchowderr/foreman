import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    globalSetup: ["./tests/aimock-setup.ts"],
    // SDK tests hit the real Zapier API (own config: vitest.sdk.config.ts).
    // Live tests hit a real Supabase (own config: vitest.live.config.ts).
    // Both opt-in via dedicated npm scripts; default `npm test` skips them.
    exclude: ["**/node_modules/**", "tests/sdk/**", "tests/live/**"],
  },
});
