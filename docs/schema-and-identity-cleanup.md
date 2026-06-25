# Schema & Identity Cleanup — Plan of Record

> Epic: **foreman-qhbp**. Owner direction (2026-06-25): make Foreman's DB clean and
> properly multi-tenant, **grouped the way the NextBase repos group migrations**, with
> **no DROP migrations** (re-baseline at source — there are zero production users). Phase 1
> (hand-rolled workflow engine removal) already shipped in `82b24fb`.

Foreman descends from **nextbase-ultimate** (Turborepo + Biome + AI SDK v5 + Supabase).
NextBase groups its schema **one migration file per domain** (`user.sql`, `workspaces.sql`,
`billing.sql`, `marketing.sql`, …). Foreman already matches that for the NextBase tables — the
divergence is Foreman's own `foreman_core.sql` monolith and a half-wired multi-tenant layer.

---

## 1. Current state — the two-worlds straddle

| World | Tables | Keying | Status |
|---|---|---|---|
| **NextBase / Supabase-auth** | `auth.users` → `user_profiles`, `workspaces`, `workspace_members`, `user_roles`, billing_*, marketing_* | **UUID**, RLS via `auth.uid()` | Fully built, **mostly inert** |
| **Foreman runtime** | `user` (legacy Better-Auth), `conversation`, `action_proposal`, `action_run`, `zapier_identity`, `connection_alias`, `channel_identity`, `api_key`, `capability_flag`, `app_catalog`, dashboards (`artifact`/`app_data_snapshot`/`dashboard_share`), `stored_agent`, `channel_link_code` | **TEXT** `user_id` → `public."user".id` | What the app actually runs on |

**The bridge already exists for web users:** `resolveFromSupabaseJwt` returns the `auth.users`
UUID, and `ensureUserExists` writes a `public."user"` row with **that same UUID** as its text id.
So `public.user.id == auth.users.id == user_profiles.id` for every web user. Channel-only users
(Slack/Discord/…) get a `randomUUID()` principal with **no** `auth.users` row; the
`channel_link_code` flow re-points them to a web user when they link.

**`public."user"` is therefore a unified *principal* table** spanning auth-backed (web) and
non-auth (channel) identities. That's a sound pattern — we keep it, we don't fight it.

**Multi-tenancy is built but unwired:** `workspaces` (solo/team), `workspace_members`
(→ `user_profiles`), `is_workspace_member`/`is_workspace_admin` SECURITY-DEFINER helpers, RLS,
and a signup trigger that auto-creates a personal solo workspace — all present. But Foreman's
runtime tables don't reference workspaces. `orgId` rides in the JWT `user_metadata` and reaches
the auth middleware, yet is only consumed by a **stubbed** guardrails config. `workspace_id`
columns exist on `conversation`/`channel_identity`/`zapier_identity` (migration `…018`) and
`artifact`/`app_data_snapshot`, but are **never filtered on** (one exception: `zapier/sdk.ts`
reads `workspace_id` first for shared connections, falling back to `user_id`).

---

## 2. Target identity & tenancy model

- **`auth.users`** stays the canonical auth for **web** users; **`user_profiles`** the NextBase profile.
- **`public."user"` stays the runtime *principal*** every Foreman table references. Web principals'
  id == `auth.users.id`; channel principals are standalone UUIDs. (Cleanup: document it as the
  principal/account table; snake_case the Better-Auth camelCase columns is *optional* later churn.)
- **`workspaces` becomes the tenant boundary.** Every Foreman resource belongs to a **workspace**;
  `user_id` stays as creator attribution. Solo user → their personal solo workspace (equivalent to
  today). Team workspace → members share resources. Channel-only principals get their own solo
  workspace too (extend the signup-trigger pattern to channel registration).
- **Resolution:** identity resolution also resolves the **active `workspace_id`** (default solo, or
  selected team) and threads it through middleware **and** Mastra `RequestContext`. Reads/writes
  scope by `workspace_id`.

---

## 3. Migration reorganization (NextBase grouping)

### 3a. Decompose `foreman_core.sql` → per-domain files
`foreman_core.sql` currently crams 11 tables (now 8, post-workflow-removal) + FKs into one file.
Split into NextBase-style domain migrations:

| New file | Tables |
|---|---|
| `foreman_principal.sql` | `public."user"` (principal) |
| `foreman_conversation.sql` | `conversation` |
| `foreman_proposals.sql` | `action_proposal`, `action_run` |
| `foreman_zapier.sql` | `zapier_identity`, `connection_alias`, `app_catalog` |
| `foreman_channels.sql` | `channel_identity` (+ `channel_link_code` folded from its own migration) |
| `foreman_api_keys.sql` | `api_key` |
| `foreman_capabilities.sql` | `capability_flag` |

