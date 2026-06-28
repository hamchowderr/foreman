"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  acceptInvitation,
  clearSharedConnection,
  declineInvitation,
  getMyInvitations,
  getMyWorkspaces,
  getSharedConnection,
  getWorkspaceInvitations,
  getWorkspaceMembers,
  getWorkspaceSettings,
  inviteMember,
  leaveWorkspace,
  removeMember,
  revokeInvitation,
  setConnectionMode,
  shareMyConnection,
  switchWorkspace,
  updateMemberRole,
} from "@/data/workspaces";
import type {
  ConnectionMode,
  MyInvitation,
  SharedConnectionInfo,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSummary,
} from "@/data/workspaces-types";

const ASSIGNABLE: WorkspaceRole[] = ["admin", "member", "readonly"];
const isAdminRole = (r?: WorkspaceRole) => r === "owner" || r === "admin";

export function WorkspacesManager() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [myInvites, setMyInvites] = useState<MyInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reload() {
    Promise.all([getMyWorkspaces(), getMyInvitations().catch(() => [] as MyInvitation[])])
      .then(([w, inv]) => {
        setWorkspaces(w.workspaces);
        setActiveId(w.active_workspace_id);
        setMyInvites(inv);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  const act = (fn: () => Promise<unknown>) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        reload();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  if (loading)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">{error}</p>
      )}

      {myInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>You've been invited to these workspaces.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {myInvites.map((inv) => (
              <div className="flex items-center justify-between gap-3" key={inv.id}>
                <span className="text-sm">
                  <span className="font-medium">{inv.workspace?.name ?? "A workspace"}</span> · as{" "}
                  {inv.role}
                </span>
                <span className="flex gap-2">
                  <Button
                    disabled={pending}
                    onClick={() => act(() => acceptInvitation(inv.id))}
                    size="sm"
                  >
                    Accept
                  </Button>
                  <Button
                    disabled={pending}
                    onClick={() => act(() => declineInvitation(inv.id))}
                    size="sm"
                    variant="outline"
                  >
                    Decline
                  </Button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your workspaces</CardTitle>
          <CardDescription>Switch the active workspace your agent operates in.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {workspaces.map((w) => (
            <div className="flex items-center justify-between gap-3" key={w.id}>
              <span className="flex items-center gap-2 text-sm">
                <span className="font-medium">{w.name}</span>
                <Badge variant="secondary">{w.role}</Badge>
                {w.membership_type === "solo" && <Badge variant="outline">personal</Badge>}
                {w.id === active?.id && <Badge>active</Badge>}
              </span>
              {w.id !== active?.id && (
                <Button
                  disabled={pending}
                  onClick={() => act(() => switchWorkspace(w.id))}
                  size="sm"
                  variant="outline"
                >
                  Switch
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {active && (active.membership_type === "team" || isAdminRole(active.role)) && (
        <>
          {active.membership_type === "solo" && isAdminRole(active.role) && (
            <p className="text-muted-foreground text-sm">
              Invite a teammate to turn this personal workspace into a shared team workspace — your
              shared documents and automations become visible to the team. Your private documents
              stay private.
            </p>
          )}
          <MembersSection
            isAdmin={isAdminRole(active.role)}
            onAct={act}
            pending={pending}
            workspaceId={active.id}
          />
          {isAdminRole(active.role) ? (
            <>
              <InvitationsSection onAct={act} pending={pending} workspaceId={active.id} />
              {active.membership_type === "team" && (
                <ConnectionSection onAct={act} pending={pending} workspaceId={active.id} />
              )}
            </>
          ) : (
            <Button
              className="self-start"
              disabled={pending}
              onClick={() => act(() => leaveWorkspace(active.id))}
              variant="outline"
            >
              Leave workspace
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function MembersSection(props: {
  workspaceId: string;
  isAdmin: boolean;
  pending: boolean;
  onAct: (fn: () => Promise<unknown>) => void;
}) {
  const { workspaceId, isAdmin, pending, onAct } = props;
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  // Reload on workspace change and after each mutation settles (pending edge).
  useEffect(() => {
    getWorkspaceMembers(workspaceId)
      .then(setMembers)
      .catch(() => {});
  }, [workspaceId, pending]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>People with access to this workspace's shared resources.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  {m.name ?? m.id.slice(0, 8)}
                  {m.is_self && <span className="text-muted-foreground"> (you)</span>}
                </TableCell>
                <TableCell>
                  {isAdmin && m.role !== "owner" ? (
                    <Select
                      onValueChange={(role) =>
                        onAct(() => updateMemberRole(workspaceId, m.id, role as WorkspaceRole))
                      }
                      value={m.role}
                    >
                      <SelectTrigger className="h-8 w-32" disabled={pending}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{m.role}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isAdmin && m.role !== "owner" && !m.is_self && (
                    <Button
                      disabled={pending}
                      onClick={() => onAct(() => removeMember(workspaceId, m.id))}
                      size="sm"
                      variant="ghost"
                    >
                      Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InvitationsSection(props: {
  workspaceId: string;
  pending: boolean;
  onAct: (fn: () => Promise<unknown>) => void;
}) {
  const { workspaceId, pending, onAct } = props;
  const [invites, setInvites] = useState<WorkspaceInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");

  useEffect(() => {
    getWorkspaceInvitations(workspaceId)
      .then(setInvites)
      .catch(() => {});
  }, [workspaceId, pending]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a teammate</CardTitle>
        <CardDescription>They'll join with the role you choose once they accept.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="max-w-xs"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            type="email"
            value={email}
          />
          <Select onValueChange={(r) => setRole(r as WorkspaceRole)} value={role}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={pending || !email.trim()}
            onClick={() =>
              onAct(async () => {
                await inviteMember(workspaceId, email.trim(), role);
                setEmail("");
              })
            }
          >
            Send invite
          </Button>
        </div>
        {invites.length > 0 && (
          <div className="flex flex-col gap-1">
            {invites.map((inv) => (
              <div className="flex items-center justify-between gap-3 text-sm" key={inv.id}>
                <span>
                  {inv.invitee_user_email} · {inv.invitee_user_role}{" "}
                  <Badge variant="outline">pending</Badge>
                </span>
                <Button
                  disabled={pending}
                  onClick={() => onAct(() => revokeInvitation(workspaceId, inv.id))}
                  size="sm"
                  variant="ghost"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectionSection(props: {
  workspaceId: string;
  pending: boolean;
  onAct: (fn: () => Promise<unknown>) => void;
}) {
  const { workspaceId, pending, onAct } = props;
  const [mode, setMode] = useState<ConnectionMode>("member-first");
  const [shared, setShared] = useState<SharedConnectionInfo | null>(null);

  useEffect(() => {
    getWorkspaceSettings(workspaceId)
      .then((s) => setMode(s.zapier_connection_mode))
      .catch(() => {});
  }, [workspaceId]);

  useEffect(() => {
    getSharedConnection(workspaceId)
      .then(setShared)
      .catch(() => {});
  }, [workspaceId, pending]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zapier connections</CardTitle>
        <CardDescription>
          How members' Zapier connections resolve when the agent acts. <strong>member-first</strong>
          : own connection, else the workspace's shared one · <strong>shared</strong>: always the
          workspace's connection · <strong>personal</strong>: own only.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Select
          onValueChange={(m) =>
            onAct(async () => {
              await setConnectionMode(workspaceId, m as ConnectionMode);
              setMode(m as ConnectionMode);
            })
          }
          value={mode}
        >
          <SelectTrigger className="w-48" disabled={pending}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member-first">member-first</SelectItem>
            <SelectItem value="shared">shared</SelectItem>
            <SelectItem value="personal">personal</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="font-medium text-sm">Shared connection</p>
          <p className="text-muted-foreground text-sm">
            {shared?.shared
              ? shared.shared.is_self
                ? "Your Zapier connection is this workspace's shared connection."
                : "A teammate's connection is shared with this workspace."
              : "No shared connection set — shared / member-first fallback has nothing to resolve to yet."}
          </p>
          <div className="flex gap-2">
            {!shared?.shared?.is_self && (
              <Button
                disabled={pending || !shared?.caller_has_connection}
                onClick={() => onAct(() => shareMyConnection(workspaceId))}
                size="sm"
              >
                Use my connection
              </Button>
            )}
            {shared?.shared && (
              <Button
                disabled={pending}
                onClick={() => onAct(() => clearSharedConnection(workspaceId))}
                size="sm"
                variant="outline"
              >
                Clear
              </Button>
            )}
          </div>
          {!(shared?.caller_has_connection || shared?.shared) && (
            <p className="text-muted-foreground text-xs">
              Connect your own Zapier account first to share it with the workspace.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
