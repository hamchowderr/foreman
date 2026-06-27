"use client";

import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  HistoryIcon,
  Link2OffIcon,
  LockIcon,
  RotateCcwIcon,
  Share2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  Artifact,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKnowledgePanel } from "@/hooks/use-knowledge-panel";
import {
  type DocumentShare,
  getDocument,
  getDocumentShare,
  getDocumentVersion,
  listDocumentVersions,
  restoreDocumentVersion,
  shareDocument,
  spaceOfPath,
  unshareDocument,
} from "@/lib/documents-client";

/** A compact Space badge — "Private" (personal) or "Shared" (team). */
function SpaceBadge({ path }: { path: string }) {
  const personal = spaceOfPath(path) === "personal";
  return (
    <span
      className={
        personal
          ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-[11px] text-amber-600 dark:text-amber-500"
          : "inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground"
      }
    >
      {personal ? <LockIcon className="size-3" /> : <UsersIcon className="size-3" />}
      {personal ? "Private" : "Shared"}
    </span>
  );
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Share a knowledge document via a public link (foreman-jz14). Mints/revokes a
 * capability token through /documents/share; the link opens the logged-out
 * /doc/<token> page. Lazy-loads the current share state when the popover opens.
 */
function DocumentShareButton({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  // undefined = not loaded yet, null = not shared, object = shared.
  const [share, setShare] = useState<DocumentShare | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Forget cached state when the document changes.
  useEffect(() => {
    setShare(undefined);
    setCopied(false);
  }, [path]);

  // Load share state the first time the popover opens for this document.
  useEffect(() => {
    if (open && share === undefined) {
      getDocumentShare(path)
        .then(setShare)
        .catch(() => setShare(null));
    }
  }, [open, share, path]);

  const url =
    share && typeof window !== "undefined" ? `${window.location.origin}/doc/${share.token}` : null;

  async function createLink() {
    setBusy(true);
    try {
      setShare(await shareDocument(path));
    } finally {
      setBusy(false);
    }
  }

  async function stopSharing() {
    if (!share) return;
    setBusy(true);
    try {
      await unshareDocument(share.token);
      setShare(null);
      setCopied(false);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context) — link is still visible to copy.
    }
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button className="size-7" size="icon" type="button" variant="ghost">
          <Share2Icon className={share ? "size-4 text-primary" : "size-4"} />
          <span className="sr-only">Share document</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="font-medium text-sm">Share document</p>
        {share === undefined ? (
          <p className="mt-2 text-muted-foreground text-sm">Loading…</p>
        ) : share ? (
          <div className="mt-3 space-y-3">
            <p className="text-muted-foreground text-xs">Anyone with this link can view it.</p>
            <div className="flex items-center gap-1.5">
              <input
                className="min-w-0 flex-1 rounded-md border bg-muted/40 px-2 py-1.5 text-xs"
                onFocus={(e) => e.currentTarget.select()}
                readOnly
                value={url ?? ""}
              />
              <Button className="h-8 shrink-0 gap-1" onClick={copy} size="sm" variant="outline">
                {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <button
              className="inline-flex items-center gap-1.5 text-destructive text-xs hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={stopSharing}
              type="button"
            >
              <Link2OffIcon className="size-3.5" />
              Stop sharing
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-muted-foreground text-xs">
              Create a public link anyone can open — no account needed.
            </p>
            <Button className="w-full gap-1.5" disabled={busy} onClick={createLink} size="sm">
              <Share2Icon className="size-3.5" />
              {busy ? "Creating…" : "Create public link"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The knowledge-document side panel (foreman-aqjx). Renders a workspace document
 * (markdown) using the AI Elements Artifact primitives + the same markdown
 * renderer as chat — shown in the live-preview side panel slot so it reads "just
 * like the web preview". Docked in the resizable chat split (shell.tsx).
 *
 * Version history (foreman-udji): a dropdown lists every revision (from the
 * Mastra BlobStore-backed version manifest). Picking an older revision shows its
 * content read-only with a Restore action; the live document is always the
 * default selection.
 */
export function KnowledgePanel() {
  const { path, title, isOpen, close } = useKnowledgePanel();
  const { mutate } = useSWRConfig();
  // null = view the live/current document.
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Reset to the live view whenever a different document is opened.
  useEffect(() => {
    setViewVersion(null);
  }, [path]);

  const { data: history } = useSWR(isOpen && path ? ["doc-versions", path] : null, () =>
    listDocumentVersions(path),
  );
  const current = history?.current ?? null;
  const isHistorical = viewVersion !== null && current !== null && viewVersion !== current;

  const { data, isLoading, error } = useSWR(
    isOpen && path ? ["document", path, isHistorical ? viewVersion : "current"] : null,
    () => (isHistorical ? getDocumentVersion(path, viewVersion as number) : getDocument(path)),
  );

  if (!isOpen || !path) {
    return null;
  }

  const hasHistory = (history?.versions.length ?? 0) > 0;
  const selectValue = isHistorical ? String(viewVersion) : "current";

  async function handleRestore() {
    if (viewVersion === null) return;
    setRestoring(true);
    try {
      await restoreDocumentVersion(path, viewVersion);
      setViewVersion(null);
      // Refresh the version list + every cached view of this document.
      await mutate(["doc-versions", path]);
      await mutate(
        (key) => Array.isArray(key) && key[0] === "document" && key[1] === path,
        undefined,
        { revalidate: true },
      );
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="m-2 flex min-h-0 flex-1 flex-col overflow-hidden md:m-3">
      <Artifact className="size-full rounded-xl border-foreground/10 bg-card">
        <ArtifactHeader className="gap-2 border-foreground/10 bg-transparent">
          <ArtifactTitle className="min-w-0 flex-1 truncate">{title}</ArtifactTitle>
          <SpaceBadge path={path} />
          {hasHistory && (
            <Select
              onValueChange={(v) => setViewVersion(v === "current" ? null : Number(v))}
              value={selectValue}
            >
              <SelectTrigger className="h-7 w-auto gap-1.5 border-foreground/10 text-xs" size="sm">
                <HistoryIcon className="size-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {history?.versions.map((v) => (
                  <SelectItem className="text-xs" key={v.version} value={String(v.version)}>
                    v{v.version}
                    {v.version === current ? " · current" : ""}
                    {v.note ? ` · ${v.note}` : ""}
                    <span className="ml-2 text-muted-foreground">{formatStamp(v.createdAt)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isHistorical && (
            <Button
              className="h-7 gap-1.5 text-xs"
              disabled={restoring}
              onClick={handleRestore}
              size="sm"
              type="button"
              variant="outline"
            >
              <RotateCcwIcon className="size-3.5" />
              {restoring ? "Restoring…" : "Restore"}
            </Button>
          )}
          <DocumentShareButton path={path} />
          <Button className="size-7" onClick={close} size="icon" type="button" variant="ghost">
            <XIcon className="size-4" />
            <span className="sr-only">Close document</span>
          </Button>
        </ArtifactHeader>
        <ArtifactContent>
          {isHistorical && (
            <p className="mb-3 rounded-md bg-muted/60 px-3 py-1.5 text-muted-foreground text-xs">
              Viewing version {viewVersion} (read-only). Restore to make it the live document.
            </p>
          )}
          {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
          {error && <p className="text-destructive text-sm">Couldn&apos;t load this document.</p>}
          {data && <MessageResponse>{data.content}</MessageResponse>}
        </ArtifactContent>
      </Artifact>
    </div>
  );
}

/**
 * Inline chat chip for a finished save_document tool call (mirrors
 * PreviewInlineChip). Auto-opens the panel once when it mounts, and stays
 * clickable to re-open it. Rendered in message.tsx.
 */
export function DocumentInlineChip({ path, title }: { path: string; title: string }) {
  const { open } = useKnowledgePanel();
  const autoOpened = useRef(false);

  useEffect(() => {
    if (autoOpened.current) {
      return;
    }
    autoOpened.current = true;
    open({ path, title });
  }, [path, title, open]);

  const personal = spaceOfPath(path) === "personal";

  return (
    <button
      className="inline-flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-left text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.06)] ring-1 ring-foreground/[0.06] transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.96]"
      onClick={() => open({ path, title })}
      type="button"
    >
      {personal ? (
        <LockIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
      ) : (
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="font-medium text-foreground">{title}</span>
      <span className="text-muted-foreground">· {personal ? "private note" : "open document"}</span>
    </button>
  );
}
