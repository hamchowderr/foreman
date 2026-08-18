/**
 * Live smoke test for the durable rebuild (foreman-l7xq). Drives the REAL
 * experimental Zapier SDK (CLI login) through Foreman's own lib/durable +
 * lib/trigger-inbox code — the gap the mocked unit tests can't cover.
 *
 * Run:   cd packages/agents && npx tsx scripts/durable-smoke.ts
 * Auth:  cached CLI login (~/.zapier-sdk/config.json). If it 401s, re-login with
 *        `npx zapier-sdk login` and re-run.
 *
 * Creates a PRIVATE, no-connection echo durable (NO app side effects) and cleans
 * up after itself. Tiers: (1) ephemeral runDurable, (2) deploy+trigger+poll+delete,
 * (3) trigger-inbox reachability.
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";
import {
  deleteAutomation,
  deployAutomation,
  getDurableRunStatus,
  getTriggerRunStatus,
  runAutomationOnce,
  triggerAutomation,
} from "../src/lib/durable";
import { ensureInbox } from "../src/lib/trigger-inbox";

// Prefer client-credentials (env, via `infisical run`) so this runs headless in
// CI/probes; fall back to the cached CLI login (~/.zapier-sdk/config.json) locally.
const sdk =
  process.env.ZAPIER_CLIENT_ID && process.env.ZAPIER_CLIENT_SECRET
    ? createZapierSdk({
        credentials: {
          clientId: process.env.ZAPIER_CLIENT_ID,
          clientSecret: process.env.ZAPIER_CLIENT_SECRET,
        },
      })
    : createZapierSdk();

const ECHO_SOURCE = `import { defineDurable } from "@zapier/zapier-durable";

function normalizeInput(raw) {
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

const workflow = defineDurable("foreman-smoke", async (ctx, input) => {
  return await ctx.step("echo", async () => ({ ok: true, echo: normalizeInput(input) }));
});

export default workflow;
`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollDurable(runId: string, capMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < capMs) {
    const s = await getDurableRunStatus(sdk, runId);
    if (s.status === "finished" || s.status === "failed") return s;
    await sleep(3000);
  }
  return { status: "timeout", output: null, error: null };
}

async function pollTrigger(triggerId: string, capMs = 120_000) {
  const start = Date.now();
  let last: Awaited<ReturnType<typeof getTriggerRunStatus>> | undefined;
  while (Date.now() - start < capMs) {
    last = await getTriggerRunStatus(sdk, triggerId);
    if (last.durableRunId && (last.status === "finished" || last.status === "failed")) return last;
    await sleep(3000);
  }
  return last ?? { status: "timeout", durableRunId: null, output: null, error: null };
}

async function main() {
  // Step 0 — auth probe (also the baseline workflow count for the clean-up check).
  let baseline = 0;
  try {
    const r = await sdk.listWorkflows();
    baseline = r.data.length;
    console.log(`✓ AUTH OK — ${baseline} existing workflow(s)`);
  } catch (e) {
    console.error(`✗ AUTH FAIL: ${(e as Error).message}`);
    console.error("  Re-login:  npx zapier-sdk login   (then re-run)");
    process.exit(1);
  }

  // Tier 1 — ephemeral runDurable (no saved workflow).
  console.log("\n[Tier 1] ephemeral runDurable (echo)…");
  try {
    const once = await runAutomationOnce({ sdk, source: ECHO_SOURCE, input: { hello: "foreman" } });
    console.log(`  run ${once.runId} → ${once.status}; polling…`);
    const r1 = await pollDurable(once.runId);
    console.log(`  → ${r1.status} ${r1.output ? `output=${JSON.stringify(r1.output)}` : ""}`);
    console.log(`  ${r1.status === "finished" ? "✓ PASS" : "✗ FAIL"}`);
  } catch (e) {
    console.error(`  ✗ FAIL: ${(e as Error).message}`);
  }

  // Tier 2 — deploy → manual trigger → bridge to durable run → delete.
  console.log("\n[Tier 2] deploy + manual trigger…");
  let workflowId: string | undefined;
  try {
    const dep = await deployAutomation({
      sdk,
      name: "Foreman Smoke",
      description: "live smoke test — safe to delete",
      source: ECHO_SOURCE,
      enabled: true,
      isPrivate: true,
    });
    workflowId = dep.workflowId;
    console.log(`  deployed ${dep.workflowId} (enabled=${dep.enabled}) ${dep.editorUrl}`);
    const t = await triggerAutomation({
      sdk,
      workflowId: dep.workflowId,
      input: { fired: "smoke" },
    });
    console.log(`  trigger ${t.triggerId}; bridging to run…`);
    const r2 = await pollTrigger(t.triggerId);
    console.log(`  → status=${r2.status} durableRunId=${r2.durableRunId ?? "—"}`);
    console.log(`  ${r2.status === "finished" ? "✓ PASS" : "✗ FAIL"}`);
  } catch (e) {
    console.error(`  ✗ FAIL: ${(e as Error).message}`);
  } finally {
    if (workflowId) {
      try {
        await deleteAutomation(sdk, workflowId);
        console.log(`  cleaned up ${workflowId}`);
      } catch (e) {
        console.error(`  cleanup failed for ${workflowId}: ${(e as Error).message}`);
      }
    }
  }

  // Tier 3 — trigger-inbox reachability (no connection → API reachable; the inbox
  // can't fully subscribe without a connection, but the lib calls must hit the API).
  console.log("\n[Tier 3] trigger-inbox reachability…");
  try {
    const inbox = await ensureInbox({
      sdk,
      key: "foreman-smoke-inbox",
      app: "github",
      action: "issue_v2",
    });
    console.log(`  ensureInbox → ${inbox.id} status=${inbox.status}`);
    // Raw SDK reachability probe. Foreman no longer wraps lease/ack/release — the
    // real consumer is watchTriggerInbox (foreman-em74) — so call the API directly.
    const { data: lease } = await sdk.leaseTriggerInboxMessages({
      inbox: inbox.id,
      leaseLimit: 1,
      leaseSeconds: 30,
    });
    console.log(
      `  lease → lease_id=${lease.lease_id ?? "—"} messages=${lease.results.length} inbox=${lease.inbox_attributes.status}`,
    );
    await sdk.deleteTriggerInbox({ inbox: inbox.id });
    console.log(`  cleaned up inbox ${inbox.id}`);
    console.log("  ✓ PASS (API reachable)");
  } catch (e) {
    console.error(`  ✗ inbox probe error: ${(e as Error).message}`);
  }

  const final = await sdk.listWorkflows();
  const clean = final.data.length === baseline;
  console.log(
    `\n${clean ? "✓" : "⚠"} DONE — workflows now: ${final.data.length} (baseline ${baseline})`,
  );
  if (!clean) console.log("  ⚠ leftover workflow(s) — check https://zapier.com/durables-editor");
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(1);
});
