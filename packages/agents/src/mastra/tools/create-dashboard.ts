import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveAppSlug } from "@/lib/catalog/resolve";
import { saveArtifact } from "@/lib/dashboards/artifact";
import { getLatestSnapshot } from "@/lib/dashboards/snapshot";
import { buildDefaultSpec } from "@/lib/dashboards/spec";

// Cap how many records ride along in the tool result to the UI — enough to
// render a dashboard, bounded so a huge snapshot can't bloat the message stream.
const MAX_RECORDS_TO_UI = 500;

// NOTE: no `strict: true` — Anthropic's grammar can't handle it on richer
// schemas, and it's banned project-wide for createTool.
export const createDashboardTool = createTool({
  id: "create_dashboard",
  description:
    "Build an app — such as a live dashboard — from data already pulled from a connected app " +
    "(e.g. HubSpot, Airtable, Stripe). Use this when the user asks to 'build/make/show an app or " +
    "a dashboard' of their data. It reads the latest stored snapshot for that app, generates a " +
    "live app (KPIs, a chart, and a table), saves it, and renders it inline in the chat. " +
    "If no data has been pulled for the app yet, it tells the user to connect it / let a poll " +
    "trigger pull data first.",
  inputSchema: z.object({
    app: z
      .string()
      .describe("The connected app whose data to visualize, e.g. 'hubspot', 'airtable', 'stripe'."),
    title: z.string().optional().describe("Optional app title. Defaults to '<app> overview'."),
  }),
  // No `outputSchema`: the result carries an open-ended `spec` + `records` (rows
  // with arbitrary keys). Declaring those via z.any()/z.record() makes Mastra emit
  // `additionalProperties: <schema>` in the tool definition, which Anthropic
  // rejects ("additionalProperties: object is not supported"). Omitting the
  // output schema avoids that entirely — the execute return still flows to the UI
  // as the tool result (part.output) for inline rendering.
  //
  // The model only needs a short confirmation — the full spec+records go to the
  // UI, not into the model's context.
  toModelOutput: (output) => {
    const o = output as { title: string; rowCount: number; appKey: string; url: string };
    return {
      type: "text" as const,
      text: `Built the app "${o.title}" from ${o.rowCount} ${o.appKey} record(s). It is shown in the chat and available at ${o.url}.`,
    };
  },
  onOutput: ({ output, toolName }) => {
    const o = output as { id?: string; rowCount?: number; appKey?: string };
    console.log(
      `[tool:${toolName}] built dashboard ${o.id?.slice(0, 8)} (${o.rowCount ?? 0} ${o.appKey} records)`,
    );
  },
  execute: async ({ app, title }, context) => {
    const userId = context?.requestContext?.get("userId") as string | undefined;
    if (!userId) throw new Error("create_dashboard: no userId in request context");

    const appKey = await resolveAppSlug(app);

    const snapshot = await getLatestSnapshot(userId, appKey);
    if (!snapshot || snapshot.records.length === 0) {
      throw new Error(
        `No data has been pulled for "${appKey}" yet. Connect the app and set up a data pull ` +
          `(poll trigger) first, then ask me to build the app.`,
      );
    }

    const spec = buildDefaultSpec(appKey, snapshot.records, title);

    const id = await saveArtifact({
      userId,
      kind: "dashboard",
      title: spec.title,
      spec,
      snapshotId: snapshot.id,
      sourceConfig: snapshot.sourceConfig,
    });

    return {
      id,
      title: spec.title,
      url: `/dashboards/${id}`,
      rowCount: snapshot.rowCount,
      appKey,
      spec,
      records: snapshot.records.slice(0, MAX_RECORDS_TO_UI),
    };
  },
});
