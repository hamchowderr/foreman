"use client";

import { FileTextIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type DocumentMeta, getDocument, listDocuments, spaceOfPath } from "@/lib/documents-client";

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

  useEffect(() => {
    setLoading(true);
    setError(false);
    listDocuments()
      .then(setDocs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  function openDoc(doc: DocumentMeta) {
    setOpen({ path: doc.path, title: docTitle(doc.name) });
    setContent(null);
    getDocument(doc.path)
      .then((d) => setContent(d.content))
      .catch(() => setContent("_Couldn't load this document._"));
  }

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (error)
    return <p className="text-destructive text-sm">Couldn't load your documents. Try again.</p>;

  if (docs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <FileTextIcon className="mx-auto mb-2 size-6 text-muted-foreground" />
        <p className="font-medium text-sm">No documents yet</p>
        <p className="mt-1 text-muted-foreground text-sm">
          In a chat, ask Foreman to save one — e.g. “save a document titled Onboarding with these
          notes…”. It’ll show up here.
        </p>
      </div>
    );
  }

  return (
    <>
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
            <p className="text-muted-foreground text-sm">Loading…</p>
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
