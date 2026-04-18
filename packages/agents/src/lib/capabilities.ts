import { eq, and } from "drizzle-orm";
import { getDb, schema } from "./db";

/** Standard capability names used across the system. */
export const CAPABILITIES = [
  "search",
  "read",
  "write",
  "execute",
  "raw_api",
  "voice",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * Fetch all capability flags for a user.
 * Capabilities without a row default to `true` (all-on by default).
 */
export async function getCapabilities(
  userId: string
): Promise<Record<string, boolean>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.capabilityFlag)
    .where(eq(schema.capabilityFlag.userId, userId));

  // Start with all capabilities enabled by default
  const caps: Record<string, boolean> = {};
  for (const cap of CAPABILITIES) {
    caps[cap] = true;
  }

  // Override with DB values
  for (const row of rows) {
    caps[row.capability] = row.enabled;
  }

  return caps;
}

/**
 * Upsert a capability flag for a user.
 */
export async function setCapability(
  userId: string,
  capability: string,
  enabled: boolean
): Promise<void> {
  const db = getDb();

  // SQLite upsert via INSERT ... ON CONFLICT
  await db
    .insert(schema.capabilityFlag)
    .values({ userId, capability, enabled })
    .onConflictDoUpdate({
      target: [schema.capabilityFlag.userId, schema.capabilityFlag.capability],
      set: { enabled },
    });
}

/**
 * Check whether a specific capability is enabled for a user.
 * Returns `true` if no row exists (default-on).
 */
export async function checkCapability(
  userId: string,
  capability: string
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.capabilityFlag)
    .where(
      and(
        eq(schema.capabilityFlag.userId, userId),
        eq(schema.capabilityFlag.capability, capability)
      )
    )
    .limit(1);

  const flag = rows[0];
  // No row = enabled by default
  if (!flag) return true;
  return flag.enabled;
}
