import { getSessionFromRequest } from "@/lib/api-auth";
import { loadOwnedProposal } from "@/lib/proposals";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const proposal = await loadOwnedProposal(id, session.user.id);
  if (!proposal) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (proposal.status !== "pending") {
    return Response.json(
      { error: "Can only edit pending proposals" },
      { status: 409 }
    );
  }

  const body = await request.json();
  if (!body.inputs || typeof body.inputs !== "object") {
    return Response.json(
      { error: "inputs object is required" },
      { status: 400 }
    );
  }

  const db = getDb();
  await db
    .update(schema.actionProposal)
    .set({
      inputs: JSON.stringify(body.inputs),
      updatedAt: new Date(),
    })
    .where(eq(schema.actionProposal.id, id));

  return Response.json({ id, inputs: body.inputs, status: "pending" });
}
