/**
 * Local durable execution (foreman-3uje).
 *
 * On the Zapier adapter, a durable's source runs in Zapier's own sandbox. On the
 * filesystem adapter there is no such host — so something in Foreman has to run
 * it, and that source is a STRING the LLM authored from a user's prompt. Running
 * it in-process would put prompt-influenced arbitrary code in the same process as
 * `DATABASE_URL`, the Supabase service-role key, and every Infisical-injected
 * provider key. That is not an acceptable default, so this module never does it.
 *
 * Instead the source is written into the tenant's own workspace directory and
 * executed by a separate `node` process inside the workspace sandbox, under the
 * OS isolation backend `lib/providers/sandbox.ts` resolves (bwrap on Linux,
 * seatbelt on macOS). Two properties matter more than anything else here:
 *
 *  1. **Isolation is required, not preferred.** `assertLocalDurableAllowed()`
 *     refuses to run when no backend is available. There is exactly one
 *     documented override, for single-tenant boxes where the operator's prompts,
 *     machine and keys are all their own.
 *  2. **The environment is an allowlist, never a filter.** The child gets `PATH`
 *     plus whatever the caller explicitly hands over. `process.env` is never
 *     spread in — a denylist would silently leak every future secret anyone adds.
 *
 * The real risk being managed is TENANCY, not self-hosting. One tenant's
 * prompt-authored source sharing a host with another tenant's data is the
 * multi-tenant Linux case — which is exactly where bwrap is available.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveIsolation, resolveSandbox } from "../providers/sandbox";
import { durableStateDirFor } from "./delivery";

/** Thrown when local execution is refused because nothing can isolate it. */
export class LocalDurableUnavailableError extends Error {
  readonly code = "LOCAL_DURABLE_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "LocalDurableUnavailableError";
  }
}

/** The single documented escape hatch, for single-tenant self-hosted boxes. */
const OVERRIDE_ENV = "FOREMAN_DURABLE_ALLOW_UNISOLATED";

/**
 * Refuse to execute prompt-authored source with no OS boundary.
 *
 * Note this is deliberately STRICTER than the workspace sandbox's general
 * posture: `resolveIsolation()` on `auto` merely warns outside production, which
 * is right for the agent running `ls`, but not for executing generated code.
 * Here an unavailable backend is fatal everywhere unless explicitly overridden.
 */
export function assertLocalDurableAllowed(): { backend: string; overridden: boolean } {
  const decision = resolveIsolation();
  if (decision.available) return { backend: decision.backend, overridden: false };

  if (process.env[OVERRIDE_ENV] === "1") {
    return { backend: decision.backend, overridden: true };
  }

  throw new LocalDurableUnavailableError(
    `Refusing to run durable source locally without OS isolation. ${decision.reason}\n` +
      `Durable source is generated from user prompts, so running it unisolated puts ` +
      `arbitrary code in reach of this server's database and provider credentials.\n` +
      `Options: run the agent server on Linux with bubblewrap (Dockerfile.agents ` +
      `installs it) or on macOS (seatbelt is built in); use ` +
      `ZAPIER_DURABLE_ADAPTER=zapier to execute on Zapier instead; or, on a ` +
      `single-tenant box that only ever runs your own prompts, set ${OVERRIDE_ENV}=1.`,
  );
}

export interface LocalDurableResult {
  done: boolean;
  executionId?: string;
  result?: unknown;
  error?: string;
  /** Whatever the child wrote outside the result sentinel — useful for debugging. */
  logs: string;
}

export interface RunDurableLocallyOptions {
  /** Sanitized workspace id — scopes both the source and the durable state. */
  tenantKey: string;
  /**
   * Durable source. Required to start a run; optional when resuming, since the
   * source of an existing run is already on disk in its run directory (and the
   * caller resuming after an approval generally does not have it to hand).
   */
  source?: string;
  input?: unknown;
  /** Resume a suspended run instead of starting a new one. */
  executionId?: string;
  timeoutMs?: number;
  /**
   * Environment the child is allowed to see, beyond `PATH`. Pass Zapier
   * credentials here when the durable calls the Zapier API — and nothing else.
   * Never pass `process.env`.
   */
  env?: Record<string, string>;
  /** Directories the child may read; `node_modules` roots are added for you. */
  readOnlyPaths?: string[];
}

/** Marks the one line of child stdout that carries the structured outcome. */
const SENTINEL = "__FOREMAN_DURABLE_RESULT__";

/**
 * The child entrypoint. Kept as a generated file rather than a checked-in script
 * because it has to sit inside the tenant's run directory — under isolation that
 * directory may be the only writable path the child can see.
 */
