import type { ExperimentalZapierSdk } from "../zapier/sdk";
import { cancelDurableRun, postCallback, resolveCallbackUrl } from "./deploy";

/**
 * Adapter-aware delivery of a human decision to a durable's approval gate
 * (foreman-gk6k).
 *
 * Approving a run means "get this payload to the waiting callback". HOW that
 * happens is entirely adapter-specific:
 *
 * - **zapier**: the gate lives on Zapier's servers. `getDurableRun` will not
 *   expose the callback URL, so it is recovered from the step the durable
 *   authors to report it (`humanApprovalGate` in `./source`), then POSTed.
 * - **filesystem**: the gate lives on local disk. `callbackBaseUrl` is a
 *   `file://` URL, so there is nothing to POST to — delivery goes through the
 *   adapter client's `callback(token, payload)`.
 *
 * A caller that reaches for `resolveCallbackUrl` + `postCallback` directly
 * works on Zapier and SILENTLY does nothing on the filesystem adapter. Route
 * and service code should only ever call `deliverDecision`.
 */

export type DurableAdapter = "zapier" | "filesystem";

export interface DecisionInput {
  /** Payload delivered to the gate (approve). Ignored when `cancel` is set. */
  payload?: unknown;
  /** Hard deny — terminate the run instead of resuming it. */
  cancel?: boolean;
  /** Which gate, when the run has more than one open callback. */
  callbackName?: string;
}

export interface DecisionResult {
  ok: boolean;
  action: "resumed" | "cancelled" | "none";
  /** HTTP status of the callback POST. Zapier adapter only — local delivery has no HTTP. */
  status?: number;
  /**
   * Run status the adapter reports after a cancel. Persisted verbatim rather
   * than assumed to be "cancelled" — Zapier can legitimately return something
   * else (a run that finished before the cancel landed).
   */
  runStatus?: string;
  /** Why it could not act, when `ok` is false. */
  reason?: string;
}

/** One way of getting a decision to a waiting gate. */
export interface DecisionDelivery {
  readonly adapter: DurableAdapter;
  deliver(durableRunId: string, input: DecisionInput): Promise<DecisionResult>;
}

/**
 * Which runtime durables execute on.
 *
 * Defaults to `"zapier"` — deliberately NOT the package's own `"filesystem"`
 * default. Every Foreman durable today runs on the Zapier adapter, so
 * inheriting the upstream default would silently repoint production at an
 * empty local store. `foreman-2qbk` owns making this a real, validated setting.
 */
export function activeDurableAdapter(): DurableAdapter {
  return process.env.ZAPIER_DURABLE_ADAPTER === "filesystem" ? "filesystem" : "zapier";
}

/** Delivery against Zapier's hosted runtime — the path Foreman ships today. */
export function zapierDelivery(sdk: ExperimentalZapierSdk): DecisionDelivery {
  return {
    adapter: "zapier",
    async deliver(durableRunId, input) {
      if (input.cancel) {
        const status = await cancelDurableRun(sdk, durableRunId);
        return { ok: status === "cancelled", action: "cancelled", runStatus: status };
      }
      const cb = await resolveCallbackUrl(sdk, durableRunId, input.callbackName);
      if (!cb) {
        return { ok: false, action: "none", reason: "no open callback URL for this run" };
      }
      const res = await postCallback(cb.url, input.payload ?? {});
      return { ok: res.ok, action: "resumed", status: res.status };
    },
  };
}

/**
 * Minimal view of `FilesystemClient` this module needs. Structural, so tests can
 * pass a fake and so importing `@zapier/zapier-durable/node` stays lazy.
 *
 * `getOperations` is a synchronous, LEASE-FREE read. Do not reach for
 * `checkout()` to inspect state — it acquires the runner's lease and returns
 * `{ leased: false }` when the runner already holds it.
 */
export interface LocalDurableStore {
  getOperations(executionId: string): Array<{
    name: string;
    type: string;
    status: string;
    callback_token?: string;
  }>;
  callback(token: string, payload: unknown): Promise<{ ok: true } | { error: string }>;
  checkout(
    executionId: string,
    req?: { lease_token?: string },
  ): Promise<{ leased: true; lease_token: string } | { leased: false }>;
  release(
    executionId: string,
    req: { lease_token: string; status: string; error?: unknown },
  ): Promise<{ ok: true; done: boolean }>;
}

/**
 * Find the still-open callback gate for a local execution.
 *
 * Mirrors `resolveCallbackUrl`'s selection rule — named gate, else the sole
 * pending one — but reads local operations instead of the Zapier wire. Local
 * `OperationStatus` has no `"waiting"` member (that is an *execution* status),
 * so a live gate is exactly `type: "callback"` + `status: "pending"`.
 */
