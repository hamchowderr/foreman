import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("env validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset module cache so env.ts re-parses
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.ENCRYPTION_KEY;
    const { validateEnv } = await import("@/lib/env");
    expect(() => validateEnv()).toThrow();
  });

  it("throws when ENCRYPTION_KEY is missing", async () => {
    process.env.DATABASE_URL = "file:./test.db";
    delete process.env.ENCRYPTION_KEY;
    const { validateEnv } = await import("@/lib/env");
    expect(() => validateEnv()).toThrow();
  });

  it("parses valid env successfully", async () => {
    process.env.DATABASE_URL = "file:./test.db";
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    delete process.env.FOREMAN_MODE; // assert the default
    const { validateEnv } = await import("@/lib/env");
    const env = validateEnv();
    expect(env.DATABASE_URL).toBe("file:./test.db");
    expect(env.ENCRYPTION_KEY).toBe("a".repeat(64));
    expect(env.FOREMAN_MODE).toBe("dev");
  });

  it("accepts optional fields", async () => {
    process.env.DATABASE_URL = "file:./test.db";
    process.env.ENCRYPTION_KEY = "b".repeat(64);
    process.env.DEV_ZAPIER_OVERRIDE = "some-token";
    process.env.FOREMAN_MODE = "self_hosted";
    const { validateEnv } = await import("@/lib/env");
    const env = validateEnv();
    expect(env.DEV_ZAPIER_OVERRIDE).toBe("some-token");
    expect(env.FOREMAN_MODE).toBe("self_hosted");
  });
});
