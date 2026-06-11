#!/usr/bin/env node
// Watch the Zapier SDK + CLI for new releases.
//
// Foreman is a PRODUCT built on @zapier/zapier-sdk (and its companion CLI).
// The SDK ships fast and adds real capabilities in point releases — e.g. the
// durable-workflow and trigger-inbox APIs landed across 0.49–0.69 while we
// were pinned at 0.48 and nearly rebuilt them by hand. This script makes
// "are we behind?" a fact we see automatically instead of a thing we discover
// by luck.
//
// Modes:
//   node scripts/zapier-sdk-watch.mjs            full report per package
//                                                (installed vs latest, gap,
//                                                changelog delta)
//   node scripts/zapier-sdk-watch.mjs --quiet    one-line notice per package,
//                                                ONLY when a newer version
//                                                exists; throttled so it does
//                                                not hit npm every session.
//                                                Used by the SessionStart hook.
//                                                Always exits 0.
//   --json          machine-readable output
//   --force         ignore the throttle window
//   --no-changelog  skip the changelog fetch in full mode
//
// Network/offline is never fatal: any failure prints nothing actionable and
// exits 0 so it can never block a Claude Code session start.

import fs from "node:fs";
import path from "node:path";

// Packages we track. Each is checked independently.
const PACKAGES = ["@zapier/zapier-sdk", "@zapier/zapier-sdk-cli"];

const ROOT = path.resolve(import.meta.dirname, "..");
const STATE_FILE = path.join(import.meta.dirname, ".zapier-sdk-watch.json");
const THROTTLE_MS = 20 * 60 * 60 * 1000; // ~once/day for the quiet hook
const CHANGELOG_MAX_LINES = 160;

const argv = new Set(process.argv.slice(2));
const QUIET = argv.has("--quiet");
const JSON_OUT = argv.has("--json");
const FORCE = argv.has("--force");
const WANT_CHANGELOG = !argv.has("--no-changelog");

