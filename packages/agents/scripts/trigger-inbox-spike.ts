/**
 * Trigger-Inbox Spike (foreman-bdjp)
 * ----------------------------------
 * Hands-on exploration of @zapier/zapier-sdk/experimental's trigger-inbox API,
 * unlocked by the 0.48->0.69.3 bump. Goal: learn the real ensure/lease/ack/
 * release/drain lifecycle (and the dedup signals) against one app before we
 * decide whether to wire it into Foreman's stubbed `poll` trigger type.
 *
 * SAFETY:
 *   - Default run = DISCOVERY ONLY (read-only): profile probe, listTriggers,
 *     getTriggerInputFieldsSchema, listTriggerInboxes. Creates nothing.
 *   - `--live-create` performs the full lifecycle: it CREATES a real trigger
 *     inbox on Zapier's side, leases real messages, acks/releases them, and
 *     (unless `--keep`) deletes the inbox afterward.
 *
 * Run (from packages/agents):
 *   npx tsx --env-file=.env.local scripts/trigger-inbox-spike.ts                 # safe discovery
 *   npx tsx --env-file=.env.local scripts/trigger-inbox-spike.ts --live-create   # full lifecycle
 *   flags: --app=github  --action=<triggerKey>  --keep  --lease=5  --json
 *
 * Credentials mirror Foreman (lib/zapier/sdk.ts + zapier-sdk-tools.ts):
 *   DEV_ZAPIER_OVERRIDE (token) > ZAPIER_CLIENT_ID/SECRET (client creds) > CLI login.
 */
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";

/**
 * Minimal shapes for the two experimental list endpoints this probe reads. The
 * SDK reaches them through `as any` (they aren't on the typed surface), so
 * `Array.fromAsync` would otherwise yield `unknown[]`. Only the fields this
 * script prints are declared — this is a probe, not a typing of the API.
 */
type ProbeTrigger = { key: string; title: string; action_type: string };
type ProbeInbox = {
  id: string;
  status: string;
  subscription?: {
    app_key?: string;
    action_key?: string;
    connection_id?: string;
    inputs?: Record<string, unknown>;
  };
};

type Args = {
  app: string;
  action?: string;
  liveCreate: boolean;
  keep: boolean;
  leaseLimit: number;
  json: boolean;
  inbox?: string; // operate on an existing inbox (phase 2) instead of creating one
  waitSeconds: number; // poll-for-ready + lease-retry budget
  inputs?: Record<string, unknown>; // trigger inputs, e.g. {"repo":"owner/name"}
};

