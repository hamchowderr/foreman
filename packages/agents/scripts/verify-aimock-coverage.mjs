#!/usr/bin/env node
// Verify that aimock.json's declared MCP tools and A2A agents are each backed
// by a real fixture — and that the LLM fixture set hasn't drifted away from the
// declarations. AIMock mounts every declared MCP tool / A2A agent, but a bare
// declaration with no `result` (MCP) or `messages`/`tasks`/`streamingTasks`
// (A2A) is a dead mock: it answers nothing. This check makes a declared-vs-real
// mismatch a hard CI failure instead of a silent gap.
//
// It also forbids re-introducing a catch-all LLM fixture (`"match": {}`), which
// silently answers any unmatched request and hides missing fixtures — the exact
// anti-pattern strict mode + the z-catchall.json deletion were meant to kill.
//
// Exits non-zero on any failure. Run: `npm run verify:aimock` (from packages/agents).
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(PACKAGE_ROOT, "aimock.json");

const errors = [];
const fail = (msg) => errors.push(msg);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

// ── Load config ─────────────────────────────────────────────────────────────
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`✗ aimock.json not found at ${CONFIG_PATH}`);
  process.exit(1);
}
const config = readJson(CONFIG_PATH);

// ── 1. Strict mode must stay on ──────────────────────────────────────────────
// Strict mode is what makes an unmatched request 503 instead of silently
// matching a catch-all. Coverage is meaningless without it.
if (config.strict !== true) {
  fail('aimock.json must set "strict": true (unmatched requests should 503, not silently pass).');
}

// ── 2. Every declared MCP tool must have a backing `result` ──────────────────
const mcpTools = config.mcp?.tools ?? [];
const declaredToolNames = new Set();
for (const tool of mcpTools) {
  if (!tool.name) {
    fail("An MCP tool declaration is missing a `name`.");
    continue;
  }
  declaredToolNames.add(tool.name);
  if (tool.result === undefined) {
    fail(`MCP tool "${tool.name}" is declared but has no \`result\` fixture (dead mock).`);
  }
}

// ── 3. Every declared A2A agent must have a backing message/task pattern ─────
const a2aAgents = config.a2a?.agents ?? [];
for (const agent of a2aAgents) {
  if (!agent.name) {
    fail("An A2A agent declaration is missing a `name`.");
    continue;
  }
  const hasPattern =
    (Array.isArray(agent.messages) && agent.messages.length > 0) ||
    (Array.isArray(agent.tasks) && agent.tasks.length > 0) ||
    (Array.isArray(agent.streamingTasks) && agent.streamingTasks.length > 0);
  if (!hasPattern) {
    fail(
      `A2A agent "${agent.name}" is declared but has no \`messages\`/\`tasks\`/\`streamingTasks\` fixture (dead mock).`,
    );
  }
}

// ── 4. LLM fixtures: no catch-all, no drift against declared MCP tools ───────
let fixtureDir = config.llm?.fixtures;
if (fixtureDir) {
  if (!path.isAbsolute(fixtureDir)) fixtureDir = path.resolve(PACKAGE_ROOT, fixtureDir);
  if (!fs.existsSync(fixtureDir)) {
    fail(`llm.fixtures directory does not exist: ${fixtureDir}`);
  } else {
    const files = fs.readdirSync(fixtureDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const full = path.join(fixtureDir, file);
      let parsed;
      try {
        parsed = readJson(full);
      } catch (err) {
        fail(`LLM fixture ${file} is not valid JSON: ${err.message}`);
        continue;
      }
      const fixtures = parsed.fixtures ?? [];
      for (const [i, fx] of fixtures.entries()) {
        // No catch-all: an empty `match: {}` silently answers everything.
        if (fx.match && typeof fx.match === "object" && Object.keys(fx.match).length === 0) {
          fail(
            `LLM fixture ${file}[${i}] uses an empty catch-all match {} — forbidden anti-pattern.`,
          );
        }
        // Drift: any tool a fixture emits must be a declared MCP tool, otherwise
        // the fixture references a mock the server never registered.
        const toolCalls = fx.response?.toolCalls ?? [];
        for (const call of toolCalls) {
          if (call?.name && !declaredToolNames.has(call.name)) {
            fail(
              `LLM fixture ${file}[${i}] calls tool "${call.name}" which is not declared in aimock.json mcp.tools.`,
            );
          }
        }
      }
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (errors.length > 0) {
  console.error("✗ AIMock coverage check FAILED:\n");
  for (const e of errors) console.error(`  - ${e}`);
  console.error(
    `\n${errors.length} problem(s). Fix the declarations/fixtures in aimock.json (or tests/fixtures/aimock/).`,
  );
  process.exit(1);
}

console.log(
  `✓ AIMock coverage OK — strict mode on, ${declaredToolNames.size} MCP tool(s) and ${a2aAgents.length} A2A agent(s) backed by fixtures, no catch-all, no fixture drift.`,
);
process.exit(0);
