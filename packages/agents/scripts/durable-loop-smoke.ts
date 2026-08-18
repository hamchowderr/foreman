/**
 * FULL connected-loop smoke test (foreman-hnbx). Proves the entire
 * event → inbox → worker → durable chain against REAL Zapier + REAL local Postgres
 * + a REAL webhook event:
 *
 *   deploy durable → persist automation (webhook inbox trigger) → worker cycle 1
 *   (arm inbox) → POST event to the catch URL → worker cycle 2 (lease → claim
 *   [real-Postgres dedup] → fire durable → record automation_run → ack) → verify
 *   the run row → clean up everything.
 *
 * Run:   cd packages/agents && npx tsx --env-file=.env.local scripts/durable-loop-smoke.ts
 * Needs: local Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local)
 *        and a Zapier CLI login. Uses a private no-side-effect echo durable; the
 *        automation has workspace_id=null (so trigger_inbox_id persistence — gated
 *        on a workspace — isn't exercised; the inbox is re-ensured each cycle).
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";
import * as store from "../src/lib/automations/store";
import {
  armInbox,
  reconcilePendingRuns,
  watchAutomationInbox,
} from "../src/lib/automations/worker";
import { getSupabase } from "../src/lib/db";
import { deleteAutomation } from "../src/lib/durable";

const sdk = createZapierSdk();
// Numeric catch-URL account segment — find it in your Zapier catch-hook URL
// (hooks.zapier.com/hooks/catch/<ACCOUNT_ID>/<code>/). Set via env.
const ACCOUNT_ID = process.env.ZAPIER_ACCOUNT_ID ?? "";
if (!ACCOUNT_ID) throw new Error("Set ZAPIER_ACCOUNT_ID to run this smoke test.");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ECHO_SOURCE = `import { defineDurable } from "@zapier/zapier-durable";
function normalizeInput(raw) {
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return raw; } }
  return raw;
}
const workflow = defineDurable("foreman-loop", async (ctx, input) => {
  return await ctx.step("echo", async () => ({ ok: true, echo: normalizeInput(input) }));
});
export default workflow;
`;

async function main() {
  const code = `fmnloop${Math.floor(Date.now() / 1000)}`;
  const catchUrl = `https://hooks.zapier.com/hooks/catch/${ACCOUNT_ID}/${code}/`;

  let workflowId: string | undefined;
  let automationId: string | undefined;
  let inboxId: string | null = null;

  try {
    // 1. Deploy a manual durable (live).
    const { deployAutomation } = await import("../src/lib/durable");
    const dep = await deployAutomation({
      sdk,
      name: "Foreman Loop Smoke",
      description: "connected-loop smoke — safe to delete",
      source: ECHO_SOURCE,
      enabled: true,
      isPrivate: true,
    });
    workflowId = dep.workflowId;
    console.log(`1. deployed durable ${workflowId} (enabled=${dep.enabled})`);

    // 2. Persist the automation with a webhook inbox trigger (real Postgres).
    automationId = await store.createAutomation({
      userId: "loop-smoke-user",
      workspaceId: null,
      name: "Foreman Loop Smoke",
      source: ECHO_SOURCE,
      zapierWorkflowId: workflowId,
      zapierVersionId: dep.versionId,
      trigger: { app: "webhook", action: "hook_v2", inputs: { _zap_static_hook_code: code } },
      enabled: true,
      status: "active",
      editorUrl: dep.editorUrl,
      triggerUrl: dep.triggerUrl,
    });
    console.log(`2. persisted automation ${automationId}`);

    const row = await store.getAutomationByZapierWorkflowId(workflowId);
    if (!row) throw new Error("automation row not found after insert");

    // 3. Arm the inbox (idempotent ensureTriggerInbox + automation-row sync).
    const armed = await armInbox({ sdk, automation: row });
    inboxId = armed?.id ?? null;
    console.log(`3. armed inbox=${armed?.id} status=${armed?.status}`);

    // 4. Subscribe BEFORE posting the event. This is the whole point of the
    //    watchTriggerInbox migration (foreman-em74): delivery is an SSE
    //    notification, not the next tick of a 60s poll, so the subscription has
    //    to be live first. Not awaited — it only resolves when we abort.
    const controller = new AbortController();
    const subscription = watchAutomationInbox({
      sdk,
      automation: row,
      signal: controller.signal,
    }).catch((e) => console.error("   subscription error:", (e as Error).message));
    console.log("4. subscribed (SSE)");

    // 5. POST a real event to the catch URL, then wait for the run row to appear.
    console.log(`5. POST event → ${catchUrl}`);
    const res = await fetch(catchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "loop-smoke", code }),
    });
    console.log(`   POST → ${res.status}`);

    let fired = false;
    const startedAt = Date.now();
    for (let i = 1; i <= 15 && !fired; i++) {
      await sleep(2000);
      const { data: rows } = await getSupabase()
        .from("automation_run")
        .select("id,status")
        .eq("automation_id", automationId);
      if (rows?.length) {
        fired = true;
        console.log(
          `   fired after ~${Math.round((Date.now() - startedAt) / 1000)}s → run ${rows[0].id} (${rows[0].status})`,
        );
      }
    }
    if (!fired) console.log("   no run recorded within 30s");

    // Aborting releases anything still leased and resolves the watcher cleanly.
    controller.abort();
    await subscription;

    // 6. Reconcile — advance the run from 'started' to its real terminal status.
    let terminal = false;
    for (let i = 1; i <= 12 && !terminal; i++) {
      await sleep(4000);
      const rec = await reconcilePendingRuns();
      const { data: rows } = await getSupabase()
        .from("automation_run")
        .select("status,durable_run_id")
        .eq("automation_id", automationId);
      const st = rows?.[0]?.status;
      console.log(
        `6. reconcile attempt ${i} (${i * 4}s): updated=${rec.updated} run.status=${st} durable_run_id=${rows?.[0]?.durable_run_id ?? "—"}`,
      );
      if (st === "finished" || st === "failed") terminal = true;
    }

    // 7. Verify the final automation_run row (real Postgres).
    const { data: runs } = await getSupabase()
      .from("automation_run")
      .select("*")
      .eq("automation_id", automationId);
    console.log(`7. automation_run rows: ${runs?.length ?? 0}`);
    if (runs?.length) console.log(JSON.stringify(runs[0], null, 2));

    const finished = runs?.[0]?.status === "finished";
    console.log(
      `\n${fired && finished ? "✓✓ FULL LOOP PASS (run reached 'finished')" : "✗ LOOP INCOMPLETE"} — event → inbox → worker → durable → reconciled, in Postgres`,
    );
  } catch (e) {
    console.error("LOOP ERROR:", (e as Error).message);
  } finally {
    console.log("\ncleanup…");
    if (inboxId) await sdk.deleteTriggerInbox({ inbox: inboxId }).catch(() => {});
    if (workflowId) await deleteAutomation(sdk, workflowId).catch(() => {});
    if (automationId) {
      await getSupabase().from("automation").delete().eq("id", automationId);
      console.log(`  removed automation ${automationId} (+ runs cascade), workflow, inbox`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
