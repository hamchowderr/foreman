/**
 * One-off script to inspect SDK object shapes.
 * Run: cd packages/agents && npx tsx tests/sdk/inspect-schemas.ts
 */
import { createZapierSdk } from "@zapier/zapier-sdk";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sdk = createZapierSdk({});
  const out: string[] = [];

  // 1. Connection object shape
  const conns = await sdk.listConnections({ maxItems: 10 });
  out.push(`=== ${conns.data.length} CONNECTIONS ===`);
  if (conns.data.length > 0) {
    out.push("KEYS: " + JSON.stringify(Object.keys(conns.data[0])));
    out.push("FIRST: " + JSON.stringify(conns.data[0], null, 2));
    for (const c of conns.data) {
      const pick: Record<string, unknown> = {};
      for (const k of ["title", "app", "app_key", "appKey", "slug", "api", "selected_api"]) {
        if ((c as any)[k] !== undefined) pick[k] = (c as any)[k];
      }
      out.push("  CONN: " + JSON.stringify(pick));
    }
  }

  // 2. Apps pagination
  const apps = await sdk.listApps({ maxItems: 5 });
  out.push(`\n=== APPS (first 5 of ?) ===`);
  out.push("nextCursor: " + (apps as any).nextCursor);
  for (const a of apps.data) {
    out.push("  APP: " + JSON.stringify({ key: a.key, slug: a.slug, title: a.title }));
  }

  // 3. Registry schema param names for key functions
  const reg = sdk.getRegistry({ package: "mcp" });
  out.push("\n=== SCHEMA PARAMS ===");
  for (const fn of reg.functions) {
    const shape = (fn.inputSchema as any)?._zod?.def?.shape;
    if (shape) {
      out.push(`${fn.name}: ${Object.keys(shape).join(", ")}`);
    } else if (fn.inputParameters) {
      out.push(`${fn.name} (positional): ${fn.inputParameters.map((p: any) => p.name).join(", ")}`);
    }
  }

  const outPath = resolve(__dirname, "inspect-output.txt");
  writeFileSync(outPath, out.join("\n"));
  console.log("Written to", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
