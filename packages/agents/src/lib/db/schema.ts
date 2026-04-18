import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// ─── BetterAuth tables ───

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

// ─── Zapier Identity ───

export const zapierIdentity = sqliteTable("zapier_identity", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id),
  orgId: text("org_id"), // nullable — when set, this is a shared org connection
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  scopes: text("scopes").notNull(), // JSON stringified array
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─── Conversation & Messages ───

export const conversation = sqliteTable("conversation", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  orgId: text("org_id"), // nullable — when set, this is an org-scoped conversation
  mastraThreadId: text("mastra_thread_id"),
  title: text("title"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const message = sqliteTable("message", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id),
  role: text("role", { enum: ["user", "assistant", "agent", "system"] }).notNull(),
  content: text("content").notNull(), // JSON stringified
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Action Proposals & Runs ───

export const actionProposal = sqliteTable("action_proposal", {
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
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const actionRun = sqliteTable("action_run", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id")
    .notNull()
    .references(() => actionProposal.id),
  result: text("result").notNull(), // JSON
  error: text("error"), // JSON, nullable
  executedAt: integer("executed_at", { mode: "timestamp" }).notNull(),
});

// ─── Workflows ───

export const workflow = sqliteTable("workflow", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  sourceConversationId: text("source_conversation_id").references(
    () => conversation.id
  ),
  parameters: text("parameters").notNull(), // JSON
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const workflowStep = sqliteTable("workflow_step", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflow.id),
  order: integer("order").notNull(),
  proposalTemplate: text("proposal_template").notNull(), // JSON
});

export const workflowRun = sqliteTable("workflow_run", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflow.id),
  inputs: text("inputs").notNull(), // JSON
  status: text("status", {
    enum: ["pending", "running", "success", "failed", "declined"],
  }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// ─── Capability Flags ───

export const capabilityFlag = sqliteTable(
  "capability_flag",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    capability: text("capability").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.userId, table.capability] })]
);

// ─── Channel Identity (multi-channel user linking) ───

export const channelIdentity = sqliteTable(
  "channel_identity",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    orgId: text("org_id"), // nullable — links channel user to an org
    channel: text("channel", {
      enum: ["web", "telegram", "slack", "discord", "mcp", "a2a", "teams", "gchat", "whatsapp", "github", "linear", "imessage"],
    }).notNull(),
    channelUserId: text("channel_user_id").notNull(),
    displayName: text("display_name"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    // One identity per channel per external user
    // Note: Drizzle SQLite unique constraints via composite index
  ]
);

// ─── API Keys (MCP/A2A access) ───

export const apiKey = sqliteTable("api_key", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  keyHash: text("key_hash").notNull().unique(),
  name: text("name").notNull(),
  scopes: text("scopes").notNull(), // JSON array: ["read", "write", "execute"]
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
