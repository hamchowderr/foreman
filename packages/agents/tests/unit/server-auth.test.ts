import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveFromRequest = vi.fn();
vi.mock("../../src/lib/identity", () => ({ resolveFromRequest }));

const { foremanServerAuth, identityForRequest } = await import("../../src/lib/server-auth");

const authenticate = (request: unknown) => foremanServerAuth.authenticateToken!("", request as any);
const user = { userId: "u1", channel: "web" as const };

describe("foremanServerAuth", () => {
  beforeEach(() => {
    resolveFromRequest.mockReset();
    vi.stubEnv("MASTRA_DEV", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("authenticates with Foreman's identity resolver", async () => {
    resolveFromRequest.mockResolvedValue(user);
    const req = new Request("http://x/api/agents", { headers: { authorization: "Bearer t" } });
    expect(await authenticate(req)).toEqual(user);
    expect(await authenticate({ raw: req })).toEqual(user);
  });

  it("rejects a request with no identity", async () => {
    resolveFromRequest.mockResolvedValue(null);
    expect(await authenticate(new Request("http://x/api/agents"))).toBeNull();
  });

  it("resolves each request once", async () => {
    resolveFromRequest.mockResolvedValue(user);
    const req = new Request("http://x/agent-controller/threads");
    await identityForRequest(req);
    await authenticate(req);
    expect(resolveFromRequest).toHaveBeenCalledTimes(1);
  });

  it("lets Studio in only under mastra dev", async () => {
    resolveFromRequest.mockResolvedValue(null);
    const studio = () =>
      new Request("http://x/api/agents", { headers: { "x-mastra-dev-playground": "true" } });
    expect(await authenticate(studio())).toBeNull();
    vi.stubEnv("MASTRA_DEV", "true");
    expect(await authenticate(studio())).toEqual({ devStudio: true });
  });

  it("closes Mastra's built-in /api routes to signed-in users", async () => {
    const authorize = (path: string, method: string, u: unknown) =>
      foremanServerAuth.authorize!(path, method, u as any, undefined as any);
    expect(await authorize("/api/memory/threads", "GET", user)).toBe(false);
    expect(await authorize("/api", "GET", user)).toBe(false);
    expect(await authorize("/agent-controller/threads", "GET", user)).toBe(true);
    expect(await authorize("/chat/foreman", "POST", user)).toBe(true);
    expect(await authorize("/api/agents", "GET", { devStudio: true })).toBe(true);
  });
});
