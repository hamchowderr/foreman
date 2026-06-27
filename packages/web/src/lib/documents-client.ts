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

export type DocSpace = "shared" | "personal";

export interface DocumentMeta {
  name: string;
  path: string;
  size?: number;
  space?: DocSpace;
}

/** Derive a document's Space from its path (personal docs live under _private/). */
export function spaceOfPath(path: string): DocSpace {
  return path.startsWith("_private/") ? "personal" : "shared";
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

async function authedDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${AGENT_URL}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${await authToken()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`DELETE ${path} → ${res.status}`);
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

export interface DocumentShare {
  token: string;
  expiresAt: string | null;
}

/** The document's current public-share state (token if shared, else null). */
export async function getDocumentShare(path: string): Promise<DocumentShare | null> {
  const { share } = await authedGet<{ share: DocumentShare | null }>(
    `/documents/share?path=${encodeURIComponent(path)}`,
  );
  return share;
}

/** Mint a public share link for a document. */
export async function shareDocument(path: string, expiresInDays?: number): Promise<DocumentShare> {
  return authedPost("/documents/share", { path, expiresInDays });
}

/** Revoke a public share token. */
export async function unshareDocument(token: string): Promise<{ revoked: boolean }> {
  return authedDelete(`/documents/share/${encodeURIComponent(token)}`);
}

/**
 * Read a publicly shared document by token — NO auth, used by the logged-out
 * share page (server-side fetch). Returns null on 404 (revoked/expired/unknown).
 */
export async function getPublicDocument(
  token: string,
): Promise<{ title: string; path: string; content: string } | null> {
  const res = await fetch(`${AGENT_URL}/documents/public/${encodeURIComponent(token)}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GET /documents/public → ${res.status}`);
  }
  return (await res.json()) as { title: string; path: string; content: string };
}
