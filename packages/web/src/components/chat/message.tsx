"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useEffect } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { MessageContent, MessageResponse } from "../ai-elements/message";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "../ai-elements/tool";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageActions } from "./message-actions";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { Weather } from "./weather";

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
  <div className="flex items-center justify-end gap-1.5 border-t border-[#C8C8CA]/60 px-3 py-2.5 dark:border-[#3A3A3C]">
    <button
      className="rounded-full px-3 py-1 text-[13px] text-[#FF3B30] transition-colors hover:bg-[#FF3B30]/10"
      onClick={() => {
        addToolApprovalResponse({
          id: approvalId,
          approved: false,
          reason: "User denied this action",
        });
      }}
      type="button"
    >
      Deny
    </button>
    <button
      className="rounded-full px-3 py-1 text-[13px] text-[#8E8E93] transition-colors hover:bg-black/5 dark:hover:bg-white/10"
      onClick={() => {
        addAlwaysAllowedTool(toolName);
        addToolApprovalResponse({ id: approvalId, approved: true });
      }}
      type="button"
    >
      Always Allow
    </button>
    <button
      className="rounded-full bg-[#007AFF] px-3 py-1 text-[13px] text-white transition-colors hover:bg-[#0A84FF] dark:bg-[#0A84FF]"
      onClick={() => {
        addToolApprovalResponse({ id: approvalId, approved: true });
      }}
      type="button"
    >
      Allow
    </button>
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
              ? "w-fit max-w-[min(75%,52ch)] overflow-hidden break-words rounded-[18px] rounded-br-[4px] bg-[#007AFF] px-4 py-2.5 text-white dark:bg-[#0A84FF]"
              : "w-fit max-w-full overflow-hidden break-words rounded-[18px] rounded-bl-[4px] bg-[#E9E9EB] px-4 py-2.5 text-[#1C1C1E] dark:bg-[#2C2C2E] dark:text-[#F2F2F7]",
          )}
          data-testid="message-content"
          key={key}
        >
          <MessageResponse>{sanitizeText(part.text)}</MessageResponse>
        </MessageContent>
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
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error creating document: {String(part.output.error)}
          </div>
        );
      }

      return <DocumentPreview isReadonly={isReadonly} key={toolCallId} result={part.output} />;
    }

    if (type === "tool-updateDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error updating document: {String(part.output.error)}
          </div>
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
    <div className="flex w-fit items-center gap-1 rounded-[18px] rounded-bl-[4px] bg-[#E9E9EB] px-4 py-3 dark:bg-[#2C2C2E]">
      <span className="typing-dot size-2 rounded-full bg-[#8E8E93]" />
      <span className="typing-dot size-2 rounded-full bg-[#8E8E93]" />
      <span className="typing-dot size-2 rounded-full bg-[#8E8E93]" />
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
      <div
        className={cn(
          isUser ? "flex flex-col items-end gap-1.5" : "flex flex-col items-start gap-1.5",
        )}
      >
        {isAssistant ? (
          <div className="flex min-w-0 max-w-[80%] flex-col gap-1.5">{content}</div>
        ) : (
          content
        )}
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
      <div className="flex flex-col items-start">
        <div className="flex w-fit items-center gap-1 rounded-[18px] rounded-bl-[4px] bg-[#E9E9EB] px-4 py-3 dark:bg-[#2C2C2E]">
          <span className="typing-dot size-2 rounded-full bg-[#8E8E93]" />
          <span className="typing-dot size-2 rounded-full bg-[#8E8E93]" />
          <span className="typing-dot size-2 rounded-full bg-[#8E8E93]" />
        </div>
      </div>
    </div>
  );
};
