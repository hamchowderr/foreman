import type { ExperimentalZapierSdk } from "../zapier/sdk";

/**
 * Trigger-inbox layer (foreman-l7xq) — the chosen trigger substrate. A trigger
 * inbox is a server-side durable queue Zapier maintains for an app+action+
 * connection: `ensureInbox` once, then `lease` a batch, process, and `ack`
 * (done) / `release` (retry). At-least-once delivery, so the queue can redeliver;
 * `dispatchLeased` dedups on the message id.
 *
 * Every function takes the SDK client as a parameter so the layer is testable
 * with a fake; production passes `getExperimentalSdkForUser(userId)`. The lease
 * loop that drives this (worker, run dispatch, idempotency store) is M3.
 */

type Sdk = ExperimentalZapierSdk;

export interface InboxMessageAttributes {
  /** Times this message has been leased; >1 ⇒ a prior lease expired/released ⇒ a redelivery. */
  lease_count: number;
  error_message: string | null;
  /** Zapier's own flag that the underlying event may be a duplicate. */
  possible_duplicate_data: boolean;
}

export interface LeasedMessage {
  id: string;
  created_at: string;
  status: string;
  message_attributes: InboxMessageAttributes;
  payload: Record<string, unknown>;
}

export interface Lease {
  lease_id: string | null;
  leased_until: string | null;
  results: LeasedMessage[];
  inbox_attributes: { status: string; paused_reason: string | null };
}

export async function ensureInbox(opts: {
  sdk: Sdk;
  /** Idempotency key — `ensureTriggerInbox` is keyed on `key`; same key + different inputs errors. */
  key: string;
  app: string;
  action: string;
  connection?: string | number | null;
  inputs?: Record<string, unknown>;
  notificationUrl?: string;
}) {
  const r = await opts.sdk.ensureTriggerInbox({
    key: opts.key,
    app: opts.app,
    action: opts.action,
    connection: opts.connection ?? null,
    inputs: opts.inputs,
    notificationUrl: opts.notificationUrl,
  });
  return r.data;
}

export async function getInbox(sdk: Sdk, inbox: string) {
  return (await sdk.getTriggerInbox({ inbox })).data;
}

/** Recent messages in an inbox (metadata + attributes, no payloads) — for the inbox view. */
export async function listInboxMessages(sdk: Sdk, inbox: string, maxItems = 20) {
  const res = await sdk.listTriggerInboxMessages({ inbox, maxItems });
  return res.data;
}

export async function leaseMessages(opts: {
  sdk: Sdk;
  inbox: string;
  leaseLimit?: number;
  leaseSeconds?: number;
  signal?: AbortSignal;
}): Promise<Lease> {
  const r = await opts.sdk.leaseTriggerInboxMessages({
    inbox: opts.inbox,
    leaseLimit: opts.leaseLimit,
    leaseSeconds: opts.leaseSeconds,
    signal: opts.signal,
  });
  return r.data as Lease;
}

export async function ackMessages(opts: {
  sdk: Sdk;
  inbox: string;
  lease: string;
  messages?: string[];
}) {
  return (
    await opts.sdk.ackTriggerInboxMessages({
      inbox: opts.inbox,
      lease: opts.lease,
      messages: opts.messages,
    })
  ).data;
}

export async function releaseMessages(opts: {
  sdk: Sdk;
  inbox: string;
  lease: string;
  messages?: string[];
}) {
  return (
    await opts.sdk.releaseTriggerInboxMessages({
      inbox: opts.inbox,
      lease: opts.lease,
      messages: opts.messages,
    })
  ).data;
}

export interface DispatchResult {
  /** Handled successfully this round — ack these. */
  processed: string[];
  /** Already handled before (redelivery / duplicate) — ack these too, but don't re-run. */
  skipped: string[];
  /** Handler threw — release these for retry. */
  failed: string[];
}

/**
 * Run a handler over a leased batch with dedup. Because delivery is at-least-once,
 * a message can reappear (`lease_count > 1`, or `possible_duplicate_data`); the
 * caller supplies `isAlreadyProcessed` (its idempotency store — the automation_run
 * table in M3) and anything already seen is skipped, not re-run. The message id is
 * the dedup key. This does NOT ack/release — it classifies so the caller acks
 * `processed`+`skipped` and releases `failed`.
 */
export async function dispatchLeased(opts: {
  lease: Lease;
  handle: (message: LeasedMessage) => Promise<void> | void;
  isAlreadyProcessed?: (message: LeasedMessage) => Promise<boolean> | boolean;
}): Promise<DispatchResult> {
  const { lease, handle, isAlreadyProcessed } = opts;
  const result: DispatchResult = { processed: [], skipped: [], failed: [] };

  for (const message of lease.results) {
    const seen = isAlreadyProcessed ? await isAlreadyProcessed(message) : false;
    if (seen) {
      result.skipped.push(message.id);
      continue;
    }
    try {
      await handle(message);
      result.processed.push(message.id);
    } catch {
      result.failed.push(message.id);
    }
  }

  return result;
}
