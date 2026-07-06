# Durable-Workflow Spike — Findings (foreman-8bh9)

> **⏳ Historical (2026-06-11 spike).** Superseded by SDK 0.81.0 — durable now authenticates for accounts on Zapier's **early-access allowlist** (apply for access; **not GA**). See [`zapier-sdk-capability-map.md`](zapier-sdk-capability-map.md). The "blocked on auth" status below reflects 0.69.3.

> Quick probe of `@zapier/zapier-sdk/experimental`'s durable-workflow API
> (`runDurable` / `publishWorkflowVersion`), unlocked by the 0.69.3 bump.
> Snapshot: 2026-06-11, `@zapier/zapier-sdk@0.69.3`. Status: **blocked on auth (see below).**
>
> **Update 2026-06-16 (foreman-0yra):** re-confirmed on the latest SDK `0.70.4`, and
> broadened from a single `runDurable` probe to a **full 18-endpoint sweep** of the durable/
> workflow surface (`scripts/durable-endpoints-probe.ts`). **All 18 endpoints return the
> `userJwt` 403 under BOTH client-credentials AND a real PKCE userJwt (18/18 each)** — the
> "one probe" finding below now holds across the whole surface, empirically, on the current SDK.
> The send-ready writeup for Zapier is [`zapier-durable-questions-for-engineers.md`](zapier-durable-questions-for-engineers.md).

## API shape (from 0.69.3 `.d.ts`)

- **`runDurable`** `{ source_files: Record<string,string>, input?, dependencies?, zapier_durable_version?, connections?, app_versions?, private? }` → `{ id, status: "initialized", created_at }`. You hand Zapier the workflow **code** (`source_files` = filename→content) and it executes on their durable runtime.
- **`publishWorkflowVersion`** `{ workflow, source_files, dependencies?, zapier_durable_version?, enabled?, connections?, app_versions?, trigger? }` → a versioned, hosted workflow.
- **`getDurableRun`** `{ run }`, **`cancelDurableRun`** `{ run }`, **`triggerWorkflow`** (POST to a tokenized URL), `createWorkflow` / `enable` / `disable` / `delete`.

## Blocker found (2026-06-11, one probe)

`runDurable({ source_files: {...} })` with our **client-credentials** auth →
**`"None of the security schemes (userJwt) successfully authenticated this request."`**

