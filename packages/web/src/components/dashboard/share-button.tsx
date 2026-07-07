"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Mint (and copy) a public share link for a dashboard. POSTs through the
 * `/api/apps/*` proxy, which injects the owner's Supabase JWT; the agent
 * returns a token + the `/d/<token>` path that the public page serves.
 */
export function ShareButton({ artifactId }: { artifactId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);

  async function share() {
    setState("loading");
    try {
      const res = await fetch(`/api/apps/artifacts/${encodeURIComponent(artifactId)}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`share → ${res.status}`);
      const { url: path } = (await res.json()) as { url: string };
      const absolute = `${window.location.origin}${path}`;
      setUrl(absolute);
      try {
        await navigator.clipboard.writeText(absolute);
        setState("copied");
      } catch {
        // Clipboard blocked (e.g. insecure context) — still surface the link.
        setState("idle");
      }
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        onClick={share}
        disabled={state === "loading"}
        variant="outline"
        size="sm"
      >
        {state === "loading"
          ? "Creating…"
          : state === "copied"
            ? "Link copied ✓"
            : state === "error"
              ? "Failed — retry"
              : "Share"}
      </Button>
      {url && (
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Public share link"
          className="w-72 max-w-full rounded-md border px-2 py-1 text-xs text-muted-foreground"
        />
      )}
    </div>
  );
}
