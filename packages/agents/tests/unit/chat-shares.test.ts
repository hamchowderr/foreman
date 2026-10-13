/**
 * Public chat share links on the chat kit (foreman-mk25): only a thread's owner
 * can mint, read or revoke its link, and the public read serves the owner's
 * thread by token with no auth — and stops once the link or the thread is gone.
 *
 * No DB or controller: the share store and each user's Session thread list are
 * in-memory fakes.
 */
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  threads: {} as Record<string, Array<{ id: string; title?: string; createdAt: Date }>>,
  messages: {} as Record<string, Array<{ id: string; role: string; content: unknown }>>,
  shares: [] as Array<{
    token: string;
    threadId: string;
    userId: string;
    expiresAt: string | null;
  }>,
}));

vi.mock("@/routes/middleware", () => ({
  authMiddleware: async (c: any, next: () => Promise<void>) => {
    const user = c.req.header("Authorization")?.replace("Bearer ", "");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    c.set("userId", user);
    await next();
  },
}));
vi.mock("@/mastra/lib/agent-controller", () => ({
  getForemanSession: async (userId: string) => ({
    thread: {
      list: async () => h.threads[userId] ?? [],
      listMessages: async ({ threadId }: { threadId: string }) => h.messages[threadId] ?? [],
    },
  }),
}));
vi.mock("@/lib/conversations/share", () => ({
  createShare: vi.fn(async (userId: string, threadId: string) => {
    const share = { token: `tok-${h.shares.length + 1}`, threadId, userId, expiresAt: null };
    h.shares.push(share);
    return { token: share.token, expiresAt: null };
  }),
  getShare: vi.fn(async (userId: string, threadId: string) => {
    const s = h.shares.find((x) => x.userId === userId && x.threadId === threadId);
    return s ? { token: s.token, expiresAt: s.expiresAt } : null;
  }),
  revokeShares: vi.fn(async (userId: string, threadId: string) => {
    const before = h.shares.length;
    h.shares = h.shares.filter((x) => !(x.userId === userId && x.threadId === threadId));
    return h.shares.length < before;
  }),
  resolveShareToken: vi.fn(async (token: string) => {
    const s = h.shares.find((x) => x.token === token);
    return s ? { threadId: s.threadId, ownerId: s.userId } : null;
  }),
}));

import routes from "@/routes/chat-shares";

// Mounted where routes/index.ts mounts it, so the auth exemption sees real paths.
const app = new Hono().route("/chat-shares", routes);
// biome-ignore lint/suspicious/noExplicitAny: response bodies are asserted per test
type JsonResponse = Omit<Response, "json"> & { json(): Promise<any> };
const chatShares = {
  request: (path: string, init?: RequestInit) =>
    app.request(`/chat-shares${path}`, init) as Promise<JsonResponse>,
};

const as = (user: string, method = "GET") => ({
  method,
  headers: { Authorization: `Bearer ${user}` },
});

describe("chat share links", () => {
  beforeEach(() => {
    h.shares = [];
    h.threads = { alice: [{ id: "t-1", title: "Weekly report", createdAt: new Date(0) }] };
    h.messages = {
      "t-1": [
        { id: "m1", role: "signal", content: { parts: [{ type: "text", text: "Summarize" }] } },
        { id: "m2", role: "assistant", content: { parts: [{ type: "text", text: "Done." }] } },
        { id: "m3", role: "assistant", content: { parts: [{ type: "tool-call" }] } },
      ],
    };
  });

  it("lets the owner mint a link, and returns the same link when shared again", async () => {
    const first = await chatShares.request("/t-1", as("alice", "POST"));
    expect(first.status).toBe(201);
    const { token } = await first.json();
    const again = await (await chatShares.request("/t-1", as("alice", "POST"))).json();
    expect(again.token).toBe(token);
    expect(await (await chatShares.request("/t-1", as("alice"))).json()).toMatchObject({ token });
  });

  it("hides another user's thread: no minting, reading or revoking it", async () => {
    expect((await chatShares.request("/t-1", as("mallory", "POST"))).status).toBe(404);
    expect((await chatShares.request("/t-1", as("mallory"))).status).toBe(404);
    expect((await chatShares.request("/t-1", as("mallory", "DELETE"))).status).toBe(404);
    expect(h.shares).toHaveLength(0);
  });

  it("requires sign-in for everything but the public read", async () => {
    expect((await chatShares.request("/t-1", { method: "POST" })).status).toBe(401);
  });

  it("serves the shared chat publicly with its title and text turns only", async () => {
    const { token } = await (await chatShares.request("/t-1", as("alice", "POST"))).json();
    const res = await chatShares.request(`/public/${token}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Weekly report");
    expect(body.messages.map((m: any) => [m.role, m.parts[0].text])).toEqual([
      ["user", "Summarize"],
      ["assistant", "Done."],
    ]);
  });

  it("stops serving once the owner stops sharing", async () => {
    const { token } = await (await chatShares.request("/t-1", as("alice", "POST"))).json();
    expect(await (await chatShares.request("/t-1", as("alice", "DELETE"))).json()).toEqual({
      revoked: true,
    });
    expect((await chatShares.request(`/public/${token}`)).status).toBe(404);
  });

  it("stops serving once the owner deletes the chat", async () => {
    const { token } = await (await chatShares.request("/t-1", as("alice", "POST"))).json();
    h.threads.alice = [];
    expect((await chatShares.request(`/public/${token}`)).status).toBe(404);
  });

  it("404s an unknown token", async () => {
    expect((await chatShares.request("/public/nope")).status).toBe(404);
  });
});
