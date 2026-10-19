/**
 * Slack / Discord / Telegram on the Foreman AgentController (src/channels/).
 *
 * Most of what this guards fails silently in a real chat. A missing user stamp
 * runs Zapier actions as the wrong account. A platform-scoped memory owner cuts a
 * channel off from the user's web memory. A session that isn't scoped per thread
 * hijacks the user's web session. A `/link` code that reaches the agent leaks a
 * credential. None of these throw, so they are pinned here.
 */
import { RequestContext } from "@mastra/core/request-context";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const slackSetInstallation = vi.fn();
const slackInitialize = vi.fn(async () => {});
vi.mock("@chat-adapter/slack", () => ({
  createSlackAdapter: () => ({
    name: "slack",
    setInstallation: slackSetInstallation,
    initialize: slackInitialize,
  }),
}));
vi.mock("@chat-adapter/discord", () => ({
  createDiscordAdapter: () => ({ name: "discord", initialize: vi.fn(async () => {}) }),
}));
vi.mock("@chat-adapter/telegram", () => ({
  createTelegramAdapter: () => ({ name: "telegram", initialize: vi.fn(async () => {}) }),
}));
vi.mock("@/lib/identity", () => ({
  registerChannelUser: vi.fn(async () => "foreman-user-1"),
  resolveFromChannel: vi.fn(async () => "foreman-user-1"),
  resolveActiveWorkspace: vi.fn(async () => "workspace-1"),
}));
vi.mock("@/slack/installations", () => ({ rehydrateSlackInstallations: vi.fn(async () => {}) }));
vi.mock("@/channels/relink", () => ({
  redeemLinkCodeAndRelink: vi.fn(async () => ({ ok: true, userId: "web-user" })),
}));

import {
  buildForemanChannels,
  channelSessionKey,
  skipControllerChannels,
} from "@/channels/controller-channels";
import { redeemLinkCodeAndRelink } from "@/channels/relink";
import { registerChannelUser, resolveFromChannel } from "@/lib/identity";
import { AUTO_ALLOWED_TOOLS } from "@/mastra/lib/tool-categories";
import { rehydrateSlackInstallations } from "@/slack/installations";

