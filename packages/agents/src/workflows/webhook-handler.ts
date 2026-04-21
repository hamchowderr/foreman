import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const zapierEventSchema = z.enum([
  "new_record",
  "updated_record",
  "trigger_fired",
]);

const webhookPayloadSchema = z.object({
  event: zapierEventSchema,
  data: z.record(z.string(), z.unknown()),
  timestamp: z.string().optional(),
  source: z.string().optional(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

const validatePayload = createStep({
  id: "validate-payload",
  description: "Validate and normalize the incoming Zapier webhook payload",
  inputSchema: webhookPayloadSchema,
  outputSchema: z.object({
    event: zapierEventSchema,
    data: z.record(z.string(), z.unknown()),
    timestamp: z.string(),
    source: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      event: inputData.event,
      data: inputData.data,
      timestamp: inputData.timestamp ?? new Date().toISOString(),
      source: inputData.source ?? "zapier",
    };
  },
});

const processEvent = createStep({
  id: "process-event",
  description: "Route and process the webhook event based on its type",
  inputSchema: z.object({
    event: zapierEventSchema,
    data: z.record(z.string(), z.unknown()),
    timestamp: z.string(),
    source: z.string(),
  }),
  outputSchema: z.object({
    status: z.enum(["processed", "skipped"]),
    event: z.string(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { event, data, source } = inputData;

    switch (event) {
      case "new_record":
        console.log(
          `[Webhook] New record from ${source}:`,
          JSON.stringify(data),
        );
        return {
          status: "processed" as const,
          event,
          message: `New record received from ${source}`,
        };

      case "updated_record":
        console.log(
          `[Webhook] Updated record from ${source}:`,
          JSON.stringify(data),
        );
        return {
          status: "processed" as const,
          event,
          message: `Record update received from ${source}`,
        };

      case "trigger_fired":
        console.log(
          `[Webhook] Trigger fired from ${source}:`,
          JSON.stringify(data),
        );
        return {
          status: "processed" as const,
          event,
          message: `Trigger event received from ${source}`,
        };

      default:
        return {
          status: "skipped" as const,
          event,
          message: `Unknown event type: ${event}`,
        };
    }
  },
});

export const webhookHandlerWorkflow = createWorkflow({
  id: "webhook-handler",
  description:
    "Process incoming Zapier webhook payloads — validate, route by event type, and log results",
  inputSchema: webhookPayloadSchema,
  outputSchema: z.object({
    status: z.enum(["processed", "skipped"]),
    event: z.string(),
    message: z.string(),
  }),
})
  .then(validatePayload)
  .then(processEvent)
  .commit();
