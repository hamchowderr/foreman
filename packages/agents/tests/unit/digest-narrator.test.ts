/**
 * Unit tests for the digest narrator (foreman-bhb5). The LLM call is injected, so
 * these never hit a provider — they cover the fail-soft contract (a narrator
 * failure must never break the digest) and trimming.
 */
import { describe, expect, it } from "vitest";
import { buildDigest } from "../../src/lib/automations/digest";
import { narrateDigest } from "../../src/lib/automations/digest-narrator";

const digest = buildDigest([], "2026-07-04T12:00:00Z", "2026-07-05T12:00:00Z");

describe("narrateDigest", () => {
  it("returns the trimmed narrative", async () => {
    const out = await narrateDigest(digest, async () => "  All 3 automations ran cleanly.  ");
    expect(out).toBe("All 3 automations ran cleanly.");
  });

  it("passes the instructions + prompt through to the generator", async () => {
    let seen: { instructions?: string; prompt?: string } = {};
    await narrateDigest(digest, async (instructions, prompt) => {
      seen = { instructions, prompt };
      return "ok";
    });
    expect(seen.instructions).toContain("daily digest");
    expect(seen.prompt).toContain("totals");
  });

  it("degrades to null when the generator throws", async () => {
    const out = await narrateDigest(digest, async () => {
      throw new Error("rate limited");
    });
    expect(out).toBeNull();
  });

  it("degrades to null on empty output", async () => {
    const out = await narrateDigest(digest, async () => "   ");
    expect(out).toBeNull();
  });
});
