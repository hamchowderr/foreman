"use client";

import { Building2Icon, CheckIcon, ChevronsUpDownIcon, PlusIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { createWorkspace, getMyWorkspaces, switchWorkspace } from "@/data/workspaces";
import type { WorkspaceSummary } from "@/data/workspaces-types";

/**
 * Sidebar workspace switcher: lists the user's workspaces, marks the active one,
 * switches the agent's active workspace (writes user.default_workspace_id via the
 * agent server), and creates new team workspaces. Self-fetching so it can drop
 * into the sidebar with no layout plumbing.
 */
export function WorkspaceSwitcher() {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    getMyWorkspaces()
      .then((d) => {
        setWorkspaces(d.workspaces);
        setActiveId(d.active_workspace_id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  function onSwitch(id: string) {
    if (id === active?.id) return;
    startTransition(async () => {
      await switchWorkspace(id);
      setActiveId(id);
      router.refresh();
    });
  }

  function onCreate() {
    setError(null);
    startTransition(async () => {
      try {
        await createWorkspace(name.trim());
        setCreateOpen(false);
        setName("");
        load();
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (loading || !active) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton className="h-8" disabled tooltip="Workspace">
            <Building2Icon className="size-4" />
            <span className="truncate text-[13px]">{loading ? "Loading…" : "Workspace"}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-8" tooltip={active.name}>
              <Building2Icon className="size-4" />
              <span className="truncate text-[13px] font-medium">{active.name}</span>
              <ChevronsUpDownIcon className="ml-auto size-3.5 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((w) => (
              <DropdownMenuItem disabled={pending} key={w.id} onClick={() => onSwitch(w.id)}>
                <Building2Icon className="size-4" />
                <span className="truncate">{w.name}</span>
                {w.id === active.id && <CheckIcon className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              New workspace
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/workspaces" onClick={() => setOpenMobile(false)}>
                <SettingsIcon className="size-4" />
                Manage workspaces
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              A shared workspace for your team — agents, dashboards, and connections are shared
              across members.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="ws-name">Name</FieldLabel>
            <Input
              id="ws-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc"
              value={name}
            />
          </Field>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button onClick={() => setCreateOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button disabled={!name.trim() || pending} onClick={onCreate}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  );
}
