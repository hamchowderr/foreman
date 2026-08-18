/**
 * Native Slack channel config (foreman-3i9k, Phase 1).
 *
 * Every failure mode this guards is silent. A missing `userId` stamp means
 * Zapier actions execute as the global service account instead of the sender —
 * a wrong-account write with a cheerful success message. A `resolveResourceId`
 * that returns the platform default quietly severs cross-channel memory. A
 * `/link` code swallowed by the agent looks like the bot ignoring you. None of
 * these throw, and none are visible without an actual Slack workspace, so they
 * are pinned here.
 */
import { RequestContext } from "@mastra/core/request-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setInstallation = vi.fn();
const adapterInitialize = vi.fn(async () => {});
vi.mock("@chat-adapter/slack", () => ({
  createSlackAdapter: () => ({ setInstallation, initialize: adapterInitialize }),
}));
vi.mock("@/lib/identity", () => ({
  registerChannelUser: vi.fn(async () => "foreman-user-1"),
  redeemChannelLinkCode: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/slack/installations", () => ({ rehydrateSlackInstallations: vi.fn(async () => {}) }));

import { redeemChannelLinkCode, registerChannelUser } from "@/lib/identity";
import { buildSlackChannelConfig } from "@/slack/channel";
import { rehydrateSlackInstallations } from "@/slack/installations";

const ORIGINAL_FLAG = process.env.FOREMAN_NATIVE_CHANNELS;

/** A message from a Slack sender. */
const msg = (text: string) => ({
  text,
  author: { userId: "U123", fullName: "Ada Lovelace" },
});

/** A handler as a callable — `ChannelHandlerConfig` also admits `false`. */
function handlerOf(
  config: NonNullable<ReturnType<typeof buildSlackChannelConfig>>,
  name: "onDirectMessage" | "onMention" | "onSubscribedMessage",
) {
  const handler = config.handlers?.[name];
  if (typeof handler !== "function") throw new Error(`${name} should be a handler function`);
  return (thread: unknown, message: unknown, defaultHandler: unknown, ctx: unknown) =>
    handler(thread as never, message as never, defaultHandler as never, ctx as never);
}

function harness() {
  const config = buildSlackChannelConfig();
  if (!config) throw new Error("expected a channel config with the flag on");
  const thread = { post: vi.fn(async () => {}) };
  const defaultHandler = vi.fn(async () => {});
  const ctx = { requestContext: new RequestContext() };
  return { config, thread, defaultHandler, ctx };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(registerChannelUser).mockResolvedValue("foreman-user-1");
  vi.mocked(redeemChannelLinkCode).mockResolvedValue({ ok: true } as never);
  process.env.FOREMAN_NATIVE_CHANNELS = "slack";
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.FOREMAN_NATIVE_CHANNELS;
  else process.env.FOREMAN_NATIVE_CHANNELS = ORIGINAL_FLAG;
});

describe("buildSlackChannelConfig — the flag", () => {
  it("returns nothing when native channels are off", () => {
    // No config means the agent gets no `channels`, so Mastra generates no
    // webhook route at all. That is what keeps this additive: an unset flag
    // must not put a second live Slack surface on :4111 by accident.
    delete process.env.FOREMAN_NATIVE_CHANNELS;
    expect(buildSlackChannelConfig()).toBeUndefined();
  });

  it("stays off when the flag names only other platforms", () => {
    process.env.FOREMAN_NATIVE_CHANNELS = "discord,telegram";
    expect(buildSlackChannelConfig()).toBeUndefined();
  });

  it("builds a slack adapter when opted in, tolerating spacing and case", () => {
    process.env.FOREMAN_NATIVE_CHANNELS = " Discord , SLACK ";
    const config = buildSlackChannelConfig();
    expect(config?.adapters).toHaveProperty("slack");
  });
});

describe("acting-user stamping", () => {
  it("stamps the Foreman user id on the run before the agent sees the message", async () => {
    const { config, thread, defaultHandler, ctx } = harness();

    await handlerOf(config, "onDirectMessage")(
      thread,
      msg("book me a flight"),
      defaultHandler,
      ctx,
    );

    expect(ctx.requestContext.get("userId")).toBe("foreman-user-1");
    expect(defaultHandler).toHaveBeenCalledOnce();
    expect(registerChannelUser).toHaveBeenCalledWith("slack", "U123", "Ada Lovelace");
  });

  it("stamps on mentions and subscribed follow-ups too", async () => {
    // Every path that runs the agent needs the stamp. Missing it on one handler
    // means DMs act as the right user and channel mentions do not.
    for (const handler of ["onMention", "onSubscribedMessage"] as const) {
      const { config, thread, defaultHandler, ctx } = harness();

      await handlerOf(config, handler)(thread, msg("hey foreman"), defaultHandler, ctx);

      expect(ctx.requestContext.get("userId"), handler).toBe("foreman-user-1");
      expect(defaultHandler, handler).toHaveBeenCalledOnce();
    }
  });

  it("stamps before calling the default handler, not after", async () => {
    // Ordering is the whole mechanism: core dispatches the run with this same
    // RequestContext instance, so a stamp written after defaultHandler returns
    // would be set on an object nobody reads again.
    const { config, thread, ctx } = harness();
    let seenAtDispatch: unknown;
    const defaultHandler = vi.fn(async () => {
      seenAtDispatch = ctx.requestContext.get("userId");
    });

    await handlerOf(config, "onDirectMessage")(thread, msg("do the thing"), defaultHandler, ctx);

    expect(seenAtDispatch).toBe("foreman-user-1");
  });

  it("ignores an empty message without starting a run", async () => {
    const { config, thread, defaultHandler, ctx } = harness();

    await handlerOf(config, "onDirectMessage")(
      thread,
      { text: "", author: { userId: "U123" } },
      defaultHandler,
      ctx,
    );

    expect(defaultHandler).not.toHaveBeenCalled();
  });
});

describe("/link account pairing", () => {
  it("redeems the code and never reaches the agent", async () => {
    const { config, thread, defaultHandler, ctx } = harness();

    await handlerOf(config, "onDirectMessage")(thread, msg("/link ABCD1234"), defaultHandler, ctx);

    expect(redeemChannelLinkCode).toHaveBeenCalledWith("ABCD1234", "slack", "U123", "Ada Lovelace");
    // A link code handed to the LLM is a leaked credential and a confused reply.
    expect(defaultHandler).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledWith(expect.stringContaining("now linked"));
  });

  it("reports an expired or already-used code instead of failing silently", async () => {
    for (const [error, expected] of [
      ["expired", "expired"],
      ["already_used", "already been used"],
      ["not_found", "Code not found"],
    ] as const) {
      const { config, thread, defaultHandler, ctx } = harness();
      vi.mocked(redeemChannelLinkCode).mockResolvedValue({ ok: false, error } as never);

      await handlerOf(config, "onDirectMessage")(
        thread,
        msg("/link ABCD1234"),
        defaultHandler,
        ctx,
      );

      expect(thread.post, error).toHaveBeenCalledWith(expect.stringContaining(expected));
      expect(defaultHandler, error).not.toHaveBeenCalled();
    }
  });

  it("treats ordinary text mentioning link as a normal message", async () => {
    const { config, thread, defaultHandler, ctx } = harness();

    await handlerOf(config, "onDirectMessage")(
      thread,
      msg("can you link my calendar?"),
      defaultHandler,
      ctx,
    );

    expect(redeemChannelLinkCode).not.toHaveBeenCalled();
    expect(defaultHandler).toHaveBeenCalledOnce();
  });
});

describe("memory ownership", () => {
  it("owns channel memory by Foreman user, not by slack:U123", async () => {
    // The native default (`slack:U123`) would give the same person a separate
    // memory per platform, breaking the cross-channel recall the product is
    // built around.
    const { config } = harness();

    const resourceId = await config.resolveResourceId?.({
      platform: "slack",
      thread: { isDM: true } as never,
      message: msg("hi") as never,
      defaultResourceId: "slack:U123",
    });

    expect(resourceId).toBe("foreman-user-1");
  });

  it("falls back to the platform-scoped default when the lookup fails", async () => {
    // Guessing an owner here would hand one person's memory to another. The
    // platform default is isolated by construction, so it is the safe answer.
    vi.mocked(registerChannelUser).mockRejectedValue(new Error("db down"));
    const { config } = harness();

    const resourceId = await config.resolveResourceId?.({
      platform: "slack",
      thread: { isDM: true } as never,
      message: msg("hi") as never,
      defaultResourceId: "slack:U123",
    });

    expect(resourceId).toBe("slack:U123");
  });
});

describe("the generated webhook route", () => {
  it("mounts on :4111 under the agent, unauthenticated, only when opted in", async () => {
    // The point of the migration: Mastra serves this on the main server, so the
    // standalone raw-Node webhook server on :4112 has nothing left to do for
    // Slack. `requiresAuth: false` is what lets Slack POST at all — Foreman's
    // Supabase JWT middleware would reject it otherwise — and the path must not
    // collide with anything in CUSTOM_ROUTE_PREFIXES or Foreman's own
    // middleware would swallow the body before signature verification.
    const { Agent } = await import("@mastra/core/agent");
    const agent = new Agent({
      id: "foreman",
      name: "Foreman",
      instructions: "test",
      model: "anthropic/claude-haiku-4-5-20251001",
      channels: buildSlackChannelConfig(),
    });

    const routes = agent.getChannels()?.getWebhookRoutes() ?? [];

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      path: "/api/agents/foreman/channels/slack/webhook",
      method: "POST",
      requiresAuth: false,
    });
  });

  it("generates no route at all while the flag is off", async () => {
    delete process.env.FOREMAN_NATIVE_CHANNELS;
    const { Agent } = await import("@mastra/core/agent");
    const agent = new Agent({
      id: "foreman",
      name: "Foreman",
      instructions: "test",
      model: "anthropic/claude-haiku-4-5-20251001",
      channels: buildSlackChannelConfig(),
    });

    expect(agent.getChannels()).toBeNull();
  });
});

describe("multi-workspace installs", () => {
  it("rehydrates installs after the adapter initializes, not before", async () => {
    // setInstallation writes into the state store that initialize() wires up,
    // so the reverse order loses every install and the bot answers in no
    // workspace at all.
    const config = buildSlackChannelConfig();
    const order: string[] = [];
    adapterInitialize.mockImplementation(async () => {
      order.push("initialize");
    });
    vi.mocked(rehydrateSlackInstallations).mockImplementation(async () => {
      order.push("rehydrate");
    });

    const adapter = config?.adapters.slack as { initialize: (c: unknown) => Promise<void> };
    await adapter.initialize({} as never);

    expect(order).toEqual(["initialize", "rehydrate"]);
  });
});
