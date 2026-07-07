/**
 * Full SDK surface sweep (foreman-xb68)
 * -------------------------------------
 * Live-introspects the INSTALLED @zapier/zapier-sdk (no docs, no changelog
 * guessing) and prints the complete capability surface, so we can prove what
 * the SDK can actually do at this exact version and catch anything Foreman has
 * not categorized.
 *
 * What it enumerates:
 *   1. Installed version (from package.json on disk).
 *   2. getRegistry() across every `package` value we can find — the function
 *      list the SDK itself advertises (this is what Foreman turns into tools).
 *   3. Every callable method on the main SDK instance vs the experimental one
 *      (experimental is a superset: trigger-inbox + durable + workflow).
 *   4. Every named export of all 4 entrypoints (., ./experimental, ./define,
 *      ./apps) with its runtime typeof.
 *   5. The action-type enum (the "can it create a Zap?" question).
 *   6. Diff vs Foreman's READ_ONLY / APPROVAL_REQUIRED / EXCLUDED / PAGINATED
 *      sets -> surfaces any method that is neither surfaced nor deliberately
 *      excluded (a real blind spot).
 *
 * No credentials / no network: getRegistry + method/exports enumeration are all
 * local. Run from packages/agents:
 *   npx tsx scripts/sdk-surface-sweep.ts
 */
import { existsSync, readFileSync } from "node:fs";

// ---- Foreman's own categorization (mirror of zapier-sdk-tools.ts) ----
const APPROVAL_REQUIRED = new Set([
  "runAction",
  "fetch",
  "createTable",
  "deleteTable",
  "createTableRecords",
  "updateTableRecords",
  "deleteTableRecords",
  "createTableFields",
  "deleteTableFields",
]);
const READ_ONLY = new Set([
  "listApps",
  "getApp",
  "listActions",
  "getAction",
  "listConnections",
  "findFirstConnection",
  "findUniqueConnection",
  "getConnection",
  "getInputFieldsSchema",
  "listInputFieldChoices",
  "listTables",
  "getTable",
  "listTableFields",
  "listTableRecords",
  "getTableRecord",
  "getProfile",
]);
const EXCLUDED_METHODS = new Set([
  "listAuthentications",
  "findFirstAuthentication",
  "findUniqueAuthentication",
  "getAuthentication",
  "request",
  "listInputFields",
  "createClientCredentials",
  "deleteClientCredentials",
  "listClientCredentials",
]);
const PAGINATED_METHODS = new Set([
  "listActions",
  "listApps",
  "listConnections",
  "listTables",
  "listTableRecords",
  "listTableFields",
  "listInputFieldChoices",
  "runAction",
]);

const line = (c = "=") => console.log(c.repeat(72));
const h = (t: string) => {
  console.log();
  line();
  console.log(t);
  line();
};

/** Collect every function-valued key on an object incl. its prototype chain. */
function methodNames(obj: any): string[] {
  const names = new Set<string>();
  let o = obj;
  while (o && o !== Object.prototype) {
    for (const k of Object.getOwnPropertyNames(o)) {
      if (k === "constructor") continue;
      try {
        if (typeof obj[k] === "function") names.add(k);
      } catch {
        /* getters that throw — skip */
      }
    }
    o = Object.getPrototypeOf(o);
  }
  // also catch own enumerable function props (plugin pattern attaches these)
  for (const k of Object.keys(obj)) {
    try {
      if (typeof obj[k] === "function") names.add(k);
    } catch {
      /* skip */
    }
  }
  return [...names].sort();
}

