import type { ExperimentalZapierSdk } from "../zapier/sdk";

/**
 * Trigger-inbox layer (foreman-l7xq) — the chosen trigger substrate. A trigger
 * inbox is a server-side durable queue Zapier maintains for an app+action+
 * connection: `ensureInbox` once, then subscribe with `watchInbox` and handle
 * each message. Delivery is at-least-once, so the queue can redeliver; the
 * caller dedups on the message id.
 *
 * The lease/ack/release loop is NOT ours (foreman-em74). `watchTriggerInbox` is
 * the SDK's own consumer: an SSE subscription that leases, dispatches to
 * `onMessage`, acks on resolve and releases on reject, with a periodic safety
 * drain in case a notification is missed. Foreman previously hand-rolled that
 * loop on a 60s poll and inherited none of its improvements — SSE landed in SDK
 * 0.69.0 and transient 5xx/429 retries in 0.70.0 while we kept polling.
 *
 * Every function takes the SDK client as a parameter so the layer is testable
 * with a fake; production passes `getExperimentalSdkForUser(userId)`.
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

/**
 * Subscribe to an inbox and handle every message as it arrives. Resolves only
 * when `signal` aborts (aborting cancels in-flight HTTP, releases unprocessed
 * messages, and resolves cleanly) or a non-recoverable SDK error rejects.
 *
 * The ack/release contract is the SDK's, and we lean on it deliberately:
 *   - `onMessage` RESOLVES  → the message is acked (handled, or a duplicate we
 *     intentionally skipped — both mean "don't send it again").
 *   - `onMessage` REJECTS   → released for redelivery, because `releaseOnError`
 *     is on. Without it a failure would sit leased until the lease expired.
 *   - `continueOnError` keeps one poisoned message from tearing down the whole
 *     subscription; the failure surfaces through `onError` instead.
 *
 * `leaseLimit` also sets `concurrency` by default, so it caps how many messages
 * are in flight at once, not just the HTTP batch size.
 */
export function watchInbox(opts: {
  sdk: Sdk;
  inbox: string;
  onMessage: (message: LeasedMessage) => Promise<void> | void;
  onError?: (error: unknown, message: LeasedMessage) => void;
  leaseLimit?: number;
  leaseSeconds?: number;
  /** Seconds between safety drains when no SSE notification arrives (SDK default 300). */
  maxDrainIntervalSeconds?: number;
  signal?: AbortSignal;
}): Promise<void> {
  return opts.sdk.watchTriggerInbox({
    inbox: opts.inbox,
    onMessage: opts.onMessage as (message: unknown) => Promise<void> | void,
    onError: opts.onError as ((error: unknown, message: unknown) => void) | undefined,
    leaseLimit: opts.leaseLimit,
    leaseSeconds: opts.leaseSeconds,
    maxDrainIntervalSeconds: opts.maxDrainIntervalSeconds,
    releaseOnError: true,
    continueOnError: true,
    signal: opts.signal,
  } as Parameters<Sdk["watchTriggerInbox"]>[0]);
}
