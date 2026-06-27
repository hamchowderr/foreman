"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { Bot, Check, User } from "lucide-react";
import { useEffect } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { MessageContent, MessageResponse } from "../ai-elements/message";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "../ai-elements/tool";
import { DashboardRenderer } from "../dashboard/dashboard-renderer";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageActions } from "./message-actions";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { PreviewInlineChip } from "./preview-panel";
import { Weather } from "./weather";

const MessageAvatar = ({ isUser }: { isUser: boolean }) => (
  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
    {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
  </div>
);

function getAlwaysAllowedTools(): Set<string> {
  try {
    const stored = localStorage.getItem("foreman:always-allow-tools");
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function addAlwaysAllowedTool(toolName: string) {
  try {
    const tools = getAlwaysAllowedTools();
    tools.add(toolName);
    localStorage.setItem("foreman:always-allow-tools", JSON.stringify([...tools]));
  } catch {}
}

const ApprovalButtons = ({
  approvalId,
  toolName,
  addToolApprovalResponse,
}: {
  approvalId: string;
  toolName: string;
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
}) => (
  <div className="flex items-center gap-2 border-t border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
    <span className="flex-1 text-[12px] text-muted-foreground">
      This action needs your approval before it runs.
    </span>
    <Button
      onClick={() => {
        addToolApprovalResponse({
          id: approvalId,
          approved: false,
          reason: "User denied this action",
        });
      }}
      size="sm"
      type="button"
      variant="destructive"
    >
      Decline
    </Button>
    <Button
      onClick={() => {
        addAlwaysAllowedTool(toolName);
        addToolApprovalResponse({ id: approvalId, approved: true });
      }}
      size="sm"
      type="button"
      variant="ghost"
    >
      Always Allow
    </Button>
    <Button
      onClick={() => {
        addToolApprovalResponse({ id: approvalId, approved: true });
      }}
      size="sm"
      type="button"
      variant="default"
    >
      Approve
    </Button>
  </div>
);

const GenericToolCard = ({
  part,
  toolName,
  addToolApprovalResponse,
}: {
  part: any;
  toolName: string;
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
}) => {
  const { state } = part;
  const approvalId = (part as { approval?: { id: string } }).approval?.id;
  const isDenied =
    state === "output-denied" ||
    (state === "approval-responded" &&
      (part as { approval?: { approved?: boolean } }).approval?.approved === false);

  useEffect(() => {
    if (state === "approval-requested" && approvalId) {
      if (getAlwaysAllowedTools().has(toolName)) {
        addToolApprovalResponse({ id: approvalId, approved: true });
      }
    }
  }, [state, approvalId, toolName, addToolApprovalResponse]);

  const needsApproval = state === "approval-requested" && !!approvalId;

  return (
    <div className="w-[min(100%,500px)]">
      <Tool className="w-full" defaultOpen={needsApproval}>
        <ToolHeader state={state} toolName={toolName} type="dynamic-tool" />
        <ToolContent>
          {(state === "input-available" ||
            state === "input-streaming" ||
            state === "approval-requested" ||
            state === "approval-responded") &&
            part.input && <ToolInput input={part.input} />}
          {state === "output-available" && (
            <ToolOutput errorText={part.errorText} output={part.output} />
          )}
          {state === "output-error" && (
            <ToolOutput
              errorText={part.errorText ?? "Tool execution failed"}
              output={part.output}
            />
          )}
          {isDenied && (
            <div className="px-4 py-3 text-sm text-muted-foreground">Action was denied.</div>
          )}
        </ToolContent>
        {needsApproval && (
          <ApprovalButtons
            addToolApprovalResponse={addToolApprovalResponse}
            approvalId={approvalId}
            toolName={toolName}
          />
        )}
      </Tool>
    </div>
  );
};

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  message,
  vote,
  isLoading,
  setMessages: _setMessages,
  regenerate: _regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
  onEdit,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  onEdit?: (message: ChatMessage) => void;
}) => {
  const attachmentsFromMessage = message.parts.filter((part) => part.type === "file");

  useDataStream();

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const hasAnyContent = message.parts?.some(
    (part) =>
      (part.type === "text" && part.text?.trim().length > 0) ||
      (part.type === "reasoning" && "text" in part && part.text?.trim().length > 0) ||
      part.type.startsWith("tool-"),
  );
  const isThinking = isAssistant && isLoading && !hasAnyContent;

  const attachments = attachmentsFromMessage.length > 0 && (
    <div className="flex flex-row justify-end gap-2" data-testid={"message-attachments"}>
      {attachmentsFromMessage.map((attachment) => (
        <PreviewAttachment
          attachment={{
            name: attachment.filename ?? "file",
            contentType: attachment.mediaType,
            url: attachment.url,
          }}
          key={attachment.url}
        />
      ))}
    </div>
  );

  const mergedReasoning = message.parts?.reduce(
    (acc, part) => {
      if (part.type === "reasoning" && part.text?.trim().length > 0) {
        return {
          text: acc.text ? `${acc.text}\n\n${part.text}` : part.text,
          isStreaming: "state" in part ? part.state === "streaming" : false,
          rendered: false,
        };
      }
      return acc;
    },
    { text: "", isStreaming: false, rendered: false },
  ) ?? { text: "", isStreaming: false, rendered: false };

  const parts = message.parts?.map((part: any, index: number) => {
    const { type } = part;
    const key = `message-${message.id}-part-${index}`;

    if (type === "reasoning") {
      if (!mergedReasoning.rendered && mergedReasoning.text) {
        mergedReasoning.rendered = true;
        return (
          <MessageReasoning
            isLoading={isLoading || mergedReasoning.isStreaming}
            key={key}
            reasoning={mergedReasoning.text}
          />
        );
      }
      return null;
    }

    if (type === "text") {
      const isUserMsg = message.role === "user";
      return (
        <MessageContent
          className={cn(
            "text-[15px] leading-[1.5]",
            isUserMsg
              ? "w-fit max-w-[min(85%,60ch)] overflow-hidden break-words rounded-lg bg-primary px-4 py-2.5 text-primary-foreground"
              : "w-full max-w-full overflow-hidden break-words text-foreground",
          )}
          data-testid="message-content"
          key={key}
        >
          <MessageResponse>{sanitizeText(part.text)}</MessageResponse>
        </MessageContent>
      );
    }

    if (type === "data-preview-progress") {
      const d = (part.data ?? {}) as { stage?: string; label?: string };
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm" key={key}>
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Check className="size-3" />
          </span>
          <span>{d.label ?? "Working…"}</span>
        </div>
      );
    }

    if (type === "tool-create_dashboard") {
      const { toolCallId, state } = part;

      if (state === "output-available" && part.output && !("error" in part.output)) {
        const out = part.output as {
          title: string;
          url: string;
          rowCount: number;
          spec: Parameters<typeof DashboardRenderer>[0]["spec"];
          records: Parameters<typeof DashboardRenderer>[0]["data"];
        };
        return (
          <div className="w-full max-w-full" key={toolCallId}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">{out.title}</span>
              <a
                className="shrink-0 text-xs font-medium hover:underline"
                href={out.url}
                rel="noreferrer"
                style={{ color: "#FF4F00" }}
                target="_blank"
              >
                Open full →
              </a>
            </div>
            <DashboardRenderer data={out.records} spec={out.spec} />
          </div>
        );
      }

      if (state === "output-error" || (part.output && "error" in part.output)) {
        return (
          <Alert key={toolCallId} variant="destructive">
            <AlertDescription>
              Couldn't build dashboard:{" "}
              {String(
                part.errorText ?? (part.output as { error?: unknown })?.error ?? "unknown error",
              )}
            </AlertDescription>
          </Alert>
        );
      }

      return (
        <div className="text-muted-foreground text-sm" key={toolCallId}>
          Building dashboard…
        </div>
      );
    }

    if (type === "tool-preview_app") {
      const { toolCallId, state } = part;

      if (state === "output-available" && part.output && !("error" in part.output)) {
        const out = part.output as {
          url: string;
          title?: string;
          source?: string;
          log?: string;
          ok?: boolean;
        };
        // Render in the side panel (auto-opened by the chip); the chat keeps a
        // compact re-open chip instead of an inline iframe.
        return (
          <div className="w-full max-w-full" key={toolCallId}>
            <PreviewInlineChip
              log={out.log}
              source={out.source}
              title={out.title ?? "Preview"}
              url={out.url}
            />
          </div>
        );
      }

      if (state === "output-error" || (part.output && "error" in part.output)) {
        return (
          <Alert key={toolCallId} variant="destructive">
            <AlertDescription>
              Couldn't build the live preview:{" "}
              {String(
                part.errorText ?? (part.output as { error?: unknown })?.error ?? "unknown error",
              )}
            </AlertDescription>
          </Alert>
        );
      }

      return (
        <div className="text-muted-foreground text-sm" key={toolCallId}>
          Building live preview…
        </div>
      );
    }

    if (type === "tool-getWeather") {
      const { toolCallId, state } = part;
      const approvalId = (part as { approval?: { id: string } }).approval?.id;
      const isDenied =
        state === "output-denied" ||
        (state === "approval-responded" &&
          (part as { approval?: { approved?: boolean } }).approval?.approved === false);
      const widthClass = "w-[min(100%,450px)]";

      if (state === "output-available") {
        return (
          <div className={widthClass} key={toolCallId}>
            <Weather weatherAtLocation={part.output} />
          </div>
        );
      }

      if (isDenied) {
        return (
          <div className={widthClass} key={toolCallId}>
            <Tool className="w-full" defaultOpen={true}>
              <ToolHeader state="output-denied" type="tool-getWeather" />
              <ToolContent>
                <div className="px-4 py-3 text-muted-foreground text-sm">
                  Weather lookup was denied.
                </div>
              </ToolContent>
            </Tool>
          </div>
        );
      }

      if (state === "approval-responded") {
        return (
          <div className={widthClass} key={toolCallId}>
            <Tool className="w-full" defaultOpen={true}>
              <ToolHeader state={state} type="tool-getWeather" />
              <ToolContent>
                <ToolInput input={part.input} />
              </ToolContent>
            </Tool>
          </div>
        );
      }

      return (
        <div className={widthClass} key={toolCallId}>
          <Tool className="w-full" defaultOpen={true}>
            <ToolHeader state={state} type="tool-getWeather" />
            <ToolContent>
              {(state === "input-available" || state === "approval-requested") && (
                <ToolInput input={part.input} />
              )}
            </ToolContent>
            {state === "approval-requested" && approvalId && (
              <ApprovalButtons
                addToolApprovalResponse={addToolApprovalResponse}
                approvalId={approvalId}
                toolName="getWeather"
              />
            )}
          </Tool>
        </div>
      );
    }

    if (type === "tool-createDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <Alert key={toolCallId} variant="destructive">
            <AlertDescription>
              Error creating document: {String(part.output.error)}
            </AlertDescription>
          </Alert>
        );
      }

      return <DocumentPreview isReadonly={isReadonly} key={toolCallId} result={part.output} />;
    }

    if (type === "tool-updateDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <Alert key={toolCallId} variant="destructive">
            <AlertDescription>
              Error updating document: {String(part.output.error)}
            </AlertDescription>
          </Alert>
        );
      }

      return (
        <div className="relative" key={toolCallId}>
          <DocumentPreview
            args={{ ...part.output, isUpdate: true }}
            isReadonly={isReadonly}
            result={part.output}
          />
        </div>
      );
    }

    if (type === "tool-requestSuggestions") {
      const { toolCallId, state } = part;

      return (
        <Tool className="w-[min(100%,450px)]" defaultOpen={true} key={toolCallId}>
          <ToolHeader state={state} type="tool-requestSuggestions" />
          <ToolContent>
            {state === "input-available" && <ToolInput input={part.input} />}
            {state === "output-available" && (
              <ToolOutput
                errorText={undefined}
                output={
                  "error" in part.output ? (
                    <div className="rounded border p-2 text-red-500">
                      Error: {String(part.output.error)}
                    </div>
                  ) : (
                    <DocumentToolResult
                      isReadonly={isReadonly}
                      result={part.output}
                      type="request-suggestions"
                    />
                  )
                }
              />
            )}
          </ToolContent>
        </Tool>
      );
    }

    // Generic handler for all other tool types (Zapier SDK tools, etc.)
    if (type.startsWith("tool-")) {
      const toolName = type.replace(/^tool-/, "");

      // Internal memory tools — not meaningful to show users
      if (toolName === "updateWorkingMemory" || toolName === "recall") {
        return null;
      }

      return (
        <GenericToolCard
          addToolApprovalResponse={addToolApprovalResponse}
          key={part.toolCallId ?? key}
          part={part}
          toolName={toolName}
        />
      );
    }

    return null;
  });

  const actions = !isReadonly && (
    <MessageActions
      chatId={chatId}
      isLoading={isLoading}
      key={`action-${message.id}`}
      message={message}
      onEdit={onEdit ? () => onEdit(message) : undefined}
      vote={vote}
    />
  );

  const content = isThinking ? (
    <div className="flex items-center gap-1 py-1.5">
      <span className="typing-dot size-2 rounded-full bg-muted-foreground" />
      <span className="typing-dot size-2 rounded-full bg-muted-foreground" />
      <span className="typing-dot size-2 rounded-full bg-muted-foreground" />
    </div>
  ) : (
    <>
      {attachments}
      {parts}
      {actions}
    </>
  );

  return (
    <div
      className={cn(
        "group/message w-full",
        !isAssistant && "animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]",
      )}
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div className={cn("flex items-start gap-2.5", isUser && "flex-row-reverse")}>
        <MessageAvatar isUser={isUser} />
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-1.5",
            isUser ? "items-end" : "items-start",
          )}
        >
          {content}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message w-full"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start gap-2.5">
        <MessageAvatar isUser={false} />
        <div className="flex items-center gap-1 py-1.5">
          <span className="typing-dot size-2 rounded-full bg-muted-foreground" />
          <span className="typing-dot size-2 rounded-full bg-muted-foreground" />
          <span className="typing-dot size-2 rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  );
};
