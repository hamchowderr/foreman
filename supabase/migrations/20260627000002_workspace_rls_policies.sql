-- Workspace-scoped RLS policies (foreman-5e6p, collaboration epic foreman-wl54).
--
-- The Foreman runtime tables had RLS ENABLED but NO policies. Combined with the
-- house posture that the `authenticated`/`anon` roles hold no table-level grant on
-- them (all data access is via the service_role agent server, which BYPASSES RLS),
-- that is a hard deny-all for any direct client — verified: even the existing
-- policy-bearing tables (workspaces, app_catalog) grant authenticated no table
-- SELECT. These policies declare the workspace_id boundary in the database itself
-- so workspace_id becomes a true security boundary the moment any direct
-- authenticated read is ever exposed (Phase 2b, per 20260621000001_rls_consistency).
--
-- They add NO new access today: authenticated still has no table SELECT grant, so
-- the deny-all posture is unchanged. The policies are the latent, defense-in-depth
-- boundary BEHIND the app-layer workspace scoping already shipped + verified live in
-- swfe (membership) and 28cz (chat visibility).
--
-- Posture, matching the existing workspaces/workspace_settings policies:
--   * SHARED workspace resources (artifact, app_data_snapshot, dashboard_share,
--     document_share, automation, automation_run): any workspace MEMBER may read
--     the workspace's rows. "Shared resources, private chats."
--   * conversation (chat) is PRIVATE by default: only the owner reads it; a
--     'workspace'/'public' chat is additionally readable by workspace members
--     (read-only — mirrors the app-layer GET /conversations/:id from 28cz).
--
-- SELECT only: every mutation must continue to route through the agent server's
-- validated app logic (proposals, dedup, snapshots, versioning) — never a direct
-- client write. Rows with a NULL workspace_id are invisible to the membership
-- branch (membership of a NULL workspace is never true); the conversation owner
-- clause still covers the owner's own workspace-less chats, and service_role
-- continues to see everything. Idempotent: DROP IF EXISTS + CREATE.

-- document_share was created (20260627000000) after the rls_consistency sweep, so
-- RLS was never enabled on it — close that gap to match its sibling dashboard_share.
ALTER TABLE public.document_share ENABLE ROW LEVEL SECURITY;

-- conversation (chat): owner-or-workspace-visible (read-only for teammates).
DROP POLICY IF EXISTS "Members read own or workspace-shared chats" ON public.conversation;
CREATE POLICY "Members read own or workspace-shared chats" ON public.conversation
  FOR SELECT TO authenticated
  USING (
    user_id = (auth.uid())::text
    OR (
      visibility IN ('workspace', 'public')
      AND public.is_workspace_member(auth.uid(), workspace_id)
    )
  );

-- SHARED workspace resources: any member reads the workspace's rows.
DROP POLICY IF EXISTS "Members read workspace artifacts" ON public.artifact;
CREATE POLICY "Members read workspace artifacts" ON public.artifact
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Members read workspace snapshots" ON public.app_data_snapshot;
CREATE POLICY "Members read workspace snapshots" ON public.app_data_snapshot
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Members read workspace dashboard shares" ON public.dashboard_share;
CREATE POLICY "Members read workspace dashboard shares" ON public.dashboard_share
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Members read workspace document shares" ON public.document_share;
CREATE POLICY "Members read workspace document shares" ON public.document_share
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Members read workspace automations" ON public.automation;
CREATE POLICY "Members read workspace automations" ON public.automation
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Members read workspace automation runs" ON public.automation_run;
CREATE POLICY "Members read workspace automation runs" ON public.automation_run
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
