import { createZapierSdk } from "@zapier/zapier-sdk";
import { getSupabase } from "../db";
import { indexAppCatalog } from "./vector";

interface SeedOptions {
  /** Max apps to pull (for testing). Default: all. */
  limit?: number;
  /** Skip action lookups — only pull app metadata. */
  appsOnly?: boolean;
  /** Only embed existing DB rows — skip SDK fetch. */
  embedOnly?: boolean;
  /** Log progress. */
  verbose?: boolean;
}

/**
 * Pull the Zapier app catalog from SDK and store in app_catalog table.
 * Optionally fetches action descriptions per app for richer embeddings.
 */
export async function seedCatalog(options: SeedOptions = {}): Promise<{
  appsInserted: number;
  appsEmbedded: number;
}> {
  const { limit, appsOnly = false, embedOnly = false, verbose = true } = options;
  const log = verbose ? console.log.bind(console) : () => {};

  let appsInserted = 0;

  if (!embedOnly) {
    log("Fetching app catalog from Zapier SDK...");
    const sdk = createZapierSdk({});

    // Manual cursor pagination with retry — handles transient 503/429 errors
    const seen = new Map<string, any>();
    let cursor: string | undefined;
    const MAX_RETRIES = 6;

    log("Paginating full Zapier app catalog...");
    while (true) {
      let retries = 0;
      let page: Awaited<ReturnType<typeof sdk.listApps>> | null = null;

      while (retries <= MAX_RETRIES) {
        try {
          page = await sdk.listApps({ cursor });
          break;
        } catch (err: any) {
          const isRetryable =
            err.statusCode === 503 || err.statusCode === 429 || err.statusCode === 502;
          if (isRetryable && retries < MAX_RETRIES) {
            retries++;
            const wait = Math.min(retries * 3000, 15000);
            log(
              `  Transient error (${err.statusCode}), retry ${retries}/${MAX_RETRIES} in ${wait / 1000}s...`,
            );
            await sleep(wait);
          } else {
            throw err;
          }
        }
      }

      if (!page) break;

      for (const app of page.data) {
        seen.set(app.key, app);
      }

      if (seen.size % 500 === 0 && seen.size > 0) {
        log(`  ${seen.size} apps so far...`);
      }

      if (limit && seen.size >= limit) break;
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    log(`  Total from pagination: ${seen.size} apps`);

    const apps = [...seen.values()];
    if (limit) apps.splice(limit);
    log(`  Total unique apps: ${apps.length}`);

    // Process apps in batches
    const BATCH = 20;
    for (let i = 0; i < apps.length; i += BATCH) {
      const batch = apps.slice(i, i + BATCH);

      for (const app of batch) {
        let actionDescriptions: string[] = [];
        let actionCount = 0;

        if (!appsOnly) {
          try {
            const actions = await sdk.listActions({
              app: app.key,
              maxItems: 50,
            });
            actionCount = actions.data.length;
            actionDescriptions = actions.data
              .map((a: any) => a.description || a.title)
              .filter(Boolean)
              .slice(0, 10); // Top 10 descriptions for embedding
          } catch {
            // Some apps may not have actions or may error
          }
        }

        const categoryNames = (app.categories ?? [])
          .map((c: any) => c.name ?? c.slug)
          .filter(Boolean);

        const embeddingText = buildEmbeddingText(app.title, categoryNames, actionDescriptions);

        // Upsert into app_catalog
        const supabase = getSupabase();
        await supabase.from("app_catalog").upsert(
          {
            app_key: app.key,
            slug: app.slug ?? app.key.toLowerCase(),
            title: app.title,
            categories: JSON.stringify(app.categories ?? []),
            auth_type: app.auth_type ?? null,
            action_count: actionCount,
            embedding_text: embeddingText,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "app_key" },
        );

        appsInserted++;
      }

      log(`  Processed ${Math.min(i + BATCH, apps.length)}/${apps.length} apps`);
    }

    log(`Inserted/updated ${appsInserted} apps in app_catalog`);
  }

  // Embed all apps in DB — paginate to avoid Supabase's 1000-row default cap
  log("Embedding app catalog into vector index...");
  const supabaseEmbed = getSupabase();
  const PAGE = 1000;
  let offset = 0;
  const appsWithText: any[] = [];
  while (true) {
    const { data: page } = await supabaseEmbed
      .from("app_catalog")
      .select("*")
      .not("embedding_text", "is", null)
      .range(offset, offset + PAGE - 1);
    if (!page || page.length === 0) break;
    appsWithText.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }

  await indexAppCatalog(
    appsWithText.map((a: any) => ({
      appKey: a.app_key,
      title: a.title,
      categories: a.categories,
      embeddingText: a.embedding_text,
    })),
  );

  log(`Embedded ${appsWithText.length} apps into vector index`);

  return { appsInserted, appsEmbedded: appsWithText.length };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEmbeddingText(
  title: string,
  categories: string[],
  actionDescriptions: string[],
): string {
  const parts = [title];
  if (categories.length > 0) {
    parts.push(`Categories: ${categories.join(", ")}`);
  }
  if (actionDescriptions.length > 0) {
    parts.push(`Actions: ${actionDescriptions.join(". ")}`);
  }
  return parts.join(". ");
}
