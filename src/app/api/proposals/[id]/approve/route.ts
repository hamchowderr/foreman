import { getSessionFromRequest } from "@/lib/api-auth";
import { loadOwnedProposal } from "@/lib/proposals";
import { getDb, schema } from "@/lib/db";
import { getMastra } from "@/mastra";
import { encodeSSE, sseHeaders } from "@/lib/stream/sse";
import type { AppChunk } from "@/lib/stream/types";
import { ZapierReauthRequired } from "@/lib/zapier";
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

  // Update status to approved
  await db
    .update(schema.actionProposal)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(schema.actionProposal.id, id));

  // Parse the mastraRunId which is stored as "runId:toolCallId"
  const [runId, toolCallId] = proposal.mastraRunId!.split(":");

  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        const inputs = JSON.parse(proposal.inputs);
        const result = await agent.approveToolCall({
          runId,
          toolCallId,
        });

        const reader = result.fullStream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = value as any;

          if (chunk.type === "tool-result" && chunk.payload?.toolName === "execute_action") {
            const toolResult = chunk.payload.result;
            const summary = `Executed ${proposal.appKey} ${proposal.actionKey}`;

            // Create action_run row
            const runRowId = crypto.randomUUID();
            await db.insert(schema.actionRun).values({
              id: runRowId,
              proposalId: id,
              result: JSON.stringify(toolResult),
              error: null,
              executedAt: new Date(),
            });

            // Update proposal status
            await db
              .update(schema.actionProposal)
              .set({ status: "executed", updatedAt: new Date() })
              .where(eq(schema.actionProposal.id, id));

            const appChunk: AppChunk = {
              type: "action-executed",
              proposalId: id,
              summary,
              result: toolResult,
            };
            controller.enqueue(encodeSSE(appChunk));
          } else if (chunk.type === "tool-error") {
            const error = chunk.payload?.error;
            const errorMsg = error instanceof Error ? error.message : String(error ?? "Unknown error");

            if (errorMsg.includes("ZAPIER_REAUTH_REQUIRED") || error instanceof ZapierReauthRequired) {
              await db
                .update(schema.actionProposal)
                .set({
                  status: "failed",
                  updatedAt: new Date(),
                })
                .where(eq(schema.actionProposal.id, id));

              controller.enqueue(
                encodeSSE({
                  type: "error",
                  code: "REAUTH_REQUIRED",
                  message: "Zapier re-authentication required",
                  proposalId: id,
                })
              );
            } else {
              await db
                .update(schema.actionProposal)
                .set({ status: "failed", updatedAt: new Date() })
                .where(eq(schema.actionProposal.id, id));

              controller.enqueue(
                encodeSSE({
                  type: "error",
                  code: "EXECUTION_ERROR",
                  message: errorMsg,
                  proposalId: id,
                })
              );
            }
          } else if (chunk.type === "text-delta") {
            controller.enqueue(
              encodeSSE({ type: "text-delta", text: chunk.payload?.text ?? "" })
            );
          } else if (chunk.type === "finish") {
            controller.enqueue(
              encodeSSE({ type: "done", runId })
            );
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (errorMsg.includes("ZAPIER_REAUTH_REQUIRED")) {
          await db
            .update(schema.actionProposal)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(schema.actionProposal.id, id));

          controller.enqueue(
            encodeSSE({
              type: "error",
              code: "REAUTH_REQUIRED",
              message: "Zapier re-authentication required",
              proposalId: id,
            })
          );
        } else {
          controller.enqueue(
            encodeSSE({
              type: "error",
              code: "EXECUTION_ERROR",
              message: errorMsg,
              proposalId: id,
            })
          );
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sseStream, { headers: sseHeaders() });
}
