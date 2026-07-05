# Durable Execution — Questions for Zapier Engineers

> ## ✅ UPDATE 2026-07-05 (SDK 0.81.0) — durables now WORK; questions narrowed
>
> The two original blockers below are **RESOLVED** on `@zapier/zapier-sdk@0.81.0`:
> - **Auth:** a live re-probe (`scripts/durable-endpoints-probe.ts`, app-level **client-credentials**) returns **0/18 durable methods walled** — `runDurable` / `createWorkflow` / `listWorkflows` all `2xx`. The `internal`-scope `userJwt` wall is gone for the client-creds token.
> - **Source-file contract:** `defineDurable(...)` + `ctx.step` / `ctx.wait` / `ctx.createCallback` deploy and run end-to-end. Verified live: ephemeral `runDurable` → finished; `createWorkflow`+`publishWorkflowVersion` → `triggerWorkflow` → finished; a `createCallback` gate parks in `execution.status="waiting"` and resumes on a POST.
>
> **The remaining questions (evidence-backed, 2026-07-05):**
>
> 1. **Is durable GA / permanent now?** On 0.81.0 durable is open for us on **both** auth paths we tested: app **client-credentials** (0/18 endpoints walled) AND a real **per-user PKCE user-JWT** (`runDurable` → run **finished**). Both were **403 in June**. One tell: the PKCE token is **still granted only `external`** scope (unchanged) — durable's `userJwt` scheme now simply **accepts `external`** where it previously required `internal`. **Is that intentional and generally available for public-SDK clients, or an early-access state that could re-close?** The wall opened silently between 0.79.0 and 0.81.0 (no changelog note), so before we hard-depend on it — running every end-user's automations on durable — we need to know it's permanent.
> 2. **Human-approval callback URL is not obtainable from outside.** `getDurableRun.execution.operations[]` exposes a callback op's `callback_token`, `payload_schema`, `expires_at` — but **not the callback URL**. The real URL is `https://code-substrate-runner.zapier.com/api/v0/callbacks/<opaque-id>`, and `<opaque-id>` is **different** from `callback_token`, so it can't be reconstructed. Today an external orchestrator can only obtain the URL by having the durable **self-report it** via a step output. **Will you expose the callback URL (or add a resume-by-token endpoint / `resumeDurableRun({ run, operation, payload })`) on `getDurableRun`** so the self-report convention isn't required? There is no `resumeDurableRun`/`postCallback` in the SDK today (only `resumeTriggerInbox`, which is inbox-not-durable).
> 3. **Callback security model.** The callback URL is a **public, unauthenticated bearer endpoint** — a `POST {json}` with no auth header returns `200 {"ok":true}` and resumes the run. Is that the intended model (possession = capability)? Any plans for a **signed / account-authenticated** resume, and what are the **expiry / single-use** semantics? (We observed `expires_at` ~30 days.)
> 4. **`payload_schema` enforcement.** Is the POSTed callback payload validated against the callback's `payloadSchema` **server-side**, or passed through to the durable unchecked? (We POSTed arbitrary JSON and it was accepted + delivered.)
>
> Everything below is the **original (now-resolved) auth/contract report**, kept for history.

---

**From:** Foreman team (admin@otakusolutions.io)
**Re:** `@zapier/zapier-sdk/experimental` durable-workflow API (`runDurable` / `publishWorkflowVersion`)
**Date of findings:** 2026-06-11 (SDK `0.69.3`); re-confirmed 2026-06-16 on `0.70.4`, and again 2026-06-22 on the current `0.76.0` — both credential types, identical 403; `defineDurable` still a "not callable — Phase 2" stub on 0.76.0
**Status:** Blocked — durable is unreachable with every credential a public SDK client can mint.

---

## TL;DR — what we need from you

We want to use the experimental durable-workflow API. We're blocked on **two** things:

1. **Auth.** `runDurable` returns **HTTP 403 `"None of the security schemes (userJwt) successfully authenticated this request."`** for *both* app-level client-credentials **and** a genuine per-user PKCE user JWT. The PKCE flow *requests* scope `internal credentials offline_access` but is only *granted* `external credentials offline_access`. It looks like durable requires an **`internal`-scoped** token that the public PKCE client is not permitted to obtain.
   - **What grants a token that satisfies durable's `userJwt` scheme?**
