"use client";

import { PanelLeftIcon } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { ShareButton } from "./share-button";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  title,
  selectedVisibilityType,
  isOwner,
}: {
  chatId: string;
  title: string | null;
  selectedVisibilityType: VisibilityType;
  isOwner: boolean;
}) {
  const { state, toggleSidebar, isMobile } = useSidebar();

  if (state === "collapsed" && !isMobile) {
    return null;
  }

  return (
    <header className="flex h-12 items-center gap-2 border-b border-border/50 px-3">
      <Button className="md:hidden" onClick={toggleSidebar} size="icon-sm" variant="ghost">
        <PanelLeftIcon className="size-4" />
      </Button>

      <h1 className="min-w-0 flex-1 truncate font-medium text-foreground/80 text-sm">
        {title || "New chat"}
      </h1>

      {isOwner && (
        <>
          <ShareButton chatId={chatId} />
          <VisibilitySelector chatId={chatId} selectedVisibilityType={selectedVisibilityType} />
        </>
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.title === nextProps.title &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isOwner === nextProps.isOwner
  );
});