async function main() {
  // 1) Installed version straight off disk (exports map blocks require()).
  //    The package may be deduped to the workspace root, so try the nested
  //    copy first, then the hoisted root node_modules.
  const pkgCandidates = [
    "../node_modules/@zapier/zapier-sdk/package.json",
    "../../../node_modules/@zapier/zapier-sdk/package.json",
  ].map((p) => new URL(p, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const pkgPath = pkgCandidates.find((p) => existsSync(p));
  if (!pkgPath) {
    throw new Error(`@zapier/zapier-sdk/package.json not found in: ${pkgCandidates.join(", ")}`);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  h(`@zapier/zapier-sdk SURFACE SWEEP — installed v${pkg.version}`);
  console.log("dependencies:", JSON.stringify(pkg.dependencies));
  console.log("entrypoints:", Object.keys(pkg.exports).join(", "));

  // 2) Import all four entrypoints.
  const main = await import("@zapier/zapier-sdk");
  const experimental = await import("@zapier/zapier-sdk/experimental");
  const define = await import("@zapier/zapier-sdk/define").catch((e) => ({ __err: String(e) }));
  const apps = await import("@zapier/zapier-sdk/apps").catch((e) => ({ __err: String(e) }));

  // 3) Named exports of each entrypoint with runtime typeof.
  const dumpExports = (label: string, mod: any) => {
    h(`EXPORTS — ${label}`);
    if (mod.__err) {
      console.log("  import failed:", mod.__err);
      return;
    }
    const keys = Object.keys(mod).sort();
    console.log(`(${keys.length} named exports)`);
    for (const k of keys) {
      let kind = typeof mod[k];
      // distinguish error classes / constructors
      if (kind === "function" && /^[A-Z]/.test(k)) {
        const isErr = mod[k]?.prototype instanceof Error;
        kind = isErr ? "class(Error)" : "function/class";
      }
      console.log(`  ${k.padEnd(34)} ${kind}`);
    }
  };
  dumpExports(".", main);
  dumpExports("./experimental", experimental);
  dumpExports("./define", define);
  dumpExports("./apps", apps);

  // 4) Build SDK instances (no creds — pure shape introspection).
  const mkSdk = (mod: any) => {
    try {
      return (mod.createZapierSdk as any)({ canDeleteTables: true });
    } catch (e: any) {
      console.log(`  createZapierSdk failed: ${e?.message ?? e}`);
      return null;
    }
  };
  const sdkMain = mkSdk(main);
  const sdkExp = mkSdk(experimental);

  // 5) getRegistry() across package variants on BOTH instances.
  const probeRegistry = (sdk: any, label: string) => {
    if (!sdk?.getRegistry) {
      console.log(`  [${label}] no getRegistry`);
      return new Map();
    }
    const variants: Array<Record<string, unknown> | undefined> = [
      undefined,
      { package: "mcp" },
      { package: "sdk" },
      { package: "cli" },
      { package: "all" },
      { package: "ai" },
    ];
    const seen = new Map<string, any>();
    for (const v of variants) {
      try {
        const reg = sdk.getRegistry(v);
        const fns = reg?.functions ?? [];
        console.log(
          `  [${label}] getRegistry(${v ? JSON.stringify(v) : "undefined"}) -> ${fns.length} functions`,
        );
        for (const f of fns) if (!seen.has(f.name)) seen.set(f.name, f);
      } catch (e: any) {
        console.log(
          `  [${label}] getRegistry(${v ? JSON.stringify(v) : "undefined"}) -> ERROR ${e?.message ?? e}`,
        );
      }
    }
    return seen;
  };
  h("REGISTRY — getRegistry() across package variants");
  const regMain = probeRegistry(sdkMain, "main");
  const regExp = probeRegistry(sdkExp, "experimental");

  // 6) All callable methods on each instance.
  const mMain = sdkMain ? methodNames(sdkMain) : [];
  const mExp = sdkExp ? methodNames(sdkExp) : [];
  const onlyExp = mExp.filter((m) => !mMain.includes(m));
  h("INSTANCE METHODS");
  console.log(`main createZapierSdk()        -> ${mMain.length} callable methods`);
  console.log(`experimental createZapierSdk()-> ${mExp.length} callable methods`);
  console.log(`\nmethods ONLY on experimental (${onlyExp.length}):`);
  console.log("  " + onlyExp.join(", "));

  // 7) Registry union (what is tool-able) — from the experimental registry,
  //    which is the widest. Categorize each against Foreman's sets.
  const regUnion = new Set<string>([...regMain.keys(), ...regExp.keys()]);
  h(`REGISTRY UNION (${regUnion.size}) vs FOREMAN CATEGORIZATION`);
  const rows: Array<[string, string]> = [];
  for (const name of [...regUnion].sort()) {
    let cat = "❓ UNCATEGORIZED";
    if (APPROVAL_REQUIRED.has(name)) cat = "approval";
    else if (READ_ONLY.has(name)) cat = "read-only";
    else if (EXCLUDED_METHODS.has(name)) cat = "excluded";
    rows.push([name, cat]);
  }
  for (const [n, c] of rows) console.log(`  ${n.padEnd(34)} ${c}`);
  const uncat = rows.filter(([, c]) => c.startsWith("❓"));
  h("BLIND-SPOT CHECK");
  console.log(`registry-union methods NOT in any Foreman set: ${uncat.length}`);
  for (const [n] of uncat) console.log(`  ❓ ${n}`);

  // 8) Instance methods that are NOT in the registry union (callable but not
  //    advertised as tool-able functions).
  const allInstance = new Set<string>([...mMain, ...mExp]);
  const notInRegistry = [...allInstance].filter((m) => !regUnion.has(m)).sort();
  console.log(
    `\ninstance methods NOT in any registry (helpers/proxies/internals): ${notInRegistry.length}`,
  );
  console.log("  " + notInRegistry.join(", "));

  // 9) Action-type enum (the "create a Zap?" answer).
  h("ACTION-TYPE ENUM");
  try {
    const schemaPath = new URL(
      "../node_modules/@zapier/zapier-sdk/dist/api/schemas.js",
      import.meta.url,
    ).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const txt = readFileSync(schemaPath, "utf8");
    const m = txt.match(/actionType[\s\S]{0,400}?enum\(\[([^\]]+)\]/);
    console.log(
      m
        ? `actionType enum: [${m[1].replace(/\s+/g, " ").trim()}]`
        : "actionType enum not found via regex (inspect schemas.js)",
    );
  } catch (e: any) {
    console.log("could not read schemas.js:", e?.message ?? e);
  }

  // 10) Machine-readable summary block for doc refresh.
  h("JSON SUMMARY");
  console.log(
    JSON.stringify(
      {
        version: pkg.version,
        entrypoints: Object.keys(pkg.exports),
        registry: {
          main: [...regMain.keys()].sort(),
          experimental: [...regExp.keys()].sort(),
          unionCount: regUnion.size,
        },
        instanceMethods: {
          main: mMain.length,
          experimental: mExp.length,
          onlyExperimental: onlyExp,
        },
        uncategorized: uncat.map(([n]) => n),
        notInRegistry,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error("SWEEP FAILED:", e?.stack ?? e);
  process.exit(1);
});
