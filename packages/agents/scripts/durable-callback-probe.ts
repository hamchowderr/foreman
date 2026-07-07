/**
 * foreman-e1ob / zfnj / rm8z — does getDurableRun expose the ctx.createCallback URL?
 *
 * Runs a durable that pauses on a human-approval callback, then inspects the RAW
 * getDurableRun.execution FROM OUTSIDE to answer, with evidence, the exact Zapier
 * question: is the callback URL available to Foreman —
 *   (a) natively on the callback operation, or
 *   (b) only if the durable itself reports it via a step output (the zfnj option)?
 * Also verifies rm8z's waiting-detection (getDurableRunStatus.detail.waiting) on
 * real data, then cancels the run to clean up (also exercises y4kc live).
 *
 * Run (from packages/agents, client-creds via Infisical):
 *   infisical run --projectId <id> --env dev --path=/foreman --silent -- \
 *     npx tsx scripts/durable-callback-probe.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";
import { cancelDurableRun, getDurableRunStatus, runAutomationOnce } from "../src/lib/durable";

const sdk = createZapierSdk(
  process.env.ZAPIER_CLIENT_ID && process.env.ZAPIER_CLIENT_SECRET
    ? {
        credentials: {
          clientId: process.env.ZAPIER_CLIENT_ID,
          clientSecret: process.env.ZAPIER_CLIENT_SECRET,
        },
      }
    : undefined,
) as ReturnType<typeof createZapierSdk> & {
  getDurableRun: (o: { run: string }) => Promise<{ data: { status: string; execution: unknown } }>;
  getProfile: () => Promise<{ data: { email?: string; id?: string } }>;
};

const CALLBACK_SOURCE = `import { defineDurable } from "@zapier/zapier-durable";

const workflow = defineDurable("foreman-cb-probe", async (ctx, input) => {
  await ctx.step("prep", async () => ({ ready: true }));
  const [approval, callbackUrl] = await ctx.createCallback("approve");
  // Report the URL the durable itself received — this is the zfnj "durable reports
  // its own callback URL" option; if it flows through getDurableRun we can use it.
  await ctx.step("report-url", async () => ({ callbackUrl }));
  const payload = await approval;
  return { approved: payload };
});

export default workflow;
`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  try {
    const p = await sdk.getProfile();
    console.log("auth:", p.data?.email ?? p.data?.id ?? "?");
  } catch (e) {
    console.log("auth failed:", (e as Error).message);
    process.exit(1);
  }

  console.log("\nrunning a durable that pauses on ctx.createCallback…");
  const { runId, status } = await runAutomationOnce({
    sdk,
    source: CALLBACK_SOURCE,
    input: { req: "approve me" },
  });
  console.log(`run ${runId} → ${status}`);

  let exec: Record<string, unknown> | undefined;
  for (let i = 0; i < 15; i++) {
    await sleep(3000);
    const data = (await sdk.getDurableRun({ run: runId })).data;
    exec = (data.execution ?? undefined) as Record<string, unknown> | undefined;
    const ops = (exec?.operations as Array<Record<string, unknown>>) ?? [];
    console.log(
      `  [t+${(i + 1) * 3}s] top=${data.status} exec=${exec?.status ?? "—"} ops=${ops.length}`,
    );
    if (exec?.status === "waiting" || ops.some((o) => o.callback_token)) break;
  }

  console.log("\n=== RAW execution dump (first 3.5k) ===");
  console.log(JSON.stringify(exec, null, 2)?.slice(0, 3500));

  const distilled = await getDurableRunStatus(sdk, runId);
  console.log("\n=== Foreman getDurableRunStatus.detail (rm8z) ===");
  console.log(JSON.stringify(distilled.detail, null, 2));

  const dump = JSON.stringify(exec ?? {});
  const ops = (exec?.operations as Array<Record<string, unknown>>) ?? [];
  const cbOp = ops.find((o) => o.callback_token);
  const urlMatch = dump.match(/https?:\/\/[^"\\]+/);
  console.log("\n=== VERDICT ===");
  console.log("exec.status            :", exec?.status ?? "—");
  console.log("callback op present    :", cbOp ? "YES" : "no");
  console.log("callback_token         :", cbOp?.callback_token ?? "—");
  console.log("callback op URL field  :", cbOp?.callback_url ?? cbOp?.url ?? "(none on the op)");
  console.log("ANY http(s) URL in exec:", urlMatch ? `YES → ${urlMatch[0]}` : "NO");
  console.log(
    "→ interpretation       :",
    urlMatch
      ? "URL IS reachable from outside (natively or via the report-url step) — zfnj is buildable"
      : "URL is NOT exposed by getDurableRun — need the durable to report it or a Zapier resume endpoint",
  );

  try {
    const s = await cancelDurableRun(sdk, runId);
    console.log(`\ncleanup — cancelDurableRun → ${s}`);
  } catch (e) {
    console.log("cleanup cancel failed:", (e as Error).message);
  }
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