const ENV_KEYS = ["SLACK_SIGNING_SECRET", "DISCORD_BOT_TOKEN", "TELEGRAM_BOT_TOKEN"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

type Config = NonNullable<ReturnType<typeof buildForemanChannels>>;
type MessageHandlerName = "onDirectMessage" | "onMention" | "onSubscribedMessage";

function configured(): Config {
  const config = buildForemanChannels();
  if (!config) throw new Error("expected a channels config");
  return config;
}

function messageHandler(config: Config, name: MessageHandlerName) {
  const handler = config.handlers?.[name];
  if (typeof handler !== "function") throw new Error(`${name} should be a handler`);
  return (thread: unknown, message: unknown, defaultHandler: unknown, ctx: unknown) =>
    handler(thread as never, message as never, defaultHandler as never, ctx as never);
}

function harness(platform = "slack") {
  const thread = {
    id: `${platform}:C1:T1`,
    adapter: { name: platform },
    post: vi.fn(async () => {}),
  };
  const defaultHandler = vi.fn(async () => {});
  const ctx = { requestContext: new RequestContext(), mastra: undefined };
  return { thread, defaultHandler, ctx };
}

const msg = (text: string) => ({ text, author: { userId: "U123", fullName: "Ada Lovelace" } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SLACK_SIGNING_SECRET = "test-secret";
  process.env.DISCORD_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_BOT_TOKEN = "123:abc";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("which platforms are hosted", () => {
  it("hosts only the platforms that have credentials", () => {
    delete process.env.DISCORD_BOT_TOKEN;
    expect(Object.keys(configured().adapters).sort()).toEqual(["slack", "telegram"]);
  });

  it("returns nothing when no platform is configured", () => {
    // No config means the controller gets no channels: no routes, no sockets.
    for (const key of ENV_KEYS) delete process.env[key];
    expect(buildForemanChannels()).toBeUndefined();
  });
});

describe("acting-user stamping", () => {
  it("stamps the sender's Foreman user and workspace before dispatch, on every message path", async () => {
    // Core runs the turn with this same RequestContext, so the stamp must land before
    // defaultHandler. Zapier tools and the workspace read the acting user from it.
    for (const name of ["onDirectMessage", "onMention", "onSubscribedMessage"] as const) {
      const { thread, ctx } = harness();
      let seen: unknown[] = [];
      const defaultHandler = vi.fn(async () => {
        seen = [ctx.requestContext.get("userId"), ctx.requestContext.get("workspaceId")];
      });

      await messageHandler(configured(), name)(thread, msg("book a flight"), defaultHandler, ctx);

      expect(defaultHandler, name).toHaveBeenCalledOnce();
      expect(seen, name).toEqual(["foreman-user-1", "workspace-1"]);
    }
    expect(registerChannelUser).toHaveBeenCalledWith("slack", "U123", "Ada Lovelace");
  });

  it("ignores an empty message without starting a run", async () => {
    const { thread, defaultHandler, ctx } = harness();
    await messageHandler(configured(), "onDirectMessage")(
      thread,
      { text: "  ", author: { userId: "U123" } },
      defaultHandler,
      ctx,
    );
    expect(defaultHandler).not.toHaveBeenCalled();
  });

  it("answers instead of going silent when the sender can't be looked up", async () => {
    vi.mocked(registerChannelUser).mockRejectedValueOnce(new Error("db down"));
    const { thread, defaultHandler, ctx } = harness();
    await messageHandler(configured(), "onMention")(thread, msg("hi"), defaultHandler, ctx);
    expect(defaultHandler).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledWith(expect.stringContaining("couldn't look up"));
  });

  it("stamps the clicker on approval-card actions", async () => {
    const config = configured();
    const onAction = config.handlers?.onAction;
    if (typeof onAction !== "function") throw new Error("onAction should be a handler");
    const ctx = { requestContext: new RequestContext() };
    let seen: unknown;
    const defaultHandler = vi.fn(async () => {
      seen = ctx.requestContext.get("userId");
    });

    await onAction(
      { adapter: { name: "slack" }, user: { userId: "U123" }, thread: null } as never,
      defaultHandler,
      ctx as never,
    );

    expect(resolveFromChannel).toHaveBeenCalledWith("slack", "U123");
    expect(seen).toBe("foreman-user-1");
  });
});

describe("/link account pairing", () => {
  it("redeems the code in a DM and never reaches the agent", async () => {
    const { thread, defaultHandler, ctx } = harness("telegram");
    await messageHandler(configured(), "onDirectMessage")(
      thread,
      msg("/link ABCD1234"),
      defaultHandler,
      ctx,
    );
    expect(redeemLinkCodeAndRelink).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "ABCD1234",
        platform: "telegram",
        channelUserId: "U123",
        chatThreadId: thread.id,
      }),
    );
    expect(defaultHandler).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledWith(expect.stringContaining("now linked"));
  });

  it("explains each refusal", async () => {
    for (const [error, expected] of [
      ["expired", "expired"],
      ["already_used", "already been used"],
      ["wrong_channel", "different app"],
      ["not_found", "Code not found"],
    ] as const) {
      vi.mocked(redeemLinkCodeAndRelink).mockResolvedValueOnce({ ok: false, error });
      const { thread, defaultHandler, ctx } = harness();
      await messageHandler(configured(), "onDirectMessage")(
        thread,
        msg("link ABCD1234"),
        defaultHandler,
        ctx,
      );
      expect(thread.post, error).toHaveBeenCalledWith(expect.stringContaining(expected));
      expect(defaultHandler, error).not.toHaveBeenCalled();
    }
  });

  it("treats a code in a channel mention, or ordinary text, as a normal message", async () => {
    const { thread, defaultHandler, ctx } = harness();
    await messageHandler(configured(), "onMention")(
      thread,
      msg("/link ABCD1234"),
      defaultHandler,
      ctx,
    );
    await messageHandler(configured(), "onDirectMessage")(
      thread,
      msg("can you link my calendar?"),
      defaultHandler,
      ctx,
    );
    expect(redeemLinkCodeAndRelink).not.toHaveBeenCalled();
    expect(defaultHandler).toHaveBeenCalledTimes(2);
  });
});

describe("memory ownership", () => {
  it("owns a channel thread by the Foreman user, not by slack:U123", async () => {
    const resourceId = await configured().resolveResourceId?.({
      platform: "slack",
      thread: { isDM: true } as never,
      message: msg("hi") as never,
      defaultResourceId: "slack:U123",
    });
    expect(resourceId).toBe("foreman-user-1");
  });

  it("fails rather than falling back to a platform-scoped owner", async () => {
    // A platform-scoped owner has no apps or workspace and splits memory off from
    // the web chat; failing the message is the honest outcome.
    vi.mocked(registerChannelUser).mockRejectedValueOnce(new Error("db down"));
    await expect(
      Promise.resolve(
        configured().resolveResourceId?.({
          platform: "slack",
          thread: { isDM: true } as never,
          message: msg("hi") as never,
          defaultResourceId: "slack:U123",
        }),
      ),
    ).rejects.toThrow("db down");
  });
});

