/**
 * Probe: find the real ingest URL for a Webhooks-by-Zapier "Catch Hook"
 * trigger-inbox, then prove instant delivery. Tries candidate account-id segments
 * (the classic catch URL uses the numeric/public account id, not the user UUID),
 * POSTs, and leases up to ~40s per candidate. Cleans up.
 * Run: cd packages/agents && npx tsx scripts/probe-webhook-inbox.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";

const sdk = createZapierSdk();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CODE = "foremansmokehook";

async function leaseUntil(inboxId: string, capMs: number) {
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < capMs) {
    i++;
    const { data: lease } = await sdk.leaseTriggerInboxMessages({
      inbox: inboxId,
      leaseLimit: 5,
      leaseSeconds: 30,
    });
    console.log(
      `    lease ${i} (${Math.round((Date.now() - start) / 1000)}s): msgs=${lease.results.length} inbox=${lease.inbox_attributes.status}`,
    );
    if (lease.results.length) {
      console.log("    ✓ MESSAGE:", JSON.stringify(lease.results[0], null, 2));
      if (lease.lease_id) {
        await sdk.ackTriggerInboxMessages({
          inbox: inboxId,
          lease: lease.lease_id,
          messages: lease.results.map((m) => m.id),
        });
      }
      return true;
    }
    await sleep(4000);
  }
  return false;
}

async function main() {
  // Account-id candidates from a connection (the user-profile id is a UUID and
  // didn't route; catch URLs historically use the numeric/public account id).
  const conns = await sdk.listConnections({ owner: "me", maxItems: 1 });
  const c = conns.data[0] as Record<string, unknown> | undefined;
  console.log("first connection account fields:", {
    account_id: c?.account_id,
    account_public_id: c?.account_public_id,
    public_id: c?.public_id,
  });
  const candidates = [c?.account_public_id, c?.account_id, "16517571", "16517015"].filter(
    Boolean,
  ) as string[];

  let inboxId: string | undefined;
  try {
    const { data: inbox } = await sdk.ensureTriggerInbox({
      name: "foreman-hook-probe",
      app: "webhook",
      action: "hook_v2",
      inputs: { _zap_static_hook_code: CODE },
    });
    inboxId = inbox.id;
    await sleep(1500);
    const { data: got } = await sdk.getTriggerInbox({ inbox: inbox.id });
    console.log(`inbox ${inbox.id} status=${got.status}`);

    for (const acct of candidates) {
      const url = `https://hooks.zapier.com/hooks/catch/${acct}/${CODE}/`;
      console.log(`\n→ candidate account ${acct}\n  POST ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hello: "foreman-smoke", acct }),
      });
      console.log(`  POST → ${res.status}`);
      const delivered = await leaseUntil(inbox.id, 24_000);
      if (delivered) {
        console.log(`\n✓✓ WORKING URL: ${url}`);
        break;
      }
    }
  } catch (e) {
    console.error("ERR:", (e as Error).message);
  } finally {
    if (inboxId) {
      await sdk.deleteTriggerInbox({ inbox: inboxId }).catch(() => {});
      console.log(`\ndeleted inbox ${inboxId}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
