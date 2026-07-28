/**
 * Sandbox + workspace-filesystem provider factory (foreman-zlru).
 *
 * Mirrors `DEPLOY_TARGET`: one env var picks the implementation, and every
 * construction site goes through here instead of `new LocalSandbox(...)`.
 * Two things live in this module:
 *
 *  1. **Provider selection** (`SANDBOX_PROVIDER`) — `local` today; `docker` /
 *     `e2b` / `daytona` are recognized but not yet wired (see below).
 *  2. **OS-level isolation** (`FOREMAN_SANDBOX_ISOLATION`) — which is the part
 *     that actually matters for safety, and which Foreman was silently getting
 *     wrong: `new LocalSandbox({ workingDirectory })` defaults to
 *     `isolation: 'none'`, so every command the agent ran executed directly on
 *     the host with no namespace or filesystem boundary — in production too,
 *     on a Linux box where `bwrap` isolation is available.
 *
 * ## Isolation is ON by default
 *
 * `FOREMAN_SANDBOX_ISOLATION=auto` (the default) asks
 * `LocalSandbox.detectIsolation()` for the platform's backend and uses it.
 * The failure posture is deliberate: we fail closed on the *check*, not on the
 * *feature*. If the backend is unavailable we refuse to run unisolated in
 * production, but allow it in dev/test with a loud warning — otherwise Windows
 * dev and CI (neither of which can isolate) would simply stop working, and the
 * setting would get switched off wholesale, which is worse than a warning.
 *
 * Platform reality, measured (not assumed):
 *  - Linux with bubblewrap installed → `bwrap`. This is the production target;
 *    `Dockerfile.agents` installs `bubblewrap` so prod always isolates.
 *  - macOS → `seatbelt`, built in.
 *  - Windows → **nothing**. `detectIsolation()` returns
 *    `{ backend: 'none', available: false, message: 'Native sandboxing is not
 *    supported on win32…' }`. This is a Mastra library gap, not an OS gap —
 *    Windows has AppContainer, Mastra just has no backend for it. Tracked
 *    upstream at https://github.com/mastra-ai/mastra/issues/20304.
 *
 * Note that `LocalSandbox`'s constructor independently re-checks the backend and
 * throws `IsolationUnavailableError` if it isn't usable, so a wrong answer here
 * cannot silently downgrade into an unisolated sandbox.
 */
import {
  type IsolationBackend,
  LocalFilesystem,
  LocalSandbox,
  type WorkspaceFilesystem,
  type WorkspaceSandbox,
} from "@mastra/core/workspace";

export type SandboxProvider = "local" | "docker" | "e2b" | "daytona";
export type IsolationMode = "auto" | "off" | "require";

const SANDBOX_PROVIDERS: readonly SandboxProvider[] = ["local", "docker", "e2b", "daytona"];
const ISOLATION_MODES: readonly IsolationMode[] = ["auto", "off", "require"];

/**
 * The configured provider. Unset → `local`, so behavior is unchanged for every
 * existing deployment and for CI (which has no Docker and no cloud creds).
 */
export function activeSandboxProvider(): SandboxProvider {
  const raw = process.env.SANDBOX_PROVIDER;
  if (!raw) return "local";
  if (!SANDBOX_PROVIDERS.includes(raw as SandboxProvider)) {
    throw new Error(
      `Invalid SANDBOX_PROVIDER "${raw}". Expected one of: ${SANDBOX_PROVIDERS.join(", ")}.`,
    );
  }
  return raw as SandboxProvider;
}

export function activeIsolationMode(): IsolationMode {
  const raw = process.env.FOREMAN_SANDBOX_ISOLATION;
  if (!raw) return "auto";
  if (!ISOLATION_MODES.includes(raw as IsolationMode)) {
    throw new Error(
      `Invalid FOREMAN_SANDBOX_ISOLATION "${raw}". Expected one of: ${ISOLATION_MODES.join(", ")}.`,
    );
  }
  return raw as IsolationMode;
}

/** Production means "a real deployment" — the only place we refuse to run unisolated. */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export interface IsolationDecision {
  backend: IsolationBackend;
  mode: IsolationMode;
  /** Whether the platform actually offers a backend. */
  available: boolean;
  /** Why we landed on `backend` — logged once at startup. */
  reason: string;
}

let cachedDecision: IsolationDecision | undefined;

/**
 * Decide the isolation backend once per process and remember it. Memoized
 * because `detectIsolation()` shells out to probe for `bwrap`, and the
 * workspace (and therefore the sandbox) is rebuilt on every single request.
 *
 * Throws when isolation is unavailable and running unisolated would be unsafe:
 * `require` anywhere, or `auto` in production.
 */
