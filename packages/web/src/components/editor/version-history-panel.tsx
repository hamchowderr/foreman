"use client";

import { RotateCcwIcon } from "lucide-react";
import type { StoredAgentVersion } from "@/lib/stored-agents-client";
import { cn } from "@/lib/utils";

interface Props {
  versions: StoredAgentVersion[];
  selectedId: string;
  currentVersionId: string | null;
  onSelect: (id: string) => void;
  onRestore: (sourceVersionId: string) => void | Promise<void>;
}

export function VersionHistoryPanel({
  versions,
  selectedId,
  currentVersionId,
  onSelect,
  onRestore,
}: Props) {
  if (versions.length === 0) {
    return <div className="p-4 text-xs text-muted">No versions yet.</div>;
  }

  // Latest-first ordering is assumed from the API, but sort defensively.
  const ordered = [...versions].sort((a, b) => b.version - a.version);
  const hasDraft = ordered.some((v) => v.is_draft);

  return (
    <ul className="flex-1 overflow-y-auto px-2 py-2">
      {ordered.map((v) => {
        const isSelected = v.id === selectedId;
        const isCurrent = v.id === currentVersionId;
        return (
          <li key={v.id} className="mb-1">
            <div
              className={cn(
                "rounded-md border p-2 text-sm transition-colors",
                isSelected ? "border-accent/40 bg-accent/5" : "border-transparent hover:bg-surface",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(v.id)}
                className="flex w-full items-start justify-between text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold">v{v.version}</span>
                    {v.is_draft ? (
                      <span className="rounded-sm bg-muted/20 px-1 py-0.5 text-[10px] text-muted">
                        draft
                      </span>
                    ) : isCurrent ? (
                      <span className="rounded-sm bg-accent/10 px-1 py-0.5 text-[10px] text-accent">
                        published
                      </span>
                    ) : (
                      <span className="rounded-sm bg-muted/10 px-1 py-0.5 text-[10px] text-muted">
                        archived
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted">
                    {formatTimestamp(v.published_at ?? v.created_at)} · {v.tools.length} tool
                    {v.tools.length === 1 ? "" : "s"}
                  </div>
                </div>
              </button>

              {/* Restore: only offered on non-draft versions, and only when
                  there isn't already a trailing draft (to keep the version
                  graph linear). */}
              {!v.is_draft && !hasDraft && (
                <button
                  type="button"
                  onClick={() => onRestore(v.id)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-accent"
                >
                  <RotateCcwIcon className="size-3" />
                  Restore to new draft
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
