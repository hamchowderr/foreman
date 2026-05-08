import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db";

/**
 * Load all connection aliases for a user as a map suitable for
 * the Zapier SDK's manifest.connections option.
 *
 * Returns e.g. { sheets: { connectionId: 12345 }, slack: { connectionId: 67890 } }
 */
export async function loadUserConnectionsMap(
  userId: string
): Promise<Record<string, { connectionId: number }>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.connectionAlias)
    .where(eq(schema.connectionAlias.userId, userId));

  const map: Record<string, { connectionId: number }> = {};
  for (const row of rows) {
    map[row.alias] = { connectionId: row.connectionId };
  }
  return map;
}

/**
 * Resolve a connection reference to a numeric ID the Zapier SDK can use.
 *
 * Accepts:
 *   - numeric string (e.g. "12345")   → returned as-is
 *   - alias (e.g. "slack_work")       → looked up in connection_alias for this user
 *   - undefined                       → undefined (caller may auto-discover)
 *
 * Returns the resolved string (numeric or unchanged) or undefined.
 * Throws if an alias is given but not registered for the user.
 */
export async function resolveConnection(
  userId: string,
  connection: string | undefined
): Promise<string | undefined> {
  if (!connection) return undefined;
  if (/^\d+$/.test(connection)) return connection;

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.connectionAlias)
    .where(
      and(
        eq(schema.connectionAlias.userId, userId),
        eq(schema.connectionAlias.alias, connection)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(
      `Unknown connection alias "${connection}" for user ${userId}. Register it in connection_alias.`
    );
  }

  return String(row.connectionId);
}
