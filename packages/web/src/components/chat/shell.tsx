"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useActiveChat } from "@/hooks/use-active-chat";
import { initialArtifactData, useArtifact, useArtifactSelector } from "@/hooks/use-artifact";
import { useKnowledgePanel, useKnowledgePanelSelector } from "@/hooks/use-knowledge-panel";
import { usePreviewPanel, usePreviewPanelSelector } from "@/hooks/use-preview-panel";
import type { Attachment, ChatMessage } from "@/lib/types";
import { Artifact } from "./artifact";
import { ChatHeader } from "./chat-header";
import { DataStreamHandler } from "./data-stream-handler";
import { KnowledgePanel } from "./knowledge-panel";
import { submitEditedMessage } from "./message-editor";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { PreviewPanel } from "./preview-panel";

export function ChatShell() {
  const {
    chatId,
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
    input,
    setInput,
    visibilityType,
    chatTitle,
    isReadonly,
    isLoading,
    votes,
    currentModelId,
    setCurrentModelId,
    showCreditCardAlert,
    setShowCreditCardAlert,
  } = useActiveChat();

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { setArtifact } = useArtifact();
  const isPreviewOpen = usePreviewPanelSelector((state) => state.isOpen);
  const { reset: resetPreviewPanel } = usePreviewPanel();
  const isKnowledgeOpen = useKnowledgePanelSelector((state) => state.isOpen);
  const { reset: resetKnowledgePanel } = useKnowledgePanel();

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
      setArtifact(initialArtifactData);
      resetPreviewPanel();
      resetKnowledgePanel();
      setEditingMessage(null);
      setAttachments([]);
    }
  }, [chatId, setArtifact, resetPreviewPanel, resetKnowledgePanel]);

  return (
    <>
      <div className="flex h-dvh w-full flex-row overflow-hidden">
        <ResizablePanelGroup className="flex-1" orientation="horizontal">
          <ResizablePanel
            className="flex min-w-0 flex-col bg-sidebar"
            defaultSize={50}
            id="chat-panel"
            minSize={30}
          >
            <div className="m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-sidebar-border bg-background shadow-sm md:m-3">
              <ChatHeader
                chatId={chatId}
                isReadonly={isReadonly}
                selectedVisibilityType={visibilityType}
                title={chatTitle}
              />

              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <Messages
                  addToolApprovalResponse={addToolApprovalResponse}
                  chatId={chatId}
                  isArtifactVisible={isArtifactVisible}
                  isLoading={isLoading}
                  isReadonly={isReadonly}
                  messages={messages}
                  onEditMessage={(msg) => {
                    const text = msg.parts
                      ?.filter((p) => p.type === "text")
                      .map((p) => p.text)
                      .join("");
                    setInput(text ?? "");
                    setEditingMessage(msg);
                  }}
                  regenerate={regenerate}
                  selectedModelId={currentModelId}
                  setMessages={setMessages}
                  status={status}
                  votes={votes}
                />

                <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
                  {!isReadonly && (
                    <MultimodalInput
                      attachments={attachments}
                      chatId={chatId}
                      editingMessage={editingMessage}
                      input={input}
                      isLoading={isLoading}
                      messages={messages}
                      onCancelEdit={() => {
                        setEditingMessage(null);
                        setInput("");
                      }}
                      onModelChange={setCurrentModelId}
                      selectedModelId={currentModelId}
                      selectedVisibilityType={visibilityType}
                      sendMessage={
                        editingMessage
                          ? async () => {
                              const msg = editingMessage;
                              setEditingMessage(null);
                              await submitEditedMessage({
                                message: msg,
                                text: input,
                                setMessages,
                                regenerate,
                              });
                              setInput("");
                            }
                          : sendMessage
                      }
                      setAttachments={setAttachments}
                      setInput={setInput}
                      setMessages={setMessages}
                      status={status}
                      stop={stop}
                    />
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>

          {(isKnowledgeOpen || isPreviewOpen) && (
            <>
              <ResizableHandle
                className="bg-transparent hover:bg-foreground/10 [&>div]:bg-foreground/15"
                withHandle
              />
              <ResizablePanel
                className="flex min-w-0 flex-col"
                defaultSize={50}
                id="side-panel"
                minSize={25}
              >
                {/* One side slot; a knowledge document takes precedence over a
                    live preview when both happen to be open. */}
                {isKnowledgeOpen ? <KnowledgePanel /> : <PreviewPanel />}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        <Artifact
          addToolApprovalResponse={addToolApprovalResponse}
          attachments={attachments}
          chatId={chatId}
          input={input}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          selectedVisibilityType={visibilityType}
          sendMessage={sendMessage}
          setAttachments={setAttachments}
          setInput={setInput}
          setMessages={setMessages}
          status={status}
          stop={stop}
          votes={votes}
        />
      </div>

      <DataStreamHandler />

      <AlertDialog onOpenChange={setShowCreditCardAlert} open={showCreditCardAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to activate Vercel AI
              Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank",
                );
                window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
