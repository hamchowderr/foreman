/**
 * CLI script to seed the Zapier app catalog.
 *
 * Usage:
 *   npx tsx scripts/seed-catalog.ts                    # Full sync (apps + actions + embed)
 *   npx tsx scripts/seed-catalog.ts --apps-only        # Apps only, skip action lookups
 *   npx tsx scripts/seed-catalog.ts --embed-only       # Re-embed existing DB rows
 *   npx tsx scripts/seed-catalog.ts --limit 10         # Only process 10 apps (for testing)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // also try .env as fallback
import { seedCatalog } from "../src/lib/catalog/seed";

const args = process.argv.slice(2);

const limit = args.includes("--limit")
  ? Number(args[args.indexOf("--limit") + 1])
  : undefined;

const appsOnly = args.includes("--apps-only");
const embedOnly = args.includes("--embed-only");

async function main() {
  console.log("=== Zapier App Catalog Seed ===");
  console.log(`  Mode: ${embedOnly ? "embed-only" : appsOnly ? "apps-only" : "full"}`);
  if (limit) console.log(`  Limit: ${limit}`);
  console.log();

  const start = Date.now();
  const result = await seedCatalog({ limit, appsOnly, embedOnly });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log();
  console.log(`Done in ${elapsed}s`);
  console.log(`  Apps inserted/updated: ${result.appsInserted}`);
  console.log(`  Apps embedded: ${result.appsEmbedded}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
