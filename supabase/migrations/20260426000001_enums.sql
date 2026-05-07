-- Enums used across the multi-tenant schema

-- User-level role for app admin access
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Workspace membership classification
CREATE TYPE public.workspace_membership_type AS ENUM ('solo', 'team');

-- RBAC roles within a workspace
CREATE TYPE public.workspace_member_role_type AS ENUM ('owner', 'admin', 'member', 'readonly');

-- Invitation lifecycle
CREATE TYPE public.workspace_invitation_link_status AS ENUM (
  'pending',
  'finished_accepted',
  'finished_declined',
  'expired'
);

-- Billing / subscription
CREATE TYPE public.subscription_status AS ENUM (
  'trialing',
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'unpaid',
  'paused'
);

CREATE TYPE public.pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');

-- Marketing feedback
CREATE TYPE public.marketing_blog_post_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.marketing_changelog_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.marketing_feedback_thread_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.marketing_feedback_thread_status AS ENUM (
  'open',
  'under_review',
  'planned',
  'in_progress',
  'completed',
  'closed'
);
CREATE TYPE public.marketing_feedback_thread_type AS ENUM (
  'feature_request',
  'bug',
  'improvement',
  'question',
  'other'
);
CREATE TYPE public.marketing_feedback_moderator_hold_category AS ENUM (
  'spam',
  'duplicate',
  'off_topic',
  'inappropriate',
  'other'
);
CREATE TYPE public.marketing_feedback_reaction_type AS ENUM ('like', 'heart', 'celebrate', 'upvote');
