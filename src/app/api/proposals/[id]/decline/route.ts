import { getSessionFromRequest } from "@/lib/api-auth";
import { loadOwnedProposal } from "@/lib/proposals";
import { getDb, schema } from "@/lib/db";
import { getMastra } from "@/mastra";
import { encodeSSE, sseHeaders } from "@/lib/stream/sse";
import type { AppChunk } from "@/lib/stream/types";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
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
      { error: "Proposal is not pending" },
      { status: 409 }
    );
  }

  const db = getDb();

  // Update status to declined
  await db
    .update(schema.actionProposal)
    .set({ status: "declined", updatedAt: new Date() })
    .where(eq(schema.actionProposal.id, id));

  // Parse the mastraRunId
  const [runId, toolCallId] = proposal.mastraRunId!.split(":");

  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        const result = await agent.declineToolCall({
          runId,
          toolCallId,
        });

        const reader = result.fullStream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = value as any;

          if (chunk.type === "text-delta") {
            controller.enqueue(
              encodeSSE({ type: "text-delta", text: chunk.payload?.text ?? "" })
            );
          } else if (chunk.type === "finish") {
            controller.enqueue(encodeSSE({ type: "done", runId }));
          }
        }
      } catch (err) {
        controller.enqueue(
          encodeSSE({
            type: "error",
            code: "DECLINE_ERROR",
            message: err instanceof Error ? err.message : String(err),
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sseStream, { headers: sseHeaders() });
}
