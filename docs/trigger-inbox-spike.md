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

## Full lifecycle run (live, 2026-06-11)

`npx tsx --env-file=.env.local scripts/trigger-inbox-spike.ts --live-create --action=issue_v2`

| Step | Result |
|---|---|
| `findFirstConnection({app:'github'})` | **No GitHub connection on this account** |
| `ensureTriggerInbox` | Created: `id=019eb7b1-…`, `status=initializing`, `subscription=GitHubCLIAPI@2.4.0/issue_v2`, **`conn=null`** |
| `leaseTriggerInboxMessages` | `lease_id=null`, 0 messages, **`inbox_attributes.status=initialization_failure`** |
| `deleteTriggerInbox` | Cleaned up OK |

**Key operational learning:** `ensureTriggerInbox` is permissive — it creates the
inbox even with **no connection bound**, but the inbox then transitions to
`initialization_failure` because it can't subscribe to the app's events without a
connection. So a trigger inbox is only useful once a real app connection exists.
The full API mechanics (create → lease → delete) all returned correctly; the empty
result is a **data**/connection gap, not an API failure.

### Connected run (2026-06-11, GitHub connection added)

With a real GitHub connection bound:
- `ensureTriggerInbox` → inbox transitions **`initializing → active`** (confirmed via `getTriggerInbox` polling).
- Input scoping works: `inputs: {repo: "hamchowderr/foreman"}` is accepted and echoed in `subscription.inputs`.
- `ensureTriggerInbox` keys on **`name`** — creating a second inbox with the same name but different inputs errors (`"...already exists with different subscription data"`). The driver now suffixes the name with an input hint.

### Did messages arrive? Diagnostic (the important part)

Created GitHub issues #15 and #16 (the latter *after* the scoped inbox was active),
then leased repeatedly for ~7 min total — **0 messages**. Before concluding "latency,"
we verified it's not a config/scope problem:

| Check | Result |
|---|---|
| `getTriggerInbox` | `active`, `paused_reason: null`, subscription bound to `{repo: foreman}` + connection — **correct** |
| `listTriggerInboxMessages` (raw queue) | **0** — queue genuinely empty |
| **`runAction` `github/read/issue_v2{repo}`** (synchronous read) | **Returns #16 and #15 instantly** |

**Verdict: not missing anything.** The connection/scope/repo access are fine (a direct
read returns both issues immediately); the inbox is configured correctly. The queue is
empty solely because **Zapier's background poller for the trigger-inbox subscription
hasn't fired yet** — and the *first* poll of a fresh polling-trigger subscription is the
slowest (often many minutes).

### Architectural insight for `foreman-c63f` (real tradeoff)

- A **synchronous read** (`runAction` read — which Foreman already uses) returns data
  **instantly**, on demand.
- A **trigger inbox** hands you a managed, dedup'd, push-style queue (`lease_count` /
  `possible_duplicate_data` for free) — but with **Zapier-side poll latency** baked in,
  not under our control.

So for a *low-latency* poll trigger, a read-action-based poller (Foreman owns the cadence
+ dedup) may beat the trigger inbox; for *event-driven, dedup-sensitive* flows where some
latency is acceptable, the trigger inbox removes the idempotency burden. Decide per use
case in `foreman-c63f`. (Live `lease_count`/`possible_duplicate_data` values remain
unobserved — purely a Zapier-poll-timing artifact; the inbox is armed and will capture
issue #16 on the next poll.)

## Open questions for Zapier (to raise with their engineers)

Parked here intentionally — to discuss with Zapier rather than reverse-engineer:
1. **First-poll latency.** How long until a *fresh* polling-trigger inbox subscription
   gets its first events? Empirically >7 min for GitHub `issue_v2`. Is there a way to
   prime/force an initial poll, or an expected SLA?
2. **Instant vs polling visibility.** `listTriggers` exposes no instant/hook flag (only
   `action_type`). How do we identify which triggers are REST-hook/instant (fill the
   inbox in real-time) vs polling? Instant triggers would make `watchTriggerInbox` SSE a
   genuinely real-time path. (Candidate connected apps to test instant delivery later:
   Slack, HubSpot, Airtable, Todoist.)
3. **Back-fill semantics.** Does a new inbox capture events that already existed at
   subscription time, or only new ones after? (Behaved like only-new in this spike.)
4. **Stability / sunset** of the experimental trigger-inbox surface (also `foreman-13mw`).

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
