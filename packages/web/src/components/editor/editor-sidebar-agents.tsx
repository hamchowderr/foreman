"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/client";
import { type StoredAgent, storedAgentsApi } from "@/lib/stored-agents-client";
import { cn } from "@/lib/utils";

/**
 * Mini agent list rendered inside the editor sidebar. Separate SWR cache key
 * from the full list on /editor so the two views can update independently.
 */
export function EditorSidebarAgents() {
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;

  const { data, isLoading, error } = useSWR<StoredAgent[]>(
    ["stored-agents-sidebar"],
    async () => {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      return storedAgentsApi.list(session?.access_token ?? "");
    },
    { revalidateOnFocus: false },
  );

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-2">
      {isLoading && <div className="px-2 py-1 text-xs text-muted-foreground">Loading…</div>}
      {error && <div className="px-2 py-1 text-xs text-destructive">Failed to load agents</div>}
      {data && data.length === 0 && (
        <div className="px-2 py-1 text-xs text-muted-foreground">No agents yet.</div>
      )}
      <ul className="space-y-0.5">
        {data?.map((a) => (
          <li key={a.id}>
            <Link
              href={`/editor/${a.id}`}
              className={cn(
                "group flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                a.id === activeId
                  ? "bg-accent/10 text-accent"
                  : "text-foreground/80 hover:bg-background hover:text-foreground",
              )}
            >
              <span className="truncate">{a.name}</span>
              <AgentBadge agent={a} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function AgentBadge({ agent }: { agent: StoredAgent }) {
  const latest = agent.latest_version;
  if (!latest) return null;
  if (latest.is_draft) {
    return (
      <Badge variant="outline" className="ml-2">
        draft
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="ml-2">
      v{latest.version}
    </Badge>
  );
}