const registryUrl = (pkg) => `https://registry.npmjs.org/${pkg.replace("/", "%2F")}`;
const changelogUrls = (pkg) => [
  `https://cdn.jsdelivr.net/npm/${pkg}/CHANGELOG.md`,
  `https://unpkg.com/${pkg}/CHANGELOG.md`,
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readState() {
  try {
    const s = readJson(STATE_FILE);
    return s && typeof s === "object" ? s : {};
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
  } catch {
    // best-effort; never fatal
  }
}

// Parse a semver-ish "x.y.z" into comparable parts (prerelease ignored).
function parseVer(v) {
  const m = String(v)
    .trim()
    .replace(/^[v^~]/, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmpVer(a, b) {
  const pa = parseVer(a);
  const pb = parseVer(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function isStable(v) {
  return /^\d+\.\d+\.\d+$/.test(String(v).trim());
}

// Find the installed version of a package by walking the likely node_modules
// locations, then fall back to the pinned range in the nearest package.json.
function installedVersion(pkg) {
  const segs = pkg.split("/");
  const nm = (base) => path.join(base, "node_modules", ...segs, "package.json");
  const candidates = [
    nm(ROOT),
    nm(path.join(ROOT, "packages", "agents")),
    nm(path.join(ROOT, "packages", "web")),
  ];
  for (const c of candidates) {
    try {
      return { version: readJson(c).version, source: "installed" };
    } catch {
      // try next
    }
  }
  // Fall back to a declared range if nothing is installed yet.
  const manifests = [
    path.join(ROOT, "package.json"),
    path.join(ROOT, "packages", "agents", "package.json"),
    path.join(ROOT, "packages", "web", "package.json"),
  ];
  for (const m of manifests) {
    try {
      const pj = readJson(m);
      const range = pj.dependencies?.[pkg] || pj.devDependencies?.[pkg];
      if (range) return { version: range.replace(/^[\^~]/, ""), source: "pinned" };
    } catch {
      // try next
    }
  }
  return null;
}

async function fetchText(url, { accept, timeoutMs = 6000 } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: accept ? { accept } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Full registry doc carries dist-tags + the `time` map (release dates).
async function fetchRegistry(pkg) {
  const doc = JSON.parse(await fetchText(registryUrl(pkg), { accept: "application/json" }));
  return {
    latest: doc["dist-tags"]?.latest,
    times: doc.time || {},
    versions: Object.keys(doc.versions || {}).filter(isStable),
  };
}

async function fetchChangelog(pkg) {
  let lastErr;
  for (const url of changelogUrls(pkg)) {
    try {
      return await fetchText(url, { timeoutMs: 6000 });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("no changelog");
}

// CHANGELOG.md is reverse-chronological with `## x.y.z` headers. Return the
// slice from the top down to (but not including) the installed version's
// header — i.e. exactly what changed since we last upgraded.
function changelogDelta(changelog, installed) {
  const lines = changelog.split(/\r?\n/);
  const headerRe = new RegExp(`^##\\s+${installed.replace(/\./g, "\\.")}(\\b|$)`);
  const out = [];
  let started = false;
  for (const line of lines) {
    if (/^##\s+\d+\.\d+\.\d+/.test(line)) started = true;
    if (started && headerRe.test(line)) break;
    if (started) out.push(line);
    if (out.length >= CHANGELOG_MAX_LINES) {
      out.push("", "… (truncated — run with --no-changelog or see CHANGELOG.md)");
      break;
    }
  }
  return out.join("\n").trim();
}

function countBehind(versions, installed, latest) {
  return versions.filter((v) => cmpVer(v, installed) > 0 && cmpVer(v, latest) <= 0).length;
}

// Gather the comparison facts for one package (no printing).
async function inspectPackage(pkg) {
  const inst = installedVersion(pkg);
  if (!inst) return { pkg, error: "not-resolved" };
  let reg;
  try {
    reg = await fetchRegistry(pkg);
  } catch {
    return { pkg, installed: inst, error: "offline" };
  }
  const behind = reg.latest ? cmpVer(reg.latest, inst.version) > 0 : false;
  return {
    pkg,
    installed: inst,
    latest: reg.latest,
    times: reg.times,
    versions: reg.versions,
    behind,
    gap: reg.latest ? countBehind(reg.versions, inst.version, reg.latest) : 0,
  };
}

function printFull(r) {
  console.log(`\n${r.pkg}`);
  console.log("─".repeat(48));
  if (r.error === "not-resolved") {
    console.log("  (could not resolve an installed version)");
    return;
  }
  console.log(`  installed : ${r.installed.version}  (${r.installed.source})`);
  if (r.error === "offline") {
    console.log("  latest    : (offline — registry unavailable)");
    return;
  }
  console.log(
    `  latest    : ${r.latest}` +
      (r.times[r.latest] ? `  (${r.times[r.latest].slice(0, 10)})` : ""),
  );
  if (!r.behind) {
    console.log("  status    : ✓ up to date");
    return;
  }
  console.log(`  status    : ${r.gap} release${r.gap === 1 ? "" : "s"} behind`);
}

async function main() {
  const state = readState();

  // Quiet/hook path: throttle network so we don't probe npm every session.
  if (QUIET && !FORCE && state.lastCheck) {
    const age = Date.now() - Date.parse(state.lastCheck);
    if (Number.isFinite(age) && age < THROTTLE_MS) return;
  }

  const results = [];
  for (const pkg of PACKAGES) {
    results.push(await inspectPackage(pkg));
  }

  const pkgState = { ...(state.packages || {}) };
  const newState = {
    ...state,
    lastCheck: new Date().toISOString(),
    packages: pkgState,
  };

  if (JSON_OUT) {
    const payload = [];
    for (const r of results) {
      let delta = null;
      if (r.behind && WANT_CHANGELOG) {
        try {
          delta = changelogDelta(await fetchChangelog(r.pkg), r.installed.version);
        } catch {
          delta = null;
        }
      }
      if (!r.error) pkgState[r.pkg] = { latest: r.latest, notified: r.latest };
      payload.push({
        package: r.pkg,
        installed: r.installed ? r.installed.version : null,
        latest: r.latest || null,
        behind: !!r.behind,
        gap: r.gap || 0,
        error: r.error || null,
        changelogDelta: delta,
      });
    }
    writeState(newState);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (QUIET) {
    for (const r of results) {
      if (!r.behind || r.error) continue;
      const prev = state.packages?.[r.pkg];
      if (prev && prev.notified === r.latest) {
        pkgState[r.pkg] = prev; // already pinged about this one
        continue;
      }
      console.log(
        `⚠ ${r.pkg}: installed ${r.installed.version}, latest ${r.latest} ` +
          `(${r.gap} release${r.gap === 1 ? "" : "s"} behind). ` +
          "Run `npm run sdk:check` for details.",
      );
      pkgState[r.pkg] = { latest: r.latest, notified: r.latest };
    }
    writeState(newState);
    return;
  }

  // Full human report.
  console.log("\nZapier SDK/CLI update check");
  console.log("═".repeat(48));
  for (const r of results) {
    printFull(r);
    if (r.behind && WANT_CHANGELOG) {
      try {
        const delta = changelogDelta(await fetchChangelog(r.pkg), r.installed.version);
        if (delta) {
          console.log("\n  Changelog delta:\n");
          console.log(
            delta
              .split("\n")
              .map((l) => `  ${l}`)
              .join("\n"),
          );
        }
      } catch {
        console.log(`  (changelog fetch failed — see ${changelogUrls(r.pkg)[0]})`);
      }
    }
    if (!r.error) pkgState[r.pkg] = { latest: r.latest, notified: r.latest };
  }
  console.log(
    "\nNext: review the deltas, then bump deliberately (behavior changes " +
      "possible). Tracked in beads as the SDK-bump issue.\n",
  );
  writeState(newState);
}

main().catch(() => {
  // Absolute backstop: never throw out of the watcher.
  process.exit(0);
});
