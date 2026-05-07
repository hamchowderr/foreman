/**
 * Convert a Zapier implementation name to its canonical slug form.
 *
 * The Zapier SDK historically used CamelCase implementation names
 * (e.g. "GoogleSheetsV2CLIAPI") rather than the display slugs
 * ("google-sheets"). This function normalizes either form to the slug.
 */
export function normalizeAppKey(key: string): string {
  // Already a valid slug (lowercase alphanumerics + dashes)
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key)) return key;

  return (
    key
      // Strip trailing CLIAPI / API suffix
      .replace(/(?:CLI)?API$/i, "")
      // Strip trailing version (V2, V3, ...)
      .replace(/V\d+$/i, "")
      // Insert dash between lower→Upper and Upper+Lower boundaries
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
      .toLowerCase()
      // Collapse stray dashes
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  );
}
