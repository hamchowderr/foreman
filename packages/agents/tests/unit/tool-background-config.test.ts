/**
 * Unit tests for toolBackgroundConfig (foreman-7am4) — the gate that opts
 * read-only Zapier tools into Mastra background execution. The safety invariant
 * is that write/approval tools (isReadOnly=false) are NEVER backgrounded, and
 * the feature is off unless FOREMAN_BACKGROUND_TOOLS=1.
 */
import { afterEach, describe, expect, it } from "vitest";
import { toolBackgroundConfig } from "@/lib/zapier-sdk-tools";

const orig = process.env.FOREMAN_BACKGROUND_TOOLS;
afterEach(() => {
  if (orig === undefined) delete process.env.FOREMAN_BACKGROUND_TOOLS;
  else process.env.FOREMAN_BACKGROUND_TOOLS = orig;
});

describe("toolBackgroundConfig", () => {
  it("opts a read-only tool into background when the flag is set", () => {
    process.env.FOREMAN_BACKGROUND_TOOLS = "1";
    expect(toolBackgroundConfig(true)).toEqual({ background: { enabled: true } });
  });

  it("never backgrounds a write/approval tool, even with the flag set", () => {
    process.env.FOREMAN_BACKGROUND_TOOLS = "1";
    expect(toolBackgroundConfig(false)).toEqual({});
  });

  it("is off by default — read-only tools stay foreground without the flag", () => {
    delete process.env.FOREMAN_BACKGROUND_TOOLS;
    expect(toolBackgroundConfig(true)).toEqual({});
  });

  it("treats any value other than '1' as off", () => {
    process.env.FOREMAN_BACKGROUND_TOOLS = "true";
    expect(toolBackgroundConfig(true)).toEqual({});
  });
});
