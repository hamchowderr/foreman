"use client";

import { CheckIcon, CopyIcon, Share2Icon } from "lucide-react";
import { useState } from "react";
import { type ChatShareLink, getChatShareLink, shareChat, unshareChat } from "@/app/chat/actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Mint / copy / revoke a public (logged-out) share link for a chat (foreman-mk25).
 * The token is the capability — anyone with the `/c/<token>` URL can read the chat
 * read-only, no account. Owner-only; rendered in the chat header next to the
 * Private/Team visibility selector.
 */
export function ShareButton({ chatId }: { chatId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [link, setLink] = useState<ChatShareLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const absolute = link ? `${window.location.origin}${link.url}` : null;

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !loaded) {
      try {
        setLink(await getChatShareLink(chatId));
      } catch {
        // leave link null; the create button still works
      } finally {
        setLoaded(true);
      }
    }
  }

  async function create() {
    setBusy(true);
    try {
      const created = await shareChat(chatId);
      setLink(created);
      await copy(`${window.location.origin}${created.url}`);
    } catch {
      // surface nothing destructive; user can retry
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!link) return;
    setBusy(true);
    try {
      await unshareChat(link.token);
      setLink(null);
      setCopied(false);
    } catch {
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked (insecure context) — the input still shows the link
    }
  }

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="gap-1.5 rounded-lg border-border/50 text-muted-foreground shadow-none hover:text-foreground"
          size="sm"
          variant="outline"
        >
          <Share2Icon className="size-4" />
          <span className="md:sr-only">Share</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <p className="font-medium text-sm">Public link</p>
          <p className="text-muted-foreground text-xs">
            Anyone with the link can view this chat read-only — no account needed.
          </p>
        </div>

        {!loaded ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : absolute ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                aria-label="Public share link"
                className="min-w-0 flex-1 rounded-md border px-2 py-1 text-muted-foreground text-xs"
                onFocus={(e) => e.currentTarget.select()}
                readOnly
                value={absolute}
              />
              <Button onClick={() => copy(absolute)} size="icon-sm" type="button" variant="outline">
                {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              </Button>
            </div>
            <Button
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={revoke}
              size="sm"
              type="button"
              variant="ghost"
            >
              Revoke link
            </Button>
          </div>
        ) : (
          <Button className="w-full" disabled={busy} onClick={create} size="sm" type="button">
            {busy ? "Creating…" : "Create public link"}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
