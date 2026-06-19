"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { memo } from "react";
import { MODEL_CAPABILITIES } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";
import { PaperclipIcon } from "../icons";

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
}) {
  // Capabilities are static frontend config (models.ts) — read them directly
  // instead of fetching a non-existent /api/models endpoint.
  const hasVision = MODEL_CAPABILITIES[selectedModelId]?.vision ?? false;

  return (
    <Button
      className={cn(
        "h-7 w-7 rounded-lg border border-border/40 p-1 transition-colors",
        hasVision
          ? "text-foreground hover:border-border hover:text-foreground"
          : "text-muted-foreground/30 cursor-not-allowed",
      )}
      data-testid="attachments-button"
      disabled={status !== "ready" || !hasVision}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

export const AttachmentsButton = memo(PureAttachmentsButton);
