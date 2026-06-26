/**
 * Read-only confirmation: did the next-gen-Zaps / durable early-access grant
 * (2026-06-25 "You're In!" email, foreman-13mw) lift the durable-RUN allowlist 403?
 *
 * Calls ONLY read-only durable endpoints under CLIENT CREDENTIALS — no runDurable,
 * no createWorkflow — so it never creates a resource on the account. Classifies:
 *   - EARLY-ACCESS 403  -> still allowlisted-out ("available only to select users")
 *   - userJwt 403       -> internal-scope wall (needs userJwt/internal scope)
 *   - AUTH OK           -> 2xx, or a non-auth 4xx (e.g. 404 for the fake id) => access works
 *
 * Run from packages/agents with ZAPIER_CLIENT_ID/SECRET in env (via infisical run):
 *   infisical run --projectId <id> --env dev --recursive --silent -- npx tsx scripts/durable-access-confirm.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";

// Well-formed but nonexistent UUID — clears the SDK's client-side Zod validation
// so the call reaches the server's auth layer; a missing id then 404s (auth passed).
const U = "00000000-0000-4000-8000-000000000000";
// READ-ONLY endpoints only (no runDurable / createWorkflow / publish / delete) —
// these never create or mutate a resource on the account. Covers BOTH the
// durable-run family and the workflow-definition family so we can see, per family,
// whether the wall is lifted under client-credentials.
const READONLY: Array<[string, unknown]> = [
  // durable-run family
  ["listDurableRuns", {}],
  ["getDurableRun", { run: U }],
  // workflow-definition family (read-only members)
  ["listWorkflows", {}],
  ["getWorkflow", { workflow: U }],
  ["listWorkflowVersions", { workflow: U }],
  ["getWorkflowVersion", { workflow: U, version: U }],
  ["listWorkflowRuns", { workflow: U }],
  ["getWorkflowRun", { run: U }],
  ["getTriggerRun", { trigger: U }],
];

function classify(msg: string, code?: number): string {
  if (code === 403 && /select users|early access|not yet|available only/i.test(msg))
    return "EARLY-ACCESS 403 (still walled)";
  if (code === 403 && /security schemes \(userJwt\)|userJwt/i.test(msg))
    return "userJwt 403 (internal-scope wall)";
  if (typeof code === "number" && code >= 400 && code < 500) return `AUTH OK (non-auth ${code})`;
  if (code === undefined) return "OTHER";
  return `OTHER (${code})`;
}

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
    console.log(`sanity getProfile -> OK: ${data?.email ?? data?.id ?? "?"}`);
  } catch (e: any) {
    console.log(`sanity getProfile -> ${e?.message ?? e}`);
  }

  for (const [method, args] of READONLY) {
    if (typeof sdk[method] !== "function") {
      console.log(`${method.padEnd(18)} -> MISSING (not a function on this SDK)`);
      continue;
    }
    try {
      const { data } = await sdk[method](args);
      console.log(`${method.padEnd(18)} -> AUTH OK (2xx): ${JSON.stringify(data).slice(0, 90)}`);
    } catch (e: any) {
      const code = e?.statusCode ?? e?.status;
      console.log(
        `${method.padEnd(18)} -> ${classify(String(e?.message ?? e), code)} :: ${String(
          e?.message ?? e,
        ).slice(0, 100)}`,
      );
    }
  }
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
