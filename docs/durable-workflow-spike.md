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

## Recommendation

`foreman-8bh9` stays **post-v1 / deferred** (matches its existing priority). To unblock:
(a) get a user JWT path, (b) get the durable source-file contract from Zapier. Until then,
the home-grown engine remains the v1 substrate (`foreman-98j3` keep-own-engine), with the
durable API tracked as a future hosted-execution option.
