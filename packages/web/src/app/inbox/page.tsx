import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getWorkspaceInbox } from "@/data/automations";
import type {
  InboxMessage,
  InboxPriorityLevel,
  WorkspaceInboxEntry,
} from "@/data/automations-types";
import { createClient } from "@/lib/server";

type EntryAutomation = WorkspaceInboxEntry["automation"];
type EntryOwner = WorkspaceInboxEntry["owner"];

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  let entries: WorkspaceInboxEntry[] = [];
  let loadErr: string | null = null;
  try {
    ({ entries } = await getWorkspaceInbox());
  } catch (e) {
    loadErr = (e as Error).message;
  }

  const rows = entries
    .flatMap((entry) =>
      entry.messages.map((msg) => ({ msg, automation: entry.automation, owner: entry.owner })),
    )
    .sort((a, b) => (a.msg.created_at < b.msg.created_at ? 1 : -1));
  // Entries arrive ranked highest-priority first (server-side scoring); keep that order.
  const subscriptions = entries.filter((e) => e.inbox);
  const needsAttention = entries.filter((e) => e.priority.level !== "low");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 font-semibold text-2xl tracking-tight">Inbox</h1>
      <p className="mb-6 max-w-2xl text-muted-foreground text-sm">
        Incoming triggers that fire your automations — new rows, webhooks, emails, and more land
        here before Foreman runs.
      </p>

      {loadErr ? (
        <Alert variant="destructive">
          <AlertDescription>Couldn&apos;t load the inbox: {loadErr}</AlertDescription>
        </Alert>
      ) : entries.length === 0 ? (
        <InboxEmpty />
      ) : (
        <div className="space-y-8">
          {needsAttention.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Needs attention ({needsAttention.length})
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {needsAttention.map((entry) => (
                  <AttentionRow key={entry.automation.id} entry={entry} />
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Listening ({subscriptions.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {subscriptions.map((entry) => (
                <SubscriptionCard key={entry.automation.id} entry={entry} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent activity
            </h2>
            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No events yet. When a trigger fires, it shows up here before the run.
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {rows.map(({ msg, automation, owner }) => (
                  <MessageRow key={msg.id} msg={msg} automation={automation} owner={owner} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function triggerLabel(automation: EntryAutomation): string {
  const t = automation.trigger;
  if (t?.app && t?.action) return `${t.app} · ${t.action}`;
  if (t?.app) return t.app;
  return "trigger";
}

function SubscriptionCard({ entry }: { entry: WorkspaceInboxEntry }) {
  const { automation, inbox, owner, priority } = entry;
  const paused = inbox?.paused_reason;
  return (
    <Link
      href={`/automations?selected=${automation.id}`}
      className="block rounded-xl border border-border bg-surface/40 p-4 transition-colors hover:bg-surface/70"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-foreground">{automation.name}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <PriorityPill level={priority.level} />
          <StatusDot ok={!paused && automation.enabled && priority.level !== "high"} />
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {triggerLabel(automation)}
        </span>
        <OwnerChip owner={owner} />
      </div>
      {paused ? (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Paused — {paused}</p>
      ) : priority.reasons.length > 0 && priority.level !== "low" ? (
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {priority.reasons.join(" · ")}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {automation.enabled ? "Active" : "Disabled"}
        </p>
      )}
    </Link>
  );
}

/** One high/medium-priority automation in the "Needs attention" list. */
function AttentionRow({ entry }: { entry: WorkspaceInboxEntry }) {
  const { automation, owner, priority } = entry;
  return (
    <li className="bg-card px-4 py-3 text-sm">
      <Link href={`/automations?selected=${automation.id}`} className="flex items-start gap-3">
        <PriorityDot level={priority.level} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-foreground">{automation.name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {triggerLabel(automation)}
            </span>
            <OwnerChip owner={owner} />
          </div>
          {priority.reasons.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{priority.reasons.join(" · ")}</p>
          )}
        </div>
        <PriorityPill level={priority.level} />
      </Link>
    </li>
  );
}

function MessageRow({
  msg,
  automation,
  owner,
}: {
  msg: InboxMessage;
  automation: EntryAutomation;
  owner: EntryOwner;
}) {
  const dup = msg.message_attributes?.possible_duplicate_data;
  const err = msg.message_attributes?.error_message;
  return (
    <li className="flex items-start gap-3 bg-card px-4 py-3 text-sm">
      <StatusDot ok={!err} className="mt-1.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-foreground">{automation.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {triggerLabel(automation)}
          </span>
          <OwnerChip owner={owner} />
          <Badge>{msg.status}</Badge>
          {dup && <Badge tone="warn">duplicate</Badge>}
        </div>
        {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
      </div>
      <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {new Date(msg.created_at).toLocaleString()}
      </time>
    </li>
  );
}

function OwnerChip({ owner }: { owner: EntryOwner }) {
  if (owner.isSelf) return null;
  return <Badge tone="teammate">teammate</Badge>;
}

function PriorityPill({ level }: { level: InboxPriorityLevel }) {
  if (level === "low") return null;
  const label = level === "high" ? "High" : "Medium";
  const cls =
    level === "high"
      ? "bg-destructive/10 text-destructive"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function PriorityDot({ level, className = "" }: { level: InboxPriorityLevel; className?: string }) {
  const color =
    level === "high"
      ? "bg-destructive"
      : level === "medium"
        ? "bg-amber-500"
        : "bg-muted-foreground";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color} ${className}`} aria-hidden />;
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "warn" | "teammate" }) {
  const cls =
    tone === "warn"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : tone === "teammate"
        ? "bg-accent/10 text-accent-foreground/80"
        : "bg-surface text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}

function StatusDot({ ok, className = "" }: { ok: boolean; className?: string }) {
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${ok ? "bg-green-500" : "bg-amber-500"} ${className}`}
      aria-hidden
    />
  );
}

function InboxEmpty() {
  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyTitle>No inbox activity yet</EmptyTitle>
        <EmptyDescription>
          When you have an automation with a trigger, every incoming event — a new row, a webhook,
          an email — lands here before Foreman runs it. Ask Foreman in chat to build an automation
          to start listening.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/chat"
            className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            Go to chat
          </Link>
          <Link
            href="/automations"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
          >
            View automations
          </Link>
        </div>
      </EmptyContent>
    </Empty>
  );
}
