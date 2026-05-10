import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

/**
 * Return the commit timestamp of the last edit for a file, falling back to
 * the filesystem mtime when git is unavailable (build in a shallow clone,
 * etc.). Runs at build/request time — do not call from the client.
 */
export function getLastModified(relativePath: string): Date {
  const repoRoot = path.resolve(process.cwd(), "../..");
  try {
    const iso = execSync(`git log -1 --format=%cI -- "${relativePath}"`, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (iso) return new Date(iso);
  } catch {
    // fall through to fs.stat
  }
  try {
    return statSync(path.resolve(repoRoot, relativePath)).mtime;
  } catch {
    // No git, no file stat — return epoch so the UI can hide/skip.
    return new Date(0);
  }
}
