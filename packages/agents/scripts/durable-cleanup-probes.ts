/**
 * Delete leftover probe/smoke durable workflows from the account (hygiene for the
 * durable-*-probe scripts, which mostly self-clean but can leave a workflow behind
 * on a hard failure). Deletes any workflow whose name matches /probe|smoke|access/i.
 *
 * Run (packages/agents, client-creds via Infisical):
 *   infisical run --projectId <id> --env dev --path=/foreman --silent -- \
 *     npx tsx scripts/durable-cleanup-probes.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";
import { deleteAutomation } from "../src/lib/durable";

const sdk = createZapierSdk(
  process.env.ZAPIER_CLIENT_ID && process.env.ZAPIER_CLIENT_SECRET
    ? {
        credentials: {
          clientId: process.env.ZAPIER_CLIENT_ID,
          clientSecret: process.env.ZAPIER_CLIENT_SECRET,
        },
      }
    : undefined,
);

async function main() {
  const { data } = await sdk.listWorkflows();
  console.log(`${data.length} workflow(s) on the account`);
  let deleted = 0;
  for (const w of data) {
    if (/probe|smoke|access/i.test(w.name)) {
      try {
        await deleteAutomation(sdk, w.id);
        console.log(`  deleted ${w.id}  "${w.name}"`);
        deleted++;
      } catch (e) {
        console.log(`  FAILED to delete ${w.id} "${w.name}": ${(e as Error).message}`);
      }
    } else {
      console.log(`  kept    ${w.id}  "${w.name}"`);
    }
  }
  console.log(`\ndeleted ${deleted} probe workflow(s)`);
}

main().catch((e) => {
  console.error("cleanup failed:", e);
  process.exit(1);
});
