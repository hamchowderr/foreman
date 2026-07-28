import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  activeDurableAdapter,
  durableStateDirFor,
  filesystemDelivery,
  findOpenLocalGate,
  type LocalDurableStore,
  zapierDelivery,
} from "@/lib/durable/delivery";

/**
 * foreman-gk6k — the delivery seam must behave identically from the caller's
 * point of view on both adapters, while the mechanics underneath differ
 * completely (HTTP POST to a resolved URL vs. a local store call).
 *
 * The filesystem half runs a REAL durable against a REAL FilesystemClient in a
 * temp dir: no credentials, no network, no Zapier early-access allowlist.
 */

const HOME_EXECUTIONS = join(homedir(), ".config", "zapier-sdk", "durable", "executions");
const homeExecutionsBefore = existsSync(HOME_EXECUTIONS) ? readdirSync(HOME_EXECUTIONS).length : 0;

const stateDirs: string[] = [];
function tempStateDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "foreman-delivery-test-"));
  stateDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of stateDirs) rmSync(dir, { recursive: true, force: true });
});

describe("activeDurableAdapter", () => {
  const original = process.env.ZAPIER_DURABLE_ADAPTER;
  afterAll(() => {
    if (original === undefined) delete process.env.ZAPIER_DURABLE_ADAPTER;
    else process.env.ZAPIER_DURABLE_ADAPTER = original;
  });

  it("defaults to zapier, NOT the package's own filesystem default", () => {
    delete process.env.ZAPIER_DURABLE_ADAPTER;
    expect(activeDurableAdapter()).toBe("zapier");
  });

  it("selects filesystem only on an exact match", () => {
    process.env.ZAPIER_DURABLE_ADAPTER = "filesystem";
    expect(activeDurableAdapter()).toBe("filesystem");
    process.env.ZAPIER_DURABLE_ADAPTER = "Filesystem";
    expect(activeDurableAdapter()).toBe("zapier");
  });
});

describe("durableStateDirFor", () => {
  const original = process.env.FOREMAN_WORKSPACE_PATH;
  afterAll(() => {
    if (original === undefined) delete process.env.FOREMAN_WORKSPACE_PATH;
    else process.env.FOREMAN_WORKSPACE_PATH = original;
  });

  it("nests durable state inside the tenant's own workspace directory", () => {
    delete process.env.FOREMAN_WORKSPACE_PATH;
    expect(durableStateDirFor("ws-abc")).toBe("./data/workspace/ws-abc/.durable");
  });

  it("keeps two workspaces on disjoint paths", () => {
    expect(durableStateDirFor("ws-a")).not.toBe(durableStateDirFor("ws-b"));
  });

  it("follows FOREMAN_WORKSPACE_PATH, like the agent workspace does", () => {
    process.env.FOREMAN_WORKSPACE_PATH = "/srv/foreman";
    expect(durableStateDirFor("ws-abc")).toBe("/srv/foreman/ws-abc/.durable");
  });

  it("cannot be escaped by a traversal-shaped tenant key", () => {
    delete process.env.FOREMAN_WORKSPACE_PATH;
    expect(durableStateDirFor("../../etc")).toBe("./data/workspace/etc/.durable");
    expect(durableStateDirFor("")).toBe("./data/workspace/_shared/.durable");
  });
});

describe("findOpenLocalGate", () => {
  const ops = [
    { name: "prepare", type: "step", status: "completed" },
    { name: "first-gate", type: "callback", status: "completed", callback_token: "tok-done" },
    { name: "second-gate", type: "callback", status: "pending", callback_token: "tok-open" },
    { name: "third-gate", type: "callback", status: "pending", callback_token: "tok-other" },
  ];
  const store = { getOperations: () => ops } as unknown as LocalDurableStore;

  it("ignores completed gates and steps, taking the first still-pending one", () => {
    expect(findOpenLocalGate(store, "exec-1")).toEqual({ token: "tok-open", name: "second-gate" });
  });

  it("selects by name when the run has more than one open gate", () => {
    expect(findOpenLocalGate(store, "exec-1", "third-gate")).toEqual({
      token: "tok-other",
      name: "third-gate",
    });
  });

  it("returns null for an unknown gate name rather than falling back", () => {
    expect(findOpenLocalGate(store, "exec-1", "nope")).toBeNull();
  });

  it("returns null when nothing is open", () => {
    const closed = { getOperations: () => [ops[1]] } as unknown as LocalDurableStore;
    expect(findOpenLocalGate(closed, "exec-1")).toBeNull();
  });
});

