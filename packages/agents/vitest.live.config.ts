import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Live integration test config — requires a running Supabase instance.
 *
 * Prerequisites:
 *   npx supabase start                     # boots Supabase on :54421 (local)
 *   npx drizzle-kit migrate                # (first run only) apply schema
 *
 * Run:
 *   npm run test:live                      # from packages/agents
 *
 * Tests auto-skip if SUPABASE_URL is not reachable — safe to run anytime.
 * Env vars loaded from .env.local automatically.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    include: ["tests/live/**/*.test.ts"],
    testTimeout: 15000,
    // No aimock — these tests hit real Supabase
  },
});
