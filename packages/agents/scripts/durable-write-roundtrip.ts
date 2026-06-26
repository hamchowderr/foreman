/**
 * Definitive WRITE round-trip (foreman-13mw): prove the durable/workflow DEFINE
 * path works end-to-end now that next-gen-Zaps early access is granted.
 *
 * createWorkflow (only needs a name) -> capture id -> deleteWorkflow (cleanup).
 * SELF-CLEANING: the created workflow is private (is_private) and is deleted right
 * after, so it never lingers on the account. If delete fails it prints the id for
 * manual cleanup. Read auth = client credentials.
 *
 * Run from packages/agents:
 *   infisical run --projectId <id> --env dev --recursive --silent -- npx tsx scripts/durable-write-roundtrip.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";

async function main() {
  const clientId = process.env.ZAPIER_CLIENT_ID;
  const clientSecret = process.env.ZAPIER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("ZAPIER_CLIENT_ID / ZAPIER_CLIENT_SECRET not set — run via infisical run.");
    process.exit(1);
  }
  const sdk = createZapierSdk({ credentials: { clientId, clientSecret } }) as any;

  try {
    const { data } = await sdk.getProfile();
    console.log(`auth: ${data?.email ?? data?.id ?? "?"}`);
  } catch (e: any) {
    console.log(`auth: getProfile failed -> ${e?.message ?? e}`);
  }

  const name = `foreman-access-probe-${Date.now()}`;
  let createdId: string | undefined;
  let created = false;

  console.log(`\ncreateWorkflow({ name: "${name}", is_private: true }) ...`);
  try {
    const { data } = await sdk.createWorkflow({ name, is_private: true });
    createdId = data?.id;
    created = true;
    console.log(
      `  -> CREATED  id=${data?.id}  enabled=${data?.enabled}  is_private=${data?.is_private}`,
    );
    if (data?.trigger_url) console.log(`     trigger_url=${data.trigger_url}`);
  } catch (e: any) {
    const code = e?.statusCode ?? e?.status;
    console.log(
      `  -> createWorkflow FAILED (${code ?? "?"}): ${String(e?.message ?? e).slice(0, 180)}`,
    );
  }

  if (createdId) {
    try {
      await sdk.deleteWorkflow({ workflow: createdId });
      console.log(`deleteWorkflow({ workflow: "${createdId}" }) -> DELETED (cleaned up)`);
    } catch (e: any) {
      console.log(
        `deleteWorkflow FAILED for ${createdId}: ${String(e?.message ?? e).slice(0, 180)}`,
      );
      console.log(`  MANUAL CLEANUP NEEDED: workflow ${createdId}`);
    }
  }

  console.log(
    `\nVERDICT: ${
      created
        ? "workflow DEFINE works end-to-end — createWorkflow succeeded, cleanup attempted."
        : "create did NOT succeed — see error above."
    }`,
  );
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
