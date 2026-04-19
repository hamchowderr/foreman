import { Hono } from "hono";
import { getDb, schema } from "@/lib/db";
import { getMastra } from "@/mastra";
import { loadOwnedProposal } from "@/lib/proposals";
import { encodeSSE, sseHeaders } from "@/lib/stream/sse";
import type { AppChunk } from "@/lib/stream/types";
import { getInputFieldChoices, ZapierReauthRequired } from "@/lib/zapier";
import { eq } from "drizzle-orm";
import { indexActionRun } from "@/lib/rag";
import { validateParam } from "@/lib/validation";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

const proposals = new Hono<AppEnv>();

// All routes require auth
proposals.use("/*", authMiddleware);

// PATCH /:id — update proposal inputs
proposals.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid proposal id" }, 400);
  }

  const proposal = await loadOwnedProposal(id, userId);
  if (!proposal) {
    return c.json({ error: "Not found" }, 404);
  }

  if (proposal.status !== "pending") {
    return c.json({ error: "Can only edit pending proposals" }, 409);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.inputs || typeof body.inputs !== "object") {
    return c.json({ error: "inputs object is required" }, 400);
  }

  // Guard against excessively large input payloads
  const inputsStr = JSON.stringify(body.inputs);
  if (inputsStr.length > 50000) {
    return c.json({ error: "inputs payload too large (max 50KB)" }, 400);
  }

  const db = getDb();
  await db
    .update(schema.actionProposal)
    .set({
      inputs: JSON.stringify(body.inputs),
      updatedAt: new Date(),
    })
    .where(eq(schema.actionProposal.id, id));

  return c.json({ id, inputs: body.inputs, status: "pending" });
});

// POST /:id/approve — approve and execute (SSE stream)
proposals.post("/:id/approve", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid proposal id" }, 400);
  }

  const proposal = await loadOwnedProposal(id, userId);
  if (!proposal) {
    return c.json({ error: "Not found" }, 404);
  }

  if (proposal.status !== "pending") {
    return c.json({ error: "Proposal is not pending" }, 409);
  }

  const db = getDb();

  // Update status to approved
  await db
    .update(schema.actionProposal)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(schema.actionProposal.id, id));

  // Parse the mastraRunId which is stored as "runId:toolCallId"
  const [runId, toolCallId] = proposal.mastraRunId!.split(":");

  const mastra = await getMastra();
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

          if (
            chunk.type === "tool-result" &&
            chunk.payload?.toolName === "execute_action"
          ) {
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

            // Index the completed action for RAG (fire-and-forget)
            indexActionRun(
              {
                id: runRowId,
                proposalId: id,
                result: JSON.stringify(toolResult),
                executedAt: new Date(),
              },
              proposal,
              userId
            ).catch((err) =>
              console.error("[RAG] Failed to index action run:", err)
            );

            const appChunk: AppChunk = {
              type: "action-executed",
              proposalId: id,
              summary,
              result: toolResult,
            };
            controller.enqueue(encodeSSE(appChunk));
          } else if (chunk.type === "tool-error") {
            const error = chunk.payload?.error;
            const errorMsg =
              error instanceof Error
                ? error.message
                : String(error ?? "Unknown error");

            if (
              errorMsg.includes("ZAPIER_REAUTH_REQUIRED") ||
              error instanceof ZapierReauthRequired
            ) {
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
              encodeSSE({
                type: "text-delta",
                text: chunk.payload?.text ?? "",
              })
            );
          } else if (chunk.type === "finish") {
            controller.enqueue(encodeSSE({ type: "done", runId }));
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

  const headers = sseHeaders();
  return new Response(sseStream, { headers });
});

// POST /:id/decline — decline (SSE stream)
proposals.post("/:id/decline", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid proposal id" }, 400);
  }

  const proposal = await loadOwnedProposal(id, userId);
  if (!proposal) {
    return c.json({ error: "Not found" }, 404);
  }

  if (proposal.status !== "pending") {
    return c.json({ error: "Proposal is not pending" }, 409);
  }

  const db = getDb();

  // Update status to declined
  await db
    .update(schema.actionProposal)
    .set({ status: "declined", updatedAt: new Date() })
    .where(eq(schema.actionProposal.id, id));

  // Parse the mastraRunId
  const [runId, toolCallId] = proposal.mastraRunId!.split(":");

  const mastra = await getMastra();
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
              encodeSSE({
                type: "text-delta",
                text: chunk.payload?.text ?? "",
              })
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

  const headers = sseHeaders();
  return new Response(sseStream, { headers });
});

// GET /:id/field-choices/:fieldKey — get enum choices
proposals.get("/:id/field-choices/:fieldKey", async (c) => {
  const userId = c.get("userId");
  const id = validateParam(c.req.param("id"), "id");
  if (!id) {
    return c.json({ error: "Invalid proposal id" }, 400);
  }
  const fieldKey = validateParam(c.req.param("fieldKey"), "fieldKey");
  if (!fieldKey) {
    return c.json({ error: "Invalid field key" }, 400);
  }

  const proposal = await loadOwnedProposal(id, userId);
  if (!proposal) {
    return c.json({ error: "Not found" }, 404);
  }

  const choices = await getInputFieldChoices(
    userId,
    proposal.appKey,
    proposal.actionType,
    proposal.actionKey,
    fieldKey,
    proposal.connectionId ?? undefined
  );

  return c.json({ choices });
});

export default proposals;
