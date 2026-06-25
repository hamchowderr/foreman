# Zapier SDK — Capability Map (Foreman)

> **Living ledger.** Foreman is a product built on `@zapier/zapier-sdk`. This file is the authoritative map of the SDK surface, what Foreman uses, and what we've deliberately decided *not* to build. Refresh it on every SDK bump.
>
> - **Snapshot date:** 2026-06-25 — **live-introspected** against `@zapier/zapier-sdk@0.79.0` (installed; hoisted to the workspace-root `node_modules`, deduped — no longer nested under `packages/agents`).
> - **How this snapshot was produced:** `npx tsx packages/agents/scripts/sdk-surface-sweep.ts` — imports the installed package and enumerates every entrypoint, `getRegistry()` variant, instance method, and named export. This is **not** changelog-reading; it is what the code on disk actually exposes. Re-run it on every bump (it's the "prove it" tool for the Zapier community showcase).
> - **Version delta watcher:** `npm run sdk:check` (root) — watches `@zapier/zapier-sdk` + `@zapier/zapier-sdk-cli`, fires a quiet notice on session start via `scripts/zapier-sdk-watch.mjs`.
> - **Tracking:** open decisions live in beads (see [Open decisions](#open-decisions)). Sweep tracked under **foreman-xb68**; the 0.70.4 → 0.79.0 bump under **foreman-9t9g**.

## TL;DR — the whole surface in one breath

`@zapier/zapier-sdk@0.79.0` is **four things behind one package**:

1. **A typed API client** — `createZapierSdk()` → **40 stable methods** in the `mcp` cut (apps/actions discovery, `runAction`, connections — incl. the in-flow `createConnection` / `getConnectionStartUrl` / `waitForNewConnection` trio added in 0.71 —, tables/records, profile, raw `fetch`).
2. **An experimental control plane** — `@zapier/zapier-sdk/experimental` → the same 40 **+ 36 more** (trigger inboxes, durable runs, durable workflows). 18 of those (the durable/workflow write+read endpoints) are **scope-walled** for any public-SDK token (see auth model).
3. **An authoring framework** — `@zapier/zapier-sdk/define` → `defineDurable` / `defineTool` / `defineComponent` with durable `step`/`wait`/`createCallback` primitives. This is *code-mode durable workflows*: you author them locally, deploy/run via the (walled) experimental endpoints.
4. **A composable plugin runtime** — 223 named exports on the main entrypoint: every method ships as a `*Plugin`, composable via `composePlugins`/`createPluginStack`; plus a resolver layer, a Zod schema library, a telemetry/event system (now incl. the `DEPRECATION_NOTICE_EVENT` / `api:deprecation_notice` event added in 0.79), credential helpers, and a low-level HTTP client (`createZapierApi`).

The action-type enum is still **read · read_bulk · write · run · search · search_or_write · search_and_write · filter** — **there is no "create a Zap" action type**. Persisted automation is the experimental durable API, which is walled. This is why Foreman owns its own workflow engine.

## Live surface totals (2026-06-25, v0.79.0)

| Entrypoint | `createZapierSdk()` instance methods | `getRegistry({package:"mcp"})` | Named exports |
|---|---|---|---|
| `.` (main) | **42** (40 API + `getRegistry` + `addPlugin`) | **40** | **223** |
| `./experimental` | **78** (40 + 36 experimental + meta) | **74** | **223** |
| `./define` | n/a (authoring fns, not an SDK instance) | n/a | **5** |
| `./apps` | n/a (generated-types anchor) | n/a | **1** (`App`) |

**Delta from 0.70.4:** main + experimental each gained the **3 in-flow connection methods** (`createConnection`, `getConnectionStartUrl`, `waitForNewConnection`, new in 0.71) → mcp cut 37 → 40; named exports 208 → 223. **Experimental-only methods (36)** = 18 trigger-inbox + 5 durable-run + 13 durable-workflow (full list below) — unchanged.

### `getRegistry({ package })` is a curated view, not the whole SDK

The registry exists so hosts (MCP servers, CLIs, AI tool layers) can advertise a *subset* of methods. The `package` arg changes the cut — **live counts at 0.79.0**:

| `package` | main | experimental | Notes |
|---|---|---|---|
| `undefined` (default) | 42 | 78 | includes the 2 app-proxy pseudo-entries |
| `"mcp"` | **40** | 74 | **what Foreman uses** — drops the proxy entries (can't express a fluent proxy as one MCP tool) |
| `"sdk"` | 37 | 73 | |
| `"cli"` | 40 | 74 | |
| `"all"` | 34 | 68 | |
| `"ai"` | 34 | 68 | leanest curated set |

Foreman's choice of `"mcp"` on the **main** entrypoint loses nothing real vs. the default (only the 2 proxy pseudo-entries `apps.{appKey}` / `apps.{appKey}.{actionType}.{actionKey}`, which Foreman deliberately doesn't use). If we ever want a tighter agent toolset, `"ai"` is a pre-curated 34. **Foreman never imports `./experimental`, so none of the 36 experimental methods are ever generated as tools today.**

## The 40 stable methods (main `mcp` registry)

| Domain | Methods |
|---|---|
| Apps / discovery | `listApps`, `getApp`, `listActions`, `getAction` |
| Action input fields (canonical) | `listActionInputFields`, `getActionInputFieldsSchema`, `listActionInputFieldChoices` |
| Action input fields (**deprecated aliases**) | `listInputFields`→`listActionInputFields`, `getInputFieldsSchema`→`getActionInputFieldsSchema`, `listInputFieldChoices`→`listActionInputFieldChoices` |
| Run | `runAction` |
| Connections | `listConnections`, `getConnection`, `findFirstConnection`, `findUniqueConnection` |
| Connections (**deprecated aliases**) | `listAuthentications`→`listConnections`, `getAuthentication`→`getConnection`, `findFirstAuthentication`→`findFirstConnection`, `findUniqueAuthentication`→`findUniqueConnection` |
| Connections (**in-flow, new in 0.71**) | `createConnection`, `getConnectionStartUrl`, `waitForNewConnection` — ⛔ **`EXCLUDED` in Foreman** (`createConnection`/`waitForNewConnection` block up to 5 min; connection UX is owned by `connect_zapier` + `/zapier/*` OAuth route; deliberate adoption tracked in foreman-mcwn) |
| HTTP / profile | `fetch`, `request` (deprecated alias of `fetch`), `getProfile` |
| Client credentials (Connect Builder) | `listClientCredentials`, `createClientCredentials`, `deleteClientCredentials` |
| Tables | `listTables`, `getTable`, `createTable`, `deleteTable`, `listTableFields`, `createTableFields`, `deleteTableFields` |
| Records | `listTableRecords`, `getTableRecord`, `createTableRecords`, `updateTableRecords`, `deleteTableRecords` |

### Deprecated → canonical alias map (verified from `dist/plugins/deprecated/`)

The SDK ships a `deprecated/` plugin folder that aliases old names onto canonical ones. **All 7 aliases are still live at 0.70.4** but are documented as deprecated:

```
listAuthentications      -> listConnections
getAuthentication        -> getConnection
findFirstAuthentication  -> findFirstConnection
findUniqueAuthentication -> findUniqueConnection
listInputFields          -> listActionInputFields
listInputFieldChoices    -> listActionInputFieldChoices
getInputFieldsSchema     -> getActionInputFieldsSchema
```

## The 36 experimental methods (`./experimental` only)

**Trigger Inboxes (18)** — app-event subscriptions (client-creds OK):
`listTriggers`, `listTriggerInputFields`, `getTriggerInputFieldsSchema`, `listTriggerInputFieldChoices`, `listTriggerInboxes`, `createTriggerInbox`, `getTriggerInbox`, `ensureTriggerInbox`, `updateTriggerInbox`, `deleteTriggerInbox`, `pauseTriggerInbox`, `resumeTriggerInbox`, `listTriggerInboxMessages`, `leaseTriggerInboxMessages`, `ackTriggerInboxMessages`, `releaseTriggerInboxMessages`, `drainTriggerInbox`, `watchTriggerInbox` (SSE, real-time since 0.69; retries transient drain failures since 0.70.0).

**Durable Runs (5)** — ⛔ scope-walled:
`runDurable`, `cancelDurableRun`, `listDurableRuns`, `getDurableRun`, `getTriggerRun`.

**Durable Workflows (13)** — ⛔ scope-walled:
`listWorkflows`, `getWorkflow`, `createWorkflow`, `updateWorkflow`, `enableWorkflow`, `disableWorkflow`, `deleteWorkflow`, `publishWorkflowVersion`, `listWorkflowVersions`, `getWorkflowVersion`, `listWorkflowRuns`, `getWorkflowRun`, `triggerWorkflow`.

> ⛔ **The durable wall.** All 18 durable+workflow endpoints return **HTTP 403 "None of the security schemes (userJwt)…"** under **both** client-credentials **and** a real per-user PKCE JWT. 18/18 swept 2026-06-16 (`scripts/durable-endpoints-probe.ts`). Root cause: the public PKCE client is granted `external` scope but durable's `userJwt` scheme requires `internal`. This is a Zapier-side wall, not a Foreman gap. Trigger inboxes are **not** walled. Full write-up: [`zapier-auth-model.md`](zapier-auth-model.md) + [`zapier-durable-questions-for-engineers.md`](zapier-durable-questions-for-engineers.md).

## `./define` — the durable-workflow authoring DSL (previously undocumented)

`@zapier/zapier-sdk/define` exports **5 authoring functions**. This is the *code substrate* — you author durable workflows as TypeScript, which become the `source_files` that `publishWorkflowVersion` / `runDurable` deploy. The authoring side is **fully usable locally** (type-checks, no network); only the deploy/run endpoints are walled.

| Export | What it defines |
|---|---|
| `defineDurable(config)` | A durable workflow. `run(ctx, input)` gets a **`DurableContext`** with durability primitives (below). Connectionless / single-connection / multi-connection variants. |
| `defineTool(config)` | A reusable tool (`run(ctx, input)`), connection-bound or not, with `inputDependencies` (dynamic fields) + result processors (`options`/`schema`/`digest`). |
| `defineComponent(config)` | A render-style component (`render(props)`), connection-bound. |
| `optionsFrom(tool, binds?)` | Derive **dynamic dropdown options** from another tool's output (dependent fields). |
| `schemaFrom(tool, binds?)` | Derive a **dynamic Zod schema** from another tool's output. |

**`DurableContext` primitives** (this is the Temporal/Inngest/Restate-class part):

```ts
ctx.step(name, fn)            // durable, retryable step (maxAttempts, retryDelaySeconds, outputSchema)
ctx.wait(name, seconds)      // durable sleep — survives restarts
ctx.createCallback(name)     // human-in-the-loop: returns [Promise<payload>, callbackUrl] (timeoutSeconds, payloadSchema)
ctx.zapier.fetch(url, opts)  // call connected apps from inside the workflow
```

So Zapier's durable platform = **author with `/define`** → **deploy/execute with the experimental durable endpoints**. Foreman can author and type-check durable code today; it cannot deploy it via a public-SDK token until Zapier opens the `internal` scope.

## The 208-export surface (main entrypoint) — taxonomy

Beyond the 37 methods, `import * as zapier from "@zapier/zapier-sdk"` exposes a full runtime. Grouped:

- **Factory + plugin runtime (~40):** `createZapierSdk`, `createSdk`, `createZapierApi`, `createZapierSdkWithoutRegistry`, `addPlugin`, `definePlugin`, `composePlugins`, `createPluginStack`, `createCorePlugin`, `createOptionsPlugin`, and one `*Plugin` per method (`runActionPlugin`, `listAppsPlugin`, `apiPlugin`, `registryPlugin`, `manifestPlugin`, …). → **The SDK is composable/tree-shakeable**: build a minimal client with only the plugins you need.
- **19 error/signal classes:** `ZapierError` + 15 typed subclasses (`ZapierActionError`, `ZapierApiError`, `ZapierAppNotFoundError`, `ZapierApprovalError`, `ZapierAuthenticationError`, `ZapierBundleError`, `ZapierConfigurationError`, `ZapierConflictError`, `ZapierNotFoundError`, `ZapierRateLimitError`, `ZapierRelayError`, `ZapierResourceNotFoundError`, `ZapierTimeoutError`, `ZapierUnknownError`, `ZapierValidationError`) + **3 control-flow signals** (`ZapierSignal`, `ZapierAbortDrainSignal`, `ZapierReleaseTriggerMessageSignal` — used by the trigger-inbox drain loop, *not* errors to surface).
- **Resolver layer (~25 `*Resolver` objects):** `appKeyResolver`, `actionKeyResolver`, `connectionIdResolver`, `tableIdResolver`, `workflowIdResolver`, … — the alias/identifier resolution used by methods and the proxy.
- **Zod schema library (~40 `*Schema` / `*PropertySchema`):** `CredentialsSchema`, `ConnectionsMapSchema`, `AppPropertySchema`, `RelayFetchSchema`, … — reusable for input validation.
- **Credential helpers:** `resolveCredentials`, `resolveCredentialsFromEnv`, `resolveAuthToken`, `getTokenFromCliLogin`, `isCliLoginAvailable`, `injectCliLogin`, `isClientCredentials`, `isPkceCredentials`, `isCredentialsFunction`, `getBaseUrlFromCredentials`, `clearTokenCache`, `invalidateCachedToken`.
- **Telemetry / event system:** `buildApplicationLifecycleEvent`, `buildErrorEvent`, `buildMethodCalledEvent`, `buildCapabilityMessage`, `createBaseEvent`, `generateEventId`, `eventEmissionPlugin`, `runWithTelemetryContext`, `cleanupEventListeners`. → the SDK emits structured telemetry you can hook.
- **Platform / CI / runtime introspection:** `getCiPlatform`, `isCi`, `getOsInfo`, `getPlatformVersions`, `getCpuTime`, `getMemoryUsage`, `getTtyContext`, `getReleaseId`, `getCurrentTimestamp`.
- **Approval-mode helpers:** `getZapierApprovalMode`, `getZapierDefaultApprovalMode`.
- **Constants (~17):** `ZAPIER_BASE_URL`, `ZAPIER_MAX_CONCURRENT_REQUESTS`, `ZAPIER_MAX_NETWORK_RETRIES`, `ZAPIER_MAX_NETWORK_RETRY_DELAY_MS`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_LIMIT`, `MAX_CONCURRENCY_LIMIT`, `DEFAULT_ACTION_TIMEOUT_MS`, `DEFAULT_APPROVAL_TIMEOUT_MS`, `DEFAULT_MAX_APPROVAL_RETRIES`, `DEFAULT_CONFIG_PATH`, `CONTEXT_CACHE_TTL_MS`, `CONTEXT_CACHE_MAX_SIZE`.
- **String/format utils:** `toSnakeCase`, `toTitleCase`, `formatErrorMessage`, `zapierAdaptError`, `isPermanentHttpError`, `logDeprecation`.

**Low-level HTTP client** (`dist/api/`, under every method): `createZapierApi` → `get/post/put/patch/delete`, `poll` (staged backoff), `fetch`, `fetchStream` (SSE), `fetchJsonStream` (JSON-per-frame SSE, new in 0.70.0). FIFO concurrency semaphore (`maxConcurrentRequests`, default 200, since 0.52). Error classification via `isPermanentHttpError`.

## Foreman usage map & categorization audit

Source of truth: `packages/agents/src/lib/zapier-sdk-tools.ts`. Foreman imports the **main** entrypoint, reads `getRegistry({package:"mcp"})` (40 fns at 0.79.0), drops `EXCLUDED_METHODS`, and generates a Mastra tool per remaining method.

**Live tool count: Foreman generates 26 tools** (40 mcp methods − 14 excluded), with **0 uncategorized**:

| Bucket | Count | Methods |
|---|---|---|
| `APPROVAL_REQUIRED` (`requireApproval:true`, `destructiveHint:true`) | 9 | `runAction`, `fetch`, `createTable`, `deleteTable`, `createTableRecords`, `updateTableRecords`, `deleteTableRecords`, `createTableFields`, `deleteTableFields` |
| `READ_ONLY` (`readOnlyHint:true`) | 17 | `listApps`, `getApp`, `listActions`, `getAction`, `listConnections`, `findFirstConnection`, `findUniqueConnection`, `getConnection`, `getActionInputFieldsSchema`, `listActionInputFields`, `listActionInputFieldChoices`, `listTables`, `getTable`, `listTableFields`, `listTableRecords`, `getTableRecord`, `getProfile` |
| `EXCLUDED_METHODS` (no tool) | 14 | `listAuthentications`, `findFirstAuthentication`, `findUniqueAuthentication`, `getAuthentication`, `request`, `listInputFields`, `getInputFieldsSchema`, `listInputFieldChoices`, `createClientCredentials`, `deleteClientCredentials`, `listClientCredentials`, `createConnection`, `getConnectionStartUrl`, `waitForNewConnection` |

> 📌 **History:** the 0.70.4 (pre-F1) snapshot showed **28 tools** (9 approval + 16 read-only + 3 uncategorized) with 9 excluded. Two changes since: **F1** (foreman-f1ef) moved the canonical input-field trio into `READ_ONLY` and the 3 deprecated aliases into `EXCLUDED` (→ 26 tools, 0 uncategorized); the **0.79.0 bump** (foreman-9t9g) added the 3 in-flow connection methods to the mcp registry and Foreman `EXCLUDED` all three (tool count stays **26**, excluded 11 → 14).

### ✅ Finding F1 — input-field categorization inverted — RESOLVED 2026-06-22 (foreman-f1ef)

> **Resolved 2026-06-22 (foreman-f1ef, branch `fix/zapier-deprecated-aliases`):** canonical trio → `READ_ONLY`; all 3 deprecated input-field aliases → `EXCLUDED`; `discovery.ts` production calls migrated to canonical SDK methods. The lockstep was **wider than first scoped** — landed across 16 files including `prompt-template.ts`, both agent instruction files, `tool-catalog.ts`, `tool-schema-sanitizer.ts`, 2 more unit tests, and 2 web landing demos. 323 unit tests pass, biome clean. (Live SDK tier updated but not executed — needs creds.) Original analysis preserved below.

The SDK's **canonical** input-field methods are `getActionInputFieldsSchema` / `listActionInputFields` / `listActionInputFieldChoices`; the `*InputField*` names are **deprecated aliases**. Foreman has it backwards:

- It marks the **deprecated** `getInputFieldsSchema` + `listInputFieldChoices` as read-only tools.
- It excludes only **1** of the 3 deprecated input-field aliases (`listInputFields`), keeping the other two.
- It leaves the **3 canonical** methods uncategorized → they're auto-generated as tools but with `readOnlyHint:false` (wrong — they're reads) and as **duplicates** of the deprecated ones.

Net: the agent sees **5 tools for 3 operations**, with the canonical ones mis-annotated. Correct end-state: canonical trio in `READ_ONLY`; all 7 deprecated aliases (4 auth + 3 input-field) in `EXCLUDED`.

**Blast radius (why this is a tracked decision, not a drive-by edit):** the deprecated kebab names `get-input-fields-schema` / `list-input-field-choices` are pinned in the **eval dataset trajectories** (`scripts/datasets-label.ts`, `scripts/datasets-mini-experiment.ts`), the **live SDK test** (`tests/sdk/zapier-sdk.test.ts` execs them by name), and **web docs** (`packages/web/content/docs/core-concepts/tool-discovery.mdx`). Fixing the categorization requires re-labeling those in lockstep, or the live test + trajectory scorer break. Also a forward risk: if Zapier ever removes the deprecated aliases, those tests/labels break regardless.

### Finding F2 — error-class coverage (12/19)

`handleSdkError` (`zapier-sdk-tools.ts`) does `instanceof` against **12** classes. The other 7 exported classes: 4 real errors (`ZapierApiError`, `ZapierBundleError`, `ZapierConflictError`, `ZapierUnknownError`) fall through to the `instanceof ZapierError` catch-all (degrades fine, no crash); 3 are control-flow **signals**, not errors. Low priority; `ZapierConflictError` (409) is the only one that might warrant a specific message.

### What we built that the SDK overlaps — "what not to build"

| Foreman home-grown | SDK equivalent | Stance |
|---|---|---|
| `workflow*` tables + `engine.ts` (frozen action tuples, re-run via `runAction`) | Durable Workflows + Runs (`/experimental`) + `/define` authoring | **Keep our engine** — durable is scope-walled, experimental, Zapier-hosted; ours is conversation-linked + non-experimental. Track theirs. |
| stubbed `poll` trigger type | Trigger Inboxes (`/experimental`, not walled) | **Evaluate trigger inboxes before building a poll-driver from scratch** (foreman-bdjp / foreman-ueep) |
| `cron-driver.ts` minute-tick | `watchTriggerInbox` (SSE) / `triggerWorkflow` | Possible future real-time replacement |
| manual rate-limit handling | `maxConcurrentRequests` option (default 200) | Adopt — set on `createZapierSdk` |
| (none) | `/define` durable DSL (`step`/`wait`/`createCallback`) | Not buildable for us until the durable scope opens; document as the target shape |

## Action-type enum (verified from `dist/types/properties.js`)

`read` · `read_bulk` · `write` · `run` · `search` · `search_or_write` · `search_and_write` · `filter`

Unchanged. **No "create a Zap" type** — automation persistence is the (walled) durable API, not an action type. This is the structural reason Foreman owns workflow persistence.

## Changelog digest 0.70.4 → 0.79.0

**Main-surface (affects Foreman directly):**
- **0.79.0** trusted-deprecation machinery: SDK sniffs `zapier-sdk-deprecation-*` response headers (never on relay), warns once per notice id per process (no opt-out), and emits an `api:deprecation_notice` event (`DEPRECATION_NOTICE_EVENT` export). CLI renders a boxed stderr warning; the MCP server attaches notices to every tool result so agents relay them. **Candidate: subscribe in Foreman and surface to users.**
- **0.78.0** kitcore plugin-model refactor (compat-bridged, behavior unchanged). Removed the deprecated `sdk.addPlugin(...)` **chain** method + no-arg `createSdk()` doorway; main now re-exports the plugin-authoring helpers (`createSdk`, `defineMethod`/`definePlugin`/`declareMethod`, `selectExports`, `addPlugin`). Foreman uses none of the removed APIs.
- **0.77.2 / 0.77.1** published-type-declaration packaging fix (stray `import("kitcore")` leak); `@zapier/policy-context` dep slimmed.
- **0.71.0** **`createConnection` / `getConnectionStartUrl` / `waitForNewConnection`** — connect an app from code end-to-end (mint URL → open/print → poll for the new connection). Now in the main mcp registry → auto-surfaced unless excluded (Foreman `EXCLUDED` all 3; see usage map + foreman-mcwn). Also: private-beta streaming auto-mode approval review.

**Experimental/durable surface (scope-walled for Foreman — tracked, not used):**
- **0.77.0** `triggerWorkflow` now authenticates as the account; **return shape changed** to `{ id, workflow_id, created_at }` (was `{ workflow, status, body }`).
- **0.75.0** `listWorkflowRuns` no longer returns `output` on list items — fetch via `getWorkflowRun`.
- **0.74.1** trigger claim-failure reason + workflow `disabled_reason` on experimental `get`/`listWorkflows`.
- **0.73.1** camelCased input params on `runDurable`/`publishWorkflowVersion` (`sourceFiles`, `zapierDurableVersion`, `appVersions`, nested fields); snake_case kept as **deprecated aliases**.
- **0.72.0** `listWorkflows` now paginates (`pageSize`/`cursor`; >100 rejected).
- **0.71.1** `createWorkflow`'s `is_private` input renamed to `private` (`is_private` kept as deprecated alias; wire field unchanged).
- **0.76.0** `./define` durable `CallbackResult<T>` typing — awaiting a `timeoutSeconds` callback resolves `{ status: "delivered"|"expired", … }`; `CallbackOptionsWithTimeout` exported.

**Telemetry headers:** **0.76.2** `zapier-sdk-agent`, **0.74.0** `zapier-sdk-package-operation`, **0.73.0** standard `zapier-sdk-version`/`zapier-service`/etc. headers (legacy `x-zapier-*` still sent).

(0.70.4 → 0.70.0 and 0.48 → 0.69.3 digests preserved in git history of this file; auth/behavior notes that still matter are folded into the auth model + sections above.)

## Reproduce / verify

```bash
# Full live surface dump (no creds, no network — pure introspection):
cd packages/agents && npx tsx scripts/sdk-surface-sweep.ts

# Durable wall re-confirm (needs ZAPIER_CLIENT_ID/SECRET; add --pkce for a user JWT):
cd packages/agents && npx tsx scripts/durable-endpoints-probe.ts

# Version delta watcher (root):
npm run sdk:check
```

## Test / Zapier-feedback candidates

- Trigger-inbox closed-beta vs go-forward status (the gating unknown — foreman-13mw).
- `watchTriggerInbox` SSE reliability + lease/ack/drain semantics.
- `publishWorkflowVersion` field-drop class of bugs (they fixed two: 0.69.3, 0.70.4 — we're a useful signal).
- When does the `internal` durable scope open to public SDK clients? (foreman-8bh9 / foreman-13mw).
- `/define` DSL stability + whether `runDurable` will ever accept an `external`-scope token.

## Open decisions

Tracked in beads (refresh with `bd show <id>`):

- **foreman-xb68** — this live-introspection sweep; spawned F1 (input-field categorization) + F2 (error coverage) follow-ups.
- **foreman-iyq6 / foreman-98j3** — keep home-grown workflow engine for v1; durable API is post-v1.
- **foreman-v8k1** — workflow tools epic (built; needs `/workflows` UI — foreman-ezsm).
- **foreman-bdjp / foreman-ueep** — trigger-inbox poll-driver spike + live-verify.
- **foreman-13mw** — confirm long-term stability/sunset of experimental Triggers with Zapier.

_Regenerate this file from `sdk-surface-sweep.ts` whenever `npm run sdk:check` reports a new release._
