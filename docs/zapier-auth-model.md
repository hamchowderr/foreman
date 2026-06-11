# Zapier SDK Auth Model (foreman-l8ev)

> How Foreman authenticates to `@zapier/zapier-sdk`, and — critically — **which
> auth works on which SDK surface.** Some experimental surfaces require a scope no
> public SDK client can obtain. Snapshot: 2026-06-11, `@zapier/zapier-sdk@0.69.3`.

## The three credential types the SDK accepts

From the SDK's own `AGENTS.md` (`createZapierSdk({ credentials })`):

| Type | Shape | How Foreman uses it |
|---|---|---|
| **Token string** | `credentials: "<jwt>"` | `DEV_ZAPIER_OVERRIDE` (a pre-obtained token) for local dev |
| **Client credentials** | `credentials: { clientId, clientSecret }` | App-level server-to-server — `ZAPIER_CLIENT_ID` / `ZAPIER_CLIENT_SECRET` |
| **PKCE (user JWT)** | per-user OAuth token string | Each user's `connect.ts` PKCE flow → token stored in `zapier_identity` |
| **CLI login** | `~/.zapier-sdk/config.json` | `createZapierSdk()` with no creds — dev fallback only |

How Foreman resolves them (`src/lib/zapier/sdk.ts` → `getSdkForUser`):

1. `DEV_ZAPIER_OVERRIDE` set → use that token (dev shortcut).
2. Else load the user's `zapier_identity` access token (a **PKCE user JWT** minted by
   `connect.ts`), refreshing via the refresh token when expired.
3. Else, in `FOREMAN_MODE=dev` only, fall back to CLI login (`createZapierSdk()`).
   `self_hosted` requires a real per-user OAuth connection or throws `ZapierNotConnected`.

The PKCE flow (`src/lib/zapier/connect.ts`) uses the SDK's **public** PKCE client
`grwWZD5hUWGvb4V8ODBuOtXer3h0DBEZ2HR8aay6` (the same one `zapier-sdk login` uses),
redirecting to one of a fixed set of localhost ports Zapier allow-lists for it.

## Which auth works on which surface (verified empirically)

| SDK surface | Client credentials | PKCE user JWT | Notes |
|---|---|---|---|
| `runAction`, discovery, `apps.*`, tables | ✅ | ✅ | The everyday action layer — any user auth works |
| Trigger inboxes (`/experimental`) | ✅ | ✅ | `ensureTriggerInbox` / `lease` / `ack` all accept client-creds |
| **Durable** (`runDurable`, `publishWorkflowVersion`, … `/experimental`) | ❌ **403** | ❌ **403** | `"None of the security schemes (userJwt)…"` — see below |

**Durable is walled for every token a public SDK client can produce.** Proven
2026-06-11 by `packages/agents/scripts/durable-pkce-probe.ts`: it mints a *real*
per-user PKCE JWT (Foreman's exact `connect.ts` flow, validated against `getProfile`
as `admin@otakusolutions.io`) and `runDurable` still returns **HTTP 403 "None of the
security schemes (userJwt) successfully authenticated this request."** — identical to
client-credentials.

**The tell:** the PKCE flow *requests* scope `internal credentials offline_access` but
Zapier *grants* `external credentials offline_access`. Durable's `userJwt` scheme
requires **`internal`** scope, which the public PKCE client is not permitted to obtain.
So durable isn't gated on "get a user JWT" — it's gated on a privileged scope/audience
no publicly-available Zapier SDK client can mint. This is a Zapier-side wall, not a
Foreman integration gap. (See [`durable-workflow-spike.md`](durable-workflow-spike.md).)

### Red herrings (don't waste time on these)

- **`~/.zapierrc` `deployKey`** — a 32-char legacy *platform-CLI* key, **not a JWT**.
  Passed as SDK credentials it fails with `"Failed to authenticate Bearer token"`.
- **`npx zapier-sdk login` (the SDK CLI, 0.54)** — produces **client-credentials**, not
  a user JWT, so it does **not** unlock durable either.

## Practical guidance for Foreman

- **Dev:** set `DEV_ZAPIER_OVERRIDE` to a token, or rely on CLI login (`FOREMAN_MODE=dev`).
- **Self-hosted (`FOREMAN_MODE=self_hosted`):** each user OAuths their own Zapier account
  via the PKCE `connect` flow; the resulting per-user JWT drives `runAction` + discovery
  + trigger inboxes. Requires `ZAPIER_CLIENT_ID` / `ZAPIER_CLIENT_SECRET` for the
  app-level client-credentials path where used.
- **Durable execution is currently unavailable** to Foreman via any public-SDK auth.
  Do not architect around it for v1 (reinforces `foreman-98j3`: keep the home-grown
  workflow engine). Revisit only after Zapier opens the scope — open question tracked in
  `foreman-8bh9` / `foreman-d8qq`.

## Related

- [`durable-workflow-spike.md`](durable-workflow-spike.md) — durable API shape + the auth wall.
- [`trigger-inbox-spike.md`](trigger-inbox-spike.md) — trigger-inbox lifecycle (client-creds OK).
- [`zapier-sdk-capability-map.md`](zapier-sdk-capability-map.md) — the living SDK capability ledger.
