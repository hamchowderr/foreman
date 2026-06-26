/**
 * Observe the FAILED durable lifecycle (foreman-480k companion). A failing step
 * does NOT fail the run promptly — the engine RETRIES it and the top-level status
 * stays "started". This dumps execution.summary + operations (retry_count /
 * last_error / next_retry_at) so we can see the real retry→fail behavior and how
 * long terminal failure takes. Runs an ephemeral throwing durable; polls up to 5m.
 * Run: cd packages/agents && npx tsx scripts/run-failed-probe.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";
import { runAutomationOnce } from "../src/lib/durable";

const sdk = createZapierSdk();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FAIL_SOURCE = `import { defineDurable } from "@zapier/zapier-durable";
const workflow = defineDurable("foreman-fail", async (ctx) => {
  await ctx.step("boom", async () => {
    throw new Error("intentional smoke failure");
  });
  return { neverReached: true };
});
export default workflow;
`;

async function main() {
  const { runId } = await runAutomationOnce({ sdk, source: FAIL_SOURCE });
  console.log(`run ${runId}; polling up to 5m…\n`);

  for (let i = 1; i <= 60; i++) {
    await sleep(5000);
    const { data: dr } = await sdk.getDurableRun({ run: runId });
    const ex = dr.execution as {
      status?: string;
      summary?: { total_attempts?: number; last_error?: unknown };
      operations?: Array<{
        name: string;
        status: string;
        retry_count?: number;
        max_attempts?: number;
        next_retry_at?: string;
        error?: unknown;
      }>;
    } | null;
    const op = ex?.operations?.find((o) => o.name === "boom");
    console.log(
      `${String(i * 5).padStart(3)}s  run=${dr.status}  exec=${ex?.status ?? "—"}  ` +
        `attempts=${ex?.summary?.total_attempts ?? "—"}  boom.retry=${op?.retry_count ?? "—"}/${op?.max_attempts ?? "—"}  ` +
        `next_retry=${op?.next_retry_at ?? "—"}`,
    );
    if (dr.status === "finished" || dr.status === "failed") {
      console.log(`\n→ TERMINAL run.status=${dr.status}`);
      console.log(`  run.error      = ${JSON.stringify(dr.error)}`);
      console.log(`  summary.last_error = ${JSON.stringify(ex?.summary?.last_error)}`);
      console.log(`  boom.error     = ${JSON.stringify(op?.error)}`);
      break;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
