/**
 * Local durable execution (foreman-3uje).
 *
 * The gate tests are cheap. The one that matters is the end-to-end run: it
 * executes a Foreman-shaped durable (step -> human-approval gate) in a real
 * child process on the filesystem adapter, suspends it, delivers the decision
 * through the SAME seam `/automations` Approve uses (foreman-gk6k), and resumes
 * it to completion. Offline — no credentials, no network, no Zapier allowlist.
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  durableStateDirFor,
  filesystemDelivery,
  findOpenLocalGate,
  type LocalDurableStore,
} from "../../src/lib/durable/delivery";
import {
  assertLocalDurableAllowed,
  LocalDurableUnavailableError,
  readLocalDurableSource,
  runDurableLocally,
} from "../../src/lib/durable/runner";
import { __resetIsolationCache } from "../../src/lib/providers/sandbox";

// The child resolves `@zapier/zapier-durable` by walking node_modules up from
// its run directory, so the workspace root must live INSIDE the repo. A tmpdir
// outside it would fail to resolve — the same constraint production satisfies
// by putting the workspace under /app.
const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACE_ROOT = path.join(PKG_ROOT, ".tmp-durable-runner-test");
const TENANT = "tenant-a";

const SAVED = {
  workspace: process.env.FOREMAN_WORKSPACE_PATH,
  override: process.env.FOREMAN_DURABLE_ALLOW_UNISOLATED,
  isolation: process.env.FOREMAN_SANDBOX_ISOLATION,
  nodeEnv: process.env.NODE_ENV,
};

beforeAll(() => {
  rmSync(WORKSPACE_ROOT, { recursive: true, force: true });
  mkdirSync(WORKSPACE_ROOT, { recursive: true });
});

afterAll(() => {
  rmSync(WORKSPACE_ROOT, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.FOREMAN_WORKSPACE_PATH = WORKSPACE_ROOT;
  __resetIsolationCache();
});

afterEach(() => {
  for (const [k, v] of [
    ["FOREMAN_WORKSPACE_PATH", SAVED.workspace],
    ["FOREMAN_DURABLE_ALLOW_UNISOLATED", SAVED.override],
    ["FOREMAN_SANDBOX_ISOLATION", SAVED.isolation],
    ["NODE_ENV", SAVED.nodeEnv],
  ] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  __resetIsolationCache();
});

/**
 * A Foreman-shaped durable: one step, then a human-approval gate. Deliberately
 * NOT importing @zapier/zapier-sdk — a real generated workflow would, but that
 * needs credentials, and what is under test here is the execution substrate.
 */
const APPROVAL_DURABLE = `
import { defineDurable } from "@zapier/zapier-durable";

const workflow = defineDurable({
  name: "test-approval",
  run: async (ctx, input) => {
    const prepared = await ctx.step("prepare", async () => ({ subject: input.subject }));
    const [approval] = await ctx.createCallback("human-approval");
    const decision = await approval;
    return { subject: prepared.subject, approved: decision.approved };
  },
});

export default workflow;
`;

describe("the isolation gate", () => {
  it("refuses to execute generated source with no OS boundary", () => {
    // No backend on this platform (win32) and no override → hard refusal.
    delete process.env.FOREMAN_DURABLE_ALLOW_UNISOLATED;
    const detect = assertLocalDurableAllowedSafely();
    if (detect.isolated) {
      // On a host that CAN isolate (Linux CI with bwrap, macOS), there is
      // nothing to refuse — assert the positive instead.
      expect(detect.backend === "bwrap" || detect.backend === "seatbelt").toBe(true);
      return;
    }
    expect(() => assertLocalDurableAllowed()).toThrow(LocalDurableUnavailableError);
    expect(() => assertLocalDurableAllowed()).toThrow(/Refusing to run durable source locally/);
  });

  it("names every way out in the refusal, not just the override", () => {
    delete process.env.FOREMAN_DURABLE_ALLOW_UNISOLATED;
    if (assertLocalDurableAllowedSafely().isolated) return;
    let message = "";
    try {
      assertLocalDurableAllowed();
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/bubblewrap/);
    expect(message).toMatch(/seatbelt/);
    expect(message).toMatch(/ZAPIER_DURABLE_ADAPTER=zapier/);
    expect(message).toMatch(/FOREMAN_DURABLE_ALLOW_UNISOLATED=1/);
  });

  it("honors the single documented override for single-tenant boxes", () => {
    process.env.FOREMAN_DURABLE_ALLOW_UNISOLATED = "1";
    const decision = assertLocalDurableAllowed();
    expect(decision.overridden).toBe(!assertLocalDurableAllowedSafely().isolated);
  });
});

