import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./foreman.db",
      ENCRYPTION_KEY:
        process.env.ENCRYPTION_KEY ??
        "9e104b5209f208812a9e03e113b30ba7d9867eda25e388469dbd22ed2266a206",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
    timeout: 120000,
  },
});