2. **Source-file contract.** Even with valid auth, the `source_files` entry-point/runtime contract that `runDurable` expects is undocumented (not in the SDK `.d.ts`, the README, or docs.zapier.com; the SDK's own `defineDurable` is a "Phase-2 / not callable yet" stub).
   - **What is the entry-point contract `source_files` code must conform to?**

A complete, self-contained reproduction script is included at the end — it needs no app, no DB, no Foreman env.

---

## 1. Environment snapshot

| Package | Version |
|---|---|
| `@zapier/zapier-sdk` | `0.76.0` (current latest; found on `0.69.3`, reproduced identically on `0.70.4` and `0.76.0`) |
| `@zapier/zapier-sdk-cli` | `0.54.3` |
| `@zapier/zapier-durable` | referenced from npm at `0.5.4` (not installed as a repo dep) |
| `zod` | `4.4.3` |
| Node | 22 |

We reviewed the full `0.70.0`–`0.70.4` changelog: every durable-touching change is response-schema / field-parity / streaming work — **no auth, scope, or security-scheme changes** — consistent with the 403 being a server-side OAuth wall rather than an SDK artifact. We then re-ran the reproduction (below) on `0.70.4` and got the identical 403. We re-ran it again on the current `0.76.0` (2026-06-22): 18/18 endpoints walled under client-credentials, and a freshly-minted PKCE user JWT still 403s with scope downgraded `internal`→`external` — unchanged. (The `0.71`–`0.76` changes are connection-creation, telemetry headers, camelCase param aliases, and workflow field-parity — none touch durable's auth or scope.)

OAuth client used (the SDK's **public** PKCE client — the same one `zapier-sdk login` uses):
`grwWZD5hUWGvb4V8ODBuOtXer3h0DBEZ2HR8aay6`, redirecting to one of the localhost ports Zapier allow-lists for it: `49505, 50575, 52804, 55981, 61010, 63851`.

---

## 2. Which SDK surfaces work with which auth (verified empirically)

| SDK surface | App client-credentials (`ZAPIER_CLIENT_ID/SECRET`) | Public-PKCE user JWT (our `connect.ts` flow) |
|---|---|---|
| `runAction`, discovery, `apps.*`, tables | ✅ | ✅ |
| Trigger inboxes (`/experimental` — `ensureTriggerInbox`/`lease`/`ack`) | ✅ | ✅ |
| **Durable / workflow — all 18 endpoints** (each individually called) | ❌ **403** | ❌ **403** |
| Legacy `~/.zapierrc` `deployKey` (32-char, not a JWT) | ❌ `"Failed to authenticate Bearer token"` | — |

**Durable is the only surface we cannot reach.** Everything else authenticates cleanly with the very same tokens.

> **Scope of testing — we swept the entire durable/workflow surface, not just `runDurable`.** A sweep script (`scripts/durable-endpoints-probe.ts`) calls **all 18** durable/workflow endpoints with valid-format args (so each clears the SDK's client-side Zod validation and actually reaches the server's auth layer) under **both** credential types. **Result: 18/18 return the identical `userJwt` 403 under client-credentials, and 18/18 return it again under a real PKCE userJwt.** Nothing here is inferred. The 18 endpoints:
>
> `runDurable`, `listDurableRuns`, `getDurableRun`, `cancelDurableRun`, `createWorkflow`, `listWorkflows`, `getWorkflow`, `updateWorkflow`, `deleteWorkflow`, `enableWorkflow`, `disableWorkflow`, `publishWorkflowVersion`, `getWorkflowVersion`, `listWorkflowVersions`, `triggerWorkflow`, `getWorkflowRun`, `listWorkflowRuns`, `getTriggerRun`.

---

## 3. The exact error

```
runDurable threw: None of the security schemes (userJwt) successfully authenticated this request.
HTTP 403
```

Returned identically for:
- App-level **client-credentials**, and
- A **real per-user PKCE user JWT** that we minted with our production `connect.ts` flow and validated against `getProfile` (resolved to `admin@otakusolutions.io`).

---

## 4. Auth analysis — the scope downgrade ("the tell")

Our PKCE authorize request asks for:

```
scope = "internal credentials offline_access"
```

The token Zapier returns is granted:

```
scope = "external credentials offline_access"
```

So the `internal` portion is silently dropped. Durable's `userJwt` security scheme appears to require **`internal`** scope, and the **public** PKCE client (`grwWZD…`) is not permitted to obtain it. That makes durable gated not on *"get a user JWT"* but on a **privileged scope/audience no publicly-available Zapier SDK client can mint** — a hard wall on Zapier's side, not an integration gap on ours.

### Auth questions

1. What grants a token that satisfies durable's `userJwt` scheme — an `internal`-scoped OAuth client, a privileged/allow-listed client, a token exchange (client-creds → user token), or a dedicated service identity?
2. Is the `internal` → `external` scope **downgrade** on the public PKCE client the intended gate?
3. For a **server / headless context** (no interactive user present at run time), what is the sanctioned way to obtain a durable-capable token?
4. Is durable simply **not yet open** to public SDK clients at all? If so, is there an allow-list / early-access path?

---

## 5. Source-file contract — the second unknown

`runDurable`'s type (from the `0.70.4` `.d.ts`):

```ts
runDurable(args: {
  source_files: Record<string, string>;   // filename -> code
  input?: unknown;
  dependencies?: ...;
  zapier_durable_version?: ...;
  connections?: ...;
  app_versions?: ...;
  notifications?: ...;                     // added in 0.70.4 — webhook subscribers for run lifecycle events
  private?: boolean;
}): Promise<{ id: string; status: "initialized"; created_at: string }>
```

We understand `source_files` is code written against **`@zapier/zapier-durable`** (`defineDurable`, `ctx.step`, `ctx.createCallback`). But the **entry-point + runtime contract** is undocumented:

- Not in the SDK `.d.ts`.
- The README example is literally `source_files: {}`.
- docs.zapier.com has **zero** durable references.
- The SDK's own `defineDurable` is an explicit **"Phase-2 / not callable yet"** stub.

### Source-file questions

5. What entry-point contract must `source_files` conform to? (Default export? A specific filename, e.g. `index.ts`? A named export?)
6. What does `zapier_durable_version` pin, and which value should we target with `@zapier/zapier-durable@0.5.4`?
7. How are `dependencies` / `app_versions` / `connections` resolved at execution time?
8. Are there private or forthcoming durable programming-model docs you can share?

This is the best-effort hello-world we'd run *once auth is unblocked* (the runtime error from this would itself teach us the real contract):

```ts
import { defineDurable } from "@zapier/zapier-durable";
import { z } from "zod";

export default defineDurable({
  name: "hello-world",
  inputSchema: z.object({ name: z.string().optional() }),
  run: async (ctx, input) => {
    const greeting = await ctx.step("greet", async () => `Hello, ${input?.name ?? "world"}!`);
    return { greeting };
  },
});
```

---

## 6. Self-contained reproduction script

Runs standalone — **no web app, no Supabase, no Foreman env**. It mints a *real* per-user PKCE user JWT (identical to our production flow), validates it via `getProfile`, then calls `runDurable`. From `packages/agents`:

```bash
npx tsx scripts/durable-pkce-probe.ts
```

```ts
/**
 * Durable Auth Proof via standalone PKCE
 * Replicates Foreman's connect.ts PKCE OAuth flow in ONE self-contained script:
 *   1. Spin up a local callback server on a Zapier-accepted login port.
 *   2. Print the authorize URL; you click + authorize in the browser.
 *   3. Capture the code, exchange it (PKCE) for a real per-user userJwt.
 *   4. createZapierSdk({credentials: token}) and call experimental runDurable.
 *   5. Poll getDurableRun to terminal; dump the full run journal/error.
 */
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";

const ZAPIER_AUTHORIZE_URL = "https://zapier.com/oauth/authorize/";
const ZAPIER_TOKEN_URL = "https://zapier.com/oauth/token/";
// The SDK's public PKCE client — Zapier only accepts it with redirect URIs on these ports.
const ZAPIER_PKCE_CLIENT_ID = "grwWZD5hUWGvb4V8ODBuOtXer3h0DBEZ2HR8aay6";
const LOGIN_PORTS = [49505, 50575, 52804, 55981, 61010, 63851];
const ZAPIER_SCOPE = "internal credentials offline_access";

const b64url = (b: Buffer) => b.toString("base64url");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findPort(): Promise<number> {
  for (const port of LOGIN_PORTS) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = createServer();
      s.listen(port, () => s.close(() => resolve(true)));
      s.on("error", () => resolve(false));
    });
    if (ok) return port;
  }
  throw new Error(`No login port free: ${LOGIN_PORTS.join(", ")}`);
}

/** Listen on `port`; resolve with the ?code once Zapier redirects to /oauth. */
function waitForCode(port: number, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      if (url.pathname !== "/oauth") {
        res.writeHead(404);
        res.end();
        return;
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const err = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<html><body style='font-family:sans-serif;padding:2rem'><h2>Foreman durable probe</h2><p>Authorization received — close this tab and return to the terminal.</p></body></html>",
      );
      server.close();
      if (err) return reject(new Error(`OAuth error: ${err}`));
      if (!code) return reject(new Error("No code in callback"));
      if (state !== expectedState) return reject(new Error("State mismatch (CSRF guard)"));
      resolve(code);
    });
    server.listen(port);
    setTimeout(
      () => {
        server.close();
        reject(new Error("Timed out waiting for browser authorization (5 min)"));
      },
      5 * 60 * 1000,
    );
  });
}

async function mintUserJwt(): Promise<string> {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = randomBytes(16).toString("hex");
  const port = await findPort();
  const redirectUri = `http://localhost:${port}/oauth`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: ZAPIER_PKCE_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: ZAPIER_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  const authorizeUrl = `${ZAPIER_AUTHORIZE_URL}?${params.toString()}`;

  console.log("\nACTION REQUIRED — open this URL and authorize:\n");
  console.log(authorizeUrl);
  console.log(`\n(listening for the callback on ${redirectUri})\n`);

  const code = await waitForCode(port, state);
  console.log("Code received, exchanging for token…");

  const res = await fetch(ZAPIER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: ZAPIER_PKCE_CLIENT_ID,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; scope?: string; expires_in?: number };
  console.log(
    `userJwt minted: len=${data.access_token.length}, prefix="${data.access_token.slice(0, 6)}…", scope="${data.scope}"`,
  );
  return data.access_token;
}

// Best-effort hello-world against @zapier/zapier-durable's defineDurable shape.
// (Contract is undocumented — this is a probe; the runtime error teaches us the real shape.)
const HELLO_SOURCE = `import { defineDurable } from "@zapier/zapier-durable";
import { z } from "zod";

export default defineDurable({
  name: "hello-world",
  inputSchema: z.object({ name: z.string().optional() }),
  run: async (ctx, input) => {
    const greeting = await ctx.step("greet", async () => \`Hello, \${input?.name ?? "world"}!\`);
    return { greeting };
  },
});
`;

async function main() {
  const token = await mintUserJwt();
  const sdk = createZapierSdk({ credentials: token }) as any;

  try {
    const { data: profile } = await sdk.getProfile();
    console.log(`profile OK: ${profile?.email ?? profile?.id ?? "?"}`);
  } catch (e) {
    console.log(`profile probe failed: ${(e as Error).message}`);
  }

  console.log("\nCalling runDurable with the userJwt…");
  let run: any;
  try {
    const { data } = await sdk.runDurable({
      source_files: { "index.ts": HELLO_SOURCE },
      input: { name: "Foreman" },
      private: true,
    });
    run = data;
    console.log(`✓ AUTH PASSED — runDurable accepted. run id=${data.id} status=${data.status}`);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    console.log(`runDurable threw: ${msg}`);
    if (/userJwt|security scheme|authenticate|unauthor/i.test(msg)) {
      console.log("→ STILL AN AUTH FAILURE: the userJwt did NOT satisfy the durable scheme.");
    } else {
      console.log("→ AUTH PASSED (error is NOT auth-related — likely source_files contract).");
    }
    for (const k of ["status", "statusCode", "response", "body", "cause"]) {
      if (e?.[k] !== undefined)
        console.log(`  ${k}:`, JSON.stringify(e[k], null, 2).slice(0, 1500));
    }
    return;
  }

  console.log("\nPolling getDurableRun to terminal…");
  for (let i = 0; i < 20; i++) {
    await sleep(3000);
    const { data: cur } = await sdk.getDurableRun({ run: run.id });
    console.log(`  status=${cur.status}`);
    if (["finished", "failed", "cancelled"].includes(cur.status)) {
      console.log("\nFINAL RUN STATE:");
      console.log(JSON.stringify(cur, null, 2).slice(0, 4000));
      return;
    }
  }
  console.log("(still running after ~60s — re-query getDurableRun later with the run id)");
}

main().catch((e) => {
  console.error("\nPROBE FAILED:", e?.message ?? e);
  process.exit(1);
});
```

### Observed output

Original run (2026-06-11, SDK `0.69.3`):

```
userJwt minted: len=3192, prefix="eyJhbG…", scope="external credentials offline_access"
profile OK: admin@otakusolutions.io
runDurable threw: None of the security schemes (userJwt) successfully authenticated this request.
HTTP 403
```

Re-confirmation (2026-06-16, latest SDK `0.70.4`):

```
userJwt minted: len=3199, prefix="eyJhbG…", scope="external credentials offline_access"
profile OK: admin@otakusolutions.io
runDurable threw: None of the security schemes (userJwt) successfully authenticated this request.
statusCode: 403
```

The minted token is a real, profile-validated per-user JWT — the **same token type we use in production** for `runAction`, discovery, and trigger inboxes — and it still 403s on durable on the latest SDK. Note the granted `scope` is `external …`, not the requested `internal …`, on both versions.

### Full-surface sweep (all 18 durable/workflow endpoints, both credential types)

A companion script (`scripts/durable-endpoints-probe.ts`) calls every durable/workflow endpoint — with valid-format UUID args so each clears the SDK's local Zod validation and actually reaches the server — and classifies each response. Run on SDK `0.70.4`:

```
=== Durable endpoint sweep — auth: client-credentials ===
sanity getProfile -> OK: admin@otakusolutions.io
runDurable, listDurableRuns, getDurableRun, cancelDurableRun, createWorkflow,
listWorkflows, getWorkflow, updateWorkflow, deleteWorkflow, enableWorkflow,
disableWorkflow, publishWorkflowVersion, getWorkflowVersion, listWorkflowVersions,
triggerWorkflow, getWorkflowRun, listWorkflowRuns, getTriggerRun
  → every one: 403 "None of the security schemes (userJwt) successfully authenticated this request."
SUMMARY (client-credentials): 18/18 walled by userJwt-403, 0/18 authenticated.

=== Durable endpoint sweep — auth: public-PKCE userJwt ===
userJwt minted: len=3199, scope="external credentials offline_access"
sanity getProfile -> OK: admin@otakusolutions.io
  → every one: 403 "None of the security schemes (userJwt) successfully authenticated this request."
SUMMARY (public-PKCE userJwt): 18/18 walled by userJwt-403, 0/18 authenticated.
```

So **every** durable/workflow endpoint is walled for **both** credential types a public SDK client can mint — and even a genuine PKCE userJwt is rejected by the `userJwt` scheme because it carries `external`, not `internal`, scope. (The trigger-inbox and action/discovery surfaces, by contrast, authenticate fine with the very same tokens.)

---

## 7. Why this matters to us

Durable's model (`ctx.step` memoized steps, `ctx.createCallback` for human-in-the-loop approvals) maps almost exactly onto our product: multi-step automations with human approval gates. We'd genuinely like to build on it rather than maintain our own execution engine — but right now we can't authenticate to it at all. A clear answer on the auth path (and, once unblocked, the `source_files` contract) is all we need to prototype a hello-world.

Thanks very much — happy to jump on a call or share more traces.