(Foreman's later additions — `mastra.sql`, `stored_agent.sql`, `app_data_snapshot.sql`,
`artifact.sql`, `dashboard_share.sql`, `conversation_archive.sql`,
`mastra_channels_and_schedules.sql` — are **already** one-domain-per-file; keep as-is.)

### 3b. Keep / Cut / Regroup
- **KEEP (NextBase multi-tenant foundation — multi-tenant is a must):** `enums`, `user` (profiles),
  `workspaces`, `user_triggers`, `workspace_triggers`, `custom_access_token_hook`, `app_settings`,
  `workspace_permissions`, `application_admin`, `is_application_admin`, `org_id_to_workspace_id`,
  `rls`, `revoke_anon_grants`, `catalog_vectors_rls`.
- **KEEP (Foreman runtime + storage):** everything in §3a + the later domain files + `mastra`.
- **CUT — dead NextBase marketing/feedback CMS** (zero code references in agents *or* web; Foreman's
  marketing is a bespoke landing page): `marketing`, `marketing_blog`, `marketing_changelog`,
  `marketing_feedback`, `feedback_boards`, `feedback_subscriptions`.  ← **decision: confirm cut**
- **KEEP but currently inert — `billing`** (Stripe). It's the org/team monetization foundation; cheap
  to wire later, expensive to re-derive. Recommend keep.  ← **decision: confirm keep**

### 3c. No DROP migrations
All removals happen **at source** (delete/edit the CREATE migration). `db reset` re-baselines from
clean files. Phase 1 already did this for the workflow tables.

---

## 4. Multi-tenancy wiring (the behavior change)

From the blast-radius map (foreman-qhbp), the work is bounded:

- **Add `workspace_id UUID` (FK → workspaces)** to the runtime tables that lack it: `stored_agent`
  (+ `stored_agent_version` via parent), `api_key`, `capability_flag`, `channel_link_code`,
  `connection_alias`. Already present on `conversation`, `channel_identity`, `zapier_identity`,
  `artifact`, `app_data_snapshot`.
- **`action_proposal` / `action_run` need nothing** — they resolve ownership through
  `conversation` (`loadOwnedProposal` INNER-JOINs `conversation.user_id`); scoping `conversation`
  covers them transitively.
- **Resolve + thread `workspace_id`:** in `identity.ts` (resolve active workspace for the principal),
  `middleware.ts` (`c.set("workspace_id", …)`), and the `/chat` route's `RequestContext`
  (add `workspaceId`). Channel bots inherit it via the principal's solo workspace.
- **Scope reads/writes:** the ~20 `user_id`-filtered reads (conversations ×5, snapshots ×6,
  stored_agent ×3, etc.) move to workspace scoping (or `workspace_id` + `user_id` where personal).
- **Give channel principals a solo workspace** at `registerChannelUser` time (mirror the web signup
  trigger).

This is staged **after** the reorg so each diff stays reviewable.

---

## 5. New tables for the Zapier durable / trigger-inbox SDK surface

Designed now, landed when durable EA arrives (foreman-13mw). Sketch (workspace-scoped):

- **`durable_workflow`** — maps a Foreman workspace to a Zapier durable workflow:
  `(id, workspace_id, user_id, zapier_workflow_id, name, definition_ref, status, created_at, updated_at)`.
- **`durable_run`** — run-tracking mirror of `runDurable`/`getDurableRun`:
  `(id, durable_workflow_id, workspace_id, zapier_run_id, status, started_at, finished_at, error)`.
- **`trigger_inbox_subscription`** — Foreman's binding to a Zapier trigger-inbox (unwalled today):
  `(id, workspace_id, user_id, app_key, inbox_id, config, enabled, last_event_at, created_at)`.

These replace the removed `workflow`/`workflow_step`/`workflow_run`/`workflow_trigger` 1:1, but
as thin pointers to Zapier-side durable state rather than a hand-rolled engine. Finalize against
the live SDK schema when EA lands.

---

## 6. Phased execution

- **Phase 2a — Migration reorg (no behavior change):** decompose `foreman_core`, cut the marketing/
  feedback CMS, keep everything else. `db reset` + `db:types` + full gates green. Pure
  reorganization → safe, reviewable, ships the "group like NextBase" ask.
- **Phase 2b — Multi-tenancy wiring:** add `workspace_id` to remaining tables; resolve/thread it;
  scope reads/writes; solo workspace for channel principals. Code + schema.
- **Phase 2c — Durable/trigger-inbox tables:** land §5 schema (gated on EA for the code that uses it).

Each phase: `npm test` (vitest) + `biome lint` + `next build` + `db:types:check` must stay green.

---

## 7. Open decisions (for sign-off)

1. **Cut the NextBase marketing/feedback CMS** (6 migrations, zero code refs)? — recommend **yes**.
2. **Keep `billing`** inert as the monetization foundation? — recommend **yes**.
3. Identity model (§2) — keep `public."user"` as the unified principal, workspace as tenant
   boundary — recommend **yes** (matches what the code already does + NextBase tenancy).
