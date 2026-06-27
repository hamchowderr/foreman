"use client";

import { ExternalLink, PanelRight, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { CodeBlock } from "@/components/ai-elements/code-block";
import {
  SandboxTabContent,
  SandboxTabs,
  SandboxTabsBar,
  SandboxTabsList,
  SandboxTabsTrigger,
} from "@/components/ai-elements/sandbox";
import {
  Terminal,
  TerminalContent,
  TerminalHeader,
  TerminalTitle,
} from "@/components/ai-elements/terminal";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import { Button } from "@/components/ui/button";
import { usePreviewPanel } from "@/hooks/use-preview-panel";

/**
 * The live-preview side panel (foreman-q4kf / foreman-8nyg). A Sandbox-style
 * tabbed view of what the agent built: Preview (the live WebPreview iframe),
 * Code (the generated component source), and Terminal (the real build log,
 * including the self-heal). Docked in the resizable chat split.
 */
export function PreviewPanel() {
  const { url, title, source, log, isOpen, close } = usePreviewPanel();

  if (!isOpen || !url) {
    return null;
  }

  return (
    <div className="m-2 flex flex-1 flex-col overflow-hidden rounded-xl border border-foreground/10 bg-card shadow-sm">
      <div className="flex items-center justify-between border-foreground/10 border-b px-3 py-2">
        <span className="font-medium text-foreground text-sm">{title}</span>
        <Button className="size-7" onClick={close} size="icon" type="button" variant="ghost">
          <XIcon className="size-4" />
          <span className="sr-only">Close preview</span>
        </Button>
      </div>

      <SandboxTabs className="flex min-h-0 flex-1 flex-col gap-0" defaultValue="preview">
        <SandboxTabsBar>
          <SandboxTabsList>
            <SandboxTabsTrigger value="preview">Preview</SandboxTabsTrigger>
            <SandboxTabsTrigger value="code">Code</SandboxTabsTrigger>
            <SandboxTabsTrigger value="terminal">Terminal</SandboxTabsTrigger>
          </SandboxTabsList>
        </SandboxTabsBar>

        <SandboxTabContent className="min-h-0 flex-1" value="preview">
          <WebPreview className="size-full rounded-none border-0" defaultUrl={url}>
            <WebPreviewNavigation>
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
        </SandboxTabContent>

        <SandboxTabContent className="min-h-0 flex-1 overflow-auto" value="code">
          {source ? (
            <CodeBlock code={source} language="tsx" showLineNumbers />
          ) : (
            <div className="p-4 text-muted-foreground text-sm">No source available.</div>
          )}
        </SandboxTabContent>

        <SandboxTabContent className="min-h-0 flex-1" value="terminal">
          {log ? (
            <Terminal className="size-full rounded-none border-0" output={log}>
              <TerminalHeader>
                <TerminalTitle />
              </TerminalHeader>
              <TerminalContent className="max-h-none min-h-0 flex-1" />
            </Terminal>
          ) : (
            <div className="p-4 text-muted-foreground text-sm">No build log.</div>
          )}
        </SandboxTabContent>
      </SandboxTabs>
    </div>
  );
}

/**
 * Inline chat chip for a finished preview_app tool call. Auto-opens the side
 * panel once when it first mounts (the live result), and stays clickable to
 * re-open it after the user closes the panel. Rendered in message.tsx.
 */
export function PreviewInlineChip({
  url,
  title,
  source,
  log,
}: {
  url: string;
  title: string;
  source?: string;
  log?: string;
}) {
  const { open } = usePreviewPanel();
  const autoOpened = useRef(false);

  useEffect(() => {
    if (autoOpened.current) {
      return;
    }
    autoOpened.current = true;
    open({ url, title, source, log });
  }, [url, title, source, log, open]);

  return (
    <button
      className="inline-flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-left text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.06)] ring-1 ring-foreground/[0.06] transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.96]"
      onClick={() => open({ url, title, source, log })}
      type="button"
    >
      <PanelRight className="size-4 shrink-0 text-muted-foreground" />
      <span className="font-medium text-foreground">{title}</span>
      <span className="text-muted-foreground">· open preview</span>
    </button>
  );
}
