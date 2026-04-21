import type { UIMessage } from "ai";
import { z } from "zod";
import type { Suggestion } from "./db/schema";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type ChatTools = Record<string, unknown>;

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: string;
  clear: null;
  finish: null;
  "chat-title": string;
};

export type ChatMessage = UIMessage<MessageMetadata, CustomUIDataTypes>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
