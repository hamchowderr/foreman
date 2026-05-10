"use client";

import { SearchIcon, ShieldAlertIcon, ShieldCheckIcon, WrenchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/client";
import { type CatalogTool, storedAgentsApi } from "@/lib/stored-agents-client";
import { cn } from "@/lib/utils";

interface ToolsPickerProps {
  selected: string[];
  onChange: (tools: string[]) => void;
  disabled?: boolean;
}

export function ToolsPicker({ selected, onChange, disabled }: ToolsPickerProps) {
  const { data, isLoading, error } = useSWR(
    ["stored-agents-tools"],
    async () => {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      const res = await storedAgentsApi.listTools(session?.access_token ?? "");
      return res.tools;
    },
    { revalidateOnFocus: false },
  );

  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const grouped = useMemo(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? data.filter(
          (t) => t.id.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
        )
      : data;

    const custom: CatalogTool[] = [];
    const readOnly: CatalogTool[] = [];
    const write: CatalogTool[] = [];
    for (const t of filtered) {
      if (t.category === "custom") custom.push(t);
      else if (t.read_only) readOnly.push(t);
      else write.push(t);
    }
    return { custom, readOnly, write };
  }, [data, query]);

  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  // Show "orphaned" selections — tools picked on a prior draft that are no
  // longer in the catalog (e.g. SDK dropped them). Keep them visible so they
  // can be removed.
  const orphans = useMemo(() => {
    if (!data) return [];
    const known = new Set(data.map((t) => t.id));
    return selected.filter((id) => !known.has(id));
  }, [data, selected]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border p-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="shrink-0 text-xs text-muted">{selected.length} selected</div>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-2">
        {isLoading && <p className="p-3 text-sm text-muted">Loading tool catalog…</p>}
        {error && (
          <p className="p-3 text-sm text-destructive">
            Failed to load tools: {(error as Error).message}
          </p>
        )}

        {grouped && (
          <>
            <Group
              title="Foreman tools"
              subtitle="Always safe, custom integrations"
              icon={<WrenchIcon className="size-3.5" />}
              tools={grouped.custom}
              selectedSet={selectedSet}
              onToggle={toggle}
              disabled={disabled}
            />
            <Group
              title="Read-only Zapier tools"
              subtitle="Safe lookups — no writes, no approval needed"
              icon={<ShieldCheckIcon className="size-3.5 text-accent" />}
              tools={grouped.readOnly}
              selectedSet={selectedSet}
              onToggle={toggle}
              disabled={disabled}
            />
            <Group
              title="Write / destructive tools"
              subtitle="Execute actions — approval required at runtime"
              icon={<ShieldAlertIcon className="size-3.5 text-destructive" />}
              tools={grouped.write}
              selectedSet={selectedSet}
              onToggle={toggle}
              disabled={disabled}
            />

            {orphans.length > 0 && (
              <div className="mt-2 rounded-md border border-dashed border-border p-3">
                <p className="mb-2 text-xs text-muted">
                  Tools no longer in catalog (kept so you can remove them):
                </p>
                <div className="flex flex-wrap gap-2">
                  {orphans.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      disabled={disabled}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs hover:border-destructive hover:text-destructive disabled:opacity-50"
                    >
                      {id}
                      <span aria-hidden>×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Group({
  title,
  subtitle,
  icon,
  tools,
  selectedSet,
  onToggle,
  disabled,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tools: CatalogTool[];
  selectedSet: Set<string>;
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  if (tools.length === 0) return null;
  const selectedCount = tools.filter((t) => selectedSet.has(t.id)).length;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-2 py-1.5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {icon}
            {title}
          </div>
          <div className="text-[11px] text-muted">{subtitle}</div>
        </div>
        <Badge variant="outline">
          {selectedCount}/{tools.length}
        </Badge>
      </div>
      <ul className="space-y-0.5">
        {tools.map((t) => {
          const checked = selectedSet.has(t.id);
          return (
            <li key={t.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                  checked ? "bg-accent/5" : "hover:bg-surface",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(t.id)}
                  className="mt-0.5 size-3.5 accent-accent"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono text-xs font-medium">{t.id}</code>
                    {t.requires_approval && (
                      <span className="rounded-sm bg-destructive/10 px-1 text-[10px] font-medium text-destructive">
                        approval
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted">{t.description}</p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
