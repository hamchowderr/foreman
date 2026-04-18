"use client";

import { Streamdown } from "streamdown";

export function ChatMessage({
  role,
  content,
}: {
  role: "user" | "agent" | "system";
  content: string;
}) {
  const isUser = role === "user";
  const isError = role === "system" && content.startsWith("Error:");
  const isSystem = role === "system" && !isError;
  const isAgent = role === "agent" || (!isUser && !isSystem && !isError);

  let bubbleClass: string;
  if (isUser) {
    bubbleClass = "bg-foreground text-background";
  } else if (isError) {
    bubbleClass =
      "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800";
  } else if (isSystem) {
    bubbleClass =
      "bg-gray-100 text-foreground/60 border border-gray-200 dark:bg-[#161616] dark:border-[#333] dark:text-foreground/50";
  } else {
    bubbleClass = "bg-[#f0f0f0] text-foreground dark:bg-[#1a1a1a]";
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${bubbleClass}`}
      >
        {isError && <span className="mr-1.5">{"\u26A0"}</span>}
        {isAgent ? (
          <Streamdown animated={false}>{content}</Streamdown>
        ) : (
          <span className="whitespace-pre-wrap">{content}</span>
        )}
      </div>
    </div>
  );
}

export function StreamingMessage({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed bg-[#f0f0f0] text-foreground dark:bg-[#1a1a1a]">
        <Streamdown animated>{text}</Streamdown>
      </div>
    </div>
  );
}
