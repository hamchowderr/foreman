"use client";

import { motion, AnimatePresence, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Search, Toolbox } from "@/components/icons/hi";

// 33 MCP tools loosely modeled after zapier-sdk
const ALL_TOOLS = [
  "run-action", "search-actions", "list-apps", "list-connections",
  "find-field-choices", "get-app", "fetch", "request", "auth-check",
  "list-tables", "create-table", "delete-table", "create-table-records",
  "update-table-records", "delete-table-records", "read-table-records",
  "create-table-fields", "delete-table-fields", "list-users",
  "get-webhook", "list-webhooks", "create-webhook", "delete-webhook",
  "poll-trigger", "list-triggers", "get-action-schema", "list-files",
  "upload-file", "download-file", "get-account", "list-teams",
  "get-usage", "get-health",
];

type Prompt = {
  text: string;
  matches: string[];
};

const PROMPTS: Prompt[] = [
  {
    text: "Email Jake the Q3 deck",
    matches: ["search-actions", "get-action-schema", "find-field-choices", "upload-file", "run-action"],
  },
  {
    text: "Create a Stripe invoice for $4,900",
    matches: ["list-apps", "search-actions", "get-action-schema", "find-field-choices", "run-action"],
  },
  {
    text: "What apps am I connected to?",
    matches: ["list-apps", "list-connections", "get-account"],
  },
  {
    text: "Log a Slack channel's messages to Notion",
    matches: ["list-connections", "search-actions", "poll-trigger", "run-action"],
  },
  {
    text: "Set up a webhook when a Stripe charge succeeds",
    matches: ["list-apps", "search-actions", "list-webhooks", "create-webhook", "auth-check"],
  },
  {
    text: "Add a new row to my leads spreadsheet",
    matches: ["search-actions", "find-field-choices", "create-table-records", "run-action"],
  },
  {
    text: "Post the latest blog to Twitter",
    matches: ["list-apps", "search-actions", "get-action-schema", "run-action"],
  },
  {
    text: "Delete duplicate Trello cards",
    matches: ["search-actions", "read-table-records", "delete-table-records", "run-action"],
  },
];

export function ToolDiscovery() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [promptIdx, setPromptIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "matching" | "loaded">("typing");

  useEffect(() => {
    if (!inView) return;
    const prompt = PROMPTS[promptIdx];
    setTyped("");
    setPhase("typing");

    let idx = 0;
    const typeInterval = setInterval(() => {
      idx++;
      setTyped(prompt.text.slice(0, idx));
      if (idx >= prompt.text.length) {
        clearInterval(typeInterval);
        setTimeout(() => setPhase("matching"), 400);
        setTimeout(() => setPhase("loaded"), 1400);
        setTimeout(() => setPromptIdx((p) => (p + 1) % PROMPTS.length), 3800);
      }
    }, 35);

    return () => clearInterval(typeInterval);
  }, [promptIdx, inView]);

  const prompt = PROMPTS[promptIdx];

  return (
    <div ref={ref} className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center gap-2">
        <Toolbox className="h-4 w-4 text-accent" />
        <Search className="h-3 w-3 text-muted" />
        <span className="text-xs font-medium text-muted">Toolbox search</span>
      </div>

      {/* Input */}
      <div className="px-4 sm:px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 rounded-lg bg-background border border-border px-3 py-2.5">
          <Search className="h-3.5 w-3.5 text-muted shrink-0" />
          <span className="text-sm flex-1 min-w-0 truncate">
            {typed}
            {phase === "typing" && (
              <span className="inline-block w-[2px] h-[1em] bg-accent align-text-bottom ml-0.5 animate-pulse" />
            )}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
          <AnimatePresence mode="wait">
            <motion.span
              key={phase}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.2 }}
            >
              {phase === "typing" && "Reading your request…"}
              {phase === "matching" && "Looking through the toolbox…"}
              {phase === "loaded" && (
                <span className="text-accent font-medium">
                  Grabbed {prompt.matches.length} tools for this
                </span>
              )}
            </motion.span>
          </AnimatePresence>
          <span className="font-mono tabular-nums">{prompt.matches.length} / 33</span>
        </div>
      </div>

      {/* Tool chips */}
      <div className="p-4 sm:p-5 border-t border-border bg-background/50">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
          {ALL_TOOLS.map((tool) => {
            const matched = prompt.matches.includes(tool);
            const visible = phase !== "typing" && matched;
            return (
              <motion.div
                key={tool}
                animate={{
                  opacity: phase === "typing" ? 0.3 : visible ? 1 : 0.12,
                  scale: visible && phase === "loaded" ? 1 : 0.96,
                }}
                transition={{
                  duration: 0.3,
                  delay: phase === "matching" && matched ? Math.random() * 0.3 : 0,
                }}
                className={`relative rounded-md px-2 py-1.5 text-[10px] sm:text-[11px] font-mono border truncate ${
                  visible
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-background border-border text-muted"
                }`}
              >
                {tool}
                {visible && phase === "loaded" && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent"
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
