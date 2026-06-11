# Durable-Workflow Spike — Findings (foreman-8bh9)

> Quick probe of `@zapier/zapier-sdk/experimental`'s durable-workflow API
> (`runDurable` / `publishWorkflowVersion`), unlocked by the 0.69.3 bump.
> Snapshot: 2026-06-11, `@zapier/zapier-sdk@0.69.3`. Status: **blocked on auth (see below).**

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

## Corrected status — NOT blocked, two achievable prerequisites

1. **Auth:** `runDurable` needs a per-user `userJwt` (NOT the app client-credentials we
   tested with locally). Foreman already mints these via its PKCE OAuth flow
   (`lib/zapier/sdk.ts`). To test locally: `npx zapier-sdk login` yields a user token, then
   `createZapierSdk()` (no creds) uses it.
2. **Source files:** write a `defineDurable` workflow bundled against `@zapier/zapier-durable`.

## Recommendation

Durable execution is **usable and a strong architectural fit** — not a dead end. `foreman-8bh9`
remains correctly prioritized (post-v1) only because of scope, not feasibility. Next concrete
step: load a userJwt (`npx zapier-sdk login`), bundle a `defineDurable` hello-world, `runDurable`
+ poll `getDurableRun` to terminal. This is genuinely worth revisiting vs `foreman-98j3`'s
keep-own-engine lean — the SDK now offers hosted durable execution + callbacks we'd otherwise build.
