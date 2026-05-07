// Plain TypeScript interfaces for our Supabase tables.
// Column names are snake_case to match the database.

export interface UserRow {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  image: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZapierIdentityRow {
  id: string;
  user_id: string;
  org_id: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string | null;
  scopes: string; // JSON stringified array
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  org_id: string | null;
  mastra_thread_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionProposalRow {
  id: string;
  conversation_id: string;
  mastra_run_id: string | null;
  app_key: string;
  action_type: "search" | "read" | "write";
  action_key: string;
  human_label: string;
  inputs: string; // JSON
  input_schema: string; // JSON
  connection_id: string | null;
  status: "pending" | "approved" | "declined" | "executed" | "failed";
  created_at: string;
  updated_at: string;
}

export interface ActionRunRow {
  id: string;
  proposal_id: string;
  result: string; // JSON
  error: string | null; // JSON
  executed_at: string;
}

export interface WorkflowRow {
  id: string;
  user_id: string;
  name: string;
  source_conversation_id: string | null;
  parameters: string; // JSON
  is_template: boolean;
  cloned_from: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepRow {
  id: string;
  workflow_id: string;
  order: number;
  proposal_template: string; // JSON
}

export interface WorkflowRunRow {
  id: string;
  workflow_id: string;
  inputs: string; // JSON
  status: "pending" | "running" | "success" | "failed" | "declined";
  created_at: string;
  completed_at: string | null;
}

export interface ConnectionAliasRow {
  user_id: string;
  alias: string;
  app_key: string;
  connection_id: number;
  created_at: string;
}

export interface CapabilityFlagRow {
  user_id: string;
  capability: string;
  enabled: boolean;
}

export interface ChannelIdentityRow {
  id: string;
  user_id: string;
  org_id: string | null;
  channel: "web" | "telegram" | "slack" | "discord" | "mcp" | "a2a" | "teams" | "gchat" | "whatsapp" | "github" | "linear" | "imessage";
  channel_user_id: string;
  display_name: string | null;
  created_at: string;
}

export interface AppCatalogRow {
  app_key: string;
  slug: string;
  title: string;
  categories: string; // JSON array
  auth_type: string | null;
  action_count: number | null;
  embedding_text: string | null;
  synced_at: string;
}

export interface StoredAgentRow {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredAgentVersionRow {
  id: string;
  agent_id: string;
  version: number;
  instructions: string;
  tools: string; // JSON array
  model: string;
  notes: string | null;
  published_at: string | null;
  created_at: string;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  scopes: string; // JSON array
  last_used_at: string | null;
  created_at: string;
}
