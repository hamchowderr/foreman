import { getSupabase } from "../db";

export async function loadUserConnectionsMap(
  userId: string,
): Promise<Record<string, { connectionId: number }>> {
  const supabase = getSupabase();
  const { data: rows } = await supabase
    .from("connection_alias")
    .select("alias, connection_id")
    .eq("user_id", userId);

  const map: Record<string, { connectionId: number }> = {};
  for (const row of rows ?? []) {
    map[row.alias] = { connectionId: row.connection_id };
  }
  return map;
}

export async function resolveConnection(
  userId: string,
  connection: string | undefined,
): Promise<string | undefined> {
  if (!connection) return undefined;
  if (/^\d+$/.test(connection)) return connection;

  const supabase = getSupabase();
  const { data } = await supabase
    .from("connection_alias")
    .select("connection_id")
    .eq("user_id", userId)
    .eq("alias", connection)
    .limit(1)
    .single();

  if (!data) {
    throw new Error(
      `Unknown connection alias "${connection}" for user ${userId}. Register it in connection_alias.`,
    );
  }

  return String(data.connection_id);
}
