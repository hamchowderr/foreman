/**
 * Durable/workflow endpoint sweep (foreman-0yra follow-up)
 * --------------------------------------------------------
 * Answers: "did we test ALL the durable endpoints, or just runDurable?"
 *
 * Calls every durable/workflow method on the experimental SDK with minimal
 * placeholder args and classifies each response:
 *   - WALLED (userJwt)  -> 403 "None of the security schemes (userJwt)..."  (auth wall, same as runDurable)
 *   - AUTH OK           -> success, or a non-auth error (400/404/validation) => the token authenticated
 *   - OTHER             -> anything else (printed verbatim)
 *
 * Auth precedes arg validation server-side, so placeholder args still surface
 * the auth verdict. This proves whether the WHOLE durable family is userJwt-gated
 * or just runDurable.
 *
 * Default mode uses CLIENT CREDENTIALS from env (no browser):
 *   ZAPIER_CLIENT_ID / ZAPIER_CLIENT_SECRET
 *
 * Run (from packages/agents):
 *   npx tsx scripts/durable-endpoints-probe.ts
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createZapierSdk } from "@zapier/zapier-sdk/experimental";

// --- PKCE mint (mirrors src/lib/zapier/connect.ts + durable-pkce-probe.ts) ---
const ZAPIER_AUTHORIZE_URL = "https://zapier.com/oauth/authorize/";
const ZAPIER_TOKEN_URL = "https://zapier.com/oauth/token/";
const ZAPIER_PKCE_CLIENT_ID = "grwWZD5hUWGvb4V8ODBuOtXer3h0DBEZ2HR8aay6";
const LOGIN_PORTS = [49505, 50575, 52804, 55981, 61010, 63851];
const ZAPIER_SCOPE = "internal credentials offline_access";
const b64url = (b: Buffer) => b.toString("base64url");

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
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<html><body style='font-family:sans-serif;padding:2rem'><h2>Foreman durable sweep</h2><p>Authorization received — return to the terminal.</p></body></html>",
      );
      server.close();
      if (!code) return reject(new Error("No code in callback"));
      if (state !== expectedState) return reject(new Error("State mismatch"));
      resolve(code);
    });
    server.listen(port);
    setTimeout(
      () => {
        server.close();
        reject(new Error("Timed out (5 min)"));
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
  console.log("\n========================================================");
  console.log("ACTION REQUIRED — open this URL and authorize:\n");
  console.log(`${ZAPIER_AUTHORIZE_URL}?${params.toString()}`);
  console.log(`\n(listening on ${redirectUri})`);
  console.log("========================================================\n");
  const code = await waitForCode(port, state);
  console.log("Code received, exchanging…");
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
  const data = (await res.json()) as { access_token: string; scope?: string };
  console.log(`userJwt minted: len=${data.access_token.length}, scope="${data.scope}"`);
  return data.access_token;
}

/** Minimal .env.local loader (only fills vars not already in process.env). */
function loadEnvLocal(path: string) {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (val && process.env[key] === undefined) process.env[key] = val;
  }
}

const SRC = { "index.ts": "export default {};" };
// Well-formed but nonexistent UUID — passes the SDK's client-side Zod validation
// so the call actually reaches the server's auth layer (auth is checked before
// the resource is looked up, so a walled endpoint 403s even for a missing id).
const U = "00000000-0000-4000-8000-000000000000";

// Every durable/workflow endpoint + a minimal arg set that clears local validation.
// (Trigger-inbox endpoints are excluded — already known to accept client-creds.)
const CALLS: Array<[string, unknown]> = [
  ["runDurable", { source_files: SRC, input: {}, private: true }],
  ["listDurableRuns", {}],
  ["getDurableRun", { run: U }],
  ["cancelDurableRun", { run: U }],
  ["createWorkflow", { name: "probe", source_files: SRC }],
  ["listWorkflows", {}],
  ["getWorkflow", { workflow: U }],
  ["updateWorkflow", { workflow: U, name: "probe" }],
  ["deleteWorkflow", { workflow: U }],
  ["enableWorkflow", { workflow: U }],
  ["disableWorkflow", { workflow: U }],
  ["publishWorkflowVersion", { workflow: U, source_files: SRC }],
  ["getWorkflowVersion", { workflow: U, version: U }],
  ["listWorkflowVersions", { workflow: U }],
  ["triggerWorkflow", { workflow: U, input: {} }],
  ["getWorkflowRun", { run: U }],
  ["listWorkflowRuns", { workflow: U }],
  ["getTriggerRun", { trigger: U }],
];

const isUserJwt403 = (msg: string, code?: number) =>
  code === 403 && /security schemes \(userJwt\)|userJwt.*authenticat/i.test(msg);

async function probeAll(sdk: any, label: string) {
  console.log(`\n=== Durable endpoint sweep — auth: ${label} ===`);
  try {
    const { data } = await sdk.getProfile();
    console.log(`sanity getProfile -> OK: ${data?.email ?? data?.id ?? "?"}\n`);
  } catch (e: any) {
    console.log(`sanity getProfile -> FAILED: ${e?.message ?? e}\n`);
  }

  const rows: Array<{ method: string; verdict: string; code: string; detail: string }> = [];
  for (const [method, args] of CALLS) {
    if (typeof sdk[method] !== "function") {
      rows.push({ method, verdict: "MISSING", code: "-", detail: "not a function" });
      continue;
    }
    try {
      const { data } = await sdk[method](args);
      rows.push({
        method,
        verdict: "AUTH OK (success)",
        code: "2xx",
        detail: JSON.stringify(data).slice(0, 60),
      });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const code = e?.statusCode ?? e?.status;
      let verdict: string;
      if (isUserJwt403(msg, code)) verdict = "WALLED (userJwt 403)";
      else if (typeof code === "number" && code >= 400 && code < 500)
        verdict = "AUTH OK (non-auth 4xx)";
      else verdict = "OTHER";
      rows.push({ method, verdict, code: String(code ?? "?"), detail: msg.slice(0, 80) });
    }
  }

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(pad("METHOD", 24), pad("VERDICT", 24), pad("CODE", 6), "DETAIL");
  for (const r of rows)
    console.log(pad(r.method, 24), pad(r.verdict, 24), pad(r.code, 6), r.detail);

  const walled = rows.filter((r) => r.verdict.startsWith("WALLED")).length;
  const authok = rows.filter((r) => r.verdict.startsWith("AUTH OK")).length;
  console.log(
    `\nSUMMARY (${label}): ${walled}/${rows.length} walled by userJwt-403, ${authok}/${rows.length} authenticated (success or non-auth error).`,
  );
  return rows;
}

async function main() {
  const mode = process.argv.includes("--pkce") ? "pkce" : "client-creds";

  if (mode === "pkce") {
    const token = await mintUserJwt();
    const sdk = createZapierSdk({ credentials: token }) as any;
    await probeAll(sdk, "public-PKCE userJwt");
    return;
  }

  loadEnvLocal(new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const clientId = process.env.ZAPIER_CLIENT_ID;
  const clientSecret = process.env.ZAPIER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "ZAPIER_CLIENT_ID / ZAPIER_CLIENT_SECRET not set in env — cannot run client-creds sweep.",
    );
    process.exit(1);
  }
  const sdk = createZapierSdk({ credentials: { clientId, clientSecret } }) as any;
  await probeAll(sdk, "client-credentials");
}

main().catch((e) => {
  console.error("\nPROBE FAILED:", e?.message ?? e);
  process.exit(1);
});
