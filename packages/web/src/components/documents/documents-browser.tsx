"use client";

import { FileTextIcon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type DocumentMeta,
  getDocument,
  importDocument,
  listDocuments,
  spaceOfPath,
} from "@/lib/documents-client";

/** documents/q3-launch-plan.md → "Q3 Launch Plan" for display. */
function docTitle(name: string): string {
  return name
    .replace(/\.md$/i, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Browse the knowledge documents in the caller's ACTIVE workspace (foreman-iznn).
 * listDocuments() resolves the active workspace server-side from the auth token,
 * so this reflects whichever workspace you're currently in. Click a doc to read
 * it. Shared docs are visible to the whole team; private docs are only yours.
 */
export function DocumentsBrowser() {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<{ path: string; title: string } | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    setError(false);
    listDocuments()
      .then(setDocs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openDoc(doc: DocumentMeta) {
    setOpen({ path: doc.path, title: docTitle(doc.name) });
    setContent(null);
    getDocument(doc.path)
      .then((d) => setContent(d.content))
      .catch(() => setContent("_Couldn't load this document._"));
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same filename
    if (!file) return;
    setImportErr(null);
    if (file.size > 1_000_000) {
      setImportErr("That file is too large (max ~1MB of text).");
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      await importDocument(file.name, text);
      load();
    } catch {
      setImportErr("Couldn't import that file. Make sure it's a text or markdown file.");
    } finally {
      setImporting(false);
    }
  }

  const importControls = (
    <div className="mb-3 flex items-center gap-3">
      <Button disabled={importing} onClick={() => fileInput.current?.click()} size="sm">
        <UploadIcon className="size-4" />
        {importing ? "Importing…" : "Import file"}
      </Button>
      <span className="text-muted-foreground text-xs">Markdown or text files (.md, .txt)</span>
      <input
        accept=".md,.markdown,.txt,.text,text/markdown,text/plain"
        className="hidden"
        onChange={onPickFile}
        ref={fileInput}
        type="file"
      />
    </div>
  );

  if (loading)
    return (
      <>
        {importControls}
        <div className="flex flex-col gap-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton className="h-[42px] rounded-md" key={i} />
          ))}
        </div>
      </>
    );
  if (error)
    return <p className="text-destructive text-sm">Couldn't load your documents. Try again.</p>;

  if (docs.length === 0) {
    return (
      <>
        {importControls}
        {importErr && <p className="mb-3 text-destructive text-sm">{importErr}</p>}
        <div className="rounded-lg border border-dashed p-8 text-center">
          <FileTextIcon className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="font-medium text-sm">No documents yet</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Import a markdown/text file above, or in a chat ask Foreman to save one — e.g. “save a
            document titled Onboarding with these notes…”.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {importControls}
      {importErr && <p className="mb-3 text-destructive text-sm">{importErr}</p>}
      <div className="flex flex-col gap-1">
        {docs.map((doc) => (
          <button
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
            key={doc.path}
            onClick={() => openDoc(doc)}
            type="button"
          >
            <span className="flex min-w-0 items-center gap-2">
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{docTitle(doc.name)}</span>
            </span>
            <Badge variant={spaceOfPath(doc.path) === "personal" ? "outline" : "secondary"}>
              {spaceOfPath(doc.path) === "personal" ? "Private" : "Shared"}
            </Badge>
          </button>
        ))}
      </div>

      <Dialog onOpenChange={(o) => !o && setOpen(null)} open={open !== null}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open?.title}</DialogTitle>
            <DialogDescription className="sr-only">Document contents</DialogDescription>
          </DialogHeader>
          {content === null ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            <div className="prose-sm max-w-none">
              <MessageResponse>{content}</MessageResponse>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
