/**
 * Unit tests for resolveAppSlug (foreman-c8fo) — catalog-backed app-key
 * resolution that replaces the string-munging normalizeAppKey.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

let catalogResult: { data: { slug: string } | null } = { data: null };

vi.mock("@/lib/db", () => ({
  getSupabase: () => ({
    from: () => {
      const b: any = {};
      for (const m of ["select", "or", "limit"]) b[m] = vi.fn().mockReturnValue(b);
      b.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(catalogResult));
      return b;
    },
  }),
}));

afterEach(() => {
  catalogResult = { data: null };
});

describe("resolveAppSlug", () => {
  it("maps a raw app_key to its catalog slug", async () => {
    catalogResult = { data: { slug: "github" } };
    const { resolveAppSlug } = await import("@/lib/catalog/resolve");
    expect(await resolveAppSlug("GitHubCLIAPI")).toBe("github");
  });

  it("returns the slug unchanged when given a slug", async () => {
    catalogResult = { data: { slug: "github" } };
    const { resolveAppSlug } = await import("@/lib/catalog/resolve");
    expect(await resolveAppSlug("github")).toBe("github");
  });

  it("passes the key through unchanged when the catalog has no match (unseeded)", async () => {
    catalogResult = { data: null };
    const { resolveAppSlug } = await import("@/lib/catalog/resolve");
    // The SDK accepts raw app_keys, so passing it through is safe — and crucially
    // it does NOT mangle "GitHubCLIAPI" into the broken "git-hub".
    expect(await resolveAppSlug("GitHubCLIAPI")).toBe("GitHubCLIAPI");
  });

  it("passes through non-identifier input without querying", async () => {
    const { resolveAppSlug } = await import("@/lib/catalog/resolve");
    expect(await resolveAppSlug("bad,key")).toBe("bad,key");
  });

  it("handles an empty key", async () => {
    const { resolveAppSlug } = await import("@/lib/catalog/resolve");
    expect(await resolveAppSlug("")).toBe("");
  });
});
