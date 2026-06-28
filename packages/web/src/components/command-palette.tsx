"use client";

import {
  FileTextIcon,
  InboxIcon,
  LayoutDashboardIcon,
  PenSquareIcon,
  SettingsIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

/** Other components open the palette by dispatching this event (e.g. a sidebar button). */
export const OPEN_COMMAND_PALETTE_EVENT = "foreman:command-palette";

const GO_TO = [
  { label: "Automations", href: "/automations", Icon: ZapIcon },
  { label: "Inbox", href: "/inbox", Icon: InboxIcon },
  { label: "Apps", href: "/dashboards", Icon: LayoutDashboardIcon },
  { label: "Documents", href: "/documents", Icon: FileTextIcon },
  { label: "Workspaces", href: "/workspaces", Icon: UsersIcon },
  { label: "Settings", href: "/settings", Icon: SettingsIcon },
];

/**
 * Global Cmd/Ctrl+K command palette (foreman-iznn-style UX). Mounted once in the
 * app sidebar so it's available on every authed page. Opens on Cmd/Ctrl+K or when
 * any component dispatches OPEN_COMMAND_PALETTE_EVENT.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog onOpenChange={setOpen} open={open}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/chat")}>
            <PenSquareIcon className="size-4" />
            New chat
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {GO_TO.map(({ label, href, Icon }) => (
            <CommandItem key={href} onSelect={() => go(href)}>
              <Icon className="size-4" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
