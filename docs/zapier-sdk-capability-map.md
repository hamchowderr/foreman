# Zapier SDK — Capability Map (Foreman)

> **Living ledger.** Foreman is a product built on `@zapier/zapier-sdk`. This file is the authoritative map of the SDK surface, what Foreman uses, and what we've deliberately decided *not* to build. Refresh it on every SDK bump.
>
> - **Refresh the version delta:** `npm run sdk:check` (watches both `@zapier/zapier-sdk` and `@zapier/zapier-sdk-cli`; also fires a quiet notice on session start via `scripts/zapier-sdk-watch.mjs`).
> - **Snapshot date:** 2026-06-11 — verified against `@zapier/zapier-sdk@0.69.3`.
> - **Tracking:** open decisions live in beads (see [Open decisions](#open-decisions)).

## Version status (2026-06-11)

| Package | Installed | Latest | Behind |
|---|---|---|---|
| `@zapier/zapier-sdk` | **0.48.0** | 0.69.3 (2026-06-10) | 28 releases |
| `@zapier/zapier-sdk-cli` | **0.44.0** | 0.54.3 (2026-06-10) | 33 releases |

Bump is tracked in **foreman-8ujc** — *not* a blind drop-in (behavior changes below).

## Surface totals

**69 public methods** = 35 stable (`@zapier/zapier-sdk`) + 34 experimental (`@zapier/zapier-sdk/experimental`, opt-in import path only).

### Stable methods (35)

| Domain | Methods |
|---|---|
| Apps / discovery | `listApps`, `getApp`, `listActions`, `getAction` |
| Action input fields | `listActionInputFields`, `getActionInputFieldsSchema`, `listActionInputFieldChoices`, `listInputFields`*, `getInputFieldsSchema`, `listInputFieldChoices` |
| Run | `runAction` |
| Connections / auth | `listConnections`, `getConnection`, `findFirstConnection`, `findUniqueConnection`, `listAuthentications`* |
| HTTP / profile | `fetch`, `request`* (deprecated alias), `getProfile` |
| Client credentials | `listClientCredentials`, `createClientCredentials`, `deleteClientCredentials` |
| Tables | `listTables`, `getTable`, `createTable`, `deleteTable`, `listTableFields`, `createTableFields`, `deleteTableFields` |
| Records | `listTableRecords`, `getTableRecord`, `createTableRecords`, `updateTableRecords`, `deleteTableRecords` |

\* deprecated / legacy duplicate — Foreman excludes these (see usage map).

Low-level API client (under the SDK): `get/post/put/patch/delete`, `poll`, `fetch`, `fetchStream` (SSE, 0.69). Plus internal utilities: FIFO concurrency semaphore (`maxConcurrentRequests`, default 200, since 0.52), error-classification (`isPermanentHttpError`), staged polling backoff.

### Experimental methods (34) — `@zapier/zapier-sdk/experimental` only

**Trigger Inboxes (18)** — app-event subscriptions:
`listTriggers`, `listTriggerInputFields`, `getTriggerInputFieldsSchema`, `listTriggerInputFieldChoices`, `listTriggerInboxes`, `createTriggerInbox`, `getTriggerInbox`, `ensureTriggerInbox`, `updateTriggerInbox`, `deleteTriggerInbox`, `pauseTriggerInbox`, `resumeTriggerInbox`, `listTriggerInboxMessages`, `leaseTriggerInboxMessages`, `ackTriggerInboxMessages`, `releaseTriggerInboxMessages`, `drainTriggerInbox`, `watchTriggerInbox` (SSE, real-time as of 0.69).

**Durable Workflows (13)**:
`listWorkflows`, `getWorkflow`, `createWorkflow`, `updateWorkflow`, `enableWorkflow`, `disableWorkflow`, `deleteWorkflow`, `publishWorkflowVersion`, `listWorkflowVersions`, `getWorkflowVersion`, `listWorkflowRuns`, `getWorkflowRun`, `triggerWorkflow`.

**Durable Runs (5)**:
`runDurable`, `cancelDurableRun`, `listDurableRuns`, `getDurableRun`, `getTriggerRun`.

> ✅ **Access confirmed (2026-06-11):** a live probe (latest SDK `/experimental`, client-credentials auth) returned `listTriggerInboxes -> []` and `listTriggers({app:'github'}) -> 23` — i.e. this account already has working trigger-inbox access; the 0.51 "closed beta" notice does **not** block us. Remaining open question (P3): long-term stability/sunset roadmap — ask Zapier. Tracked under **foreman-iyq6**.

### Action type enum (current)

`read` · `read_bulk` · `search` · `search_and_write` · `search_or_write` · `write` · `filter` · `run`

(Unchanged from 0.48 — still no "create a Zap" type. Workflow persistence is the experimental durable API, not an action type.)

## Foreman usage map

Source of truth: `packages/agents/src/lib/zapier-sdk-tools.ts`.

- **Surfaced as agent tools (20):** 9 `APPROVAL_REQUIRED` (runAction, fetch, create/deleteTable, create/update/deleteTableRecords, create/deleteTableFields) + 11 `READ_ONLY` discovery/introspection (listApps, getApp, listActions, getAction, listConnections, find*/getConnection, getInputFieldsSchema, listInputFieldChoices, tables/records read, getProfile).
- **Explicitly excluded (8):** deprecated auth duplicates (`listAuthentications`, `find*/getAuthentication`), `request`, `listInputFields`, client-credentials management.
- **Called directly at runtime:** `runAction` (execution.ts:86), `fetch` (execution.ts:116), `findFirstConnection` (execution.ts:73), `listApps`/`listActions` (seed.ts, connect-zapier.ts), `listConnections`/`listInputFieldChoices`/schema (discovery.ts), `getRegistry` (zapier-sdk-tools.ts:190).
- **Entire experimental surface (34): unused** — a deliberate choice (experimental, Zapier-hosted, less control), now documented rather than a blind spot.

### What we built that the SDK (now) overlaps — "what not to build"

| Foreman home-grown | SDK equivalent (experimental) | Stance |
|---|---|---|
| `workflow*` tables + `engine.ts` (frozen SDK-action tuples, re-run via `runAction`) | Durable Workflows + Runs | **Keep our engine** (control, conversation-linked, templates, non-experimental); track theirs |
| stubbed `poll` trigger type | Trigger Inboxes | **Don't build the poll-driver from scratch — evaluate trigger inboxes first** |
| `cron-driver.ts` minute-tick | `watchTriggerInbox` (SSE) / `triggerWorkflow` | Possible future real-time replacement |
| manual rate-limit handling | `maxConcurrentRequests` option | Adopt on bump |

## Changelog digest 0.48 → 0.69.3 (tagged)

- **0.69.3** [BUGFIX] restore connections/app_versions/trigger fields on `publishWorkflowVersion`.
- **0.69.1** [BUGFIX] paginated results are now consume-once (don't `.items()` after iterating pages).
- **0.69.0** [NEW] `watchTriggerInbox` → SSE (real-time); add `fetchStream` + `SseMessage`.
- **0.67.0** [BEHAVIOR] extract `kitcore`; deprecate `createSdk().addPlugin()`; `normalizeError` no longer wraps Error subclasses; logs → stderr.
- **0.66.0** [NEW] `triggerWorkflow`.
- **0.65.0 / 0.64.0** [NEW] workflow runs + workflow versions (`publishWorkflowVersion`, etc.).
- **0.61.0–0.63.0** [NEW] workflow write (`create/update/enable/disable/deleteWorkflow`) + durable runs (`runDurable`, `cancelDurableRun`).
- **0.60.0 / 0.59.0** [NEW] workflow read; register durable backend paths.
- **0.57.0** [NEW] `trash` option on `listTableRecords`/`listTableFields`.
- **0.52.0** [NEW] configurable concurrency (`maxConcurrentRequests`, default 200, FIFO).
- **0.51.0** [BEHAVIOR] SDK auth defaults to client credentials; **deprecation notice for experimental Triggers (closed beta)**.
- **0.50.0** [BEHAVIOR] approval surface collapsed to `approvalMode: "disabled"|"poll"|"throw"`; removed `isInteractive`; renamed `"fail"`→`"throw"`; **no back-compat shim**.
- **0.49.0** [NEW] experimental triggers (trigger inboxes).

### Bump-verification checklist (foreman-2xdk → gates foreman-8ujc)

**Behavior verification — DONE 2026-06-11 (foreman-2xdk). All 5 PASS** (static + 0.69.3 `.d.ts` inspection + a reverted trial install).

1. **`approvalMode` (0.50) ✅** — Foreman never sets `approvalMode`/`isInteractive`/`"fail"` (0 grep hits). On a server (non-TTY) the unset default is `"throw"` ⇒ `runAction` throws `ZapierApprovalError` on approval-gated responses. That class `extends ZapierError`, so `handleSdkError`'s catch-all (`zapier-sdk-tools.ts:426`) degrades gracefully — no crash. *Follow-up (non-blocking):* the approval URL carried on the error is not surfaced to the user (only `.message`/`.code`).
2. **Client-credentials auth (0.51) ✅** — 0.69.3 `CredentialsSchema` still accepts a `string` token; PKCE schema present. Per-user path passes `credentials: accessToken` (string). Probe-confirmed (getProfile OK).
3. **`normalizeError` (0.67) ✅** — Foreman relies on `instanceof`, never calls `normalizeError`. All 11 imported `Zapier*Error` classes exist in 0.69.3 as real `Error` subclasses; "no longer wraps Error subclasses" means typed errors reach the catch unwrapped ⇒ `instanceof` still works. Handler order correct (`ZapierResourceNotFoundError` before `ZapierNotFoundError`).
4. **Pagination consume-once (0.69.1) ✅** — `listApps` response `{data, nextCursor}` unchanged 0.48→0.69.3. `seed.ts` walks cursors via `.data`/`.nextCursor`; **zero `.items()` calls** in `packages/`. Auto-paginate path uses `maxItems` (materialized). Immune to the consume-once footgun.
5. **zod single-version ✅ (with a caveat)** — SDK 0.69.3 declares `zod` as a **regular dependency pinned to `4.3.6` exact** (peerDeps empty). The root override `zod: 4.4.3` *does* collapse it to a single version — **but only on a full clean reinstall** (`rm -rf node_modules package-lock.json && npm install`). An *incremental* `npm install` after the bump leaves a stale `zod@4.3.6` nested under `packages/agents/node_modules/zod` and `check:deps` FAILS. See install-mechanics below.

### Install mechanics for the bump (foreman-8ujc) — discovered in the 2xdk trial

Bumping `@zapier/zapier-sdk` to `^0.69.3` is **not** a drop-in `npm install`. Two traps:

- **zod dup → needs a clean reinstall.** Incremental install fails `check:deps` (two zod: 4.4.3 + 4.3.6). Full `rm -rf node_modules package-lock.json && npm install` resolves to single `zod@4.4.3`.
- **A clean reinstall drifts `@mastra/*`.** Nuking the lockfile re-resolves the `^`-ranged Mastra packages: `@mastra/memory ^1.17.5→1.20.2`, `@mastra/pg ^1.10.0→1.12.1`, which then expect `@mastra/core` exports (`modelSupportsAttachments`, `FavoritesStorage`) that the pinned `@mastra/core@1.32.1` (override) lacks ⇒ **5 mocked tests fail** (`foreman.ts`, `rag/index.ts` import errors) — unrelated to Zapier. The committed lockfile pins a compatible constellation; a naive nuke loses it.

**Recommended recipe for 8ujc:** before the clean reinstall, pin `@mastra/memory`/`@mastra/pg` (and any drift-prone Mastra pkg) to the lockfile's current versions — exact pins or an `overrides` entry — so the zod-collapsing clean install doesn't drift Mastra. Then: `check:deps` + `mastra build` + `npm test` + `test:sdk` green. (Heads-up: `@zapier/zapier-sdk-cli` still transitively pulls `@zapier/zapier-sdk@0.48.x`, hoisted to root `node_modules` — harmless, tooling-only, not imported by the runtime which resolves 0.69.3 from `packages/agents`.)

## Test / Zapier-feedback candidates

- Trigger-inbox closed-beta vs go-forward status (the gating unknown).
- `watchTriggerInbox` SSE reliability + lease/ack/drain semantics.
- `publishWorkflowVersion` field-drop class of bugs (they fixed one in 0.69.3 — we're a useful signal).
- Server-shape passthrough on durable endpoints (types can drift from responses).

## Open decisions

Tracked in beads (refresh with `bd show <id>`):

- **foreman-8ujc** — execute the SDK bump (with the verification checklist above).
- **foreman-iyq6** — evaluate the experimental durable-workflow + trigger-inbox APIs vs Foreman's own engine.
- **foreman-v8k1** — workflow tools epic (mostly already built; needs reconciliation + `/workflows` UI).
- **foreman-x944** — SDK/CLI update watcher (done).

_Regenerate the version section and re-audit the experimental surface whenever `npm run sdk:check` reports a new release._
