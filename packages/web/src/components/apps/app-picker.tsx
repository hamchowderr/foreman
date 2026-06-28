"use client";

import { useRouter } from "next/navigation";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

interface AppOption {
  appKey: string;
  rowCount: number;
}

/**
 * Searchable picker for switching the Apps page between the workspace's apps.
 * Replaces the URL-param-only app switch with a real combobox so the apps are
 * discoverable and filterable (foreman-1ybk). Selecting an app navigates to
 * `/apps?app=<key>`, which re-runs the server component with new data.
 */
export function AppPicker({ apps, current }: { apps: AppOption[]; current: string }) {
  const router = useRouter();
  const items = apps.map((a) => a.appKey);
  const rowCounts = new Map(apps.map((a) => [a.appKey, a.rowCount] as const));

  return (
    <Combobox
      items={items}
      value={current || null}
      onValueChange={(value) => {
        if (value) router.push(`/apps?app=${encodeURIComponent(value)}`);
      }}
    >
      <ComboboxInput placeholder="Search apps…" aria-label="Select an app" className="w-56" />
      <ComboboxContent>
        <ComboboxEmpty>No apps found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              <span className="flex-1 truncate">{item}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {rowCounts.get(item) ?? 0}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