export function resolveIsolation(): IsolationDecision {
  if (cachedDecision) return cachedDecision;

  const mode = activeIsolationMode();

  if (mode === "off") {
    cachedDecision = {
      backend: "none",
      mode,
      available: false,
      reason: "FOREMAN_SANDBOX_ISOLATION=off — sandbox commands run directly on the host.",
    };
    return cachedDecision;
  }

  const detected = LocalSandbox.detectIsolation();

  if (detected.available) {
    cachedDecision = {
      backend: detected.backend,
      mode,
      available: true,
      reason: `Isolating sandbox commands with "${detected.backend}".`,
    };
    return cachedDecision;
  }

  // Unavailable. Fail closed where it matters; degrade loudly where it doesn't.
  const detail = `${detected.message} (platform=${process.platform})`;
  if (mode === "require") {
    throw new Error(
      `FOREMAN_SANDBOX_ISOLATION=require but no isolation backend is available. ${detail}`,
    );
  }
  if (isProduction()) {
    throw new Error(
      `Refusing to run sandbox commands unisolated in production. ${detail} ` +
        `Install bubblewrap in the runtime image (Dockerfile.agents does this), ` +
        `or set FOREMAN_SANDBOX_ISOLATION=off to accept the risk explicitly.`,
    );
  }

  cachedDecision = {
    backend: "none",
    mode,
    available: false,
    reason: `No isolation backend available — sandbox commands run directly on the host. ${detail}`,
  };
  return cachedDecision;
}

/** Test seam — `resolveIsolation` memoizes a process-wide decision. */
export function __resetIsolationCache(): void {
  cachedDecision = undefined;
}

export interface ResolveSandboxOptions {
  /** The tenant's workspace directory; also the sandbox's cwd. */
  workingDirectory: string;
  /** Sanitized workspace id, used to give the sandbox a stable per-tenant id. */
  tenantKey: string;
}

/**
 * Build the sandbox for one tenant.
 *
 * Non-local providers are recognized by `activeSandboxProvider()` but not yet
 * constructible: they need `@mastra/workspace-sandbox-computesdk`, and adding a
 * `@mastra/*` package means bumping every pin in the root `overrides` together
 * and reinstalling from a clean lockfile (a mismatched deployer/core pair 500s
 * every authed route — see CLAUDE.md). That bump is its own change; this
 * factory is the seam it will slot into. Until then, asking for a provider we
 * cannot build is an explicit error rather than a silent fallback to `local`,
 * which would run untrusted code on the host under a config that says otherwise.
 */
export function resolveSandbox(options: ResolveSandboxOptions): WorkspaceSandbox {
  const provider = activeSandboxProvider();
  if (provider !== "local") {
    throw new Error(
      `SANDBOX_PROVIDER="${provider}" is not wired yet — it needs ` +
        `@mastra/workspace-sandbox-computesdk, which requires bumping every @mastra/* ` +
        `pin in the root overrides together. Use SANDBOX_PROVIDER=local for now.`,
    );
  }

  const { backend } = resolveIsolation();
  return new LocalSandbox({
    id: `foreman-sandbox-${options.tenantKey}`,
    workingDirectory: options.workingDirectory,
    isolation: backend,
  });
}

/**
 * Build the workspace filesystem for one tenant.
 *
 * `contained: true` keeps path resolution inside `basePath` — the tenant
 * boundary for file access, independent of OS-level isolation.
 *
 * Note this is deliberately NOT wired through `Workspace`'s `mounts` map. Three
 * measured reasons (all against @mastra/core 1.53.0):
 *  - `Workspace` throws `Cannot use both "filesystem" and "mounts"`, so adopting
 *    mounts means giving up the root filesystem entirely.
 *  - `/` is not a legal mount path, so a mounts-only workspace would re-root
 *    every document path under a prefix — a breaking change to stored paths.
 *  - `LocalSandbox.mount()` symlinks `<workingDir>/<mount>` at the target, and
 *    Foreman's filesystem basePath IS the sandbox working directory. Mounting it
 *    produces `<dir>/workspace -> <dir>`: a self-referential symlink loop that
 *    any recursive walker will spin on. Verified on this host.
 *
 * Mounts are the right mechanism for *additional* filesystems — the cloud FS
 * (foreman-udo9) and the Zapier data-in bridge (foreman-gnd7) — and they do
 * work, including on Windows. They just must not point at the primary directory.
 */
export function resolveWorkspaceFilesystem(basePath: string): WorkspaceFilesystem {
  return new LocalFilesystem({ basePath, contained: true });
}
