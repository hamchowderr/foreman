import { requireSession } from "@/lib/api-auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  let session;
  try {
    session = await requireSession(request);
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const db = getDb();

  await db
    .delete(schema.zapierIdentity)
    .where(eq(schema.zapierIdentity.userId, session.user.id));

  return new Response(null, { status: 204 });
}
