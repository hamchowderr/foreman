"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { useCallback } from "react";
import { createClient } from "@/lib/client";
import { DefaultChatTransport } from "ai";
import { usePathname } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { getChatHistoryPaginationKey } from "@/components/chat/sidebar-history";
import { toast } from "@/components/chat/toast";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useDevConsole } from "@/hooks/use-dev-console";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { Vote } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";

type ActiveChatContextValue = {
  chatId: string;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  status: UseChatHelpers<ChatMessage>["status"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  visibilityType: VisibilityType;
  isReadonly: boolean;
  isLoading: boolean;
  votes: Vote[] | undefined;
  currentModelId: string;
  setCurrentModelId: (id: string) => void;
  showCreditCardAlert: boolean;
  setShowCreditCardAlert: Dispatch<SetStateAction<boolean>>;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();
  const { log } = useDevConsole();
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
    });
  }, []);
  const getToken = useCallback(async () => {
    const { data: { session } } = await createClient().auth.getSession();
    return session?.access_token ?? null;
  }, []);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const logRef = useRef(log);
  logRef.current = log;

  const chatIdFromUrl = extractChatId(pathname);
  const isNewChat = !chatIdFromUrl;
  const newChatIdRef = useRef(generateUUID());
  const prevPathnameRef = useRef(pathname);

  if (isNewChat && prevPathnameRef.current !== pathname) {
    newChatIdRef.current = generateUUID();
  }
  prevPathnameRef.current = pathname;

  const chatId = chatIdFromUrl ?? newChatIdRef.current;

  const [currentModelId, setCurrentModelId] = useState(DEFAULT_CHAT_MODEL);
  const currentModelIdRef = useRef(currentModelId);
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const [input, setInput] = useState("");
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);

  const { data: chatData, isLoading } = useSWR(
    isNewChat
      ? null
      : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const initialMessages: ChatMessage[] = isNewChat
    ? []
    : (chatData?.messages ?? []);
  const visibility: VisibilityType = isNewChat
    ? "private"
    : (chatData?.visibility ?? "private");

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    generateId: generateUUID,
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      return (
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved != null
        ) ?? false
      );
    },
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111"}/chat/foreman`,
      fetch: async (input, init) => {
        const token = await getTokenRef.current();
        logRef.current("info", "transport", `POST ${typeof input === "string" ? input : (input as Request).url}`, {
          hasToken: !!token,
          bodyLength: init?.body ? String(init.body).length : 0,
        });
        const startTime = Date.now();
        try {
          const response = await fetch(input, {
            ...init,
            headers: {
              ...init?.headers,
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          logRef.current(
            response.ok ? "info" : "error",
            "transport",
            `Response ${response.status} (${Date.now() - startTime}ms)`,
            { status: response.status, statusText: response.statusText }
          );
          return response;
        } catch (err) {
          logRef.current("error", "transport", `Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
          throw err;
        }
      },
      prepareSendMessagesRequest(request) {
        const uid = userIdRef.current || "";

        // Detect tool approval/decline responses.
        // The approvalId (set by our backend) is actually the Mastra runId,
        // so the backend can call agent.approveToolCall({ runId }) directly.
        const approvalPart = request.messages
          .flatMap((m) => m.parts ?? [])
          .find(
            (p: any) =>
              "state" in p &&
              p.state === "approval-responded" &&
              p.approval?.approved != null,
          ) as { approval: { id: string; approved: boolean; reason?: string } } | undefined;

        if (approvalPart) {
          logRef.current(
            "info",
            "approval",
            `Tool ${approvalPart.approval.approved ? "approved" : "denied"}: runId=${approvalPart.approval.id}`,
          );
          return {
            body: {
              approveRunId: approvalPart.approval.id,
              approved: approvalPart.approval.approved,
              reason: approvalPart.approval.reason,
              threadId: request.id,
              resourceId: uid,
            },
          };
        }

        // Normal message — extract text and send to Mastra
        const lastMsg = request.messages.at(-1);
        const text = lastMsg?.parts
          ?.filter((p) => p.type === "text")
          .map((p) => (p as { text: string }).text)
          .join("") || "";
        return {
          body: {
            messages: [{ role: "user", content: text }],
            threadId: request.id,
            resourceId: uid,
          },
        };
      },
    }),
    onData: (dataPart) => {
      logRef.current("debug", "stream", `data: ${dataPart.type}`, dataPart);
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      logRef.current("info", "lifecycle", "Stream finished");
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      logRef.current("error", "error", `Chat error: ${error.message}`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      if (error.message?.includes("AI Gateway requires a valid credit card")) {
        setShowCreditCardAlert(true);
      } else if (error instanceof ChatbotError) {
        toast({ type: "error", description: error.message });
      } else if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("NetworkError") ||
        error.message?.includes("ERR_CONNECTION_REFUSED")
      ) {
        toast({
          type: "error",
          description:
            "Agent server is unavailable. Make sure it's running on port 4111.",
        });
      } else if (error.message?.includes("aborted")) {
        // Stream was cancelled by user — no need to show error
        logRef.current("info", "lifecycle", "Stream aborted by user");
      } else {
        toast({
          type: "error",
          description: error.message || "Something went wrong. Please try again.",
        });
      }
    },
  });

  const urlPushedRef = useRef(false);
  const wrappedSendMessage = useCallback<typeof sendMessage>(
    (...args) => {
      if (isNewChat && !urlPushedRef.current) {
        urlPushedRef.current = true;
        window.history.pushState(
          {},
          "",
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
        );
        // Persist the conversation so it appears in history and survives refresh
        getTokenRef.current().then((token) => {
          fetch(
            `${process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111"}/conversations`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ id: chatId }),
            }
          ).catch(() => {});
        });
      }
      return sendMessage(...args);
    },
    [isNewChat, chatId, sendMessage]
  );

  const loadedChatIds = useRef(new Set<string>());

  if (isNewChat && !loadedChatIds.current.has(newChatIdRef.current)) {
    loadedChatIds.current.add(newChatIdRef.current);
  }

  useEffect(() => {
    if (loadedChatIds.current.has(chatId)) {
      return;
    }
    if (chatData?.messages) {
      loadedChatIds.current.add(chatId);
      setMessages(chatData.messages);
    }
  }, [chatId, chatData?.messages, setMessages]);

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      urlPushedRef.current = false;
      if (isNewChat) {
        setMessages([]);
      }
    }
  }, [chatId, isNewChat, setMessages]);

  useEffect(() => {
    if (chatData && !isNewChat) {
      const cookieModel = document.cookie
        .split("; ")
        .find((row) => row.startsWith("chat-model="))
        ?.split("=")[1];
      if (cookieModel) {
        setCurrentModelId(decodeURIComponent(cookieModel));
      }
    }
  }, [chatData, isNewChat]);

  const hasAppendedQueryRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    if (query && !hasAppendedQueryRef.current) {
      hasAppendedQueryRef.current = true;
      window.history.replaceState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });
    }
  }, [sendMessage, chatId]);

  // Log status changes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      log("info", "lifecycle", `Status: ${prevStatusRef.current} → ${status}`);
      prevStatusRef.current = status;
    }
  }, [status, log]);

  // Log message count changes (tool calls, new parts)
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length !== prevMsgCountRef.current) {
      const lastMsg = messages.at(-1);
      const toolParts = lastMsg?.parts?.filter((p) => p.type.startsWith("tool-")) ?? [];
      log("debug", "stream", `Messages: ${prevMsgCountRef.current} → ${messages.length}`, {
        lastRole: lastMsg?.role,
        partTypes: lastMsg?.parts?.map((p) => p.type),
        toolCount: toolParts.length,
      });
      prevMsgCountRef.current = messages.length;
    }
  }, [messages, log]);

  useAutoResume({
    autoResume: !isNewChat && !!chatData,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const isReadonly = isNewChat ? false : (chatData?.isReadonly ?? false);

  const { data: votes } = useSWR<Vote[]>(
    !isReadonly && messages.length >= 2
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const value = useMemo<ActiveChatContextValue>(
    () => ({
      chatId,
      messages,
      setMessages,
      sendMessage: wrappedSendMessage,
      status,
      stop,
      regenerate,
      addToolApprovalResponse,
      input,
      setInput,
      visibilityType: visibility,
      isReadonly,
      isLoading: !isNewChat && isLoading,
      votes,
      currentModelId,
      setCurrentModelId,
      showCreditCardAlert,
      setShowCreditCardAlert,
    }),
    [
      chatId,
      messages,
      setMessages,
      wrappedSendMessage,
      status,
      stop,
      regenerate,
      addToolApprovalResponse,
      input,
      visibility,
      isReadonly,
      isNewChat,
      isLoading,
      votes,
      currentModelId,
      showCreditCardAlert,
    ]
  );

  return (
    <ActiveChatContext.Provider value={value}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat() {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return context;
}