describe("zapierDelivery", () => {
  it("resolves the reported callback URL and POSTs the payload", async () => {
    const posted: Array<{ url: string; body: unknown }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      posted.push({ url, body: JSON.parse(init.body as string) });
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch;

    const sdk = {
      getDurableRun: async () => ({
        data: {
          execution: {
            operations: [
              {
                name: "__report_callback_url_approve",
                status: "completed",
                result: { callbackUrl: "https://cb.zapier.test/abc", callbackName: "approve" },
              },
              { name: "approve", status: "pending", callback_token: "tok" },
            ],
          },
        },
      }),
    };

    try {
      const res = await zapierDelivery(sdk as never).deliver("run-1", {
        payload: { approved: true },
      });
      expect(res).toMatchObject({ ok: true, action: "resumed", status: 200 });
      expect(posted).toEqual([{ url: "https://cb.zapier.test/abc", body: { approved: true } }]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reports the status the SDK returns on cancel instead of assuming cancelled", async () => {
    const sdk = { cancelDurableRun: async () => ({ data: { status: "completed" } }) };
    const res = await zapierDelivery(sdk as never).deliver("run-1", { cancel: true });
    // Finished before the cancel landed: not ok, but the real status is surfaced
    // so the caller persists the truth.
    expect(res).toEqual({ ok: false, action: "cancelled", runStatus: "completed" });
  });

  it("does not POST when no gate reported a URL", async () => {
    const sdk = {
      getDurableRun: async () => ({ data: { execution: { operations: [] } } }),
    };
    const res = await zapierDelivery(sdk as never).deliver("run-1", { payload: {} });
    expect(res).toMatchObject({ ok: false, action: "none" });
  });
});

describe("filesystemDelivery (real adapter, offline)", () => {
  // Everything comes from the ROOT entry point. `@zapier/zapier-durable/node`
  // re-exports the same names but holds SEPARATE config state, so configuring
  // through it reports success while the runtime writes to the default fsDir —
  // i.e. into the developer's real home directory. Measured on 0.11.0.
  let createClient: typeof import("@zapier/zapier-durable").createClient;
  let defineDurable: typeof import("@zapier/zapier-durable").defineDurable;

  beforeAll(async () => {
    ({ createClient, defineDurable } = await import("@zapier/zapier-durable"));
  });

  async function suspendedRun(baseDir: string) {
    const { configureDurable, getConfig } = await import("@zapier/zapier-durable");
    // The key is `fsDir` — an unknown key is silently ignored and falls back to
    // the home default. Assert the temp dir actually took.
    configureDurable({ adapter: "filesystem", fsDir: baseDir });
    expect(getConfig().fsDir).toBe(baseDir);

    const durable = defineDurable({
      name: "gk6k-approval",
      run: async (ctx) => {
        const [approval] = await ctx.createCallback("human-approval");
        const decision = (await approval) as { approved: boolean };
        return { approved: decision.approved };
      },
    });

    const first = await durable({});
    expect(first.done).toBe(false);
    return { durable, executionId: first.executionId as string };
  }

  it("delivers an approval to a real suspended run, which then completes", async () => {
    const baseDir = tempStateDir();
    const { durable, executionId } = await suspendedRun(baseDir);

    const store = createClient() as unknown as LocalDurableStore;
    const res = await filesystemDelivery(store).deliver(executionId, {
      payload: { approved: true },
    });

    // No HTTP status: there is no HTTP on this path.
    expect(res).toEqual({ ok: true, action: "resumed" });

    const resumed = await durable(executionId);
    expect(resumed.done).toBe(true);
    expect(resumed.result).toEqual({ approved: true });
  });

  it("reports a clear reason when the run has no open gate", async () => {
    const baseDir = tempStateDir();
    const { executionId } = await suspendedRun(baseDir);
    const store = createClient() as unknown as LocalDurableStore;

    await filesystemDelivery(store).deliver(executionId, { payload: { approved: true } });
    // Second delivery — the gate is closed now.
    const again = await filesystemDelivery(store).deliver(executionId, {
      payload: { approved: true },
    });
    expect(again.ok).toBe(false);
    expect(again.reason).toMatch(/no open callback/);
  });

  it("cancels a suspended run by releasing it as failed", async () => {
    const baseDir = tempStateDir();
    const { executionId } = await suspendedRun(baseDir);
    const store = createClient() as unknown as LocalDurableStore;

    const res = await filesystemDelivery(store).deliver(executionId, { cancel: true });
    expect(res).toEqual({ ok: true, action: "cancelled", runStatus: "cancelled" });

    const client = createClient() as unknown as {
      getExecution(id: string): { status: string } | null;
    };
    expect(client.getExecution(executionId)?.status).toBe("failed");
  });

  it("wrote nothing into the developer's real home directory", () => {
    // Regression guard. Both known ways to get this wrong (the `filesystem:
    // { baseDir }` key that does not exist, and configuring via the `/node`
    // subpath) fail SILENTLY by writing to ~/.config/zapier-sdk/durable.
    const home = join(homedir(), ".config", "zapier-sdk", "durable", "executions");
    const leaked = existsSync(home) ? readdirSync(home).length : 0;
    expect(leaked).toBe(homeExecutionsBefore);
  });
});
