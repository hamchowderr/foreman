"use client";

import { ExternalLinkIcon, RotateCwIcon } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Web Preview (Vercel AI Elements style) — a faux browser frame around an iframe,
 * used to embed a live URL (e.g. a server the agent spawned in the sandbox) inline
 * in chat. Compound component: WebPreview > WebPreviewNavigation > WebPreviewUrl,
 * then WebPreviewBody.
 */

type WebPreviewContextValue = {
  url: string;
  setUrl: (url: string) => void;
  /** Bumped to force the iframe to reload. */
  reloadKey: number;
  reload: () => void;
};

const WebPreviewContext = createContext<WebPreviewContextValue | null>(null);

function useWebPreview() {
  const ctx = useContext(WebPreviewContext);
  if (!ctx) throw new Error("WebPreview components must be used within <WebPreview>");
  return ctx;
}

export function WebPreview({
  defaultUrl = "",
  className,
  children,
}: {
  defaultUrl?: string;
  className?: string;
  children: ReactNode;
}) {
  const [url, setUrl] = useState(defaultUrl);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const value = useMemo(() => ({ url, setUrl, reloadKey, reload }), [url, reloadKey, reload]);

  return (
    <WebPreviewContext.Provider value={value}>
      <div
        className={cn(
          "flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-card",
          className,
        )}
      >
        {children}
      </div>
    </WebPreviewContext.Provider>
  );
}

export function WebPreviewNavigation({ className }: { className?: string }) {
  const { url, reload } = useWebPreview();
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 border-b border-border bg-surface/60 px-2 py-1.5",
        className,
      )}
    >
      <span className="flex gap-1.5 pl-1 pr-1">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
      </span>
      <WebPreviewUrl />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7 shrink-0"
        onClick={reload}
        title="Reload"
      >
        <RotateCwIcon className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7 shrink-0"
        asChild
        title="Open in new tab"
      >
        <a href={url || undefined} target="_blank" rel="noreferrer">
          <ExternalLinkIcon className="size-3.5" />
        </a>
      </Button>
    </div>
  );
}

export function WebPreviewUrl({ className }: { className?: string }) {
  const { url } = useWebPreview();
  return (
    <span
      className={cn(
        "min-w-0 flex-1 truncate rounded-md bg-background px-3 py-1 font-mono text-xs text-muted-foreground",
        className,
      )}
      title={url}
    >
      {url || "about:blank"}
    </span>
  );
}

export function WebPreviewBody({
  src,
  title = "Preview",
  className,
}: {
  src?: string;
  title?: string;
  className?: string;
}) {
  const { url, reloadKey } = useWebPreview();
  const resolved = src ?? url;
  return (
    <iframe
      key={reloadKey}
      src={resolved || undefined}
      title={title}
      className={cn("h-full min-h-[320px] w-full border-0 bg-white", className)}
      // Sandbox the embedded preview: allow scripts + same-origin so a built app
      // runs, but block top-navigation/popups. (Tighten further before prod.)
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
  );
}
