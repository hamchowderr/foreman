/**
 * Durable Auth Proof via standalone PKCE (foreman-d8qq)
 * ----------------------------------------------------
 * Replicates Foreman's connect.ts PKCE OAuth flow in ONE self-contained script
 * — no web app, no Supabase, no env needed:
 *   1. Spin up a local callback server on a Zapier-accepted login port.
 *   2. Print the authorize URL; you click + authorize in the browser.
 *   3. Capture the code, exchange it (PKCE) for a real per-user userJwt.
 *   4. createZapierSdk({credentials: token}) and call experimental runDurable.
 *   5. Poll getDurableRun to terminal; dump the full run journal/error.
 *
 * What this proves:
 *   (a) Whether a Foreman-minted userJwt satisfies durable's `userJwt` security
 *       scheme — we have ONLY ever confirmed client-credentials FAILS.
 *   (b) The exact source_files / runtime contract error (the entry-point contract
 *       is undocumented publicly: docs.zapier.com has zero durable refs, the
 *       README example is `source_files: {}`, and SDK defineDurable is a Phase-2
 *       stub). That error becomes the precise question for Zapier's engineers.
 *
 * Run (from packages/agents):
 *   npx tsx scripts/durable-pkce-probe.ts
 */
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";

// --- Mirrors src/lib/zapier/connect.ts exactly ---
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

  console.log("\n========================================================");
  console.log("ACTION REQUIRED — open this URL and authorize:\n");
  console.log(authorizeUrl);
  console.log(`\n(listening for the callback on ${redirectUri})`);
  console.log("========================================================\n");

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
