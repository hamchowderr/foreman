import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

// ─── User table (Clerk-managed, auto-created on first auth) ───

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true }).notNull(),
});

// ─── Zapier Identity ───

export const zapierIdentity = pgTable("zapier_identity", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id),
  orgId: text("org_id"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
  scopes: text("scopes").notNull(), // JSON stringified array
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
});

// ─── Conversation (links to Mastra Memory thread) ───

export const conversation = pgTable("conversation", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  orgId: text("org_id"),
  mastraThreadId: text("mastra_thread_id"),
  title: text("title"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
});

// ─── Action Proposals & Runs ───

export const actionProposal = pgTable("action_proposal", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id),
  mastraRunId: text("mastra_run_id"),
  appKey: text("app_key").notNull(),
  actionType: text("action_type", {
    enum: ["search", "read", "write"],
  }).notNull(),
  actionKey: text("action_key").notNull(),
  humanLabel: text("human_label").notNull(),
  inputs: text("inputs").notNull(), // JSON
  inputSchema: text("input_schema").notNull(), // JSON
  connectionId: text("connection_id"),
  status: text("status", {
    enum: ["pending", "approved", "declined", "executed", "failed"],
  }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
});

export const actionRun = pgTable("action_run", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id")
    .notNull()
    .references(() => actionProposal.id),
  result: text("result").notNull(), // JSON
  error: text("error"), // JSON, nullable
  executedAt: timestamp("executed_at", { mode: "date", withTimezone: true }).notNull(),
});

// ─── Workflows ───

export const workflow = pgTable("workflow", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  sourceConversationId: text("source_conversation_id").references(
    () => conversation.id
  ),
  parameters: text("parameters").notNull(), // JSON
  isTemplate: boolean("is_template").notNull().default(false),
  clonedFrom: text("cloned_from"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
});

export const workflowStep = pgTable("workflow_step", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflow.id),
  order: integer("order").notNull(),
  proposalTemplate: text("proposal_template").notNull(), // JSON
});

export const workflowRun = pgTable("workflow_run", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflow.id),
  inputs: text("inputs").notNull(), // JSON
  status: text("status", {
    enum: ["pending", "running", "success", "failed", "declined"],
  }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
});

// ─── Connection Aliases (portable workflow references) ───

export const connectionAlias = pgTable(
  "connection_alias",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    alias: text("alias").notNull(),
    appKey: text("app_key").notNull(),
    connectionId: integer("connection_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.alias] })]
);

// ─── Capability Flags ───

export const capabilityFlag = pgTable(
  "capability_flag",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    capability: text("capability").notNull(),
    enabled: boolean("enabled").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.userId, table.capability] })]
);

// ─── Channel Identity (multi-channel user linking) ───

export const channelIdentity = pgTable(
  "channel_identity",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    orgId: text("org_id"),
    channel: text("channel", {
      enum: ["web", "telegram", "slack", "discord", "mcp", "a2a", "teams", "gchat", "whatsapp", "github", "linear", "imessage"],
    }).notNull(),
    channelUserId: text("channel_user_id").notNull(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
  },
  () => []
);

// ─── App Catalog (embedded for semantic search) ───

export const appCatalog = pgTable("app_catalog", {
  appKey: text("app_key").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  categories: text("categories").notNull(), // JSON array: [{ id, name, slug }]
  authType: text("auth_type"),
  actionCount: integer("action_count"),
  embeddingText: text("embedding_text"), // pre-built text for vector embedding
  syncedAt: timestamp("synced_at", { mode: "date", withTimezone: true }).notNull(),
});

// ─── Stored Agents (user-authored agent definitions) ───

export const storedAgent = pgTable("stored_agent", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  orgId: text("org_id"),
  name: text("name").notNull(),
  description: text("description"),
  // Points to the currently-published version (null until first publish)
  currentVersionId: text("current_version_id"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
});

export const storedAgentVersion = pgTable("stored_agent_version", {
  id: text("id").primaryKey(),
  agentId: text("agent_id")
    .notNull()
    .references(() => storedAgent.id, { onDelete: "cascade" }),
  // 1-indexed version number, unique per agentId (enforced in app code)
  version: integer("version").notNull(),
  instructions: text("instructions").notNull(),
  // JSON array of tool IDs: ["list-actions", "run-action", ...]
  tools: text("tools").notNull(),
  model: text("model").notNull(),
  // Version notes / changelog for this revision
  notes: text("notes"),
  // null = draft, non-null = published timestamp
  publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
});

// ─── API Keys (MCP/A2A access) ───

export const apiKey = pgTable("api_key", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  keyHash: text("key_hash").notNull().unique(),
  name: text("name").notNull(),
  scopes: text("scopes").notNull(), // JSON array: ["read", "write", "execute"]
  lastUsedAt: timestamp("last_used_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
});
