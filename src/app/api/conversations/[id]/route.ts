import { getSessionFromRequest } from "@/lib/api-auth";
import { getDb, schema } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, id),
        eq(schema.conversation.userId, session.user.id)
      )
    )
    .limit(1);

  const conv = rows[0];
  if (!conv) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(schema.message)
    .where(eq(schema.message.conversationId, id))
    .orderBy(asc(schema.message.createdAt));

  return Response.json({
    conversation: {
      id: conv.id,
      mastra_thread_id: conv.mastraThreadId,
      title: conv.title,
      created_at: conv.createdAt.toISOString(),
      updated_at: conv.updatedAt.toISOString(),
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: JSON.parse(m.content),
      created_at: m.createdAt.toISOString(),
    })),
  });
}
