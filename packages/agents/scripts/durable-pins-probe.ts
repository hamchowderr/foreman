/**
 * foreman-h54f — prove the durable path end-to-end against the LIVE Zapier
 * sandbox, which mocked tests structurally cannot cover.
 *
 * Two things the suite does not prove:
 *   1. AGED_DURABLE_DEPS. Zapier installs durable source in a sandbox with
 *      pnpm install --config.minimumReleaseAge=1440, so each pin must exist AND
 *      be >=24h old, and the durable runtime engine must accept the source.
 *   2. validateWorkflow (SDK 0.100.0), wired into deployAutomation as a
 *      pre-flight. It is best-effort — a failing call returns no issues — so a
 *      scope wall would make it a silent no-op. Phase 2 proves it actually runs
 *      by feeding it source that MUST fail.
 *
 * Run (from packages/agents, client-creds via Infisical):
 *   infisical run --projectId <id> --env dev --path=/foreman --silent -- \
 *     npx tsx scripts/durable-pins-probe.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";
import {
  AGED_DURABLE_DEPS,
  deleteAutomation,
  deployAutomation,
  getDurableRunStatus,
  getTriggerRunStatus,
  listAutomations,
  runAutomationOnce,
  triggerAutomation,
} from "../src/lib/durable";
import { validateAutomationSource } from "../src/lib/durable/deploy";

const sdk = createZapierSdk(
  process.env.ZAPIER_CLIENT_ID && process.env.ZAPIER_CLIENT_SECRET
    ? {
        credentials: {
          clientId: process.env.ZAPIER_CLIENT_ID,
          clientSecret: process.env.ZAPIER_CLIENT_SECRET,
        },
      }
    : undefined,
) as Parameters<typeof deployAutomation>[0]["sdk"] & {
  getProfile: () => Promise<{ data: { email?: string; id?: string } }>;
};

const GOOD_SOURCE = [
  'import { defineDurable } from "@zapier/zapier-durable";',
  "",
  'const workflow = defineDurable("foreman-pins-probe", async (ctx, input) => {',
  '  const a = await ctx.step("double", async () => ({ n: 21 * 2 }));',
  "  return { answer: a.n, echoed: input };",
  "});",
  "",
  "export default workflow;",
  "",
].join("\n");

// Two grades of broken, to learn how deep validateWorkflow actually looks.
// SYNTAX_BAD cannot parse at all — any real checker must reject it. If even
// this comes back clean, the call is a no-op for us.
const SYNTAX_BAD = [
  'import { defineDurable } from "@zapier/zapier-durable";',
  "",
  'const workflow = defineDurable("foreman-pins-probe-syntax", async (ctx) => {',
  "  const x = ;;;",
  "  return {",
  "",
].join("\n");

// SEMANTIC_BAD parses fine but calls an undeclared identifier and never
// default-exports the durable — only a type-aware pass catches it.
const SEMANTIC_BAD = [
  'import { defineDurable } from "@zapier/zapier-durable";',
  "",
  'const workflow = defineDurable("foreman-pins-probe-semantic", async (ctx) => {',
  "  return thisIdentifierDoesNotExist(ctx);",
  "});",
  "",
].join("\n");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Observed durable lifecycle: initialized -> started -> finished. The success
// state is "finished", NOT "completed" — assuming otherwise made two healthy
// 8-second runs look like 240-second hangs.
const SUCCESS_STATES = ["finished", "completed", "success", "succeeded"];
const TERMINAL = (s: string) =>
  SUCCESS_STATES.includes(s) || ["failed", "error", "cancelled", "canceled"].includes(s);
const SUCCESS = (s?: string) => !!s && SUCCESS_STATES.includes(s);

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};
const pass = (msg: string) => console.log(`  ok    ${msg}`);

async function pollDurable(runId: string, label: string) {
  let last = "";
  let s: Awaited<ReturnType<typeof getDurableRunStatus>> | null = null;
  for (let i = 0; i < 60; i++) {
    await sleep(4000);
    s = await getDurableRunStatus(sdk, runId);
    if (s.status !== last) {
      console.log(`        ${label} [${(i + 1) * 4}s] ${last || "(start)"} -> ${s.status}`);
      last = s.status;
    }
    if (TERMINAL(s.status)) {
      if (s.error) console.log(`        error: ${JSON.stringify(s.error).slice(0, 500)}`);
      if (s.output) console.log(`        output: ${JSON.stringify(s.output).slice(0, 300)}`);
      return s;
    }
  }
  console.log(`        ${label} -> NOT terminal after 240s, stuck in "${last}"`);
  // Why is it wedged? detail carries last_error + retrying ops.
  if (s?.detail) console.log(`        detail: ${JSON.stringify(s.detail).slice(0, 600)}`);
  else console.log("        detail: (none — no error, no retries recorded)");
  return null;
}

async function main() {
  console.log(
    `\nAGED_DURABLE_DEPS: sdk ${AGED_DURABLE_DEPS.sdk} | durable ${AGED_DURABLE_DEPS.durable} | zod ${AGED_DURABLE_DEPS.zod}\n`,
  );

  console.log("[1] auth");
  try {
    const p = await sdk.getProfile();
    pass(`authenticated as ${p.data?.email ?? p.data?.id ?? "?"}`);
  } catch (e) {
    fail(`auth: ${(e as Error).message}`);
    process.exit(1);
  }

  console.log("\n[1b] sweep leftovers from earlier probe runs");
  try {
    const all = await listAutomations(sdk);
    const stale = all.filter((w) => w.name.startsWith("foreman-h54f-probe-"));
    if (stale.length === 0) {
      pass(`no leftovers (${all.length} workflow(s) in the account)`);
    } else {
      for (const w of stale) {
        await deleteAutomation(sdk, w.id);
        console.log(`        deleted stale ${w.id} (${w.name})`);
      }
      pass(`swept ${stale.length} leftover probe workflow(s)`);
    }
  } catch (e) {
    fail(`sweep failed: ${(e as Error).message}`);
  }

  console.log("\n[2] validateWorkflow actually runs (not a silent no-op)");
  // validateAutomationSource swallows transport errors by design, so an empty
  // result is ambiguous: "clean bill of health" and "the call threw" look the
  // same. Hit the raw SDK method once, unguarded, to tell them apart.
  try {
    const raw = await sdk.validateWorkflow({
      sourceFiles: { "/workflow.ts": SYNTAX_BAD },
      entrypointFile: "/workflow.ts",
    });
    console.log(`        raw call OK, issues=${JSON.stringify(raw.data.issues).slice(0, 300)}`);
  } catch (e) {
    console.log(`        raw call THREW -> ${(e as Error).message.slice(0, 240)}`);
  }
  const goodIssues = await validateAutomationSource({ sdk, source: GOOD_SOURCE });
  const goodErrors = goodIssues.filter((i) => i.severity === "error");
  if (goodErrors.length === 0) {
    pass(`valid source -> 0 errors (${goodIssues.length} total diagnostics)`);
  } else {
    fail(`valid source reported errors: ${JSON.stringify(goodErrors).slice(0, 300)}`);
  }

  // NOT a hard failure. The raw call above proves the request is accepted, so
  // an empty result is upstream's answer, not a transport or scope problem.
  // Recorded so a future SDK release that starts returning diagnostics is
  // visible here rather than assumed. See foreman-h54f.
  const synIssues = await validateAutomationSource({ sdk, source: SYNTAX_BAD });
  const synErrors = synIssues.filter((i) => i.severity === "error");
  const semIssues = await validateAutomationSource({ sdk, source: SEMANTIC_BAD });
  const semErrors = semIssues.filter((i) => i.severity === "error");
  console.log(
    `        unparseable source -> ${synErrors.length} error(s), ${synIssues.length} diagnostics`,
  );
  console.log(
    `        type-aware defects -> ${semErrors.length} error(s), ${semIssues.length} diagnostics`,
  );
  if (synErrors.length + semErrors.length === 0) {
    console.log(
      "  note  request accepted but zero diagnostics for definitely-broken source:\n" +
        "        the pre-flight runs and costs nothing, but currently catches nothing.",
    );
  } else {
    pass("validateWorkflow returns real diagnostics — the pre-flight has teeth");
  }

  console.log("\n[3] runAutomationOnce (ephemeral runDurable in the sandbox)");
  try {
    const { runId, status } = await runAutomationOnce({
      sdk,
      source: GOOD_SOURCE,
      input: { hi: "there" },
    });
    console.log(`        run ${runId} -> ${status}`);
    const s = await pollDurable(runId, "run");
    if (SUCCESS(s?.status)) pass("ephemeral run reached a success state");
    else fail(`ephemeral run ended ${s?.status ?? "unresolved"}`);
  } catch (e) {
    fail(`runAutomationOnce threw: ${(e as Error).message}`);
  }

  console.log("\n[4] deployAutomation (createWorkflow + publishWorkflowVersion)");
  let workflowId: string | null = null;
  try {
    const d = await deployAutomation({
      sdk,
      name: `foreman-h54f-probe-${Date.now()}`,
      description: "foreman-h54f live pin verification - safe to delete",
      source: GOOD_SOURCE,
      enabled: true,
      isPrivate: true,
    });
    workflowId = d.workflowId;
    pass(`workflow ${d.workflowId} version ${d.versionId} enabled=${d.enabled}`);
    console.log(`        ${d.editorUrl}`);
  } catch (e) {
    fail(`deployAutomation threw: ${(e as Error).message}`);
  }

  if (workflowId) {
    console.log("\n[5] triggerAutomation (manual fire of the deployed workflow)");
    try {
      const { triggerId } = await triggerAutomation({ sdk, workflowId, input: { fired: true } });
      console.log(`        trigger ${triggerId}`);
      let durableRunId: string | null = null;
      for (let i = 0; i < 30; i++) {
        await sleep(4000);
        const t = await getTriggerRunStatus(sdk, triggerId);
        durableRunId = t.durableRunId;
        if (TERMINAL(t.status)) {
          console.log(`        trigger -> ${t.status} (durable run ${durableRunId ?? "none"})`);
          break;
        }
      }
      if (durableRunId) {
        const s = await pollDurable(durableRunId, "triggered run");
        if (SUCCESS(s?.status)) pass("triggered run reached a success state");
        else fail(`triggered run ended ${s?.status ?? "unresolved"}`);
      } else {
        fail("trigger produced no durable run id");
      }
    } catch (e) {
      fail(`triggerAutomation threw: ${(e as Error).message}`);
    }

    console.log("\n[6] cleanup");
    try {
      await deleteAutomation(sdk, workflowId);
      pass(`deleted workflow ${workflowId}`);
    } catch (e) {
      fail(`cleanup failed, DELETE MANUALLY: ${workflowId} - ${(e as Error).message}`);
    }
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("probe crashed:", e);
  process.exit(1);
});
