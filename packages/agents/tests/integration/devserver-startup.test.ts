/**
 * Regression test for the mastra dev hang.
 *
 * Spawns `mastra dev` against a free port, polls the API until it responds
 * 200, then kills the process tree. If the API doesn't respond within 90s
 * we assume the hang has returned.
 *
 * The hang's signature was: log stops at "[file-logger] Logging to server.log"
 * and the supervisor never returns from registerRoutes(). With the lazy-init
 * + zod dedup fixes, the API binds in ~3-6 seconds.
 *
 * See: vault note reference_foreman_mastra_dev_hang.md
 */
import { describe, it, expect, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const AGENTS_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const STARTUP_BUDGET_MS = 90_000;
const POLL_INTERVAL_MS = 500;
const HANG_MARKER = "[file-logger] Logging to server.log";

let activeChild: ChildProcess | undefined;

afterAll(() => {
  if (activeChild && !activeChild.killed) killTree(activeChild);
});

/** Pick a free port by binding ephemeral and immediately releasing. */
function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

/** Kill child + descendants. Windows needs taskkill; POSIX gets a process-group SIGTERM. */
function killTree(child: ChildProcess) {
  if (process.platform === "win32") {
    try {
      spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore" });
      return;
    } catch {
      child.kill("SIGTERM");
      return;
    }
  }
  try {
    process.kill(-(child.pid as number), "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

/** Probe the API. Resolves to 200 status or throws. */
async function probeApi(port: number): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api`, { signal: controller.signal });
    return res.status;
  } finally {
    clearTimeout(timer);
  }
}

describe("mastra dev startup (hang regression)", () => {
  it(
    "binds API port within budget — does not hang at registerRoutes",
    async () => {
      const port = await reservePort();

      const child = spawn("npm", ["run", "dev"], {
        cwd: AGENTS_DIR,
        env: { ...process.env, PORT: String(port) },
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      });
      activeChild = child;

      const buffer: string[] = [];
      child.stdout?.on("data", (c: Buffer) => buffer.push(c.toString("utf8")));
      child.stderr?.on("data", (c: Buffer) => buffer.push(c.toString("utf8")));

      const deadline = Date.now() + STARTUP_BUDGET_MS;
      let lastStatus: number | undefined;

      try {
        while (Date.now() < deadline) {
          if (child.exitCode !== null) {
            throw new Error(
              `mastra dev exited unexpectedly (code ${child.exitCode}). Output:\n${buffer.join("").slice(-2000)}`
            );
          }
          try {
            lastStatus = await probeApi(port);
            if (lastStatus === 200) break;
          } catch {
            // Server not ready yet — keep polling.
          }
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }

        if (lastStatus !== 200) {
          const log = buffer.join("");
          const stuckAtFileLogger =
            log.includes(HANG_MARKER) && !log.includes("API");
          throw new Error(
            stuckAtFileLogger
              ? `mastra dev hung at "${HANG_MARKER}" — the lazy-init/zod-dedup regression has returned. Last output:\n${log.slice(-2000)}`
              : `mastra dev did not respond on port ${port} within ${STARTUP_BUDGET_MS}ms (last status: ${lastStatus ?? "no response"}). Last output:\n${log.slice(-2000)}`
          );
        }

        expect(lastStatus).toBe(200);
      } finally {
        killTree(child);
        await new Promise<void>((resolve) => {
          if (child.exitCode != null || child.killed) return resolve();
          child.once("exit", () => resolve());
          setTimeout(resolve, 5_000).unref();
        });
        activeChild = undefined;
      }
    },
    STARTUP_BUDGET_MS + 30_000,
  );
});