describe("one session per channel thread", () => {
  function fakeController() {
    const session = { grantTool: vi.fn() };
    return { session, controller: { createSession: vi.fn(async () => session) } };
  }

  it("creates the owner's session in its own scope, bound to the thread", async () => {
    // Scoped so it never reuses (and re-points) the user's unscoped web session.
    const { session, controller } = fakeController();
    const requestContext = new RequestContext();
    requestContext.set("userId", "foreman-user-1");

    const result = await configured().resolveSession?.({
      controller: controller as never,
      thread: { id: "thread-9", resourceId: "foreman-user-1" },
      requestContext,
    });

    expect(result).toBe(session);
    expect(controller.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: "foreman-user-1",
        id: channelSessionKey("thread-9"),
        scope: channelSessionKey("thread-9"),
        threadId: "thread-9",
        createInitialThread: false,
      }),
    );
    // Same no-card tools as the web session; Zapier writes still ask.
    for (const tool of AUTO_ALLOWED_TOOLS) expect(session.grantTool).toHaveBeenCalledWith(tool);
  });

  it("refuses anyone but the thread's owner, and says why in the chat", async () => {
    const { controller } = fakeController();
    const chatThread = { post: vi.fn(async () => {}) };
    const requestContext = new RequestContext();
    requestContext.set("userId", "someone-else");
    requestContext.set("foremanChatThread", chatThread);

    await expect(
      Promise.resolve(
        configured().resolveSession?.({
          controller: controller as never,
          thread: { id: "thread-9", resourceId: "foreman-user-1" },
          requestContext,
        }),
      ),
    ).rejects.toThrow();
    expect(controller.createSession).not.toHaveBeenCalled();
    expect(chatThread.post).toHaveBeenCalledWith(expect.stringContaining("belongs to the person"));
  });
});

describe("Slack workspace installs", () => {
  it("rehydrates installs after the adapter initializes, not before", async () => {
    const order: string[] = [];
    slackInitialize.mockImplementation(async () => {
      order.push("initialize");
    });
    vi.mocked(rehydrateSlackInstallations).mockImplementation(async () => {
      order.push("rehydrate");
    });
    const slack = configured().adapters.slack as {
      adapter: { initialize: (c: unknown) => Promise<void> };
    };

    await slack.adapter.initialize({});

    expect(order).toEqual(["initialize", "rehydrate"]);
  });
});

describe("on the AgentController", () => {
  // Cold-importing @mastra/core can take seconds on a loaded machine.
  let AgentController: typeof import("@mastra/core/agent-controller").AgentController;
  let Agent: typeof import("@mastra/core/agent").Agent;
  beforeAll(async () => {
    ({ AgentController } = await import("@mastra/core/agent-controller"));
    ({ Agent } = await import("@mastra/core/agent"));
  }, 120_000);

  function controllerWith(channels: ReturnType<typeof buildForemanChannels>) {
    return new AgentController({
      id: "foreman-agent-controller",
      agent: new Agent({
        id: "foreman",
        name: "Foreman",
        instructions: "test",
        model: "anthropic/claude-haiku-4-5-20251001",
      }),
      modes: [{ id: "chat", name: "Chat" }],
      channels,
    });
  }

  it("mounts an unauthenticated webhook per platform under the controller", () => {
    // requiresAuth: false is what lets Slack/Discord/Telegram POST at all; the
    // platforms authenticate with their own signatures.
    const routes = controllerWith(buildForemanChannels()).getChannels()?.getWebhookRoutes() ?? [];
    expect(routes.map((r) => r.path).sort()).toEqual([
      "/api/agent-controllers/foreman-agent-controller/channels/discord/webhook",
      "/api/agent-controllers/foreman-agent-controller/channels/slack/webhook",
      "/api/agent-controllers/foreman-agent-controller/channels/telegram/webhook",
    ]);
    expect(routes.every((r) => r.requiresAuth === false)).toBe(true);
  });

  it("hosts nothing in a process that opted out (the :4112 server, the inbox worker)", () => {
    skipControllerChannels();
    expect(buildForemanChannels()).toBeUndefined();
    expect(controllerWith(buildForemanChannels()).getChannels()).toBeNull();
  });
});
