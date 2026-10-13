"use client";

import { CheckIcon, CopyIcon, LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { chatShareUrl, getChatShare, shareChat, unshareChat } from "@/lib/chat-shares-client";

/**
 * Share one chat by public link (foreman-mk25). Anyone with the link can read the
 * chat on a logged-out page; they can't send messages. Turning sharing off kills
 * the link. `thread` null closes the dialog.
 */
export function ShareChatDialog({
  thread,
  onClose,
}: {
  thread: { id: string; title: string } | null;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!thread) return;
    let cancelled = false;
    setToken(null);
    setCopied(false);
    setLoading(true);
    getChatShare(thread.id)
      .then((s) => !cancelled && setToken(s.token))
      .catch(() => !cancelled && toast.error("Couldn't load the share link"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [thread]);

  const create = async () => {
    if (!thread) return;
    setLoading(true);
    try {
      setToken((await shareChat(thread.id)).token);
    } catch {
      toast.error("Couldn't create the link");
    } finally {
      setLoading(false);
    }
  };

  const stop = async () => {
    if (!thread) return;
    setLoading(true);
    try {
      await unshareChat(thread.id);
      setToken(null);
      toast.success("Sharing turned off");
    } catch {
      toast.error("Couldn't turn sharing off");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(chatShareUrl(token));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={thread !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">Share “{thread?.title}”</DialogTitle>
          <DialogDescription className="text-pretty">
            Anyone with the link can read this chat, including what's added later. They can't send
            messages.
          </DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={chatShareUrl(token)}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Share link"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={copy}
              aria-label="Copy link"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border transition-[scale] active:scale-[0.96]"
            >
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            </button>
          </div>
        ) : null}

        <DialogFooter>
          {token ? (
            <button
              type="button"
              disabled={loading}
              onClick={stop}
              className="h-9 rounded-lg border border-border px-4 font-medium text-destructive text-sm transition-[scale] active:scale-[0.96] disabled:opacity-50"
            >
              Stop sharing
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={create}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground text-sm transition-[scale] active:scale-[0.96] disabled:opacity-50"
            >
              <LinkIcon className="size-4" />
              Create link
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
