"use client";

import { BotIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/client";
import { type StoredAgent, storedAgentsApi } from "@/lib/stored-agents-client";

async function getToken() {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  return session?.access_token ?? null;
}

export function AgentListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();

  const { data, isLoading, error } = useSWR<StoredAgent[]>(["stored-agents-list"], async () => {
    const token = await getToken();
    return storedAgentsApi.list(token ?? "");
  });

  const [creating, setCreating] = useState(false);

  // Support ?new=1 query param from the sidebar "New" button.
  useEffect(() => {
    if (searchParams.get("new") === "1") setCreating(true);
  }, [searchParams]);

  const handleCreate = async (body: { name: string; description?: string }) => {
    const token = await getToken();
    const created = await storedAgentsApi.create(token ?? "", body);
    mutate(["stored-agents-list"]);
    mutate(["stored-agents-sidebar"]);
    router.push(`/editor/${created.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-6 md:p-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your agents</h1>
          <p className="mt-1 text-sm text-muted">
            Custom agent definitions — instructions, tools, and published versions.
          </p>
        </div>
        <Button variant="accent" onClick={() => setCreating(true)} className="gap-2">
          <PlusIcon className="size-4" />
          New agent
        </Button>
      </header>

      {isLoading && <p className="text-sm text-muted">Loading agents…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Failed to load agents: {(error as Error).message}
        </p>
      )}

      {data && data.length === 0 && !isLoading && <EmptyState onCreate={() => setCreating(true)} />}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      <NewAgentDialog
        open={creating}
        onOpenChange={(v) => {
          setCreating(v);
          if (!v && searchParams.get("new") === "1") {
            router.replace("/editor");
          }
        }}
        onSubmit={handleCreate}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-12 text-center">
      <BotIcon className="mx-auto mb-3 size-8 text-muted" />
      <h2 className="text-base font-medium">No agents yet</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        Create your first agent to define instructions, pick tools, and publish versions you can
        reference elsewhere.
      </p>
      <Button variant="accent" onClick={onCreate} className="mt-4 gap-2">
        <PlusIcon className="size-4" />
        New agent
      </Button>
    </div>
  );
}

function AgentCard({ agent }: { agent: StoredAgent }) {
  const latest = agent.latest_version;
  const publishedVersion = agent.current_version_id
    ? latest && latest.id === agent.current_version_id
      ? latest
      : null
    : null;

  return (
    <Link
      href={`/editor/${agent.id}`}
      className="card-hover group rounded-xl border border-border bg-card p-5 transition-colors"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="truncate text-base font-medium group-hover:text-accent">{agent.name}</h3>
        {latest?.is_draft ? (
          <Badge variant="outline">draft v{latest.version}</Badge>
        ) : publishedVersion ? (
          <Badge variant="accent">v{publishedVersion.version}</Badge>
        ) : latest ? (
          <Badge variant="outline">v{latest.version}</Badge>
        ) : null}
      </div>
      <p className="line-clamp-3 min-h-[3.5em] text-sm text-muted">
        {agent.description || "No description"}
      </p>
      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>{latest ? `${latest.tools.length} tools` : "—"}</span>
        <span>Updated {formatRelative(agent.updated_at)}</span>
      </div>
    </Link>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NewAgentDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (body: { name: string; description?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New agent</DialogTitle>
            <DialogDescription>
              Give your agent a name. You can edit everything else afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="new-agent-name" className="mb-1 block text-sm font-medium">
                Name
              </label>
              <Input
                id="new-agent-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer support bot"
                maxLength={120}
                required
              />
            </div>
            <div>
              <label htmlFor="new-agent-description" className="mb-1 block text-sm font-medium">
                Description <span className="text-xs font-normal text-muted">(optional)</span>
              </label>
              <Textarea
                id="new-agent-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Helps answer support questions and file tickets in Zendesk."
                maxLength={2000}
                rows={3}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={!name.trim() || submitting}>
              {submitting ? "Creating…" : "Create agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
