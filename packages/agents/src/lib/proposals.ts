import { getSupabase } from "./db";

export async function loadOwnedProposal(proposalId: string, userId: string) {
  const supabase = getSupabase();

  const { data } = await supabase
    .from("action_proposal")
    .select("*, conversation!inner(user_id)")
    .eq("id", proposalId)
    .limit(1)
    .single();

  if (!data || (data.conversation as any).user_id !== userId) {
    return null;
  }

  // Return proposal fields without the joined conversation
  const { conversation: _conv, ...proposal } = data as any;
  return proposal;
}
