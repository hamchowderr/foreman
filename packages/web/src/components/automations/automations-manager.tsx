"use client";

import {
  ExternalLinkIcon,
  InboxIcon,
  PlayIcon,
  RefreshCwIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteAutomation,
  getAutomation,
  getAutomations,
  getInboxState,
  runAutomation,
  setAutomationEnabled,
} from "@/data/automations";
import type { Automation, AutomationDetail, InboxState } from "@/data/automations-types";

function statusVariant(status: string, enabled: boolean): "default" | "secondary" | "destructive" {
  if (status === "trigger_claim_failed") return "destructive";
  return enabled ? "default" : "secondary";
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function AutomationsManager() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AutomationDetail | null>(null);
  const [inbox, setInbox] = useState<InboxState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadList = useCallback(() => {
    getAutomations()
      .then((rows) => {
        setAutomations(rows);
        setSelectedId((cur) => cur ?? rows[0]?.id ?? null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadDetail = useCallback((id: string) => {
    setDetail(null);
    setInbox(null);
    setConfirmDelete(false);
    getAutomation(id)
      .then(setDetail)
      .catch((e) => setError((e as Error).message));
    getInboxState(id)
      .then(setInbox)
      .catch(() => setInbox(null));
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  function act(fn: () => Promise<unknown>, reloadList = false) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        if (selectedId) loadDetail(selectedId);
        if (reloadList) loadList();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading automations…</p>;
  }

  if (automations.length === 0) {
    return (
      <Empty className="rounded-xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ZapIcon className="size-5" />
          </EmptyMedia>
          <EmptyTitle>No automations yet</EmptyTitle>
          <EmptyDescription>
            Ask Foreman in chat to build one — e.g. "every time a GitHub issue is opened, post it to
            Slack." Deployed automations show up here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const selected = detail?.automation ?? automations.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      {error && <p className="text-destructive text-sm md:col-span-2">{error}</p>}

      {/* List */}
      <ul className="flex flex-col gap-1">
        {automations.map((a) => (
          <li key={a.id}>
            <button
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                a.id === selectedId
                  ? "border-border bg-muted"
                  : "border-transparent hover:bg-muted/50"
              }`}
              onClick={() => setSelectedId(a.id)}
              type="button"
            >
              <span className="truncate font-medium">{a.name}</span>
              <Badge variant={statusVariant(a.status, a.enabled)}>{a.enabled ? "on" : "off"}</Badge>
            </button>
          </li>
        ))}
      </ul>

      {/* Detail */}
      {selected && (
        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-semibold text-lg">{selected.name}</h2>
                <Badge variant={statusVariant(selected.status, selected.enabled)}>
                  {selected.status}
                </Badge>
              </div>
              {selected.description && (
                <p className="mt-0.5 text-muted-foreground text-sm">{selected.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                aria-label="Enabled"
                checked={selected.enabled}
                disabled={pending}
                onCheckedChange={(v) => act(() => setAutomationEnabled(selected.id, v))}
              />
              <span className="text-muted-foreground text-xs">
                {selected.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={pending}
              onClick={() => act(() => runAutomation(selected.id))}
              size="sm"
              variant="outline"
            >
              <PlayIcon className="size-4" /> Run now
            </Button>
            {selected.editor_url && (
              <Button asChild size="sm" variant="ghost">
                <a href={selected.editor_url} rel="noopener noreferrer" target="_blank">
                  <ExternalLinkIcon className="size-4" /> Editor
                </a>
              </Button>
            )}
            {confirmDelete ? (
              <Button
                disabled={pending}
                onClick={() => act(() => deleteAutomation(selected.id), true)}
                size="sm"
                variant="destructive"
              >
                <Trash2Icon className="size-4" /> Confirm delete
              </Button>
            ) : (
              <Button
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
                size="sm"
                variant="ghost"
              >
                <Trash2Icon className="size-4" /> Delete
              </Button>
            )}
          </div>

          <Tabs className="mt-4" defaultValue="runs">
            <TabsList>
              <TabsTrigger value="runs">
                <RefreshCwIcon className="size-3.5" /> Runs
              </TabsTrigger>
              <TabsTrigger value="inbox">
                <InboxIcon className="size-3.5" /> Trigger inbox
              </TabsTrigger>
            </TabsList>

            <TabsContent value="runs">
              {detail && detail.runs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Durable run</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.runs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(r.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.status === "failed" ? "destructive" : "secondary"}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.durable_run_id ? shortId(r.durable_run_id) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-4 text-muted-foreground text-sm">No runs yet.</p>
              )}
            </TabsContent>

            <TabsContent value="inbox">
              {!selected.trigger ? (
                <p className="py-4 text-muted-foreground text-sm">
                  Manual automation — no trigger inbox. Use “Run now” to fire it.
                </p>
              ) : inbox?.inbox ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={inbox.inbox.status === "active" ? "default" : "secondary"}>
                      {inbox.inbox.status}
                    </Badge>
                    <span className="font-mono text-muted-foreground text-xs">
                      {inbox.inbox.subscription.app_key}/{inbox.inbox.subscription.action_key}
                    </span>
                  </div>
                  {inbox.messages.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Message</TableHead>
                          <TableHead>When</TableHead>
                          <TableHead>Leases</TableHead>
                          <TableHead>Dup?</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inbox.messages.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-mono text-xs">{shortId(m.id)}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {new Date(m.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>{m.message_attributes.lease_count}</TableCell>
                            <TableCell>
                              {m.message_attributes.possible_duplicate_data ? (
                                <Badge variant="destructive">dup</Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Inbox armed, no messages yet. The first poll of a fresh subscription can take
                      several minutes.
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-4 text-muted-foreground text-sm">
                  Not armed yet — the worker creates the trigger inbox on its next cycle.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