function parseArgs(argv: string[]): Args {
  const get = (k: string) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.split("=").slice(1).join("=") : undefined;
  };
  const has = (k: string) => argv.includes(`--${k}`);
  return {
    app: get("app") ?? "github",
    action: get("action"),
    liveCreate: has("live-create"),
    keep: has("keep"),
    leaseLimit: Number(get("lease") ?? 5),
    json: has("json"),
    inbox: get("inbox"),
    waitSeconds: Number(get("wait") ?? 0),
    inputs: get("inputs") ? JSON.parse(get("inputs") as string) : undefined,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resolveCredentials(): { clientId: string; clientSecret: string } | string | undefined {
  if (process.env.DEV_ZAPIER_OVERRIDE) return process.env.DEV_ZAPIER_OVERRIDE;
  const clientId = process.env.ZAPIER_CLIENT_ID;
  const clientSecret = process.env.ZAPIER_CLIENT_SECRET;
  if (clientId && clientSecret) return { clientId, clientSecret };
  return undefined; // fall back to CLI login (~/.zapier-sdk/config.json)
}

const log = (...a: unknown[]) => console.log(...a);
const hr = (t: string) => log(`\n${"─".repeat(4)} ${t} ${"─".repeat(Math.max(0, 60 - t.length))}`);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const creds = resolveCredentials();
  const credKind = !creds
    ? "CLI login"
    : typeof creds === "string"
      ? "token (DEV_ZAPIER_OVERRIDE)"
      : "client credentials";

  const sdk = createZapierSdk(creds ? { credentials: creds } : {});

  hr("SETUP");
  log(
    `auth: ${credKind} | app: ${args.app} | mode: ${args.liveCreate ? "LIVE-CREATE" : "discovery-only"}`,
  );

  // --- Sanity: who are we? (read-only) ---
  try {
    const { data: profile } = await (sdk as any).getProfile();
    log(`profile OK: ${profile?.email ?? profile?.id ?? JSON.stringify(profile).slice(0, 80)}`);
  } catch (err) {
    log(`profile probe failed: ${(err as Error).message}`);
  }

  // --- Discovery: list triggers for the app (read-only) ---
  hr(`TRIGGERS for ${args.app}`);
  const triggers = await Array.fromAsync<ProbeTrigger>(
    (sdk as any).listTriggers({ app: args.app, maxItems: 200 }).items(),
  );
  log(`${triggers.length} triggers`);
  for (const t of triggers.slice(0, 25)) {
    log(`  ${t.key.padEnd(34)} [${t.action_type}] ${t.title}`);
  }

  // Pick a trigger: explicit --action, else prefer one mentioning "issue"/"new", else first.
  const pick =
    triggers.find((t) => t.key === args.action) ??
    triggers.find((t) => /issue/i.test(t.key) && !/legacy/i.test(t.title)) ??
    triggers.find((t) => /issue/i.test(t.key)) ??
    triggers.find((t) => /new/i.test(t.key)) ??
    triggers[0];
  if (!pick) {
    log(
      "No triggers available — cannot continue. (Is the app key right and a connection present?)",
    );
    return;
  }
  hr("SELECTED TRIGGER");
  log(`${pick.key} — ${pick.title} (${pick.action_type})`);

  // --- Input schema for the selected trigger (read-only) ---
  try {
    const { data: schema } = await (sdk as any).getTriggerInputFieldsSchema({
      app: args.app,
      action: pick.key,
    });
    log("input schema keys:", Object.keys(schema ?? {}).join(", ") || "(none)");
    if (args.json) log(JSON.stringify(schema, null, 2));
  } catch (err) {
    log(`getTriggerInputFieldsSchema failed: ${(err as Error).message}`);
  }

  // --- Existing inboxes (read-only) ---
  hr("EXISTING INBOXES");
  const inboxes = await Array.fromAsync<ProbeInbox>(
    (sdk as any).listTriggerInboxes({ maxItems: 50 }).items(),
  );
  log(`${inboxes.length} existing inbox(es)`);
  for (const i of inboxes.slice(0, 20)) {
    log(`  ${i.id}  status=${i.status}  ${i.subscription?.app_key}/${i.subscription?.action_key}`);
  }

  if (!args.liveCreate && !args.inbox) {
    hr("DONE (discovery only)");
    log("Re-run with --live-create to ensure→lease→ack/release→delete,");
    log("or --inbox=<id> --wait=120 to drain an existing inbox.");
    return;
  }

  // ===================== LIVE LIFECYCLE (creates/uses real resources) =====================
  let inboxId: string;
  if (args.inbox) {
    inboxId = args.inbox;
    hr("USING EXISTING INBOX");
    log(`inbox ${inboxId}`);
  } else {
    // Resolve a connection for the app — trigger inboxes bind to a connection,
    // and without one the inbox transitions to initialization_failure.
    hr("CONNECTION");
    let connection: string | number | undefined;
    try {
      const { data: conn } = await (sdk as any).findFirstConnection({
        app: args.app,
        expired: false,
      });
      connection = conn?.id;
      log(
        connection
          ? `using connection ${connection}`
          : "no connection found — inbox will fail to initialize",
      );
    } catch (err) {
      log(`findFirstConnection failed: ${(err as Error).message}`);
    }

    hr("ensureTriggerInbox");
    const inputHint = args.inputs
      ? `-${Object.values(args.inputs)
          .join("-")
          .replace(/[^a-z0-9]+/gi, "-")}`
      : "";
    const { data: inbox } = await (sdk as any).ensureTriggerInbox({
      key: `foreman-spike-${args.app}-${pick.key}${inputHint}`,
      app: args.app,
      action: pick.key,
      ...(connection ? { connection } : {}),
      ...(args.inputs ? { inputs: args.inputs } : {}),
    });
    inboxId = inbox.id;
    log(`inbox id=${inbox.id} status=${inbox.status} conn=${inbox.subscription?.connection_id}`);
    log(`inputs=${JSON.stringify(inbox.subscription?.inputs ?? {})}`);
  }

  // --- Poll until the inbox leaves "initializing" (up to --wait seconds) ---
  if (args.waitSeconds > 0) {
    hr(`POLL READY (≤${args.waitSeconds}s)`);
    const deadline = Date.now() + args.waitSeconds * 1000;
    let status = "initializing";
    while (Date.now() < deadline) {
      const { data: cur } = await (sdk as any).getTriggerInbox({ inbox: inboxId });
      status = cur.status;
      log(`  status=${status}`);
      if (status !== "initializing") break;
      await sleep(5000);
    }
  }

  try {
    // --- Lease, retrying until a message arrives or the --wait budget is spent ---
    hr("leaseTriggerInboxMessages");
    const deadline = Date.now() + Math.max(0, args.waitSeconds) * 1000;
    let msgs: any[] = [];
    let leaseId: string | null = null;
    let attempt = 0;
    while (true) {
      attempt++;
      const { data: leased } = await (sdk as any).leaseTriggerInboxMessages({
        inbox: inboxId,
        leaseLimit: args.leaseLimit,
        leaseSeconds: 60,
      });
      leaseId = leased.lease_id;
      msgs = leased.results ?? [];
      log(
        `  attempt ${attempt}: lease_id=${leaseId} leased=${msgs.length} inbox=${leased.inbox_attributes?.status}`,
      );
      if (msgs.length > 0 || Date.now() >= deadline) break;
      await sleep(8000);
    }

    for (const m of msgs) {
      log(
        `  msg ${m.id}  lease_count=${m.message_attributes?.lease_count}  dup=${m.message_attributes?.possible_duplicate_data}  err=${m.message_attributes?.error_message ?? "-"}`,
      );
    }

    if (leaseId && msgs.length > 0) {
      // Ack the first (simulate success), release the rest (simulate retry).
      const [first, ...rest] = msgs.map((m: any) => m.id);
      hr("ackTriggerInboxMessages (first)");
      const { data: acked } = await (sdk as any).ackTriggerInboxMessages({
        inbox: inboxId,
        lease: leaseId,
        messages: [first],
      });
      log(`acked_id=${acked.acked_id} (${acked.results?.length ?? 0} results)`);
      if (rest.length) {
        hr("releaseTriggerInboxMessages (rest → retry)");
        const { data: released } = await (sdk as any).releaseTriggerInboxMessages({
          inbox: inboxId,
          lease: leaseId,
          messages: rest,
        });
        log(`released_id=${released.released_id} (${released.results?.length ?? 0} results)`);
      }
    } else {
      log(
        "No messages leased. issue_v2 is a POLLING trigger — Zapier collects events on its own cadence (minutes). Open an issue, wait, then re-drain with --inbox=<id> --wait=120.",
      );
    }
  } finally {
    if (!args.keep) {
      hr("deleteTriggerInbox (cleanup)");
      await (sdk as any).deleteTriggerInbox({ inbox: inboxId });
      log(`deleted inbox ${inboxId}`);
    } else {
      log(`--keep set: leaving inbox ${inboxId} alive.`);
      log(`Next: open a ${args.app} event, then run: --inbox=${inboxId} --wait=180`);
    }
  }

  hr("DONE (live lifecycle)");
}

main().catch((err) => {
  console.error("\nSPIKE FAILED:", err?.message ?? err);
  if (err?.stack) console.error(err.stack.split("\n").slice(1, 4).join("\n"));
  process.exit(1);
});
