"use client";

import { ChevronLeftIcon, HistoryIcon, Loader2Icon, RocketIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/client";
import {
  type StoredAgent,
  type StoredAgentVersion,
  storedAgentsApi,
} from "@/lib/stored-agents-client";
import { cn } from "@/lib/utils";
import { ToolsPicker } from "./tools-picker";
import { VersionHistoryPanel } from "./version-history-panel";

const MODELS = [
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6 (default)" },
  { id: "anthropic/claude-opus-4-6", label: "Claude Opus 4.6 (heavy reasoning)" },
  { id: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast)" },
];

const AUTOSAVE_DEBOUNCE_MS = 800;

type SaveState = "clean" | "dirty" | "saving" | "error";

async function getToken() {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  return session?.access_token ?? null;
}

export function AgentEditor({ agentId }: { agentId: string }) {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();

  const {
    data: agent,
    error: agentError,
    isLoading: agentLoading,
    mutate: mutateAgent,
  } = useSWR<StoredAgent>(["stored-agent", agentId], async () => {
    const token = await getToken();
    return storedAgentsApi.get(token ?? "", agentId);
  });

  const { data: versions, mutate: mutateVersions } = useSWR<StoredAgentVersion[]>(
    ["stored-agent-versions", agentId],
    async () => {
      const token = await getToken();
      return storedAgentsApi.listVersions(token ?? "", agentId);
    },
  );

  // The editor targets whichever version is selected. Default: the latest
  // draft if one exists, otherwise the latest published version (read-only).
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const selectedVersion = useMemo(() => {
    if (!versions) return null;
    if (selectedVersionId) {
      return versions.find((v) => v.id === selectedVersionId) ?? null;
    }
    // Prefer trailing draft so edits autosave to it.
    const trailingDraft = versions.find((v) => v.is_draft);
    return trailingDraft ?? versions[0] ?? null;
  }, [versions, selectedVersionId]);

  // Local editor buffer — decoupled from SWR cache so typing doesn't thrash.
  const [buffer, setBuffer] = useState<{
    instructions: string;
    tools: string[];
    model: string;
  } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset the buffer when the selected version changes.
  const lastLoadedVersionId = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedVersion) return;
    if (lastLoadedVersionId.current === selectedVersion.id) return;
    lastLoadedVersionId.current = selectedVersion.id;
    setBuffer({
      instructions: selectedVersion.instructions,
      tools: selectedVersion.tools,
      model: selectedVersion.model,
    });
    setSaveState("clean");
    setSaveError(null);
  }, [selectedVersion]);

  const isDraft = selectedVersion?.is_draft ?? false;
  const isPublished = !!selectedVersion && !selectedVersion.is_draft;
  const isCurrentPublished = isPublished && agent?.current_version_id === selectedVersion?.id;

  // Autosave: debounce buffer changes into a PATCH on the draft. Refuses to
  // run on published versions — the user has to explicitly fork to a new
  // draft first via "Edit as new draft".
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueAutosave = useCallback(() => {
    if (!isDraft || !selectedVersion || !buffer) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("dirty");
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const token = await getToken();
        await storedAgentsApi.updateDraft(token ?? "", agentId, selectedVersion.id, {
          instructions: buffer.instructions,
          tools: buffer.tools,
          model: buffer.model,
        });
        setSaveState("clean");
        mutateVersions();
      } catch (err) {
        setSaveState("error");
        setSaveError(err instanceof Error ? err.message : "Save failed");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [agentId, buffer, getToken, isDraft, mutateVersions, selectedVersion]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const updateBuffer = (patch: Partial<NonNullable<typeof buffer>>) => {
    setBuffer((prev) => (prev ? { ...prev, ...patch } : prev));
    queueAutosave();
  };

  // Create a new draft from the currently-viewed published version.
  const forkToDraft = async (sourceVersionId?: string) => {
    const token = await getToken();
    const draft = await storedAgentsApi.createDraft(token ?? "", agentId, {
      sourceVersionId,
    });
    await mutateVersions();
    setSelectedVersionId(draft.id);
    toast.success(`Opened draft v${draft.version}`);
  };

  const publish = async () => {
    if (!selectedVersion || !isDraft) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    // Flush any in-flight changes before publishing.
    if (saveState !== "clean" && buffer) {
      try {
        const token = await getToken();
        await storedAgentsApi.updateDraft(token ?? "", agentId, selectedVersion.id, {
          instructions: buffer.instructions,
          tools: buffer.tools,
          model: buffer.model,
        });
        setSaveState("clean");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save before publish");
        return;
      }
    }

    try {
      const token = await getToken();
      const { agent: updatedAgent, version: updatedVersion } = await storedAgentsApi.publish(
        token ?? "",
        agentId,
        selectedVersion.id,
      );
      mutateAgent(updatedAgent, { revalidate: false });
      globalMutate(["stored-agents-list"]);
      globalMutate(["stored-agents-sidebar"]);
      await mutateVersions();
      setSelectedVersionId(updatedVersion.id);
      toast.success(`Published v${updatedVersion.version}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    }
  };

  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    try {
      const token = await getToken();
      await storedAgentsApi.remove(token ?? "", agentId);
      globalMutate(["stored-agents-list"]);
      globalMutate(["stored-agents-sidebar"]);
      toast.success("Agent deleted");
      router.push("/editor");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  // Metadata (name, description) edits run their own small state machine —
  // autosave on blur to avoid saving every keystroke.
  const [nameBuffer, setNameBuffer] = useState<string | null>(null);
  const [descBuffer, setDescBuffer] = useState<string | null>(null);

  useEffect(() => {
    if (agent) {
      setNameBuffer(agent.name);
      setDescBuffer(agent.description ?? "");
    }
  }, [agent?.id]); // reset only when switching agents

  const commitMetadata = async () => {
    if (!agent) return;
    const patch: { name?: string; description?: string | null } = {};
    if (nameBuffer !== null && nameBuffer !== agent.name) {
      patch.name = nameBuffer.trim();
    }
    if (descBuffer !== null && (descBuffer || "") !== (agent.description ?? "")) {
      patch.description = descBuffer.trim() || null;
    }
    if (Object.keys(patch).length === 0) return;
    try {
      const token = await getToken();
      const updated = await storedAgentsApi.update(token ?? "", agentId, patch);
      mutateAgent(updated, { revalidate: false });
      globalMutate(["stored-agents-list"]);
      globalMutate(["stored-agents-sidebar"]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save agent");
    }
  };

  if (agentLoading) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-sm text-muted">
        <Loader2Icon className="mr-2 size-4 animate-spin" />
        Loading agent…
      </div>
    );
  }
  if (agentError) {
    return (
      <div className="p-10 text-sm text-destructive">
        Failed to load agent: {(agentError as Error).message}
      </div>
    );
  }
  if (!agent || !buffer || !selectedVersion) {
    return <div className="p-10 text-sm text-muted">Loading version…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/editor"
            className="rounded-md p-1 text-muted transition-colors hover:bg-surface hover:text-foreground"
            aria-label="Back to agents"
          >
            <ChevronLeftIcon className="size-4" />
          </Link>
          <Input
            value={nameBuffer ?? ""}
            onChange={(e) => setNameBuffer(e.target.value)}
            onBlur={commitMetadata}
            className="h-8 max-w-md border-transparent bg-transparent text-base font-semibold shadow-none hover:bg-surface focus-visible:bg-surface"
            maxLength={120}
          />
          <VersionBadge version={selectedVersion} isCurrent={isCurrentPublished} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SaveIndicator state={saveState} error={saveError} isDraft={isDraft} />
          {isDraft ? (
            <Button
              variant="accent"
              onClick={publish}
              className="gap-2"
              disabled={saveState === "saving"}
            >
              <RocketIcon className="size-4" />
              Publish v{selectedVersion.version}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => forkToDraft(selectedVersion.id)}
              className="gap-2"
            >
              Edit as new draft
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeleteOpen(true)}
            title="Delete agent"
            className="text-muted hover:text-destructive"
          >
            <TrashIcon className="size-4" />
          </Button>
        </div>
      </header>

      {/* Body: editor + history panel */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
            <section>
              <label
                htmlFor="agent-description"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted"
              >
                Description
              </label>
              <Textarea
                id="agent-description"
                value={descBuffer ?? ""}
                onChange={(e) => setDescBuffer(e.target.value)}
                onBlur={commitMetadata}
                placeholder="What does this agent do?"
                rows={2}
                maxLength={2000}
                className="resize-none"
              />
            </section>

            <section>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="agent-instructions"
                  className="text-xs font-medium uppercase tracking-wide text-muted"
                >
                  Instructions
                </label>
                <span className="text-xs text-muted">
                  {buffer.instructions.length.toLocaleString()} chars
                </span>
              </div>
              <Textarea
                id="agent-instructions"
                value={buffer.instructions}
                readOnly={!isDraft}
                onChange={(e) => updateBuffer({ instructions: e.target.value })}
                placeholder="You are a helpful assistant that…"
                rows={16}
                className={cn(
                  "font-mono text-sm leading-relaxed",
                  !isDraft && "bg-surface/50 text-muted",
                )}
                maxLength={50000}
              />
              {!isDraft && (
                <p className="mt-1 text-xs text-muted">
                  Published versions are read-only. Click{" "}
                  <span className="font-medium">Edit as new draft</span> to change them.
                </p>
              )}
            </section>

            <section>
              <label
                htmlFor="agent-model"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted"
              >
                Model
              </label>
              <Select
                value={buffer.model}
                disabled={!isDraft}
                onValueChange={(v) => updateBuffer({ model: v })}
              >
                <SelectTrigger id="agent-model" className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                  {/* Allow custom model strings to round-trip even if unknown */}
                  {!MODELS.some((m) => m.id === buffer.model) && (
                    <SelectItem value={buffer.model}>{buffer.model}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </section>

            <section>
              {/* biome-ignore lint/a11y/noLabelWithoutControl: ToolsPicker is a custom multi-input picker; visual label is fine */}
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">
                Tools
              </label>
              <ToolsPicker
                selected={buffer.tools}
                disabled={!isDraft}
                onChange={(tools) => updateBuffer({ tools })}
              />
            </section>
          </div>
        </div>

        <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-surface/40 lg:flex">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted">
            <HistoryIcon className="size-3.5" />
            Version history
          </div>
          <VersionHistoryPanel
            versions={versions ?? []}
            selectedId={selectedVersion.id}
            currentVersionId={agent.current_version_id}
            onSelect={setSelectedVersionId}
            onRestore={forkToDraft}
          />
        </aside>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the agent and all {versions?.length ?? 0} version
              {versions?.length === 1 ? "" : "s"}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VersionBadge({ version, isCurrent }: { version: StoredAgentVersion; isCurrent: boolean }) {
  if (version.is_draft) {
    return <Badge variant="outline">draft v{version.version}</Badge>;
  }
  if (isCurrent) {
    return <Badge variant="accent">published · v{version.version}</Badge>;
  }
  return <Badge variant="secondary">v{version.version}</Badge>;
}

function SaveIndicator({
  state,
  error,
  isDraft,
}: {
  state: SaveState;
  error: string | null;
  isDraft: boolean;
}) {
  if (!isDraft) return null;
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <Loader2Icon className="size-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (state === "dirty") {
    return <span className="text-xs text-muted">Unsaved…</span>;
  }
  if (state === "error") {
    return (
      <span className="text-xs text-destructive" title={error ?? undefined}>
        Save failed
      </span>
    );
  }
  return <span className="text-xs text-muted">Draft saved</span>;
}
