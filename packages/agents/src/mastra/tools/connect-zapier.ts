import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createZapierSdk } from "@zapier/zapier-sdk";

const ZAPIER_CONNECTIONS_PAGE = "https://zapier.com/app/connections";

/**
 * Build the deep-link URL that opens Zapier's OAuth flow for a specific app.
 * Uses the SDK's `implementation_id` (e.g. "GoogleMailV2CLIAPI@2.8.3") which
 * is Zapier's internal app identifier.
 */
function authStartUrl(implementationId: string): string {
  return `https://zapier.com/engine/auth/start/${implementationId}/`;
}

/**
 * Pick the canonical match from listApps results. Zapier's search is a
 * substring match — querying "notion" returns "Fitness Nation" first and
 * "gmail" buries Gmail past position 10. Only return an app if we find an
 * exact slug/key/title match; otherwise it's safer to fall back to the
 * generic connections page than to deep-link to the wrong app.
 */
function pickExactApp<T extends { slug?: string; key?: string; title?: string }>(
  apps: readonly T[],
  query: string,
): T | undefined {
  if (!apps?.length) return undefined;
  const q = query.toLowerCase().trim();
  const qNoDash = q.replace(/-/g, "_");
  return (
    apps.find((a) => a.slug?.toLowerCase() === q) ??
    apps.find((a) => a.slug?.toLowerCase().replace(/-/g, "_") === qNoDash) ??
    apps.find((a) => a.key?.toLowerCase() === q) ??
    apps.find((a) => a.title?.toLowerCase() === q)
  );
}

export const connectZapierTool = createTool({
  id: "connect_zapier",
  strict: true,
  description:
    "Generate a URL the user can click to connect an app on Zapier. " +
    "If appSlug is provided (e.g. 'gmail', 'slack', 'notion'), returns the " +
    "public Zapier app page where they click 'Connect' to start OAuth. " +
    "If no appSlug, returns the general Zapier connections page. Use this " +
    "whenever a user needs to add a new app connection or after a " +
    "ZapierNotConnected error.",
  inputSchema: z.object({
    appSlug: z
      .string()
      .optional()
      .describe(
        "The app slug to connect (e.g. 'gmail', 'slack', 'notion'). " +
        "If omitted, returns the general Zapier connections page URL.",
      ),
  }),
  onInputStart: ({ toolCallId }) => {
    console.log(`[tool:connect_zapier] Input streaming started (callId=${toolCallId.slice(0, 8)})`);
  },
  onInputAvailable: ({ input, toolCallId }) => {
    const slug = (input as any)?.appSlug ?? "(generic)";
    console.log(`[tool:connect_zapier] Input available: appSlug=${slug} (callId=${toolCallId.slice(0, 8)})`);
  },
  onOutput: ({ output, toolName }) => {
    console.log(
      `[tool:${toolName}] Generated connect URL for ${(output as any)?.appName ?? "generic"}`,
    );
  },
  execute: async ({ appSlug }, context) => {
    if (!appSlug) {
      return {
        connectUrl: ZAPIER_CONNECTIONS_PAGE,
        message:
          "Click the link to manage your Zapier connections. Once you've added the app, come back and I'll complete your request.",
      };
    }

    // Top-level data-* chunk so the UI can render progress as a discrete part.
    // transient: true keeps "Looking up ..." chatter out of message history —
    // the final tool result is what gets persisted, not the search progress.
    await context?.writer?.custom({
      type: "data-tool-progress",
      data: { tool: "connect_zapier", status: "searching", appSlug },
      transient: true,
    });

    try {
      const sdk = createZapierSdk();
      // Pull a wider candidate set — Zapier's search uses substring matching
      // and can bury exact-name apps (e.g. "gmail" returns "Acelle Mail" in
      // the first 10 results, with the actual Gmail beyond position 10).
      const { data: apps } = await sdk.listApps({ search: appSlug, maxItems: 50 });
      const app = pickExactApp(apps ?? [], appSlug);
      if (app?.implementation_id) {
        return {
          connectUrl: authStartUrl(app.implementation_id),
          appName: app.title ?? app.slug ?? appSlug,
          message: `Click the link to connect ${app.title ?? app.slug ?? appSlug} on Zapier. Once connected, come back and I'll complete your request.`,
        };
      }
    } catch {
      // Fall through to the generic page below.
    }

    return {
      connectUrl: ZAPIER_CONNECTIONS_PAGE,
      message: `Couldn't find "${appSlug}" on Zapier as an exact match. Click the link to manage connections — search for the app there, then come back and I'll complete your request.`,
    };
  },
});
