"use client";

import { FileTextIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import useSWR from "swr";
import {
  Artifact,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { useKnowledgePanel } from "@/hooks/use-knowledge-panel";
import { getDocument } from "@/lib/documents-client";

/**
 * The knowledge-document side panel (foreman-aqjx). Renders a workspace document
 * (markdown) using the AI Elements Artifact primitives + the same markdown
 * renderer as chat — shown in the live-preview side panel slot so it reads "just
 * like the web preview". Docked in the resizable chat split (shell.tsx).
 */
export function KnowledgePanel() {
  const { path, title, isOpen, close } = useKnowledgePanel();
  const { data, isLoading, error } = useSWR(isOpen && path ? ["document", path] : null, () =>
    getDocument(path),
  );

  if (!isOpen || !path) {
    return null;
  }

  return (
    <div className="m-2 flex min-h-0 flex-1 flex-col overflow-hidden md:m-3">
      <Artifact className="size-full rounded-xl border-foreground/10 bg-card">
        <ArtifactHeader className="border-foreground/10 bg-transparent">
          <ArtifactTitle>{title}</ArtifactTitle>
          <Button className="size-7" onClick={close} size="icon" type="button" variant="ghost">
            <XIcon className="size-4" />
            <span className="sr-only">Close document</span>
          </Button>
        </ArtifactHeader>
        <ArtifactContent>
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

  return (
    <button
      className="inline-flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-left text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.06)] ring-1 ring-foreground/[0.06] transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.96]"
      onClick={() => open({ path, title })}
      type="button"
    >
      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="font-medium text-foreground">{title}</span>
      <span className="text-muted-foreground">· open document</span>
    </button>
  );
}
