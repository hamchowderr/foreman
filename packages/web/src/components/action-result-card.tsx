"use client";

import { useState } from "react";

interface ActionResultCardProps {
  proposalId: string;
  summary: string;
  result: unknown;
}

export function ActionResultCard({
  summary,
  result,
}: ActionResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-emerald-600 dark:text-emerald-400 text-base">
          &#10003;
        </span>
        <span className="text-sm font-medium">{summary}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto text-xs text-foreground/50 hover:text-foreground/70 transition-colors"
        >
          {expanded ? "Hide" : "Details"}
        </button>
      </div>
      {expanded && (
        <pre className="mt-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 text-xs overflow-x-auto max-h-60">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
