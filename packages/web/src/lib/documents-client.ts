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

async function authToken(): Promise<string> {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  return session?.access_token ?? "";
}

async function authedGet<T>(path: string): Promise<T> {
  const res = await fetch(`${AGENT_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${await authToken()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

async function authedPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${AGENT_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await authToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`POST ${path} → ${res.status}`);
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

export interface DocumentVersion {
  version: number;
  blobHash: string;
  size: number;
  title: string;
  createdAt: string;
  note?: string;
}

/** List a document's revisions (newest first), from its version manifest. */
export async function listDocumentVersions(
  path: string,
): Promise<{ current: number; title: string; versions: DocumentVersion[] }> {
  return authedGet(`/documents/versions?path=${encodeURIComponent(path)}`);
}

/** Read one historical revision's content from the blob store. */
export async function getDocumentVersion(
  path: string,
  version: number,
): Promise<{ path: string; version: number; content: string }> {
  return authedGet(`/documents/version?path=${encodeURIComponent(path)}&v=${version}`);
}

/** Restore an older revision as the live document (recorded as a new revision). */
export async function restoreDocumentVersion(
  path: string,
  version: number,
): Promise<{ path: string; current: number }> {
  return authedPost("/documents/restore", { path, version });
}
