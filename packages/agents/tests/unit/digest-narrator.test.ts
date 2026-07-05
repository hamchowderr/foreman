/**
 * Unit tests for the opt-in digest narrator (foreman-ufo3). The LLM call is
 * injected, so these never hit a provider — they cover the enable flag + the
 * fail-soft contract (a narrator failure must never break the digest).
 */
import { afterEach, describe, expect, it } from "vitest";
import { buildDigest } from "../../src/lib/automations/digest";
import { isDigestNarrativeEnabled, narrateDigest } from "../../src/lib/automations/digest-narrator";

const digest = buildDigest([], "2026-07-04T12:00:00Z", "2026-07-05T12:00:00Z");

describe("digest narrator", () => {
  afterEach(() => {
    delete process.env.FOREMAN_DIGEST_NARRATIVE;
  });

  it("is disabled unless FOREMAN_DIGEST_NARRATIVE=true", () => {
    expect(isDigestNarrativeEnabled()).toBe(false);
    process.env.FOREMAN_DIGEST_NARRATIVE = "true";
    expect(isDigestNarrativeEnabled()).toBe(true);
  });

  it("returns null (and never calls the LLM) when disabled", async () => {
    let called = false;
    const out = await narrateDigest(digest, async () => {
      called = true;
      return "should not run";
    });
    expect(out).toBeNull();
    expect(called).toBe(false);
  });

  it("returns the trimmed narrative when enabled", async () => {
    process.env.FOREMAN_DIGEST_NARRATIVE = "true";
    const out = await narrateDigest(digest, async () => "  All 3 automations ran cleanly.  ");
    expect(out).toBe("All 3 automations ran cleanly.");
  });

  it("degrades to null when the generator throws", async () => {
    process.env.FOREMAN_DIGEST_NARRATIVE = "true";
    const out = await narrateDigest(digest, async () => {
      throw new Error("rate limited");
    });
    expect(out).toBeNull();
  });

  it("degrades to null on empty output", async () => {
    process.env.FOREMAN_DIGEST_NARRATIVE = "true";
    const out = await narrateDigest(digest, async () => "   ");
    expect(out).toBeNull();
  });
});
