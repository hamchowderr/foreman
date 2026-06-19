#!/usr/bin/env node
// Fail the install if any of these packages has more than one resolved version
// in the workspace. Multi-version installs of these specific packages have
// caused real, hard-to-debug runtime bugs (see commit 2969e46 — zod v3 shim
// vs zod v4 mismatch hung `mastra dev` for an entire afternoon).
//
// If this fails, add an entry to "overrides" in the root package.json to
// force a single version, then run `rm -rf node_modules package-lock.json && npm install`.
import { execSync } from "node:child_process";

const MUST_BE_SINGLE = ["zod", "postcss", "@mastra/core", "@mastra/deployer", "@mastra/server"];

// These @mastra packages are released in lockstep and MUST all resolve to the
// SAME version. They are NOT pinned together by default: `@mastra/core` carries
// a root override, but `@mastra/deployer`/`@mastra/server` are transitive (pulled
// by the `mastra` CLI via a `^` range) and silently float UP to the latest minor.
// When they drift ahead of core, the server calls APIs core doesn't have yet —
// e.g. deployer 1.43.0 called `mastra.getStudio()` while core was 1.42.0-alpha.3,
// throwing in route auth so EVERY authed HTTP route 500'd while agents still
// worked in-process. Cost ~a full session to find. Keep all three pinned to the
// same version in root `overrides`.
const MUST_MATCH_VERSION = ["@mastra/core", "@mastra/deployer", "@mastra/server"];

function resolvedVersions(pkg) {
  let out = "";
  try {
    out = execSync(`npm ls ${pkg} --all --json`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    out = err.stdout || "";
  }
  const versions = new Set();
  if (out) {
    const walk = (node) => {
      if (node?.dependencies) {
        for (const [name, child] of Object.entries(node.dependencies)) {
          if (name === pkg && child.version) versions.add(child.version);
          walk(child);
        }
      }
    };
    try {
      walk(JSON.parse(out));
    } catch {}
  }
  return versions;
}

let failed = false;

// Cross-package version alignment for the lockstep @mastra server packages.
const mastraVersions = new Map();
for (const pkg of MUST_MATCH_VERSION) {
  for (const v of resolvedVersions(pkg)) mastraVersions.set(`${pkg}@${v}`, v);
}
const distinctMastra = new Set(mastraVersions.values());
if (distinctMastra.size > 1) {
  console.error(
    `\n[dep-uniqueness] @mastra/core, @mastra/deployer, @mastra/server must share ONE version, found: ${[...mastraVersions.keys()].join(", ")}`,
  );
  console.error(`  Pin all three in root "overrides" to the same version, then:`);
  console.error(`    rm -rf node_modules package-lock.json && npm install`);
  failed = true;
}

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
