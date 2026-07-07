/**
 * foreman-zfnj end-to-end proof. Composes an approval-gated durable with the
 * SHIPPED authoring helper (`humanApprovalGate`), runs it, then approves it via the
 * SHIPPED lib chain the /automations route uses — `resolveCallbackUrl` (reads the
 * URL the durable self-reported) + `postCallback` (POSTs the decision) — and confirms
 * the run resumes to finished carrying that decision. Proves the whole zfnj mechanism
 * against real Zapier (the workspace/route wrapper is covered by unit tests).
 *
 * Run (packages/agents, client-creds via Infisical):
 *   infisical run --projectId <id> --env dev --path=/foreman --silent -- \
 *     npx tsx scripts/durable-approval-probe.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";
import {
  getDurableRunStatus,
  humanApprovalGate,
  postCallback,
  resolveCallbackUrl,
  runAutomationOnce,
} from "../src/lib/durable";

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
  }) => Promise<{ data: { execution: { status?: string } | null } }>;
};

// Approval durable authored with the SHIPPED gate helper (self-reports its URL).
const SOURCE = `import { defineDurable } from "@zapier/zapier-durable";

const workflow = defineDurable("foreman-approval-probe", async (ctx, input) => {
  await ctx.step("prep", async () => ({ ready: true }));
${humanApprovalGate("approve")}
  return { decision: approveDecision };
});

export default workflow;
`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("running an approval-gated durable (humanApprovalGate)…");
  const { runId } = await runAutomationOnce({ sdk, source: SOURCE, input: { req: "ship it" } });
  console.log(`run ${runId}`);

  // Wait until it's parked waiting on the gate.
  for (let i = 0; i < 15; i++) {
    await sleep(3000);
    const execStatus = (await sdk.getDurableRun({ run: runId })).data.execution?.status;
    console.log(`  [t+${(i + 1) * 3}s] exec=${execStatus ?? "—"}`);
    if (execStatus === "waiting") break;
  }

  // Exactly what respondToCallbackForUser does server-side:
  const cb = await resolveCallbackUrl(sdk, runId, "approve");
  console.log(`\nresolveCallbackUrl → ${cb ? `${cb.name} @ ${cb.url}` : "NULL"}`);
  if (!cb) {
    console.log("✗ FAIL — could not resolve the callback URL (authoring convention broken)");
    process.exit(1);
  }

  const res = await postCallback(cb.url, { approved: true, by: "zfnj-probe" });
  console.log(`postCallback → HTTP ${res.status} ok=${res.ok}`);

  let final: { status: string; output: unknown } | undefined;
  for (let i = 0; i < 15; i++) {
    await sleep(3000);
    const s = await getDurableRunStatus(sdk, runId);
    console.log(`  [resume t+${(i + 1) * 3}s] status=${s.status}`);
    if (["finished", "failed", "cancelled"].includes(s.status)) {
      final = { status: s.status, output: s.output };
      break;
    }
  }

  console.log("\n=== VERDICT ===");
  console.log("resolved URL     :", cb ? "YES ✓" : "NO ✗");
  console.log("POST accepted    :", res.ok ? `YES (${res.status})` : `NO (${res.status})`);
  console.log(
    "resumed+finished :",
    final?.status === "finished" ? "YES ✓" : (final?.status ?? "timed out"),
  );
  console.log("final output     :", JSON.stringify(final?.output ?? null));
  console.log(
    "→ zfnj mechanism :",
    cb && res.ok && final?.status === "finished" ? "PROVEN end-to-end" : "INCOMPLETE — see above",
  );
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
