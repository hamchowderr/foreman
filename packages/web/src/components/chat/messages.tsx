import type { UseChatHelpers } from "@ai-sdk/react";
import { useSessionUser } from "@/hooks/use-session-user";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "../ai-elements/conversation";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

type MessagesProps = {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  isLoading?: boolean;
  selectedModelId: string;
  onEditMessage?: (message: ChatMessage) => void;
};

function PureMessages({
  addToolApprovalResponse,
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  isArtifactVisible: _isArtifactVisible,
  isLoading,
  selectedModelId: _selectedModelId,
  onEditMessage,
}: MessagesProps) {
  useDataStream();
  const sessionUser = useSessionUser();

  return (
    // key={chatId} resets the stick-to-bottom scroll state when switching chats.
    <Conversation className="bg-background" key={chatId}>
      {messages.length === 0 && !isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Greeting />
        </div>
      )}

      <ConversationContent className="mx-auto flex min-h-full min-w-0 max-w-3xl flex-col gap-3 px-3 py-6 md:px-5">
        {messages.map((message, index) => (
          <PreviewMessage
            addToolApprovalResponse={addToolApprovalResponse}
            chatId={chatId}
            isLoading={status === "streaming" && messages.length - 1 === index}
            isReadonly={isReadonly}
            key={message.id}
            message={message}
            onEdit={onEditMessage}
            regenerate={regenerate}
            requiresScrollPadding={false}
            setMessages={setMessages}
            userEmail={sessionUser?.email}
            userImage={sessionUser?.image}
            vote={votes ? votes.find((vote) => vote.messageId === message.id) : undefined}
          />
        ))}

        {status === "submitted" && messages.at(-1)?.role !== "assistant" && <ThinkingMessage />}
      </ConversationContent>

      <ConversationScrollButton className="z-10" />
    </Conversation>
  );
}

export const Messages = PureMessages;