describe("end-to-end local run (offline)", () => {
  beforeEach(() => {
    // This host cannot isolate; the override is what lets the execution path be
    // exercised at all. On Linux/macOS the gate passes on its own and the
    // override is a no-op.
    process.env.FOREMAN_DURABLE_ALLOW_UNISOLATED = "1";
  });

  it("runs, suspends at the approval gate, resumes, and completes", async () => {
    const first = await runDurableLocally({
      tenantKey: TENANT,
      source: APPROVAL_DURABLE,
      input: { subject: "ship it" },
    });

    expect(first.error, `runner logs:\n${first.logs}`).toBeUndefined();
    expect(first.done).toBe(false);
    expect(first.executionId).toBeTruthy();

    // The run's source is re-keyed to the executionId, which is the only id the
    // rest of Foreman carries (automation_run.durable_run_id).
    const stored = await readLocalDurableSource(TENANT, first.executionId as string);
    expect(stored).toContain("defineDurable");

    // Deliver the approval through the production seam, against the same
    // per-tenant state directory the run wrote to.
    const { FilesystemClient } = await import("@zapier/zapier-durable");
    const store = new FilesystemClient({
      baseDir: path.resolve(durableStateDirFor(TENANT)),
    }) as unknown as LocalDurableStore;

    const gate = findOpenLocalGate(store, first.executionId as string);
    expect(gate, "no open callback gate found on the local execution").not.toBeNull();

    const delivery = filesystemDelivery(store);
    const outcome = await delivery.deliver(first.executionId as string, {
      payload: { approved: true },
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.action).toBe("resumed");

    // Resume — no source passed, proving it is read back from the run directory.
    const second = await runDurableLocally({
      tenantKey: TENANT,
      executionId: first.executionId,
    });
    expect(second.error, `resume logs:\n${second.logs}`).toBeUndefined();
    expect(second.done).toBe(true);
    expect(second.result).toMatchObject({ subject: "ship it", approved: true });
  }, 180_000);

  it("keeps each tenant's durable state in its own directory", async () => {
    await runDurableLocally({
      tenantKey: "tenant-b",
      source: APPROVAL_DURABLE,
      input: { subject: "other tenant" },
    });
    expect(existsSync(path.join(WORKSPACE_ROOT, "tenant-b", ".durable"))).toBe(true);
    expect(durableStateDirFor("tenant-b")).not.toBe(durableStateDirFor(TENANT));
  }, 180_000);

  it("does not hand the child this server's secrets", async () => {
    process.env.__FOREMAN_TEST_SECRET = "super-secret-value";
    try {
      const leak = await runDurableLocally({
        tenantKey: "tenant-env",
        source: `
import { defineDurable } from "@zapier/zapier-durable";
export default defineDurable({
  name: "env-probe",
  run: async () => ({
    sawSecret: !!process.env.__FOREMAN_TEST_SECRET,
    sawDatabaseUrl: !!process.env.DATABASE_URL,
    passedThrough: process.env.ALLOWED_ONE ?? null,
  }),
});
`,
        env: { ALLOWED_ONE: "yes" },
      });

      expect(leak.error, `env probe logs:\n${leak.logs}`).toBeUndefined();
      expect(leak.done).toBe(true);
      // The env is an allowlist: only what the caller named crosses over.
      expect(leak.result).toMatchObject({
        sawSecret: false,
        sawDatabaseUrl: false,
        passedThrough: "yes",
      });
    } finally {
      delete process.env.__FOREMAN_TEST_SECRET;
    }
  }, 180_000);
});

/** Is this host actually able to isolate? Used to keep assertions honest across OSes. */
function assertLocalDurableAllowedSafely(): { isolated: boolean; backend: string } {
  const saved = process.env.FOREMAN_DURABLE_ALLOW_UNISOLATED;
  process.env.FOREMAN_DURABLE_ALLOW_UNISOLATED = "1";
  try {
    const d = assertLocalDurableAllowed();
    return { isolated: !d.overridden, backend: d.backend };
  } finally {
    if (saved === undefined) delete process.env.FOREMAN_DURABLE_ALLOW_UNISOLATED;
    else process.env.FOREMAN_DURABLE_ALLOW_UNISOLATED = saved;
  }
}
