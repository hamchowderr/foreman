import { Hono } from "hono";
import { createShare, getShare, resolveShareToken, revokeShares } from "../lib/conversations/share";
import { validateParam } from "../lib/validation";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";

/**
 * Public share links for chat-kit conversations (foreman-mk25).
 *
 *   GET    /chat-shares/:threadId        → the chat's link, or { token: null }
 *   POST   /chat-shares/:threadId        → mint a link (owner only)
 *   DELETE /chat-shares/:threadId        → stop sharing (owner only)
 *   GET    /chat-shares/public/:token    → the shared chat, NO auth (token = grant)
 *
 * A chat is an AgentController thread. The owner check is the kit's own: the
 * thread must be in the caller's Session thread list (`ownsThread`), so nobody
 * can share or read through a share of someone else's thread id.
 */
const chatShares = new Hono<AppEnv>();

chatShares.use("*", (c, next) =>
  c.req.path.includes("/chat-shares/public/") ? next() : authMiddleware(c, next),
);

// The controller pulls in the whole agent tree, so load it on first use rather
// than when the custom routes are imported.
async function sessionFor(userId: string) {
  const { getForemanSession } = await import("../mastra/lib/agent-controller");
  return getForemanSession(userId);
}

async function owns(userId: string, threadId: string): Promise<boolean> {
  const { ownsThread } = await import("../mastra/routes/threads");
  return ownsThread(await sessionFor(userId), threadId);
}

chatShares.get("/public/:token", async (c) => {
  const token = validateParam(c.req.param("token"), "token");
  if (!token) return c.json({ error: "Invalid share token" }, 400);
  const ref = await resolveShareToken(token);
  // The owner must still have the thread (a deleted chat takes its links with it).
  if (!ref || !(await owns(ref.ownerId, ref.threadId))) {
    return c.json({ error: "Not found" }, 404);
  }

  const { messageText, threadTitle, toUIMessage } = await import("../mastra/lib/thread-utils");
  const session = await sessionFor(ref.ownerId);
  const thread = (await session.thread.list()).find((t) => t.id === ref.threadId);
  const raw = await session.thread.listMessages({ threadId: ref.threadId });
  const messages = raw.map(toUIMessage).filter((m) => m.parts[0]?.text);
  const firstUser = raw.find((m) => (m as { role?: string }).role !== "assistant");

  return c.json({
    title: threadTitle(thread, firstUser ? messageText(firstUser) : ""),
    createdAt: thread ? new Date(thread.createdAt).toISOString() : null,
    messages,
  });
});

chatShares.get("/:threadId", async (c) => {
  const userId = c.get("userId");
  const threadId = validateParam(c.req.param("threadId"), "threadId");
  if (!threadId) return c.json({ error: "Invalid thread id" }, 400);
  if (!(await owns(userId, threadId))) return c.json({ error: "Not found" }, 404);
  const share = await getShare(userId, threadId);
  return c.json(share ?? { token: null, expiresAt: null });
});

chatShares.post("/:threadId", async (c) => {
  const userId = c.get("userId");
  const threadId = validateParam(c.req.param("threadId"), "threadId");
  if (!threadId) return c.json({ error: "Invalid thread id" }, 400);

  const body = (await c.req.json().catch(() => ({}))) as { expiresInDays?: unknown };
  let expiresInDays: number | undefined;
  if (body.expiresInDays !== undefined) {
    const n = Number(body.expiresInDays);
    if (!Number.isFinite(n) || n <= 0 || n > 3650) {
      return c.json({ error: "expiresInDays must be a positive number of days (<= 3650)" }, 400);
    }
    expiresInDays = n;
  }

  if (!(await owns(userId, threadId))) return c.json({ error: "Not found" }, 404);
  // One live link per chat: sharing again returns the existing one.
  const existing = expiresInDays === undefined ? await getShare(userId, threadId) : null;
  if (existing) return c.json(existing);
  const share = await createShare(userId, threadId, {
    workspaceId: c.get("workspaceId"),
    expiresInDays,
  });
  return c.json(share, 201);
});

chatShares.delete("/:threadId", async (c) => {
  const userId = c.get("userId");
  const threadId = validateParam(c.req.param("threadId"), "threadId");
  if (!threadId) return c.json({ error: "Invalid thread id" }, 400);
  if (!(await owns(userId, threadId))) return c.json({ error: "Not found" }, 404);
  return c.json({ revoked: await revokeShares(userId, threadId) });
});

export default chatShares;
