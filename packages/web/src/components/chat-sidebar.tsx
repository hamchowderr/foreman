"use client";

interface ConversationItem {
  id: string;
  title: string | null;
  updated_at: string;
}

interface ChatSidebarProps {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
}: ChatSidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-[#e0e0e0] dark:border-[#222] flex flex-col h-full bg-[#fafafa] dark:bg-[#0d0d0d]">
      <div className="p-3 border-b border-[#e0e0e0] dark:border-[#222]">
        <button
          onClick={onNew}
          data-testid="new-chat-button"
          className="w-full px-3 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New Chat
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
              c.id === activeId
                ? "bg-foreground/10 font-medium"
                : "hover:bg-foreground/5"
            }`}
          >
            {c.title || "New conversation"}
          </button>
        ))}
        {conversations.length === 0 && (
          <p className="px-3 py-4 text-xs text-foreground/40 text-center">
            No conversations yet
          </p>
        )}
      </nav>
    </aside>
  );
}
