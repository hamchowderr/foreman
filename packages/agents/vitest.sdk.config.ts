import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    include: ["tests/sdk/**/*.test.ts"],
    testTimeout: 30000,
    // No globalSetup — SDK tests hit the real Zapier API, no aimock
  },
});
