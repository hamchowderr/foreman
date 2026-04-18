import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * Load a proposal and verify the requesting user owns it
 * (via conversation.user_id).
 */
export async function loadOwnedProposal(proposalId: string, userId: string) {
  const db = getDb();

  const rows = await db
    .select({
      proposal: schema.actionProposal,
      conversationUserId: schema.conversation.userId,
    })
    .from(schema.actionProposal)
    .innerJoin(
      schema.conversation,
      eq(schema.actionProposal.conversationId, schema.conversation.id)
    )
    .where(eq(schema.actionProposal.id, proposalId))
    .limit(1);

  const row = rows[0];
  if (!row || row.conversationUserId !== userId) {
    return null;
  }

  return row.proposal;
}
