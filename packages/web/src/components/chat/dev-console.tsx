"use client";

import { useEffect, useRef, useState } from "react";
import { type DevLogEntry, type LogLevel, useDevConsole } from "@/hooks/use-dev-console";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "text-muted-foreground",
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

const CATEGORY_BADGES: Record<DevLogEntry["category"], string> = {
  stream: "bg-purple-500/20 text-purple-300",
  transport: "bg-blue-500/20 text-blue-300",
  error: "bg-red-500/20 text-red-300",
  lifecycle: "bg-green-500/20 text-green-300",
  approval: "bg-amber-500/20 text-amber-300",
};

function LogEntry({ entry }: { entry: DevLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions);

  const toggleExpanded = () => {
    if (entry.data) setExpanded(!expanded);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: row contains rich layout (badges, flex children) that doesn't fit inside a native <button>; role/tabIndex/onKeyDown make it keyboard-accessible
    <div
      role={entry.data ? "button" : undefined}
      tabIndex={entry.data ? 0 : undefined}
      className="group flex flex-col border-b border-border/20 px-3 py-1.5 font-mono text-[11px] leading-relaxed hover:bg-muted/30"
      onClick={toggleExpanded}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleExpanded();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-muted-foreground/60">{time}</span>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase",
            CATEGORY_BADGES[entry.category],
          )}
        >
          {entry.category}
        </span>
        <span className={cn("shrink-0", LEVEL_COLORS[entry.level])}>[{entry.level}]</span>
        <span className="min-w-0 truncate text-foreground">{entry.message}</span>
        {entry.data !== undefined && (
          <span className="ml-auto shrink-0 text-muted-foreground/40">
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
        )}
      </div>
      {expanded && entry.data !== undefined && (
        <pre className="mt-1 max-h-[200px] overflow-auto rounded bg-black/30 p-2 text-[10px] text-muted-foreground">
          {typeof entry.data === "string" ? entry.data : JSON.stringify(entry.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function DevConsolePanel() {
  const { logs, isOpen, setIsOpen, clear } = useDevConsole();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<LogLevel | "all">("all");

  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.level === filter);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  // Only show in development. Early-return must come AFTER all hooks
  // (rules of hooks). NODE_ENV is build-time constant so this branch
  // is dead-code-eliminated in production bundles.
  if (process.env.NODE_ENV !== "development") return null;

  const errorCount = logs.filter((l) => l.level === "error").length;

  if (!isOpen) {
    return (
      <button
        className="fixed bottom-3 right-3 z-[9999] flex size-5 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border/40 backdrop-blur-sm transition-all hover:scale-110 hover:bg-muted hover:ring-border/60"
        onClick={() => setIsOpen(true)}
        title="Dev Console (Ctrl+Shift+D)"
        type="button"
      >
        {errorCount > 0 ? (
          <span className="size-2 rounded-full bg-red-400" />
        ) : (
          <span className="size-1.5 rounded-full bg-muted-foreground/40" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 z-[9999] flex h-[350px] w-[min(100%,600px)] flex-col overflow-hidden rounded-tl-lg border border-border/50 bg-background/95 shadow-2xl backdrop-blur-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-medium text-foreground">Dev Console</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            ({filteredLogs.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["all", "debug", "info", "warn", "error"] as const).map((level) => (
            <button
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[9px] transition-colors",
                filter === level
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              key={level}
              onClick={() => setFilter(level)}
              type="button"
            >
              {level}
            </button>
          ))}
          <div className="mx-1 h-3 w-px bg-border/50" />
          <button
            className="rounded px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground hover:text-foreground"
            onClick={clear}
            type="button"
          >
            clear
          </button>
          <button
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[9px]",
              autoScroll ? "text-blue-400" : "text-muted-foreground",
            )}
            onClick={() => setAutoScroll(!autoScroll)}
            type="button"
          >
            auto↓
          </button>
          <button
            className="ml-1 rounded px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground hover:text-red-400"
            onClick={() => setIsOpen(false)}
            type="button"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-[11px] text-muted-foreground/50">
            No logs yet. Send a message to see stream events.
          </div>
        ) : (
          filteredLogs.map((entry) => <LogEntry entry={entry} key={entry.id} />)
        )}
      </div>
    </div>
  );
}
