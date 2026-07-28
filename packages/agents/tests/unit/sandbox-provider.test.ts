/**
 * Unit tests for the sandbox/filesystem provider factory (foreman-zlru).
 *
 * The important behavior here is the isolation posture, not the plumbing:
 * isolation is ON by default, and we fail closed rather than silently execute
 * agent commands on the host without a boundary.
 */
import { LocalSandbox } from "@mastra/core/workspace";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetIsolationCache,
  activeIsolationMode,
  activeSandboxProvider,
  resolveIsolation,
  resolveSandbox,
  resolveWorkspaceFilesystem,
} from "../../src/lib/providers/sandbox";

const ENV_KEYS = ["SANDBOX_PROVIDER", "FOREMAN_SANDBOX_ISOLATION", "NODE_ENV"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  __resetIsolationCache();
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  __resetIsolationCache();
  vi.restoreAllMocks();
});

/** Pretend the platform does / doesn't offer a native backend. */
function mockDetect(available: boolean, backend: "bwrap" | "seatbelt" | "none" = "bwrap") {
  return vi.spyOn(LocalSandbox, "detectIsolation").mockReturnValue({
    backend: available ? backend : "none",
    available,
    message: available ? `${backend} available` : "Native sandboxing is not supported on win32.",
  });
}

describe("provider selection", () => {
  it("defaults to local when SANDBOX_PROVIDER is unset", () => {
    expect(activeSandboxProvider()).toBe("local");
    expect(activeIsolationMode()).toBe("auto");
  });

  it("rejects an unknown provider instead of falling back to local", () => {
    process.env.SANDBOX_PROVIDER = "kubernetes";
    expect(() => activeSandboxProvider()).toThrow(/Invalid SANDBOX_PROVIDER/);
  });

  it("rejects an unknown isolation mode", () => {
    process.env.FOREMAN_SANDBOX_ISOLATION = "maybe";
    expect(() => activeIsolationMode()).toThrow(/Invalid FOREMAN_SANDBOX_ISOLATION/);
  });

  it("refuses to build a provider it cannot actually construct", () => {
    // A silent fallback to `local` here would run agent commands on the host
    // under a config that claims they are in a remote sandbox.
    process.env.SANDBOX_PROVIDER = "e2b";
    expect(() => resolveSandbox({ workingDirectory: "/tmp/x", tenantKey: "t" })).toThrow(
      /not wired yet/,
    );
  });
});

describe("isolation posture", () => {
  it("uses the detected backend when the platform offers one", () => {
    mockDetect(true, "bwrap");
    const decision = resolveIsolation();
    expect(decision).toMatchObject({ backend: "bwrap", available: true, mode: "auto" });
  });

  it("passes the resolved backend through to the sandbox it builds", () => {
    // `LocalSandbox`'s constructor independently re-checks availability and
    // throws IsolationUnavailableError — it will not accept a backend the host
    // cannot provide, no matter what detection says. So on a host without a
    // backend (this one, and CI), asking for bwrap surfaces as that error, which
    // is itself the proof that resolveSandbox forwarded the resolved backend
    // rather than dropping it.
    mockDetect(true, "bwrap");
    expect(() => resolveSandbox({ workingDirectory: "/tmp/x", tenantKey: "acme" })).toThrow(
      /bwrap/,
    );
  });

  it("builds a working sandbox, tagged per tenant, on a host with no backend", () => {
    mockDetect(false);
    // `resolveSandbox` is typed as the provider-agnostic `WorkspaceSandbox`
    // (remote providers have no `isolation`), so narrow to inspect it here.
    const sandbox = resolveSandbox({
      workingDirectory: "/tmp/x",
      tenantKey: "acme",
    }) as LocalSandbox;
    expect(sandbox.isolation).toBe("none");
    expect(sandbox.id).toBe("foreman-sandbox-acme");
  });

  it("degrades with a reason (not silently) when no backend exists outside production", () => {
    mockDetect(false);
    const decision = resolveIsolation();
    expect(decision.backend).toBe("none");
    expect(decision.available).toBe(false);
    expect(decision.reason).toMatch(/run directly on the host/);
  });

  it("REFUSES to run unisolated in production", () => {
    mockDetect(false);
    process.env.NODE_ENV = "production";
    expect(() => resolveIsolation()).toThrow(/Refusing to run sandbox commands unisolated/);
  });

  it("still isolates in production when a backend is available", () => {
    mockDetect(true, "bwrap");
    process.env.NODE_ENV = "production";
    expect(resolveIsolation().backend).toBe("bwrap");
  });

  it("require mode throws even in dev", () => {
    mockDetect(false);
    process.env.FOREMAN_SANDBOX_ISOLATION = "require";
    expect(() => resolveIsolation()).toThrow(/no isolation backend is available/);
  });

  it("off mode is an explicit, un-probed opt-out", () => {
    const spy = mockDetect(true, "bwrap");
    process.env.FOREMAN_SANDBOX_ISOLATION = "off";
    const decision = resolveIsolation();
    expect(decision.backend).toBe("none");
    expect(decision.reason).toMatch(/=off/);
    // Opting out must not even probe — the answer cannot change the outcome.
    expect(spy).not.toHaveBeenCalled();
  });

  it("off mode is honored in production too (explicit risk acceptance)", () => {
    mockDetect(false);
    process.env.FOREMAN_SANDBOX_ISOLATION = "off";
    process.env.NODE_ENV = "production";
    expect(() => resolveIsolation()).not.toThrow();
  });

  it("memoizes the decision — detectIsolation shells out and the workspace is per-request", () => {
    const spy = mockDetect(true, "bwrap");
    resolveIsolation();
    resolveIsolation();
    resolveIsolation();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("filesystem provider", () => {
  it("keeps path resolution contained to the tenant directory", () => {
    const fs = resolveWorkspaceFilesystem("/tmp/workspace/acme");
    // `contained` is the tenant boundary for file access, independent of
    // OS-level isolation — it must not regress when isolation is unavailable.
    expect((fs as unknown as { contained: boolean }).contained).toBe(true);
    expect(fs.provider).toBe("local");
  });
});
