import { Hono } from "hono";
import { getSupabase } from "../lib/db";
import { loadOwnedProposal } from "../lib/proposals";
import { indexActionRun } from "../lib/rag";
import { encodeSSE, sseHeaders } from "../lib/stream/sse";
import type { AppChunk } from "../lib/stream/types";
import { validateParam } from "../lib/validation";
import { getInputFieldChoices, ZapierReauthRequired } from "../lib/zapier";
import { getMastra } from "../mastra";
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

  const inputsStr = JSON.stringify(body.inputs);
  if (inputsStr.length > 50000) {
    return c.json({ error: "inputs payload too large (max 50KB)" }, 400);
  }

  const supabase = getSupabase();
  await supabase
    .from("action_proposal")
    .update({ inputs: JSON.stringify(body.inputs), updated_at: new Date().toISOString() })
    .eq("id", id);

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

  const supabase = getSupabase();

  await supabase
    .from("action_proposal")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", id);

  const [runId, toolCallId] = proposal.mastra_run_id!.split(":");

  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        const result = await agent.approveToolCall({ runId, toolCallId });
        const reader = result.fullStream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = value as any;

          if (chunk.type === "tool-result" && chunk.payload?.toolName === "execute_action") {
            const toolResult = chunk.payload.result;
            const summary = `Executed ${proposal.app_key} ${proposal.action_key}`;

            const runRowId = crypto.randomUUID();
            await supabase.from("action_run").insert({
              id: runRowId,
              proposal_id: id,
              result: JSON.stringify(toolResult),
              error: null,
              executed_at: new Date().toISOString(),
            });

            await supabase
              .from("action_proposal")
              .update({ status: "executed", updated_at: new Date().toISOString() })
              .eq("id", id);

            indexActionRun(
              {
                id: runRowId,
                proposalId: id,
                result: JSON.stringify(toolResult),
                executedAt: new Date(),
              },
              proposal,
              userId,
            ).catch((err) => console.error("[RAG] Failed to index action run:", err));

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
              error instanceof Error ? error.message : String(error ?? "Unknown error");

            if (
              errorMsg.includes("ZAPIER_REAUTH_REQUIRED") ||
              error instanceof ZapierReauthRequired
            ) {
              await supabase
                .from("action_proposal")
                .update({ status: "failed", updated_at: new Date().toISOString() })
                .eq("id", id);

              controller.enqueue(
                encodeSSE({
                  type: "error",
                  code: "REAUTH_REQUIRED",
                  message: "Zapier re-authentication required",
                  proposalId: id,
                }),
              );
            } else {
              await supabase
                .from("action_proposal")
                .update({ status: "failed", updated_at: new Date().toISOString() })
                .eq("id", id);

              controller.enqueue(
                encodeSSE({
                  type: "error",
                  code: "EXECUTION_ERROR",
                  message: errorMsg,
                  proposalId: id,
                }),
              );
            }
          } else if (chunk.type === "text-delta") {
            controller.enqueue(encodeSSE({ type: "text-delta", text: chunk.payload?.text ?? "" }));
          } else if (chunk.type === "finish") {
            controller.enqueue(encodeSSE({ type: "done", runId }));
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (errorMsg.includes("ZAPIER_REAUTH_REQUIRED")) {
          await supabase
            .from("action_proposal")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", id);

          controller.enqueue(
            encodeSSE({
              type: "error",
              code: "REAUTH_REQUIRED",
              message: "Zapier re-authentication required",
              proposalId: id,
            }),
          );
        } else {
          controller.enqueue(
            encodeSSE({
              type: "error",
              code: "EXECUTION_ERROR",
              message: errorMsg,
              proposalId: id,
            }),
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

  const supabase = getSupabase();

  await supabase
    .from("action_proposal")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", id);

  const [runId, toolCallId] = proposal.mastra_run_id!.split(":");

  const mastra = getMastra();
  const agent = mastra.getAgent("foreman");

  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        const result = await agent.declineToolCall({ runId, toolCallId });
        const reader = result.fullStream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = value as any;

          if (chunk.type === "text-delta") {
            controller.enqueue(encodeSSE({ type: "text-delta", text: chunk.payload?.text ?? "" }));
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
          }),
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
    proposal.app_key,
    proposal.action_type,
    proposal.action_key,
    fieldKey,
    proposal.connection_id ?? undefined,
  );

  return c.json({ choices });
});

export default proposals;
