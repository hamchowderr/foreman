/**
 * Backfill the knowledge indexes (foreman-aqjx).
 *
 * Embeds every SHARED knowledge document into its workspace's vector index so
 * docs saved before save_document started indexing (or on a fresh DB) become
 * searchable. Self-host/local only — walks the on-disk per-tenant Workspace
 * dirs under FOREMAN_WORKSPACE_PATH. Cloud/S3 backfill is a follow-up.
 *
 * Run with local Supabase creds (NOT under `infisical run`, which injects cloud
 * DB creds that override .env.local):
 *
 *   npx tsx --env-file=.env.local scripts/knowledge-reindex.ts
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { indexSharedDoc } from "../src/mastra/agents/workspace";

const WORKSPACE_PATH = process.env.FOREMAN_WORKSPACE_PATH ?? "./data/workspace";

/** documents/q3-launch-plan.md → "Q3 Launch Plan" (fallback title, no manifest read). */
function titleFromSlug(slug: string): string {
  return (
    slug
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "Document"
  );
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function main() {
  const tenants = await listDirs(WORKSPACE_PATH);
  if (tenants.length === 0) {
    console.log(`No workspace dirs under ${WORKSPACE_PATH}. Nothing to reindex.`);
    return;
  }

  let total = 0;
  for (const tenantKey of tenants) {
    // Only the SHARED `documents/` tier is indexed (v1). Personal `_private/…`
    // docs are skipped — they'd become searchable by teammates in the shared
    // per-workspace index (personal search is a per-user-index follow-up).
    const docsDir = path.join(WORKSPACE_PATH, tenantKey, "documents");
    let files: string[];
    try {
      files = (await readdir(docsDir)).filter((f) => f.endsWith(".md"));
    } catch {
      continue; // no documents/ dir for this tenant
    }
    for (const file of files) {
      const abs = path.join(docsDir, file);
      const s = await stat(abs).catch(() => null);
      if (!s?.isFile()) continue;
      const content = await readFile(abs, "utf8");
      const relPath = `documents/${file}`;
      try {
        await indexSharedDoc({
          tenantKey,
          path: relPath,
          content,
          title: titleFromSlug(file.replace(/\.md$/, "")),
        });
        total++;
        console.log(`  indexed ${tenantKey}/${relPath}`);
      } catch (err) {
        console.error(`  FAILED ${tenantKey}/${relPath}:`, (err as Error).message);
      }
    }
  }
  console.log(`\nReindexed ${total} shared document(s) across ${tenants.length} workspace(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
