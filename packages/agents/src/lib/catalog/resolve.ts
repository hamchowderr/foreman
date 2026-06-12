import { getSupabase } from "../db";

/**
 * Resolve any Zapier app identifier to its canonical slug, using the
 * `app_catalog` table (seeded from `sdk.listApps`) as the source of truth.
 *
 * The catalog stores BOTH the Zapier `app_key` (e.g. "GitHubCLIAPI") and the
 * display `slug` (e.g. "github"), so it knows the correct mapping. This replaces
 * the string-munging `normalizeAppKey`, which can't reliably derive a slug from
 * a CamelCase implementation name: "GitHubCLIAPI" → "git-hub" is wrong (the real
 * slug is "github"), while "GoogleSheetsV2CLIAPI" → "google-sheets" needs the
 * dash. You can't tell those apart from the string alone — only the catalog can.
 * (foreman-c8fo)
 *
 * Accepts either form (app_key or slug, case-insensitive) and returns the slug.
 * If the app isn't in the catalog (e.g. an unseeded local DB), the key is
 * returned UNCHANGED — the Zapier SDK accepts both raw app_keys and slugs, so
 * passing the original through is safe; only the mangled form ever broke.
 */
export async function resolveAppSlug(key: string): Promise<string> {
  if (!key) return key;
  // App keys/slugs are simple identifiers; guard the PostgREST `or` filter.
  if (!/^[\w.-]+$/.test(key)) return key;

  try {
    const { data } = await getSupabase()
      .from("app_catalog")
      .select("slug")
      .or(`app_key.ilike.${key},slug.ilike.${key}`)
      .limit(1)
      .maybeSingle();
    if (data?.slug) return data.slug;
  } catch {
    // catalog unavailable / not seeded — fall through to pass-through
  }
  return key;
}
