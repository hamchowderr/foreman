/**
 * Read-only probe: what's connected on this Zapier account + what instant
 * (webhook/hook) triggers are available for an end-to-end inbox test.
 * Run: cd packages/agents && npx tsx scripts/probe-connections.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";

const sdk = createZapierSdk();

async function main() {
  console.log("=== Connections (owner: me) ===");
  try {
    const conns = await sdk.listConnections({ owner: "me", maxItems: 50 });
    if (conns.data.length === 0) console.log("  (none)");
    for (const c of conns.data) {
      console.log(`  app=${c.app_key ?? "?"}  title="${c.title ?? c.label ?? ""}"  id=${c.id}`);
    }
    console.log(`  → ${conns.data.length} connection(s)`);
  } catch (e) {
    console.log("  listConnections error:", (e as Error).message);
  }

  console.log("\n=== Apps matching 'webhook' ===");
  try {
    const apps = await sdk.listApps({ search: "webhook", maxItems: 6 });
    for (const a of apps.data) {
      console.log(`  key=${a.key}  impl=${a.implementation_id}  "${a.title}"`);
    }
  } catch (e) {
    console.log("  listApps error:", (e as Error).message);
  }

  // Webhooks-by-Zapier triggers (the canonical instant trigger for testing).
  for (const appKey of ["webhook", "WebHookAPI", "webhooks"]) {
    console.log(`\n=== Triggers for app '${appKey}' ===`);
    try {
      const trigs = await sdk.listTriggers({ app: appKey });
      if (trigs.data.length === 0) console.log("  (none)");
      for (const t of trigs.data) {
        console.log(`  key=${t.key}  "${t.title}"  type=${t.action_type ?? "?"}`);
      }
      break; // first one that resolves wins
    } catch (e) {
      console.log(`  ${appKey}: ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
