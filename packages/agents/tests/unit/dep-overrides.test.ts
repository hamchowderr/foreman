/**
 * Regression test for the npm `overrides` in root package.json.
 *
 * Bug: Multiple copies of zod (or @mastra/core) in node_modules each register
 * schemas in the process-global Symbol(_zod) registry with conflicting
 * definitions. Mastra Studio's toJSONSchema introspection then hangs at
 * "[file-logger] Logging to server.log" instead of throwing.
 *
 * Fix (88be4ff + 2969e46): root package.json `overrides` pin zod and
 * @mastra/core to single versions across the entire workspace.
 *
 * This test catches anyone removing the override or upgrading sub-deps that
 * pull in additional copies.
 *
 * See: vault note reference_foreman_mastra_dev_hang.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "..");
const ROOT_NODE_MODULES = join(REPO_ROOT, "node_modules");

/**
 * Find every resolved copy of `packageName` and return a map of version → paths.
 * Walks the entire node_modules tree, including nested node_modules used for
 * conflict resolution.
 */
function findVersions(packageName: string): Map<string, string[]> {
  const versions = new Map<string, string[]>();
  if (!existsSync(ROOT_NODE_MODULES)) return versions;

  const stack: string[] = [ROOT_NODE_MODULES];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }

    for (const name of entries) {
      const full = join(dir, name);
      let isDir = false;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;

      // Recurse into nested node_modules.
      if (name === "node_modules") {
        stack.push(full);
        continue;
      }
      // Recurse into @scope folders so we can find their child packages.
      if (name.startsWith("@")) {
        stack.push(full);
        continue;
      }

      // A directory is a "resolved package" if its trailing path segments
      // match `packageName` (handles both "zod" and "@mastra/core").
      const rel = full.slice(ROOT_NODE_MODULES.length + 1).split(sep).join("/");
      const tailLen = packageName.split("/").length;
      const tail = rel.split("/").slice(-tailLen).join("/");
      if (tail !== packageName) continue;

      const pkgJson = join(full, "package.json");
      if (!existsSync(pkgJson)) continue;

      let version: string | undefined;
      try {
        version = JSON.parse(readFileSync(pkgJson, "utf8")).version;
      } catch {
        continue;
      }
      // Bundled copies (e.g. next/dist/compiled/zod) lack a version — those
      // never share state with the user-facing registry.
      if (!version) continue;

      if (!versions.has(version)) versions.set(version, []);
      versions.get(version)!.push("/" + rel);
    }
  }

  return versions;
}

describe("Workspace dependency overrides (mastra dev hang regression)", () => {
  it("zod resolves to exactly one version across the workspace", () => {
    const versions = findVersions("zod");
    expect(
      versions.size,
      `Expected exactly 1 zod version, found ${versions.size}:\n${JSON.stringify(
        Object.fromEntries(versions),
        null,
        2
      )}\n\nMultiple zod copies trigger the mastra dev hang. Re-add the zod override in root package.json.`
    ).toBe(1);
  });

  it("@mastra/core resolves to exactly one version across the workspace", () => {
    const versions = findVersions("@mastra/core");
    expect(
      versions.size,
      `Expected exactly 1 @mastra/core version, found ${versions.size}:\n${JSON.stringify(
        Object.fromEntries(versions),
        null,
        2
      )}\n\nMultiple @mastra/core copies cause mastra build to fail with ERESOLVE. Re-add the @mastra/core override in root package.json.`
    ).toBe(1);
  });
});
