/**
 * Observe the REAL durable run-status lifecycle (foreman-480k). Deploys a slow
 * durable (a ctx.wait makes intermediate states visible), triggers it, and polls
 * ALL THREE run views — trigger run, durable run, workflow run — with timestamps,
 * so we can see exactly how `status` and `durable_run_id` resolve over time and
 * which field is authoritative for "finished". Cleans up.
 *
 * Run: cd packages/agents && npx tsx scripts/run-status-probe.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";
import { deleteAutomation, deployAutomation } from "../src/lib/durable";

const sdk = createZapierSdk();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const el = () => `${String(Date.now() - t0).padStart(6)}ms`;

// A slow durable: a step, a 6s durable wait, another step. The wait keeps the run
// observably in-progress so we see pre-terminal states.
const SLOW_SOURCE = `import { defineDurable } from "@zapier/zapier-durable";
const workflow = defineDurable("foreman-status", async (ctx, input) => {
  const a = await ctx.step("step-a", async () => ({ stage: "a" }));
  await ctx.wait("pause", 6);
  const b = await ctx.step("step-b", async () => ({ stage: "b", a }));
  return { done: true, b };
});
export default workflow;
`;

async function main() {
  let workflowId: string | undefined;
  try {
    const dep = await deployAutomation({
      sdk,
      name: "Foreman Status Probe",
      source: SLOW_SOURCE,
      enabled: true,
      isPrivate: true,
    });
    workflowId = dep.workflowId;
    console.log(`${el()} deployed ${workflowId}`);

    const { data: trig } = await sdk.triggerWorkflow({ workflow: workflowId, input: { n: 1 } });
    const triggerId = trig.id;
    console.log(`${el()} triggered → triggerId=${triggerId}`);

    let durableRunId: string | null = null;
    let done = false;
    for (let i = 0; i < 40 && !done; i++) {
      await sleep(1500);

      // 1) Trigger run
      try {
        const { data: tr } = await sdk.getTriggerRun({ trigger: triggerId });
        durableRunId = tr.durable_run_id ?? durableRunId;
        console.log(
          `${el()} TRIGGER  status=${tr.status}  durable_run_id=${tr.durable_run_id ?? "—"}  wf_version=${tr.workflow_version_id ?? "—"}`,
        );
      } catch (e) {
        console.log(`${el()} TRIGGER  err=${(e as Error).message}`);
      }

      // 2) Durable run (once we have its id)
      if (durableRunId) {
        try {
          const { data: dr } = await sdk.getDurableRun({ run: durableRunId });
          const ex = dr.execution as { status?: string } | null;
          console.log(
            `${el()} DURABLE  status=${dr.status}  execution.status=${ex?.status ?? "—"}  error=${dr.error ? JSON.stringify(dr.error) : "—"}`,
          );
          if (dr.status === "finished" || dr.status === "failed") {
            console.log(`${el()} → terminal. output=${JSON.stringify(dr.output)}`);
            done = true;
          }
        } catch (e) {
          console.log(`${el()} DURABLE  err=${(e as Error).message}`);
        }
      }

      // 3) Workflow run view
      try {
        const { data: wruns } = await sdk.listWorkflowRuns({ workflow: workflowId, maxItems: 1 });
        const wr = wruns[0];
        if (wr) {
          console.log(
            `${el()} WFRUN    status=${wr.status}  trigger_id=${wr.trigger_id ?? "—"}  durable_run_id=${wr.durable_run_id ?? "—"}`,
          );
        }
      } catch (e) {
        console.log(`${el()} WFRUN    err=${(e as Error).message}`);
      }
      console.log("");
    }
  } catch (e) {
    console.error("PROBE ERR:", (e as Error).message);
  } finally {
    if (workflowId) {
      await deleteAutomation(sdk, workflowId).catch(() => {});
      console.log(`${el()} cleaned up ${workflowId}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
