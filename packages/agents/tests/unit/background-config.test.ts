/**
 * Unit tests for backgroundIfEnabled (foreman-7am4) — the env gate that opts a
 * tool into Mastra background execution. Off unless FOREMAN_BACKGROUND_TOOLS=1.
 */
import { afterEach, describe, expect, it } from "vitest";
import { backgroundIfEnabled } from "@/lib/background";

const orig = process.env.FOREMAN_BACKGROUND_TOOLS;
afterEach(() => {
  if (orig === undefined) delete process.env.FOREMAN_BACKGROUND_TOOLS;
  else process.env.FOREMAN_BACKGROUND_TOOLS = orig;
});

describe("backgroundIfEnabled", () => {
  it("returns a background config when the flag is set to '1'", () => {
    process.env.FOREMAN_BACKGROUND_TOOLS = "1";
    expect(backgroundIfEnabled()).toEqual({ background: { enabled: true } });
  });

  it("is off by default — returns an empty slice", () => {
    delete process.env.FOREMAN_BACKGROUND_TOOLS;
    expect(backgroundIfEnabled()).toEqual({});
  });

  it("treats any value other than '1' as off", () => {
    process.env.FOREMAN_BACKGROUND_TOOLS = "true";
    expect(backgroundIfEnabled()).toEqual({});
  });
});
