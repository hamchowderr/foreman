"use client";

import { ExternalLink, PanelRight } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  Artifact,
  ArtifactActions,
  ArtifactClose,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import { usePreviewPanel } from "@/hooks/use-preview-panel";

/**
 * The live-preview side panel (foreman-q4kf). Renders the AI Elements Artifact
 * container wrapping the WebPreview iframe, shown in the right pane of the chat
 * shell when a preview is open. Returns null when closed so the shell collapses
 * the split back to a full-width chat.
 */
export function PreviewPanel() {
  const { url, title, isOpen, close } = usePreviewPanel();

  if (!isOpen || !url) {
    return null;
  }

  return (
    <Artifact className="m-2 flex-1 rounded-xl border-foreground/10">
      <ArtifactHeader className="border-b-foreground/10">
        <ArtifactTitle>{title}</ArtifactTitle>
        <ArtifactActions>
          <ArtifactClose onClick={close} />
        </ArtifactActions>
      </ArtifactHeader>
      <WebPreview className="flex-1 rounded-none border-0" defaultUrl={url}>
        <WebPreviewNavigation className="border-b-foreground/10">
          <WebPreviewUrl readOnly value={url} />
          <WebPreviewNavigationButton
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            tooltip="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>
        <WebPreviewBody src={url} title={title} />
      </WebPreview>
    </Artifact>
  );
}

/**
 * Inline chat chip for a finished preview_app tool call. Auto-opens the side
 * panel once when it first mounts (the live result), and stays clickable to
 * re-open it after the user closes the panel. Rendered in place of the old
 * inline iframe in message.tsx.
 */
export function PreviewInlineChip({ url, title }: { url: string; title: string }) {
  const { open } = usePreviewPanel();
  const autoOpened = useRef(false);

  useEffect(() => {
    if (autoOpened.current) {
      return;
    }
    autoOpened.current = true;
    open(url, title);
  }, [url, title, open]);

  return (
    <button
      className="inline-flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-left text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.06)] ring-1 ring-foreground/[0.06] transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.96]"
      onClick={() => open(url, title)}
      type="button"
    >
      <PanelRight className="size-4 shrink-0 text-muted-foreground" />
      <span className="font-medium text-foreground">{title}</span>
      <span className="text-muted-foreground">· open preview</span>
    </button>
  );
}
