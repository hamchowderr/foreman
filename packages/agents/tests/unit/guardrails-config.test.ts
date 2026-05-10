import { describe, expect, it } from "vitest";
import { getOrgGuardrailConfig } from "@/lib/guardrails-config";

describe("guardrails-config", () => {
  describe("getOrgGuardrailConfig", () => {
    it("returns sensible defaults", () => {
      const config = getOrgGuardrailConfig();
      expect(config).toBeDefined();
      expect(config.rateLimitPerMinute).toBeGreaterThan(0);
      expect(config.rateLimitPerHour).toBeGreaterThan(0);
      expect(config.maxBulkItems).toBeGreaterThan(0);
    });

    it("defaults include rateLimitPerMinute: 30", () => {
      const config = getOrgGuardrailConfig();
      expect(config.rateLimitPerMinute).toBe(30);
    });

    it("defaults include rateLimitPerHour: 200", () => {
      const config = getOrgGuardrailConfig();
      expect(config.rateLimitPerHour).toBe(200);
    });

    it("defaults include maxBulkItems: 5", () => {
      const config = getOrgGuardrailConfig();
      expect(config.maxBulkItems).toBe(5);
    });

    it("defaults blockedApps to empty array", () => {
      const config = getOrgGuardrailConfig();
      expect(config.blockedApps).toEqual([]);
    });

    it("defaults allowedApps to empty array", () => {
      const config = getOrgGuardrailConfig();
      expect(config.allowedApps).toEqual([]);
    });

    it("defaults requireApprovalForWrites to false", () => {
      const config = getOrgGuardrailConfig();
      expect(config.requireApprovalForWrites).toBe(false);
    });

    it("returns a new object each call (no shared reference)", () => {
      const a = getOrgGuardrailConfig();
      const b = getOrgGuardrailConfig();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });

    it("accepts optional orgId parameter", () => {
      const config = getOrgGuardrailConfig("org-123");
      expect(config.rateLimitPerMinute).toBe(30);
    });
  });
});
