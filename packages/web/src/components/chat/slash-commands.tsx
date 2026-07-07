"use client";

import {
  BombIcon,
  ListIcon,
  PaletteIcon,
  PenLineIcon,
  PenSquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

export type SlashCommand = {
  name: string;
  description: string;
  icon: ReactNode;
  action: string;
  shortcut?: string;
};

export const slashCommands: SlashCommand[] = [
  {
    name: "new",
    description: "Start a new chat",
    icon: <PenSquareIcon className="size-3.5" />,
    action: "new",
  },
  {
    name: "clear",
    description: "Clear current chat",
    icon: <Trash2Icon className="size-3.5" />,
    action: "clear",
  },
  {
    name: "rename",
    description: "Rename current chat",
    icon: <PenLineIcon className="size-3.5" />,
    action: "rename",
  },
  {
    name: "model",
    description: "Change the AI model",
    icon: <ListIcon className="size-3.5" />,
    action: "model",
  },
  {
    name: "theme",
    description: "Toggle dark/light mode",
    icon: <PaletteIcon className="size-3.5" />,
    action: "theme",
  },
  {
    name: "delete",
    description: "Delete current chat",
    icon: <XIcon className="size-3.5" />,
    action: "delete",
  },
  {
    name: "purge",
    description: "Delete all chats",
    icon: <BombIcon className="size-3.5" />,
    action: "purge",
  },
];

type SlashCommandMenuProps = {
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  selectedIndex: number;
};

export function SlashCommandMenu({
  query,
  onSelect,
  onClose: _onClose,
  selectedIndex,
}: SlashCommandMenuProps) {
  const filtered = slashCommands.filter((cmd) => cmd.name.startsWith(query.toLowerCase()));

  if (filtered.length === 0) {
    return null;
  }

  // The composer textarea above this menu owns keyboard navigation and selection
  // (ArrowUp/Down/Enter/Escape) and feeds the active row in via `selectedIndex`.
  // We disable cmdk's own filtering and drive its highlight from that index so the
  // parent contract is preserved while still getting role=listbox/option + aria-selected.
  const activeValue = filtered[selectedIndex]?.name ?? filtered[0]?.name;

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-[var(--shadow-float)] backdrop-blur-xl">
      <Command
        className="rounded-none bg-transparent p-0 text-popover-foreground"
        loop
        shouldFilter={false}
        value={activeValue}
      >
        <CommandList className="max-h-64 pb-1">
          <CommandGroup
            className="p-0 **:[[cmdk-group-heading]]:px-4 **:[[cmdk-group-heading]]:py-2.5 **:[[cmdk-group-heading]]:text-[10px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-muted-foreground/40"
            heading="Commands"
          >
            {filtered.map((cmd) => (
              <CommandItem
                className="gap-3 rounded-none px-4 py-2.5"
                key={cmd.name}
                onMouseDown={(e) => e.preventDefault()}
                onSelect={() => onSelect(cmd)}
                value={cmd.name}
              >
                <div className="flex size-6 shrink-0 items-center justify-center text-muted-foreground/60">
                  {cmd.icon}
                </div>
                <span className="font-mono text-[13px] text-foreground">/{cmd.name}</span>
                <span className="text-[12px] text-muted-foreground/50">{cmd.description}</span>
                {cmd.shortcut && (
                  <span className="ml-auto text-[11px] text-muted-foreground/30">
                    {cmd.shortcut}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
