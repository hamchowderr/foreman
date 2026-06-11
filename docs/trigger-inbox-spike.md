# Trigger-Inbox Spike — Findings (foreman-bdjp)

> Hands-on exploration of `@zapier/zapier-sdk/experimental`'s trigger-inbox API,
> unlocked by the SDK 0.48.0 → 0.69.3 bump. Driver: `packages/agents/scripts/trigger-inbox-spike.ts`.
> Snapshot: 2026-06-11, verified against `@zapier/zapier-sdk@0.69.3`.

## What a trigger inbox is

A **server-side, durable queue of trigger events** that Zapier maintains for an
app+action+connection. Instead of Foreman polling an app on a minute-tick (our
current `cron-driver`), you create an *inbox* once; Zapier accumulates matching
events into it; your code **leases** a batch, processes it, then **acks** (done)
or **releases** (retry). This is a competing-consumer queue with at-least-once
delivery and explicit lease/ack semantics — much closer to SQS than to polling.

Import path is opt-in: `import { createZapierSdk } from "@zapier/zapier-sdk/experimental"`.
The stable subpath does **not** surface these methods.

## API lifecycle (exact signatures, from the 0.69.3 `.d.ts`)

All methods return `{ data }` wrappers; all take a single options object.

| Method | Params | Returns (`data`) |
|---|---|---|
| `listTriggers` | `{ app, maxItems?, cursor? }` | `[{ key, app_key, action_type, title, type }]` (paginated) |
| `getTriggerInputFieldsSchema` | `{ app, action, connection?, inputs? }` | JSON Schema object |
| `ensureTriggerInbox` | `{ name, app, action, connection?, inputs?, notificationUrl? }` | `{ id, status, subscription:{ connection_id, app_key, action_key, inputs } }` |
| `listTriggerInboxes` | `{ maxItems?, cursor? }` | `[{ id, status, subscription }]` (paginated) |
| `getTriggerInbox` / `pause` / `resume` / `deleteTriggerInbox` | `{ inbox }` | the inbox record |
| `leaseTriggerInboxMessages` | `{ inbox, leaseLimit?, leaseSeconds?, signal? }` | `{ lease_id, leased_until, results:[{ id, status, message_attributes, payload }], inbox_attributes }` |
| `ackTriggerInboxMessages` | `{ inbox, lease, messages? }` | `{ acked_id, results }` |
| `releaseTriggerInboxMessages` | `{ inbox, lease, messages? }` | `{ released_id, results }` |
| `drainTriggerInbox` | `DrainTriggerInboxOptions` (callback per message) | `void` |
| `watchTriggerInbox` | `WatchTriggerInboxOptions` (SSE, near-real-time) | `void` |

`ensureTriggerInbox` is idempotent on (app, action, connection, inputs) — safe to
call on every boot. `lease` returns a `lease_id` that scopes the subsequent
ack/release; messages not acked before `leased_until` become re-leasable.

### Dedup / idempotency signals (directly relevant to foreman-tv5p)

Every leased message carries `message_attributes`:
- **`lease_count`** — how many times this message has been leased (>1 ⇒ a prior
  lease expired or released without ack → a redelivery).
- **`possible_duplicate_data`** — Zapier's own flag that the underlying event may
  be a duplicate.
- `error_message` — last processing error, if any.

This means the queue gives us **redelivery visibility for free**, which is exactly
the gap `foreman-tv5p` flags in our channel-trigger/cron path (no dedup; cron can
double-fire on a same-minute restart). A trigger-inbox-backed driver would dedup
on `(message.id)` + honor `lease_count`/`possible_duplicate_data` rather than us
hand-rolling idempotency keys.

## Live discovery run (read-only, 2026-06-11)

`npx tsx --env-file=.env.local scripts/trigger-inbox-spike.ts`

- **Auth:** client credentials (`ZAPIER_CLIENT_ID`/`SECRET`) → `getProfile` OK (`admin@otakusolutions.io`).
- **`listTriggers({app:'github'})` → 23 triggers**, incl. `issue_v2` (New Issue), `pull` (New Pull Request), `comment`, `release`, etc. (`issue` is the Legacy variant.)
- **`getTriggerInputFieldsSchema`** for `issue_v2` → a JSON Schema (`$schema`, `type`, `properties`, `required`).
- **`listTriggerInboxes` → 0** existing inboxes (clean slate).

✅ The experimental trigger-inbox surface is **real, reachable, and authenticated**
on this account with no extra setup beyond the bump.

## Full lifecycle run — PENDING (gated)

The `--live-create` path (ensure → lease → ack/release → delete) **creates a real
inbox on Zapier and leases real events**, so it's gated behind an explicit flag and
awaiting a go-ahead. Once run, this section will record: ensure latency, whether a
brand-new inbox back-fills recent events or only accrues new ones, real
`lease_count`/`possible_duplicate_data` values, and ack vs release behavior.

## Preliminary go/no-go

**Lean: GO for evaluating it as the substrate for Foreman's stubbed `poll` trigger
type** (the open `foreman-c63f` decision), and as a **real-time replacement for the
cron-driver** via `watchTriggerInbox` SSE (`foreman-iyq6`). Rationale:
- It directly solves the dedup/idempotency gap (`foreman-tv5p`) with server-side
  lease semantics + duplicate flags, instead of us maintaining that ourselves.
- Access is confirmed; the API shape is clean and matches a competing-consumer model.

**Caveats to settle before wiring in (tracked in `foreman-13mw`):**
- It's `/experimental` and server-shape-authoritative (types can drift from
  responses; 0.69.3 already shipped a field-drop bugfix elsewhere).
- Long-term stability / closed-beta sunset is unconfirmed with Zapier.
- Connection binding + per-event → per-workflow-run mapping needs design
  (how a leased message resolves to a Foreman workflow + conversation context).

**Next:** run `--live-create` to fill in the lifecycle section, then take
`foreman-c63f` (poll-trigger: trigger-inbox vs build-own) with real data.