export function findOpenLocalGate(
  store: LocalDurableStore,
  executionId: string,
  callbackName?: string,
): { token: string; name: string } | null {
  const open = store
    .getOperations(executionId)
    .filter((o) => o.type === "callback" && o.status === "pending" && o.callback_token);
  const gate = callbackName ? open.find((o) => o.name === callbackName) : open[0];
  return gate?.callback_token ? { token: gate.callback_token, name: gate.name } : null;
}

/** Delivery against a local filesystem store — no Zapier account, no network. */
export function filesystemDelivery(store: LocalDurableStore): DecisionDelivery {
  return {
    adapter: "filesystem",
    async deliver(executionId, input) {
      if (input.cancel) {
        // No cancel primitive on the adapter. A suspended run holds no lease,
        // so take it and release the execution as terminally failed. If the
        // runner IS mid-tick the lease is refused and we report that honestly
        // rather than half-cancelling.
        const lease = await store.checkout(executionId);
        if (!lease.leased) {
          return { ok: false, action: "none", reason: "run is leased; cannot cancel mid-tick" };
        }
        await store.release(executionId, {
          lease_token: lease.lease_token,
          status: "failed",
          error: { name: "Cancelled", message: "Cancelled by user from Foreman" },
        });
        return { ok: true, action: "cancelled", runStatus: "cancelled" };
      }

      const gate = findOpenLocalGate(store, executionId, input.callbackName);
      if (!gate) {
        return { ok: false, action: "none", reason: "no open callback for this run" };
      }
      // `CallbackRequest` is the raw payload — wrapping it as `{ payload }`
      // fails edge validation against the gate's payloadSchema.
      const res = await store.callback(gate.token, input.payload ?? {});
      if ("error" in res) {
        return { ok: false, action: "none", reason: `callback rejected: ${res.error}` };
      }
      return { ok: true, action: "resumed" };
    },
  };
}

/**
 * Where one tenant's local durable state lives — INSIDE that tenant's agent
 * workspace directory, alongside its files.
 *
 * Mirrors `mastra/agents/workspace.ts` (`FOREMAN_WORKSPACE_PATH`, default
 * `./data/workspace`, one directory per `workspace_id`). Keeping durable state
 * under the same per-tenant root means one workspace's suspended runs can never
 * be read or resumed from another's, and nothing lands in the developer's home
 * directory.
 *
 * This is path CO-LOCATION, not integration: the adapter writes with plain
 * `node:fs`, not through Mastra's filesystem abstraction. Whether that keeps
 * working under the sandbox-provider work (foreman-zlru) depends on WHERE the
 * durable process runs:
 *
 * - **Inside the sandbox** — the per-tenant workspace FS is mounted there
 *   (symlink locally, s3fs/gcsfuse in cloud), so a plain `node:fs` write to the
 *   mount path lands on the real workspace FS. Works unchanged.
 * - **On the host, with a CLOUD workspace FS** (foreman-udo9) — the host has no
 *   mount, so `node:fs` writes to a local path that is no longer the workspace.
 *   Diverges silently.
 *
 * Foreman runs durables in the agent-server process today, so the second case
 * is the one that will actually bite. The durable package supports custom
 * adapters; an adapter backed by the workspace filesystem would make this
 * correct by construction rather than by path coincidence (foreman-1uz7).
 */
export function durableStateDirFor(tenantKey: string): string {
  const root = process.env.FOREMAN_WORKSPACE_PATH ?? "./data/workspace";
  const safe = tenantKey.replace(/[^a-zA-Z0-9_-]/g, "") || "_shared";
  return `${root}/${safe}/.durable`;
}

/**
 * Build the delivery for the active adapter.
 *
 * The Zapier SDK is passed as a thunk so the filesystem path never mints a
 * Zapier client (it has no account), and the durable package is imported
 * lazily so the Zapier path never loads the local adapter.
 */
export async function deliveryForActiveAdapter(
  getSdk: () => Promise<ExperimentalZapierSdk>,
  opts: { tenantKey?: string } = {},
): Promise<DecisionDelivery> {
  if (activeDurableAdapter() === "filesystem") {
    // Import from the ROOT entry point, never `@zapier/zapier-durable/node`.
    // The subpath re-exports the same names but carries SEPARATE config state:
    // `configureDurable` there reports success via its own `getConfig()` while
    // the durable runtime keeps writing to the default `fsDir`. Measured
    // 2026-07-28 on 0.11.0.
    const { FilesystemClient } = await import("@zapier/zapier-durable");
    // Construct the client explicitly instead of `createClient()`. `createClient`
    // reads PROCESS-GLOBAL config, which cannot be per-tenant on a server serving
    // several workspaces at once — flipping `fsDir` per request is a race. An
    // explicit `baseDir` (and `DurableCallOptions.client` on the run side) keeps
    // tenancy per-call, with no global state involved.
    const baseDir = durableStateDirFor(opts.tenantKey ?? "_shared");
    return filesystemDelivery(new FilesystemClient({ baseDir }) as unknown as LocalDurableStore);
  }
  return zapierDelivery(await getSdk());
}
