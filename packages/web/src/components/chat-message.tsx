"use client";

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";

const streamdownPlugins = { code, math, mermaid };

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
          <Streamdown
            mode="static"
            plugins={streamdownPlugins}
            shikiTheme={["github-light", "github-dark"]}
            controls={{ code: { copy: true }, table: { copy: true } }}
            linkSafety={{ enabled: false }}
            className="max-w-none"
            components={{
              p: ({ children, className }) => (
                <p className={`my-1 ${className ?? ""}`}>{children}</p>
              ),
              h1: ({ children, className }) => (
                <h2 className={`text-lg font-bold mt-2 mb-1 ${className ?? ""}`}>{children}</h2>
              ),
              h2: ({ children, className }) => (
                <h3 className={`text-base font-semibold mt-2 mb-1 ${className ?? ""}`}>{children}</h3>
              ),
              h3: ({ children, className }) => (
                <h4 className={`text-sm font-semibold mt-1.5 mb-0.5 ${className ?? ""}`}>{children}</h4>
              ),
              ul: ({ children, className }) => (
                <ul className={`list-disc pl-4 my-1 space-y-0.5 ${className ?? ""}`}>{children}</ul>
              ),
              ol: ({ children, className }) => (
                <ol className={`list-decimal pl-4 my-1 space-y-0.5 ${className ?? ""}`}>{children}</ol>
              ),
              a: ({ children, href }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline break-all">
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </Streamdown>
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
        <Streamdown
          mode="streaming"
          isAnimating
          animated={{ animation: "fadeIn", duration: 100, sep: "word" }}
          caret="circle"
          plugins={streamdownPlugins}
          controls={false}
          linkSafety={{ enabled: false }}
          className="max-w-none"
          components={{
            p: ({ children, className }) => (
              <p className={`my-1 ${className ?? ""}`}>{children}</p>
            ),
          }}
        >
          {text}
        </Streamdown>
      </div>
    </div>
  );
}
