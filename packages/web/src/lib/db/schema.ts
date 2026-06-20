/**
 * Type definitions extracted from the original Drizzle schema.
 * These types are used throughout the UI but data comes from the agent server API.
 */

export type Chat = {
  id: string;
  createdAt: Date;
  title: string;
  userId: string;
  visibility: "public" | "private";
  /** Set when the conversation is archived (non-destructive hide); null when active. */
  archivedAt?: string | null;
};

export type DBMessage = {
  id: string;
  chatId: string;
  role: string;
  parts: unknown;
  attachments: unknown;
  createdAt: Date;
};

export type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

export type Document = {
  id: string;
  createdAt: Date;
  title: string;
  content: string | null;
  kind: "text" | "code" | "image" | "sheet";
  userId: string;
};

export type Suggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: Date;
  originalText: string;
  suggestedText: string;
  description: string | null;
  isResolved: boolean;
  userId: string;
  createdAt: Date;
};
