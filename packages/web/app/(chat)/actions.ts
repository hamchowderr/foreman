"use server";

import type { UIMessage } from "ai";
import { cookies } from "next/headers";
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth } from "@/lib/auth";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { getTextFromMessage } from "@/lib/utils";

const AGENT_SERVER_URL =
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const text = getTextFromMessage(message);
  return text.split(/\s+/).slice(0, 6).join(" ").trim() || "New Chat";
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Not supported by agent server yet - no-op
  console.warn("deleteTrailingMessages not yet supported by agent server", {
    id,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const { getToken } = await clerkAuth();
  const token = await getToken();
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${AGENT_SERVER_URL}/conversations/${chatId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ visibility }),
  });

  if (!res.ok) {
    throw new Error(`Failed to update visibility: ${res.status}`);
  }
}
