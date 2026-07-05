/**
 * foreman-ufo3 narrative check: proves the opt-in LLM digest summary works with a
 * real provider (OpenAI). No DB — builds a representative digest in-memory and runs
 * the SHIPPED narrateDigest through the SHIPPED Mastra-agent path.
 *
 * Run (packages/agents, needs the provider key via Infisical):
 *   $env:DIGEST_MODEL="openai/gpt-4o-mini"
 *   infisical run --projectId <id> --env dev --path=/foreman --silent -- \
 *     npx tsx scripts/digest-narrator-probe.ts
 */
import { buildDigest } from "../src/lib/automations/digest";
import { narrateDigest } from "../src/lib/automations/digest-narrator";

const digest = buildDigest(
  [
    {
      automationId: "a",
      automationName: "Nightly Sheets→Slack sync",
      status: "failed",
      error: { message: "connection refused" },
      createdAt: "2026-07-05T02:00:00Z",
    },
    {
      automationId: "b",
      automationName: "Invoice approval",
      status: "waiting",
      createdAt: "2026-07-05T09:00:00Z",
    },
    {
      automationId: "c",
      automationName: "Daily backup",
      status: "finished",
      createdAt: "2026-07-05T03:00:00Z",
    },
    {
      automationId: "d",
      automationName: "Lead enrichment",
      status: "finished",
      createdAt: "2026-07-05T06:00:00Z",
    },
  ],
  "2026-07-04T12:00:00Z",
  "2026-07-05T12:00:00Z",
);

async function main() {
  console.log(`model    : ${process.env.DIGEST_MODEL ?? "(fast tier default)"}`);
  console.log(`headline : ${digest.headline}`);
  const narrative = await narrateDigest(digest);
  console.log(`narrative: ${narrative ?? "(null — disabled or failed)"}`);
  console.log(`\n→ OpenAI narrative : ${narrative ? "PROVEN" : "NOT GENERATED — see above"}`);
  if (!narrative) process.exit(1);
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
