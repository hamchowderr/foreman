import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { Socket } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Live-preview server for the real shadcn harness (foreman-8nyg). The agent
 * builds a genuine React component using the project's shadcn/ui components;
 * we write it into a warm Vite + React + Tailwind + shadcn template
 * (packages/agents/preview-template) whose dev server stays running, and Vite
 * HMR re-renders it live in the chat's preview panel.
 *
 * The Vite process is spawned via node's child_process (detached + unref'd) so
 * it survives the agent turn — exactly like a long-running dev server should.
 * We run vite's CLI through `process.execPath` (no shell) to avoid the Windows
 * console-window popup that `shell:true`/`npx` causes.
 *
 * SPIKE limits: ONE shared template/dev-server (not per-tenant — foreman-jgme),
 * localhost only (the dev browser reaches it directly). Cloud/per-tenant/
 * sandbox isolation + security are phase-2.
 */

const PREVIEW_PORT = Number(process.env.FOREMAN_PREVIEW_PORT ?? 7332);

/**
 * Locate packages/agents/preview-template robustly — works whether this module
 * runs from source (`mastra dev` bundles it to a different depth) or from a
 * built output, by walking up from both the module dir and process.cwd().
 */
function resolveTemplateDir(): string {
  const fromEnv = process.env.FOREMAN_PREVIEW_TEMPLATE_DIR;
  if (fromEnv && existsSync(path.join(fromEnv, "package.json"))) return fromEnv;

  const starts = [path.dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 12; i++) {
      for (const candidate of [
        path.join(dir, "preview-template"),
        path.join(dir, "packages", "agents", "preview-template"),
      ]) {
        if (existsSync(path.join(candidate, "package.json"))) return candidate;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error(
    "preview: could not locate packages/agents/preview-template (set FOREMAN_PREVIEW_TEMPLATE_DIR)",
  );
}

/** Resolve once and remember which port/template a started server is using. */
let viteStarting: Promise<void> | null = null;

function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = new Socket();
      socket.setTimeout(1000);
      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };
      socket.once("connect", () => {
        cleanup();
        resolve();
      });
      const retry = () => {
        cleanup();
        if (Date.now() > deadline) {
          reject(new Error(`preview: Vite did not open ${port} within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, 400);
        }
      };
      socket.once("error", retry);
      socket.once("timeout", retry);
      socket.connect(port, "127.0.0.1");
    };
    attempt();
  });
}

/** Start the template's Vite dev server once and wait until it's accepting connections. */
function ensureVite(templateDir: string): Promise<void> {
  if (viteStarting) return viteStarting;

  viteStarting = (async () => {
    const viteBin = path.join(templateDir, "node_modules", "vite", "bin", "vite.js");
    if (!existsSync(viteBin)) {
      throw new Error(
        `preview: template deps missing — run \`npm install\` in ${templateDir} (node_modules/vite not found)`,
      );
    }
    const child = spawn(process.execPath, [viteBin], {
      cwd: templateDir,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    await waitForPort(PREVIEW_PORT, 30_000);
  })();

  // If startup fails, allow a later call to retry instead of caching the rejection.
  viteStarting.catch(() => {
    viteStarting = null;
  });

  return viteStarting;
}

/**
 * Write the agent's React component into the template and ensure Vite is live.
 * Returns the dev-server URL the chat embeds in an iframe. Vite HMR makes
 * subsequent writes update the open preview in place.
 */
export async function startReactPreview(componentTsx: string): Promise<{ url: string }> {
  const templateDir = resolveTemplateDir();
  await writeFile(path.join(templateDir, "src", "generated.tsx"), componentTsx, "utf8");
  await ensureVite(templateDir);
  return { url: `http://localhost:${PREVIEW_PORT}` };
}

/**
 * Type-check the template (incl. the just-written generated.tsx) so the
 * preview_app self-heal loop can feed real compile errors back to the builder
 * (foreman-8nyg). The 57 ui components are known-good, so any error is in the
 * generated component or its usage of the registry. Fails OPEN (treats as ok) if
 * the toolchain isn't reachable — we never want the check itself to block a
 * preview. Incremental buildinfo lives under node_modules/.cache (gitignored),
 * so repeat checks are fast.
 */
export async function typecheckPreview(): Promise<{ ok: boolean; errors?: string }> {
  const templateDir = resolveTemplateDir();
  const tscBin = path.join(templateDir, "node_modules", "typescript", "bin", "tsc");
  if (!existsSync(tscBin)) return { ok: true };

  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        tscBin,
        "--noEmit",
        "--incremental",
        "--tsBuildInfoFile",
        path.join("node_modules", ".cache", "preview.tsbuildinfo"),
      ],
      { cwd: templateDir, windowsHide: true },
    );
    let out = "";
    child.stdout?.on("data", (d) => {
      out += d.toString();
    });
    child.stderr?.on("data", (d) => {
      out += d.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
      } else {
        // Prefer errors in the generated component; fall back to all output.
        const lines = out.split(/\r?\n/);
        const relevant = lines.filter((l) => l.includes("generated.tsx"));
        resolve({
          ok: false,
          errors: (relevant.length ? relevant : lines).join("\n").slice(0, 2000),
        });
      }
    });
    child.on("error", () => resolve({ ok: true }));
  });
}