So the durable-run/workflow endpoints require **`userJwt`** auth — a *per-user* OAuth
token (Foreman's PKCE flow, `lib/zapier/sdk.ts`) — **not** the app-level
`ZAPIER_CLIENT_ID/SECRET` client-credentials that the trigger-inbox + discovery APIs
accept. This is the same split noted in `foreman-iyq6` (durable API is a different,
`/experimental`-only execution model).

## Two unknowns still gated (good for the Zapier-engineer conversation)

1. **Auth:** confirm durable runs require a user JWT, and the cleanest way to obtain one
   for a server context (exchange client-creds → user token? service identity?).
2. **Source-file contract:** the expected entry-point + runtime API that `source_files`
   code must conform to (`zapier_durable_version`) isn't in the SDK types — needs Zapier's
   durable-workflow programming-model docs before a real hello-world.

## The source-file contract IS documented — `@zapier/zapier-durable`

`runDurable`'s `source_files` are code written against **`@zapier/zapier-durable`**
(published npm pkg, v0.5.4 — "Durable execution for the Zapier SDK"). Authoring model:

```typescript
import { defineDurable } from "@zapier/zapier-durable";
import { z } from "zod";
const wf = defineDurable({
  name: "my-durable",
  inputSchema: z.object({ userId: z.string() }),
  run: async (ctx, input) => {
    const data = await ctx.step("fetch", async () => {/* ... */});  // memoized, runs once even on replay
    const [approval, url] = await ctx.createCallback({              // human-in-the-loop
      name: "wait-for-approval", payloadSchema: z.object({ approved: z.boolean() }),
    });
    await ctx.step("notify", async () => notify(url));
    return await approval;                                          // resumes when callback delivered
  },
});
```
Package exports: `.`, `./runner`, `./node`, `./testing`, `./cli`. Returns `{ done, result, error, executionId }`.

This is a real durable-execution engine (Temporal/Inngest-shaped): **`ctx.step` = durable
memoized steps; `ctx.createCallback` = approval callbacks.** That maps directly onto
Foreman's domain (multi-step automations with human approval).

## Auth — RESOLVED by direct test (2026-06-11): durable is walled for ALL public-SDK auth

Earlier in this spike I claimed durable was "usable in Foreman's per-user production
context (PKCE userJwt)." **That was wrong — a direct test disproved it.**

`packages/agents/scripts/durable-pkce-probe.ts` replicates Foreman's exact PKCE flow
(`connect.ts`: public client `grwWZD…`, login ports, scope request) in one standalone
script, mints a **real per-user JWT**, and calls `runDurable` with it. Result:

```
userJwt minted: len=3192, prefix="eyJhbG…", scope="external credentials offline_access"
profile OK: you@example.com
runDurable threw: None of the security schemes (userJwt) successfully authenticated this request.  (HTTP 403)
```

So a genuine, profile-validated PKCE user JWT — **the same token type Foreman mints in
production** — **still 403s on durable** with the identical error client-credentials gets.

| Auth path the public SDK can produce | runAction / discovery / trigger inboxes | Durable (`runDurable`) |
|---|---|---|
| Client-credentials (`ZAPIER_CLIENT_ID/SECRET`) | ✅ | ❌ 403 `"…(userJwt)…"` |
| Public-PKCE user JWT (Foreman's `connect.ts` flow) | ✅ | ❌ 403 `"…(userJwt)…"` (**proven**) |
| Legacy `~/.zapierrc` deployKey (32-char, not a JWT) | ❌ | ❌ |

**Root cause (the tell):** the probe *requested* `internal credentials offline_access`
but Zapier *granted* `external credentials offline_access`. Durable's `userJwt` security
scheme appears to require **`internal` scope**, which the **public** PKCE client is not
permitted to obtain. Durable isn't gated on "get a userJwt" — it's gated on a privileged
scope/audience **no publicly-available Zapier SDK client can mint.** This is a hard wall on
Zapier's side, not a Foreman integration gap.

**Sharpened question for Zapier:** durable's `userJwt` scheme rejects both client-credentials
and a public-PKCE user JWT (the latter downgraded to `external` scope). What grants a token
that satisfies it — an `internal`-scoped client, a privileged/allow-listed OAuth client, a
token exchange, or is durable simply not yet open to public SDK clients? Is the `internal`→
`external` scope downgrade the intended gate?

## Status — BLOCKED on Zapier (not a scope/effort question; literally inaccessible)

1. **Auth (hard blocker):** every token the public SDK can mint — client-creds *and*
   per-user PKCE JWT — gets 403 on durable. Not solvable from Foreman's side today.
2. **Source-file contract (also undocumented):** even with valid auth, the `source_files`
   entry-point contract is absent from the SDK types, the README (`source_files: {}`), and
   `docs.zapier.com` (zero durable refs); SDK `defineDurable` is an explicit "Phase-2 / not
   callable yet" stub. Needs Zapier's private/forthcoming docs.

## Recommendation

**Do not plan around durable for v1 — it is currently inaccessible, not merely out of scope.**
This *strengthens* `foreman-98j3`'s keep-own-engine lean: it's not a build-vs-buy trade-off
right now because the "buy" option can't be authenticated. Revisit only after Zapier answers
the scope question above (track via `foreman-8bh9` / `foreman-d8qq`). Trigger inboxes are
unaffected — they authenticate fine with client-credentials (see `trigger-inbox-spike.md`).
