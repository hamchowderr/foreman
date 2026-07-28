/**
 * Spike (foreman-02lu): run a Foreman-shaped durable with a human-approval gate
 * on the FILESYSTEM adapter — no Zapier early-access allowlist, no network.
 *
 * What this answers:
 *   1. Does `@zapier/zapier-durable` run in-process on the filesystem adapter?
 *   2. Does it work with the repo-wide `zod` override (4.4.3) even though the
 *      package pins zod 4.2.1 exactly?
 *   3. What does `ctx.createCallback` hand back as `callbackUrl` locally — is it
 *      something Foreman's /automations Approve/Deny could POST to, or does
 *      delivery have to go through the adapter client?
 *
 * Run:  npx tsx scripts/durable-filesystem-spike.ts
 * No credentials required.
 *
 * STABILITY: the package README states it is pre-1.0 and that MINOR versions are
 * breaking until 1.0, and it ships one roughly every 1-2 weeks (0.5.2 -> 0.11.0
 * between 2026-06-02 and 2026-07-27). The `^0.11.0` range is deliberate: npm
 * caret on a 0.x version allows patches only (`^0.11.0` rejects 0.12.0), so it
 * pins us below the next breaking minor. Re-run this spike on every minor bump.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configureDurable, createClient, defineDurable, getConfig } from "@zapier/zapier-durable";
import { z } from "zod";

const stateDir = mkdtempSync(join(tmpdir(), "foreman-durable-spike-"));

function log(label: string, value?: unknown) {
  if (value === undefined) console.log(`\n${label}`);
  else console.log(`  ${label}`, typeof value === "string" ? value : JSON.stringify(value));
}

async function main() {
  // 1. Select the adapter explicitly rather than relying on the documented
  //    default, so this proves the env-selected path Foreman would ship.
  process.env.ZAPIER_DURABLE_ADAPTER = "filesystem";
  process.env.ZAPIER_DURABLE_FS_DIR = stateDir;
  configureDurable({ adapter: "filesystem", filesystem: { baseDir: stateDir } });

  log("[1] config");
  const cfg = getConfig();
  log("adapter:", cfg.adapter);
  log("stateDir:", stateDir);

  const client = createClient();
  log("client:", client.constructor.name);
  log("callbackBaseUrl:", client.callbackBaseUrl);

  // 2. A durable shaped like Foreman's: one step, then a human-approval gate.
  //    payloadSchema exercises zod — the version the override forced on it.
  let observedCallbackUrl: string | undefined;

  const approvalDurable = defineDurable({
    name: "foreman-spike-approval",
    description: "One step, then wait for a human decision.",
    inputSchema: z.object({ subject: z.string() }),
    run: async (ctx, input) => {
      const prepared = await ctx.step("prepare", async () => ({
        subject: input.subject,
        preparedAt: "fixed-for-determinism",
      }));

      const [approval, callbackUrl] = await ctx.createCallback({
        name: "human-approval",
        payloadSchema: z.object({ approved: z.boolean(), note: z.string().optional() }),
      });

      // THE POINT OF THE SPIKE: in-process the URL is right here, no
      // `__report_callback_url_*` step needed to smuggle it out.
      observedCallbackUrl = callbackUrl;

      const decision = await approval;
      return { subject: prepared.subject, approved: decision.approved, note: decision.note };
    },
  });

  // 3. First tick — should suspend at the gate.
  log("[2] first tick (expect suspend at the approval gate)");
  const first = await approvalDurable({ subject: "ship it" });
  log("done:", first.done);
  log("executionId:", first.executionId ?? "(none)");
  log("callbackUrl:", observedCallbackUrl ?? "(never observed)");

  if (first.done)
    throw new Error("expected the durable to suspend at the callback, but it finished");
  if (!observedCallbackUrl) throw new Error("ctx.createCallback did not surface a callbackUrl");
  if (!first.executionId) throw new Error("no executionId returned; cannot resume");

  // 4. Deliver the decision. The token is the last URL segment; the adapter
  //    client is the delivery path (there is no HTTP server locally).
  const token = observedCallbackUrl.split("/").pop() as string;
  log("[3] delivering approval via the adapter client");
  log("token:", token);
  // `CallbackRequest` is `unknown` — the payload IS the body, not `{ payload }`.
  // Wrapping it fails edge validation against the gate's payloadSchema.
  const delivered = await client.callback(token, { approved: true, note: "spike" });
  log("callback response:", delivered);
  if ("error" in delivered) throw new Error(`callback delivery rejected: ${delivered.error}`);

  // 5. Resume and confirm the journal replayed to completion.
  log("[4] resume");
  const second = await approvalDurable(first.executionId);
  log("done:", second.done);
  log("result:", second.result);
  log("error:", second.error?.message ?? "(none)");

  if (!second.done) throw new Error("durable did not complete after callback delivery");
  const result = second.result as { approved?: boolean; subject?: string; note?: string };
  if (result?.approved !== true) throw new Error(`expected approved=true, got ${result?.approved}`);

  log("[5] VERDICT");
  log("filesystem adapter ran end-to-end:", true);
  log("zod override (4.4.3) accepted by payloadSchema:", true);
  log("callbackUrl available in-process:", observedCallbackUrl);
  log("callbackUrl is HTTP-POSTable:", /^https?:\/\//.test(observedCallbackUrl));
}

main()
  .then(() => {
    console.log("\nPASS");
    process.exitCode = 0;
  })
  .catch((err) => {
    console.error("\nFAIL:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });
