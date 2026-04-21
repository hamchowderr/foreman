"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/types";
import type { SlashCommand } from "../slash-commands";

export function createSlashHandler({
  chatId,
  setInput,
  setMessages,
  router,
  setTheme,
  resolvedTheme,
  onClose,
}: {
  chatId: string;
  setInput: (val: string) => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  router: { push: (path: string) => void };
  setTheme: (theme: string) => void;
  resolvedTheme: string | undefined;
  onClose: () => void;
}) {
  return (cmd: SlashCommand) => {
    onClose();
    setInput("");
    switch (cmd.action) {
      case "new":
        router.push("/");
        break;
      case "clear":
        setMessages(() => []);
        break;
      case "rename":
        toast("Rename is available from the sidebar chat menu.");
        break;
      case "model": {
        const modelBtn = document.querySelector<HTMLButtonElement>(
          "[data-testid='model-selector']"
        );
        modelBtn?.click();
        break;
      }
      case "theme":
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        break;
      case "delete":
        toast("Delete this chat?", {
          action: {
            label: "Delete",
            onClick: () => {
              fetch(
                `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat?id=${chatId}`,
                { method: "DELETE" }
              );
              router.push("/");
              toast.success("Chat deleted");
            },
          },
        });
        break;
      case "purge":
        toast("Delete all chats?", {
          action: {
            label: "Delete all",
            onClick: () => {
              fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, {
                method: "DELETE",
              });
              router.push("/");
              toast.success("All chats deleted");
            },
          },
        });
        break;
      default:
        break;
    }
  };
}
