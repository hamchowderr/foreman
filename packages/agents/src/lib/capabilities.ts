import { getSupabase } from "./db";

export const CAPABILITIES = ["search", "read", "write", "execute", "raw_api", "voice"] as const;

export type Capability = (typeof CAPABILITIES)[number];

export async function getCapabilities(userId: string): Promise<Record<string, boolean>> {
  const supabase = getSupabase();
  const { data: rows } = await supabase
    .from("capability_flag")
    .select("capability, enabled")
    .eq("user_id", userId);

  const caps: Record<string, boolean> = {};
  for (const cap of CAPABILITIES) {
    caps[cap] = true;
  }
  for (const row of rows ?? []) {
    caps[row.capability] = row.enabled;
  }
  return caps;
}

export async function setCapability(
  userId: string,
  capability: string,
  enabled: boolean,
): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("capability_flag")
    .upsert({ user_id: userId, capability, enabled }, { onConflict: "user_id,capability" });
}

export async function checkCapability(userId: string, capability: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("capability_flag")
    .select("enabled")
    .eq("user_id", userId)
    .eq("capability", capability)
    .limit(1)
    .single();

  if (!data) return true; // no row = enabled by default
  return data.enabled;
}
