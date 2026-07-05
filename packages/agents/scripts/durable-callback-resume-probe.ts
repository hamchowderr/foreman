/**
 * foreman-e1ob / zfnj — does POSTing the createCallback URL actually RESUME the run?
 *
 * Completes the callback loop the exposure probe started: run a durable that pauses
 * on ctx.createCallback, read the URL it self-reports via a step, POST an approval
 * payload to it, and confirm the run leaves "waiting" and finishes with that payload.
 * This is the last unknown for zfnj — visible ≠ resumable.
 *
 * Run (packages/agents, client-creds via Infisical):
 *   infisical run --projectId <id> --env dev --path=/foreman --silent -- \
 *     npx tsx scripts/durable-callback-resume-probe.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";
import { cancelDurableRun, runAutomationOnce } from "../src/lib/durable";

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
  getDurableRun: (o: {
    run: string;
  }) => Promise<{ data: { status: string; output: unknown; execution: unknown } }>;
};

const CALLBACK_SOURCE = `import { defineDurable } from "@zapier/zapier-durable";

const workflow = defineDurable("foreman-cb-resume", async (ctx, input) => {
  const [approval, callbackUrl] = await ctx.createCallback("approve");
  await ctx.step("report-url", async () => ({ callbackUrl }));
  const payload = await approval;
  return { approved: payload };
});

export default workflow;
`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function findCallbackUrl(exec: unknown): string | undefined {
  const ops = ((exec as { operations?: Array<Record<string, unknown>> })?.operations ??
    []) as Array<Record<string, unknown>>;
  for (const op of ops) {
    const res = op.result as { callbackUrl?: string } | undefined;
    if (res?.callbackUrl) return res.callbackUrl;
  }
  return undefined;
}

async function main() {
  console.log("running a durable that pauses on ctx.createCallback…");
  const { runId } = await runAutomationOnce({
    sdk,
    source: CALLBACK_SOURCE,
    input: { req: "please approve" },
  });
  console.log(`run ${runId}`);

  // Wait until it's parked in "waiting" and has reported its URL.
  let url: string | undefined;
  for (let i = 0; i < 15; i++) {
    await sleep(3000);
    const { execution, status } = (await sdk.getDurableRun({ run: runId })).data;
    url = findCallbackUrl(execution);
    const execStatus = (execution as { status?: string })?.status;
    console.log(
      `  [t+${(i + 1) * 3}s] top=${status} exec=${execStatus ?? "—"} url=${url ? "got" : "—"}`,
    );
    if (url && execStatus === "waiting") break;
  }
  if (!url) {
    console.log("never captured a callback URL — cancelling.");
    await cancelDurableRun(sdk, runId).catch(() => {});
    process.exit(1);
  }

  console.log(`\nPOSTing approval to the callback URL…\n  ${url}`);
  const body = { decision: "approved", by: "foreman-probe" };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(`  → HTTP ${res.status} ${res.statusText}`);
  const text = await res.text().catch(() => "");
  if (text) console.log(`  body: ${text.slice(0, 300)}`);

  // Did it resume?
  let final: { status: string; output: unknown } | undefined;
  for (let i = 0; i < 15; i++) {
    await sleep(3000);
    const d = (await sdk.getDurableRun({ run: runId })).data;
    console.log(`  [resume t+${(i + 1) * 3}s] status=${d.status}`);
    if (d.status === "finished" || d.status === "failed") {
      final = { status: d.status, output: d.output };
      break;
    }
  }

  console.log("\n=== VERDICT ===");
  console.log("POST accepted        :", res.ok ? `YES (${res.status})` : `NO (${res.status})`);
  console.log(
    "run resumed+finished :",
    final?.status === "finished" ? "YES ✓" : (final?.status ?? "still waiting / timed out"),
  );
  console.log("final output         :", JSON.stringify(final?.output ?? null));
  console.log(
    "→ zfnj              :",
    res.ok && final?.status === "finished"
      ? "PROVEN buildable via durable-self-reported URL + plain POST"
      : "POST/resume did NOT complete — see status above",
  );

  if (!final) await cancelDurableRun(sdk, runId).catch(() => {});
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
