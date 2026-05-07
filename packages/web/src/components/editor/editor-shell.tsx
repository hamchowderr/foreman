"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BotIcon, LogOut, PlusIcon } from "lucide-react";
import { createClient } from "@/lib/client";
import { EditorSidebarAgents } from "./editor-sidebar-agents";

export function EditorShell({
  user,
  children,
}: {
  user: { id: string; email: string };
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push("/");
  };

  return (
    <div className="flex h-dvh w-full bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Link
            href="/editor"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <BotIcon className="size-4 text-accent" />
            Agent Editor
          </Link>
          <button
            type="button"
            onClick={() => router.push("/editor?new=1")}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
            title="New agent"
          >
            <PlusIcon className="size-3" />
            New
          </button>
        </div>
        <EditorSidebarAgents />
        <div className="mt-auto border-t border-border px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-muted">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-background hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-background/95 px-5 py-3 backdrop-blur md:hidden">
          <Link
            href="/editor"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <BotIcon className="size-4 text-accent" />
            Agent Editor
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md p-1 text-muted transition-colors hover:bg-muted hover:text-foreground"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
