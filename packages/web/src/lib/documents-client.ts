/**
 * Typed client for the /documents/* routes on the agents server (foreman-aqjx).
 *
 * Knowledge documents are files under documents/ in the user's per-tenant
 * Workspace filesystem. The browser calls the agent server directly with the
 * Supabase access token (same pattern as the chat transport in use-active-chat),
 * so no Next proxy route is needed.
 */
import { createClient } from "@/lib/client";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export interface DocumentMeta {
  name: string;
  path: string;
  size?: number;
}

async function authedGet<T>(path: string): Promise<T> {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  const res = await fetch(`${AGENT_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

/** List the knowledge documents in the caller's workspace. */
export async function listDocuments(): Promise<DocumentMeta[]> {
  return (await authedGet<{ documents: DocumentMeta[] }>("/documents")).documents;
}

/** Read one document's markdown content by its workspace-relative path. */
export async function getDocument(path: string): Promise<{ path: string; content: string }> {
  return authedGet(`/documents/content?path=${encodeURIComponent(path)}`);
}
