import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { createZapierSdk } from "@zapier/zapier-sdk";
import { getEnv } from "@/lib/env";

const checkConnections = createStep({
  id: "check-connections",
  description:
    "Discover Zapier connections and report health status",
  inputSchema: z.object({}),
  outputSchema: z.object({
    activeCount: z.number(),
    staleConnections: z.array(z.string()),
    healthy: z.boolean(),
  }),
  execute: async () => {
    const env = getEnv();

    // In dev, use CLI credentials; in prod, use the override token
    const sdk = env.DEV_ZAPIER_OVERRIDE
      ? createZapierSdk({ credentials: env.DEV_ZAPIER_OVERRIDE })
      : createZapierSdk();

    try {
      const { data: connections } = await sdk.listConnections();
      const activeCount = connections.length;

      // Flag connections that might be stale (no app key or missing fields)
      const staleConnections = connections
        .filter((c: Record<string, unknown>) => !c.app || !c.id)
        .map((c: Record<string, unknown>) => String(c.id ?? "unknown"));

      const healthy = staleConnections.length === 0;

      if (!healthy) {
        console.warn(
          `[Health Check] ${staleConnections.length} stale connection(s): ${staleConnections.join(", ")}`
        );
      }

      console.log(
        `[Health Check] ${activeCount} active connection(s), healthy: ${healthy}`
      );

      return { activeCount, staleConnections, healthy };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[Health Check] Failed to discover connections: ${message}`);
      return { activeCount: 0, staleConnections: [], healthy: false };
    }
  },
});

export const healthCheckWorkflow = createWorkflow({
  id: "health-check",
  description: "Check Zapier connection health every 6 hours",
  inputSchema: z.object({}),
  outputSchema: z.object({
    activeCount: z.number(),
    staleConnections: z.array(z.string()),
    healthy: z.boolean(),
  }),
})
  .then(checkConnections)
  .commit();
