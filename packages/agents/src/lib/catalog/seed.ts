import { createZapierSdk } from "@zapier/zapier-sdk";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { indexAppCatalog } from "./index";

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
  const db = getDb();
  const log = verbose ? console.log.bind(console) : () => {};

  let appsInserted = 0;

  if (!embedOnly) {
    log("Fetching app catalog from Zapier SDK...");
    const sdk = createZapierSdk({});
    const maxItems = limit ?? 10000;
    const appsResult = await sdk.listApps({ maxItems });
    const apps = appsResult.data;
    log(`  Fetched ${apps.length} apps`);

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

        const embeddingText = buildEmbeddingText(
          app.title,
          categoryNames,
          actionDescriptions,
        );

        // Upsert into app_catalog
        const existing = await db
          .select()
          .from(schema.appCatalog)
          .where(eq(schema.appCatalog.appKey, app.key))
          .limit(1);

        const row = {
          appKey: app.key,
          slug: app.slug ?? app.key.toLowerCase(),
          title: app.title,
          categories: JSON.stringify(app.categories ?? []),
          authType: app.auth_type ?? null,
          actionCount,
          embeddingText,
          syncedAt: new Date(),
        };

        if (existing.length > 0) {
          await db
            .update(schema.appCatalog)
            .set(row)
            .where(eq(schema.appCatalog.appKey, app.key));
        } else {
          await db.insert(schema.appCatalog).values(row);
        }

        appsInserted++;
      }

      log(`  Processed ${Math.min(i + BATCH, apps.length)}/${apps.length} apps`);

      // Rate limit if fetching actions
      if (!appsOnly && i + BATCH < apps.length) {
        await sleep(500);
      }
    }

    log(`Inserted/updated ${appsInserted} apps in app_catalog`);
  }

  // Embed all apps in DB
  log("Embedding app catalog into vector index...");
  const allApps = await db.select().from(schema.appCatalog);
  const appsWithText = allApps.filter((a) => a.embeddingText);

  await indexAppCatalog(
    appsWithText.map((a) => ({
      appKey: a.appKey,
      title: a.title,
      categories: a.categories,
      embeddingText: a.embeddingText!,
    })),
  );

  log(`Embedded ${appsWithText.length} apps into vector index`);

  return { appsInserted, appsEmbedded: appsWithText.length };
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
