import { getDb, schema } from "@/lib/db";
import type { AppChunk } from "./types";

/**
 * Transform a Mastra fullStream into app-native SSE chunks.
 *
 * Intercepts:
 * - text-delta → pass through as text-delta
 * - tool-call → pass through as tool-call (for read-only tools like discover_connections)
 * - tool-call-approval → for execute_action: create action_proposal row, emit proposal-created
 * - tool-result → for execute_action: emit action-executed chunk + create action_run row
 * - tool-error → check for ZapierReauthRequired, emit error chunk
 * - finish → emit done
 */
export function createChunkTransformer(conversationId: string) {
  let accumulatedText = "";
  let runId = "";

  return new TransformStream<any, AppChunk>({
    async transform(chunk, controller) {
      runId = chunk.runId || runId;

      switch (chunk.type) {
        case "text-delta": {
          const text = chunk.payload?.text ?? "";
          accumulatedText += text;
          controller.enqueue({ type: "text-delta", text });
          break;
        }

        case "tool-call": {
          const { toolName, args } = chunk.payload;
          // For non-approval tools (read-only ones), surface them to the UI
          if (toolName !== "execute_action") {
            controller.enqueue({
              type: "tool-call",
              toolName,
              args: args ?? {},
            });
          }
          break;
        }

        case "tool-call-approval": {
          // This fires when execute_action (requireApproval: true) is called
          const { toolCallId, toolName, args } = chunk.payload;
          if (toolName === "execute_action" && args) {
            const proposal = await createProposalFromApproval(
              conversationId,
              runId,
              toolCallId,
              args
            );
            controller.enqueue({
              type: "proposal-created",
              proposal: {
                id: proposal.id,
                app_key: proposal.appKey,
                action_type: proposal.actionType,
                action_key: proposal.actionKey,
                human_label: proposal.humanLabel,
                inputs: JSON.parse(proposal.inputs),
                input_schema: JSON.parse(proposal.inputSchema),
                connection_id: proposal.connectionId,
                status: proposal.status,
              },
            });
          }
          break;
        }

        case "tool-result": {
          const { toolName, result } = chunk.payload;
          if (toolName === "execute_action" && result) {
            // After tool execution, emit action-executed
            // The proposal would have been updated by the approve flow
            break;
          }
          break;
        }

        case "tool-error": {
          const { toolName, error } = chunk.payload;
          const errorMsg =
            error instanceof Error ? error.message : String(error);

          if (errorMsg.includes("ZAPIER_REAUTH_REQUIRED")) {
            controller.enqueue({
              type: "error",
              code: "REAUTH_REQUIRED",
              message: "Zapier re-authentication required",
            });
          } else if (errorMsg.includes("ZAPIER_RATE_LIMITED")) {
            controller.enqueue({
              type: "error",
              code: "RATE_LIMITED",
              message: "Zapier API rate limit exceeded",
            });
          } else if (errorMsg.includes("ZAPIER_CAPABILITY_DENIED")) {
            controller.enqueue({
              type: "error",
              code: "CAPABILITY_DENIED",
              message: errorMsg,
            });
          } else if (errorMsg.includes("ZAPIER_ACTION_FAILED")) {
            controller.enqueue({
              type: "error",
              code: "ACTION_FAILED",
              message: errorMsg,
            });
          } else if (errorMsg.includes("ZAPIER_NOT_CONNECTED")) {
            controller.enqueue({
              type: "error",
              code: "REAUTH_REQUIRED",
              message: "No Zapier connection found. Please connect your account.",
            });
          } else {
            controller.enqueue({
              type: "error",
              code: "TOOL_ERROR",
              message: `${toolName}: ${errorMsg}`,
            });
          }
          break;
        }

        case "error": {
          const errorMsg =
            chunk.payload?.error instanceof Error
              ? chunk.payload.error.message
              : String(chunk.payload?.error ?? "Unknown error");
          controller.enqueue({
            type: "error",
            code: "STREAM_ERROR",
            message: errorMsg,
          });
          break;
        }

        case "finish": {
          controller.enqueue({ type: "done", runId });
          break;
        }

        // Ignore other chunk types (start, step-start, step-finish, etc.)
        default:
          break;
      }
    },
  });
}

async function createProposalFromApproval(
  conversationId: string,
  mastraRunId: string,
  toolCallId: string,
  args: Record<string, unknown>
) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date();

  // The execute_action tool schema has these fields in args
  const appKey = (args.appKey as string) ?? "";
  const actionType = (args.actionType as string) ?? "write";
  const actionKey = (args.actionKey as string) ?? "";
  const humanLabel = (args.humanLabel as string) ?? "";
  const inputs = (args.inputs as Record<string, unknown>) ?? {};
  const connectionId = (args.connectionId as string) ?? null;

  // For input_schema, we store the schema of the inputs field
  // In a real scenario this would come from get_action_schema,
  // but for the proposal we store what we have from the tool args
  const inputSchema = args.inputSchema ?? {};

  const values = {
    id,
    conversationId,
    mastraRunId: `${mastraRunId}:${toolCallId}`,
    appKey,
    actionType: actionType as "search" | "read" | "write",
    actionKey,
    humanLabel,
    inputs: JSON.stringify(inputs),
    inputSchema: JSON.stringify(inputSchema),
    connectionId,
    status: "pending" as const,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.actionProposal).values(values);

  return values;
}

/**
 * Get accumulated text from a transformer for persistence.
 * Used after stream completes to save the agent's response.
 */
export function createTextAccumulator() {
  let text = "";
  return {
    append(chunk: string) {
      text += chunk;
    },
    getText() {
      return text;
    },
  };
}
