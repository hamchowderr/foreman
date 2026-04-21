import type { UIMessageStreamWriter } from "ai";
import type { Session } from "@/lib/auth";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { Document } from "../db/schema";
import type { ChatMessage } from "../types";

export type SaveDocumentProps = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
};

export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  modelId: string;
};

export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  modelId: string;
};

export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
};

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      await config.onCreateDocument({
        id: args.id,
        title: args.title,
        dataStream: args.dataStream,
        session: args.session,
        modelId: args.modelId,
      });
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        dataStream: args.dataStream,
        session: args.session,
        modelId: args.modelId,
      });
    },
  };
}

export const artifactKinds = ["text", "code", "sheet"] as const;
