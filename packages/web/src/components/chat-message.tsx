"use client";

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
        className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${bubbleClass}`}
      >
        {isError && <span className="mr-1.5">{"\u26A0"}</span>}
        {content}
      </div>
    </div>
  );
}

export function StreamingMessage({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-[#f0f0f0] text-foreground dark:bg-[#1a1a1a]">
        {text}
        <span className="inline-block w-1.5 h-4 ml-0.5 bg-foreground/40 animate-pulse" />
      </div>
    </div>
  );
}
