import { getSessionFromRequest } from "@/lib/api-auth";
import { loadOwnedProposal } from "@/lib/proposals";
import { getInputFieldChoices } from "@/lib/zapier";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; fieldKey: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, fieldKey } = await params;
  const proposal = await loadOwnedProposal(id, session.user.id);
  if (!proposal) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const choices = await getInputFieldChoices(
    session.user.id,
    proposal.appKey,
    proposal.actionType,
    proposal.actionKey,
    fieldKey,
    proposal.connectionId ?? undefined
  );

  return Response.json({ choices });
}
