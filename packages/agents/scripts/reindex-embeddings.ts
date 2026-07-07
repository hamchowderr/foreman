/**
 * Migration: drop the embedding vector indexes so they get recreated at the
 * dimension the CODE currently uses (see EMBEDDING_DIMENSION in
 * src/lib/catalog/vector.ts and src/lib/rag/index.ts).
 *
 * WHY: PgVector indexes are fixed-dimension. ensureIndex()/ensureCatalogIndex()
 * only CREATE an index when it's missing — they never resize an existing one.
 * After switching the embedder (e.g. OpenAI 1536d -> fastembed 384d), any env
 * whose `catalog_vectors` / `action_history` indexes already exist at the old
 * dimension will reject the new vectors with a dimension mismatch. This drops
 * them so the running app recreates them at the new dimension on next use.
 *
 * SAFE BY DEFAULT: dry-run (reports current dimensions, changes nothing) unless
 * you pass --yes. Destructive: dropping action_history discards historical
 * semantic-recall embeddings (they rebuild as new actions run). catalog_vectors
 * is fully restored by `npm run catalog:embed` afterwards.
 *
 * Usage (run with the TARGET env's DATABASE_URL in the environment):
 *   npx tsx scripts/reindex-embeddings.ts            # dry-run: report only
 *   npx tsx scripts/reindex-embeddings.ts --yes      # drop the indexes
 *   # then, to repopulate the catalog at the new dimension:
 *   npm run catalog:embed
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config(); // .env fallback

import { Client } from "pg";

const INDEXES = ["catalog_vectors", "action_history"] as const;
const apply = process.argv.slice(2).includes("--yes");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  console.log("=== Embedding index re-index ===");
  console.log(`  Mode: ${apply ? "APPLY (will drop indexes)" : "dry-run (report only)"}`);
  console.log();

  for (const idx of INDEXES) {
    // PgVector stores each index as a table of the same name; the embedding
    // column is the lone `vector` type column. format_type exposes its dim.
    const dim = await client.query(
      `SELECT format_type(a.atttypid, a.atttypmod) AS type
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
        WHERE c.relname = $1 AND a.atttypid = 'vector'::regtype`,
      [idx],
    );
    const current = dim.rows[0]?.type ?? "(table does not exist)";
    console.log(`  ${idx}: ${current}`);

    if (apply) {
      await client.query(`DROP TABLE IF EXISTS "${idx}" CASCADE`);
      console.log(`    -> dropped (will be recreated at the code's current dimension on next use)`);
    }
  }

  await client.end();

  console.log();
  if (apply) {
    console.log("Done. Next steps:");
    console.log("  1. (Re)start the agents server so the new embedder/dimension is live.");
    console.log("  2. Run `npm run catalog:embed` to repopulate catalog_vectors.");
    console.log("  3. action_history recreates empty and rebuilds as new actions run.");
  } else {
    console.log("Dry run only — no changes made. Re-run with --yes to drop the indexes.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Re-index failed:", err);
  process.exit(1);
});
