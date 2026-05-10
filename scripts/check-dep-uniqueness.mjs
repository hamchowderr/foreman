#!/usr/bin/env node
// Fail the install if any of these packages has more than one resolved version
// in the workspace. Multi-version installs of these specific packages have
// caused real, hard-to-debug runtime bugs (see commit 2969e46 — zod v3 shim
// vs zod v4 mismatch hung `mastra dev` for an entire afternoon).
//
// If this fails, add an entry to "overrides" in the root package.json to
// force a single version, then run `rm -rf node_modules package-lock.json && npm install`.
import { execSync } from "node:child_process";

const MUST_BE_SINGLE = ["zod", "postcss", "@mastra/core"];

let failed = false;
for (const pkg of MUST_BE_SINGLE) {
  // npm ls exits non-zero when there are unmet peers, but still prints valid JSON.
  // Suppress stderr at the API level (cross-platform) and ignore exit code.
  let out = "";
  try {
    out = execSync(`npm ls ${pkg} --all --json`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    out = err.stdout || "";
  }
  if (!out) continue;
  const versions = new Set();
  const walk = (node) => {
    if (node?.dependencies) {
      for (const [name, child] of Object.entries(node.dependencies)) {
        if (name === pkg && child.version) versions.add(child.version);
        walk(child);
      }
    }
  };
  walk(JSON.parse(out));
  if (versions.size > 1) {
    console.error(
      `\n[dep-uniqueness] ${pkg} has ${versions.size} resolved versions: ${[...versions].join(", ")}`,
    );
    console.error(`  Add an override in root package.json:`);
    console.error(`    "overrides": { "${pkg}": "<version>" }`);
    console.error(`  Then: rm -rf node_modules package-lock.json && npm install`);
    failed = true;
  }
}
if (failed) process.exit(1);