function bootstrapSource(opts: { fsDir: string; executionId?: string }): string {
  const q = (v: unknown) => JSON.stringify(v);
  return [
    `import { configureDurable } from "@zapier/zapier-durable";`,
    ``,
    `// Must precede importing the workflow: the durable is defined at module`,
    `// scope, and an unconfigured adapter would default to the Zapier client.`,
    `// The key is \`fsDir\` — an unknown key is silently ignored and state lands`,
    `// in ~/.config/zapier-sdk/durable (foreman-40ab).`,
    `configureDurable({ adapter: "filesystem", fsDir: ${q(opts.fsDir)} });`,
    ``,
    `const mod = await import("./workflow.mjs");`,
    `const durable = mod.default;`,
    `if (typeof durable !== "function") {`,
    `  throw new Error("durable source must \`export default\` the defineDurable() result");`,
    `}`,
    ``,
    `const input = JSON.parse(await (await import("node:fs/promises")).readFile("./input.json", "utf8"));`,
    `const outcome = ${opts.executionId ? `await durable(${q(opts.executionId)})` : `await durable(input)`};`,
    ``,
    `process.stdout.write(`,
    `  "\\n${SENTINEL}" +`,
    `    JSON.stringify({`,
    `      done: !!outcome.done,`,
    `      executionId: outcome.executionId,`,
    `      result: outcome.result,`,
    `      error: outcome.error ? String(outcome.error.message ?? outcome.error) : undefined,`,
    `    }) +`,
    `    "\\n",`,
    `);`,
    ``,
  ].join("\n");
}

/**
 * Node resolves bare imports by walking `node_modules` up from the entry file.
 * The run directory lives deep under the workspace, so every ancestor is a
 * candidate — name them all so isolation does not break `@zapier/zapier-durable`.
 */
function nodeModulesRootsFor(runDir: string): string[] {
  const roots: string[] = [];
  let dir = path.resolve(runDir);
  for (;;) {
    roots.push(path.join(dir, "node_modules"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return roots;
}

/**
 * Run (or resume) a durable locally, sandboxed.
 *
 * Returns the same shape the durable callable does, so the caller can treat a
 * local run and a Zapier run alike: `done: false` with an `executionId` means it
 * suspended — at an approval gate, in Foreman's case — and
 * `deliveryForActiveAdapter` resumes it against the very same per-tenant state
 * directory this run wrote to.
 */
export async function runDurableLocally(
  opts: RunDurableLocallyOptions,
): Promise<LocalDurableResult> {
  assertLocalDurableAllowed();

  const stateDir = path.resolve(durableStateDirFor(opts.tenantKey));
  // A new run gets a provisional directory: the engine's executionId only exists
  // once it has run. On the way out we rename to that id so a later resume — and
  // `readLocalDurableSource` — can find the run by the only id the rest of
  // Foreman knows it by (`automation_run.durable_run_id`).
  const provisional = opts.executionId ?? randomUUID();
  // Reassigned after the run, once the engine's executionId is known.
  let runDir = path.join(stateDir, "runs", provisional);
  await mkdir(runDir, { recursive: true });

  const source = opts.source ?? (await readFile(path.join(runDir, "workflow.mjs"), "utf8"));
  await writeFile(path.join(runDir, "workflow.mjs"), source, "utf8");
  await writeFile(path.join(runDir, "input.json"), JSON.stringify(opts.input ?? {}), "utf8");
  await writeFile(
    path.join(runDir, "run.mjs"),
    bootstrapSource({ fsDir: stateDir, executionId: opts.executionId }),
    "utf8",
  );

  const sandbox = resolveSandbox({
    workingDirectory: runDir,
    tenantKey: opts.tenantKey,
    idSuffix: "durable",
    // The state directory is the parent of runDir and must stay writable — the
    // durable journal is written there, not in the run directory.
    readOnlyPaths: [...nodeModulesRootsFor(runDir), ...(opts.readOnlyPaths ?? [])],
    // A durable exists to call app APIs; without egress every runAction fails.
    allowNetwork: true,
  });

  if (!sandbox.executeCommand) {
    throw new LocalDurableUnavailableError(
      "The configured sandbox provider cannot execute commands, so durables cannot run locally.",
    );
  }

  try {
    await sandbox.start?.();
    const res = await sandbox.executeCommand("node", ["run.mjs"], {
      cwd: runDir,
      timeout: opts.timeoutMs ?? 120_000,
      // ALLOWLIST. Spreading `process.env` here would hand generated code the
      // database URL, the service-role key and every provider credential.
      env: { PATH: process.env.PATH ?? "", ...(opts.env ?? {}) },
    });

    const stdout = res.stdout ?? "";
    const line = stdout
      .split("\n")
      .reverse()
      .find((l) => l.startsWith(SENTINEL));

    if (!line) {
      return {
        done: false,
        error:
          res.exitCode === 0
            ? "durable produced no result line"
            : `durable exited ${res.exitCode}: ${(res.stderr ?? "").trim().slice(0, 500)}`,
        logs: `${stdout}\n${res.stderr ?? ""}`.trim(),
      };
    }

    const parsed = JSON.parse(line.slice(SENTINEL.length)) as Omit<LocalDurableResult, "logs">;

    // Re-key the run directory to the engine's executionId, so resuming after an
    // approval (which only carries `durable_run_id`) finds this run's source.
    if (parsed.executionId && parsed.executionId !== provisional) {
      const target = path.join(stateDir, "runs", parsed.executionId);
      await rename(runDir, target).catch(() => {});
      runDir = target;
    }

    return { ...parsed, logs: stdout.replace(line, "").trim() };
  } finally {
    // `destroy` is optional on the interface and may return void, not a promise.
    await Promise.resolve(sandbox.destroy?.()).catch(() => {});
  }
}

/** Read back a run's generated source — used by the automations UI and tests. */
export async function readLocalDurableSource(
  tenantKey: string,
  executionId: string,
): Promise<string | null> {
  const file = path.join(
    path.resolve(durableStateDirFor(tenantKey)),
    "runs",
    executionId,
    "workflow.mjs",
  );
  return readFile(file, "utf8").catch(() => null);
}
