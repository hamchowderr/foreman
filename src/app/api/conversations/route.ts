import { getSessionFromRequest } from "@/lib/api-auth";
import { getDb, schema } from "@/lib/db";
import { getMastra } from "@/mastra";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const db = getDb();
  const mastra = getMastra();

  // Create a Mastra thread for memory
  const memory = await mastra.getAgent("foreman").getMemory();
  const thread = await memory!.createThread({
    resourceId: userId,
  });

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.conversation).values({
    id,
    userId,
    mastraThreadId: thread.id,
    title: null,
    createdAt: now,
    updatedAt: now,
  });

  return Response.json(
    {
      id,
      mastra_thread_id: thread.id,
      title: null,
      created_at: now.toISOString(),
    },
    { status: 201 }
  );
}

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const conversations = await db
    .select()
    .from(schema.conversation)
    .where(eq(schema.conversation.userId, session.user.id))
    .orderBy(desc(schema.conversation.updatedAt));

  return Response.json(
    conversations.map((c) => ({
      id: c.id,
      mastra_thread_id: c.mastraThreadId,
      title: c.title,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
    }))
  );
}
