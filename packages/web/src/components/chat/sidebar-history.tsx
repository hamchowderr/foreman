"use client";

import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { motion } from "framer-motion";
import { ArchiveIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
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
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { SessionUser as User } from "@/lib/auth";
import { createClient } from "@/lib/client";
import type { Chat } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";
import { LoaderIcon } from "./icons";
import { ChatItem } from "./sidebar-history-item";

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats,
  );
};

export function getChatHistoryPaginationKey(pageIndex: number, previousPageData: ChatHistory) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) {
    return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?limit=${PAGE_SIZE}`;
  }

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) {
    return null;
  }

  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

export function SidebarHistory({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const id = pathname?.startsWith("/chat/") ? pathname.split("/")[2] : null;

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(user ? getChatHistoryPaginationKey : () => null, fetcher, {
    fallbackData: [],
    revalidateOnFocus: false,
  });

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Archived conversations are loaded lazily (only when the section is expanded)
  // from the same /api/history endpoint with ?archived=true.
  const {
    data: archivedData,
    isLoading: archivedLoading,
    mutate: mutateArchived,
  } = useSWR<ChatHistory>(
    showArchived && user
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?archived=true&limit=100`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const archivedChats = archivedData?.chats ?? [];

  const handleArchiveToggle = async (chatId: string, nextArchived: boolean) => {
    // Optimistically remove it from whichever list it currently sits in.
    if (nextArchived) {
      mutate(
        (pages) =>
          pages?.map((page) => ({
            ...page,
            chats: page.chats.filter((chat) => chat.id !== chatId),
          })),
        { revalidate: false },
      );
    } else {
      mutateArchived(
        (data) => (data ? { ...data, chats: data.chats.filter((c) => c.id !== chatId) } : data),
        { revalidate: false },
      );
    }

    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      const token = session?.access_token ?? null;
      const agentUrl = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";
      const res = await fetch(`${agentUrl}/conversations/${chatId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ archived: nextArchived }),
      });
      if (!res.ok) throw new Error(`archive failed (${res.status})`);

      if (nextArchived) {
        toast.success("Chat archived", {
          action: { label: "Undo", onClick: () => handleArchiveToggle(chatId, false) },
        });
        mutateArchived(); // pull it into the archived list
      } else {
        toast.success("Chat restored");
        mutate(); // pull it back into the active list
      }
    } catch {
      toast.error(nextArchived ? "Failed to archive chat" : "Failed to restore chat");
      mutate();
      mutateArchived();
    }
  };

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory = paginatedChatHistories
    ? paginatedChatHistories.every((page) => page.chats.length === 0)
    : false;

  const handleDelete = async () => {
    const chatToDelete = deleteId;
    if (!chatToDelete) return;
    const isCurrentChat = pathname === `/chat/${chatToDelete}`;

    setShowDeleteDialog(false);

    // Optimistically remove it from the list and suppress revalidation until the
    // real delete confirms — otherwise the next /api/history refetch brings it
    // back before the DELETE lands.
    mutate(
      (chatHistories) =>
        chatHistories?.map((chatHistory) => ({
          ...chatHistory,
          chats: chatHistory.chats.filter((chat) => chat.id !== chatToDelete),
        })),
      { revalidate: false },
    );

    try {
      // Hit the agents server directly (with auth), exactly like Rename does.
      // The old `/api/chat?id=` route does not exist (404), so deletes never
      // persisted and reappeared on revalidation.
      const {
        data: { session },
      } = await createClient().auth.getSession();
      const token = session?.access_token ?? null;
      const agentUrl = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";
      const res = await fetch(`${agentUrl}/conversations/${chatToDelete}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`delete failed (${res.status})`);
      toast.success("Chat deleted");
      mutateArchived(); // in case the deleted chat was an archived one
      // Stay inside the chat app (new chat) instead of the marketing homepage.
      if (isCurrentChat) router.replace("/chat");
    } catch {
      toast.error("Failed to delete chat");
      mutate(); // revalidate to restore the true list
    }
  };

  if (!user) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-[13px] text-sidebar-foreground/60">
            Login to save and revisit previous chats!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
          History
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="flex flex-col gap-0.5 px-1">
            {[44, 32, 28, 64, 52].map((item) => (
              <div className="flex h-8 items-center gap-2 rounded-lg px-2" key={item}>
                <Skeleton
                  className="h-3 max-w-(--skeleton-width) flex-1 rounded-md bg-sidebar-foreground/[0.06]"
                  style={
                    {
                      "--skeleton-width": `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
          History
        </SidebarGroupLabel>
        <SidebarGroupContent>
          {hasEmptyChatHistory && (
            <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-[13px] text-sidebar-foreground/60">
              Your conversations will appear here once you start chatting!
            </div>
          )}
          <SidebarMenu>
            {paginatedChatHistories &&
              (() => {
                const chatsFromHistory = paginatedChatHistories.flatMap(
                  (paginatedChatHistory) => paginatedChatHistory.chats,
                );

                const groupedChats = groupChatsByDate(chatsFromHistory);

                return (
                  <div className="flex flex-col gap-4">
                    {groupedChats.today.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          Today
                        </div>
                        {groupedChats.today.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onArchiveToggle={handleArchiveToggle}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.yesterday.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          Yesterday
                        </div>
                        {groupedChats.yesterday.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onArchiveToggle={handleArchiveToggle}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.lastWeek.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          Last 7 days
                        </div>
                        {groupedChats.lastWeek.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onArchiveToggle={handleArchiveToggle}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.lastMonth.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          Last 30 days
                        </div>
                        {groupedChats.lastMonth.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onArchiveToggle={handleArchiveToggle}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.older.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          Older
                        </div>
                        {groupedChats.older.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onArchiveToggle={handleArchiveToggle}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
          </SidebarMenu>

          <motion.div
            onViewportEnter={() => {
              if (!isValidating && !hasReachedEnd) {
                setSize((size) => size + 1);
              }
            }}
          />

          {hasReachedEnd ? null : (
            <div className="mt-1 flex flex-row items-center gap-2 px-4 py-2 text-sidebar-foreground/50">
              <div className="animate-spin">
                <LoaderIcon />
              </div>
              <div className="text-[11px]">Loading...</div>
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Archived — collapsed by default, loaded on demand. Always reachable so a
          user whose chats are all archived can still find and restore them. */}
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupContent>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
            onClick={() => setShowArchived((v) => !v)}
            type="button"
          >
            <ArchiveIcon size={13} />
            <span>{showArchived ? "Hide archived" : "Archived"}</span>
          </button>

          {showArchived && (
            <SidebarMenu className="mt-1">
              {archivedLoading ? (
                <div className="px-2 py-1.5 text-[12px] text-sidebar-foreground/50">Loading…</div>
              ) : archivedChats.length === 0 ? (
                <div className="px-2 py-1.5 text-[12px] text-sidebar-foreground/50">
                  No archived chats
                </div>
              ) : (
                archivedChats.map((chat) => (
                  <ChatItem
                    chat={chat}
                    isActive={chat.id === id}
                    key={chat.id}
                    onArchiveToggle={handleArchiveToggle}
                    onDelete={(chatId) => {
                      setDeleteId(chatId);
                      setShowDeleteDialog(true);
                    }}
                    setOpenMobile={setOpenMobile}
                  />
                ))
              )}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your chat and remove it
              from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
