"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAgentFetch,
  createConversation,
  listConversations,
  getConversation,
} from "@/lib/api-client";
import { ChatSidebar } from "./chat-sidebar";
import { ChatPane } from "./chat-pane";

interface ConversationItem {
  id: string;
  title: string | null;
  updated_at: string;
}

interface Message {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
}

export function ChatShell() {
  const agentFetch = useAgentFetch();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // Load conversation list
  useEffect(() => {
    listConversations(agentFetch)
      .then((data) => {
        setConversations(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [agentFetch]);

  const handleSelect = useCallback(async (id: string) => {
    setActiveId(id);
    const data = await getConversation(agentFetch, id);
    setMessages(data.messages);
  }, [agentFetch]);

  const handleNew = useCallback(async () => {
    const conv = await createConversation(agentFetch);
    const item: ConversationItem = {
      id: conv.id,
      title: null,
      updated_at: conv.created_at,
    };
    setConversations((prev) => [item, ...prev]);
    setActiveId(conv.id);
    setMessages([]);
  }, [agentFetch]);

  const handleTitleUpdate = useCallback(
    (conversationId: string, title: string) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title } : c))
      );
    },
    []
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-foreground/40 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
      />
      <main className="flex-1 flex flex-col min-w-0">
        {activeId ? (
          <ChatPane
            key={activeId}
            conversationId={activeId}
            initialMessages={messages}
            onTitleUpdate={handleTitleUpdate}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-foreground/30">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Foreman</h1>
              <p className="text-sm">
                Start a new conversation or select an existing one
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
