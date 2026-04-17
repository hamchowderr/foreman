"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  streamMessage,
  streamApprove,
  streamDecline,
} from "@/lib/api-client";
import type { AppChunk } from "@/lib/stream/types";
import { ChatMessage, StreamingMessage } from "./chat-message";
import { ApprovalCard } from "./approval-card";
import { ActionResultCard } from "./action-result-card";
import { ReauthBanner } from "./reauth-banner";

interface Message {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
}

interface ProposalData {
  id: string;
  app_key: string;
  action_type: string;
  action_key: string;
  human_label: string;
  inputs: Record<string, unknown>;
  input_schema: Record<string, unknown>;
  connection_id: string | null;
  status: string;
}

interface ActionResult {
  proposalId: string;
  summary: string;
  result: unknown;
}

// Inline items can be messages, proposals, or results — ordered by insertion
type ChatItem =
  | { type: "message"; message: Message }
  | { type: "proposal"; proposal: ProposalData }
  | { type: "action-result"; result: ActionResult };

interface ChatPaneProps {
  conversationId: string;
  initialMessages: Message[];
  onTitleUpdate?: (conversationId: string, title: string) => void;
}

export function ChatPane({ conversationId, initialMessages, onTitleUpdate }: ChatPaneProps) {
  const [items, setItems] = useState<ChatItem[]>(() =>
    initialMessages.map((m) => ({ type: "message" as const, message: m }))
  );
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [reauthRequired, setReauthRequired] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, streamingText]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  const processChunks = useCallback(
    async (chunks: AsyncGenerator<AppChunk>) => {
      let accumulated = "";

      for await (const chunk of chunks) {
        switch (chunk.type) {
          case "text-delta":
            accumulated += chunk.text;
            setStreamingText(accumulated);
            break;

          case "proposal-created":
            // Flush accumulated text as agent message first
            if (accumulated) {
              setItems((prev) => [
                ...prev,
                {
                  type: "message",
                  message: {
                    id: crypto.randomUUID(),
                    role: "agent",
                    content: accumulated,
                  },
                },
              ]);
              accumulated = "";
              setStreamingText("");
            }
            setItems((prev) => [
              ...prev,
              { type: "proposal", proposal: chunk.proposal },
            ]);
            break;

          case "action-executed":
            setItems((prev) => [
              ...prev,
              {
                type: "action-result",
                result: {
                  proposalId: chunk.proposalId,
                  summary: chunk.summary,
                  result: chunk.result,
                },
              },
            ]);
            break;

          case "error": {
            if (chunk.code === "REAUTH_REQUIRED") {
              setReauthRequired(true);
            }
            const errorMessages: Record<string, string> = {
              REAUTH_REQUIRED:
                "Your Zapier connection needs to be re-authorized. Please reconnect above.",
              RATE_LIMITED:
                "Please wait — rate limited by Zapier. Try again in a moment.",
              CAPABILITY_DENIED:
                "This action is not enabled for your account.",
              STREAM_ERROR: "Connection error. Please try again.",
            };
            const errorText =
              chunk.code === "ACTION_FAILED"
                ? `Action failed — ${chunk.message}`
                : (errorMessages[chunk.code ?? ""] ?? chunk.message);
            setItems((prev) => [
              ...prev,
              {
                type: "message",
                message: {
                  id: crypto.randomUUID(),
                  role: "system",
                  content: `Error: ${errorText}`,
                },
              },
            ]);
            break;
          }

          case "title-updated":
            onTitleUpdate?.(conversationId, chunk.title);
            break;

          case "done":
            // Flush any remaining text
            if (accumulated) {
              setItems((prev) => [
                ...prev,
                {
                  type: "message",
                  message: {
                    id: crypto.randomUUID(),
                    role: "agent",
                    content: accumulated,
                  },
                },
              ]);
            }
            break;
        }
      }

      setStreamingText("");
    },
    [conversationId, onTitleUpdate]
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    // Add user message immediately
    setItems((prev) => [
      ...prev,
      {
        type: "message",
        message: {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
        },
      },
    ]);

    try {
      await processChunks(streamMessage(conversationId, text));
    } catch (err) {
      setItems((prev) => [
        ...prev,
        {
          type: "message",
          message: {
            id: crypto.randomUUID(),
            role: "system",
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, conversationId, processChunks]);

  const handleApprove = useCallback(
    async (proposalId: string) => {
      setIsStreaming(true);
      try {
        // Mark proposal as approved in UI
        setItems((prev) =>
          prev.map((item) =>
            item.type === "proposal" && item.proposal.id === proposalId
              ? {
                  ...item,
                  proposal: { ...item.proposal, status: "approved" },
                }
              : item
          )
        );
        await processChunks(streamApprove(proposalId));
      } finally {
        setIsStreaming(false);
      }
    },
    [processChunks]
  );

  const handleDecline = useCallback(
    async (proposalId: string) => {
      setIsStreaming(true);
      try {
        setItems((prev) =>
          prev.map((item) =>
            item.type === "proposal" && item.proposal.id === proposalId
              ? {
                  ...item,
                  proposal: { ...item.proposal, status: "declined" },
                }
              : item
          )
        );
        await processChunks(streamDecline(proposalId));
      } finally {
        setIsStreaming(false);
      }
    },
    [processChunks]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-col flex-1 h-full">
      {reauthRequired && (
        <ReauthBanner onDismiss={() => setReauthRequired(false)} />
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {items.length === 0 && (
          <div className="flex items-center justify-center h-full text-foreground/30 text-sm">
            Send a message to get started
          </div>
        )}

        {items.map((item, i) => {
          switch (item.type) {
            case "message":
              return (
                <ChatMessage
                  key={item.message.id}
                  role={item.message.role}
                  content={item.message.content}
                />
              );
            case "proposal":
              return (
                <ApprovalCard
                  key={item.proposal.id}
                  proposal={item.proposal}
                  onApprove={handleApprove}
                  onDecline={handleDecline}
                  disabled={
                    isStreaming || item.proposal.status !== "pending"
                  }
                />
              );
            case "action-result":
              return (
                <ActionResultCard
                  key={item.result.proposalId}
                  proposalId={item.result.proposalId}
                  summary={item.result.summary}
                  result={item.result.result}
                />
              );
          }
        })}

        <StreamingMessage text={streamingText} />
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[#e0e0e0] dark:border-[#222] p-4">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Foreman..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-[#ddd] dark:border-[#444] bg-transparent px-4 py-3 text-sm placeholder:text-foreground/30 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="px-4 py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
