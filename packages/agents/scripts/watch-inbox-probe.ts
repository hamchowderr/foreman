/**
 * foreman-em74 — prove `watchInbox` actually subscribes against LIVE Zapier.
 *
 * The unit tests mock `watchTriggerInbox`, so they prove the options we pass and
 * nothing about whether a subscription establishes. This opens a real one,
 * holds it, and aborts it. It does NOT prove message delivery — that needs a
 * real event, which needs a catch-hook URL (see durable-loop-smoke.ts, gated on
 * ZAPIER_ACCOUNT_ID).
 *
 * What a pass means: ensureTriggerInbox armed a real inbox, watchTriggerInbox
 * opened its SSE subscription without throwing, and aborting resolved it
 * cleanly instead of hanging or rejecting.
 *
 * Run (from packages/agents, client-creds via Infisical):
 *   infisical run --projectId <id> --env dev --path=/foreman --silent -- \
 *     npx tsx scripts/watch-inbox-probe.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";
import { ensureInbox, watchInbox } from "../src/lib/trigger-inbox";

const sdk = createZapierSdk(
  process.env.ZAPIER_CLIENT_ID && process.env.ZAPIER_CLIENT_SECRET
    ? {
        credentials: {
          clientId: process.env.ZAPIER_CLIENT_ID,
          clientSecret: process.env.ZAPIER_CLIENT_SECRET,
        },
      }
    : undefined,
) as Parameters<typeof ensureInbox>[0]["sdk"] & {
  getProfile: () => Promise<{ data: { email?: string } }>;
  deleteTriggerInbox: (o: { inbox: string }) => Promise<unknown>;
};

const HOLD_MS = 8000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const hookCode = `fmnem74${Math.floor(Date.now() / 1000)}`;
const hookKey = `foreman-em74-probe-${Date.now()}`;

async function main() {
  let inboxId: string | null = null;
  let failures = 0;

  try {
    const p = await sdk.getProfile();
    console.log(`auth: ${p.data?.email ?? "?"}`);

    console.log("\n[1] arm a real inbox");
    const inbox = await ensureInbox({
      sdk,
      key: hookKey,
      // webhook/hook_v2 needs NO connection — the same trigger durable-loop-smoke
      // uses. A connected app like github/issue_v2 arms as "initializing" and then
      // fails without one, which is a probe-setup failure, not a code failure.
      app: "webhook",
      action: "hook_v2",
      inputs: { _zap_static_hook_code: hookCode },
    });
    inboxId = inbox.id;
    console.log(`  ok    inbox ${inbox.id} status=${inbox.status}`);

    console.log(`\n[2] open the SSE subscription and hold it ${HOLD_MS / 1000}s`);
    const controller = new AbortController();
    let received = 0;
    let subscriptionError: unknown = null;

    const subscription = watchInbox({
      sdk,
      inbox: inbox.id,
      signal: controller.signal,
      leaseLimit: 5,
      leaseSeconds: 30,
      onMessage: (m) => {
        received++;
        console.log(`        message ${m.id}`);
      },
    }).catch((e) => {
      subscriptionError = e;
    });

    await sleep(HOLD_MS);
    if (subscriptionError) {
      console.log(`  FAIL  subscription rejected: ${(subscriptionError as Error).message}`);
      failures++;
    } else {
      console.log(`  ok    held ${HOLD_MS / 1000}s without error (${received} messages)`);
    }

    console.log("\n[3] abort and confirm it resolves cleanly");
    const abortedAt = Date.now();
    controller.abort();
    await Promise.race([subscription, sleep(15000)]);
    const elapsed = Date.now() - abortedAt;
    if (elapsed < 15000) {
      console.log(`  ok    resolved ${elapsed}ms after abort`);
    } else {
      console.log("  FAIL  did not resolve within 15s of abort");
      failures++;
    }
  } catch (e) {
    console.log(`  FAIL  ${(e as Error).message}`);
    failures++;
  } finally {
    if (inboxId) {
      await sdk.deleteTriggerInbox({ inbox: inboxId }).catch(() => {});
      console.log(`\ncleanup: deleted inbox ${inboxId}`);
    }
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("probe crashed:", e);
  process.exit(1);
});
