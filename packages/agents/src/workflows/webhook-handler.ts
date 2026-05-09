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
  execute: async ({ inputData, writer }) => {
    await writer?.write({
      type: "webhook-validation-start",
      event: inputData.event,
      source: inputData.source ?? "zapier",
    });

    const result = {
      event: inputData.event,
      data: inputData.data,
      timestamp: inputData.timestamp ?? new Date().toISOString(),
      source: inputData.source ?? "zapier",
    };

    await writer?.write({
      type: "webhook-validated",
      event: result.event,
      source: result.source,
      timestamp: result.timestamp,
    });

    return result;
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
  execute: async ({ inputData, writer }) => {
    const { event, data, source } = inputData;

    await writer?.write({
      type: "webhook-routing",
      event,
      source,
    });

    let result: { status: "processed" | "skipped"; event: string; message: string };

    switch (event) {
      case "new_record":
        console.log(
          `[Webhook] New record from ${source}:`,
          JSON.stringify(data),
        );
        result = {
          status: "processed",
          event,
          message: `New record received from ${source}`,
        };
        break;

      case "updated_record":
        console.log(
          `[Webhook] Updated record from ${source}:`,
          JSON.stringify(data),
        );
        result = {
          status: "processed",
          event,
          message: `Record update received from ${source}`,
        };
        break;

      case "trigger_fired":
        console.log(
          `[Webhook] Trigger fired from ${source}:`,
          JSON.stringify(data),
        );
        result = {
          status: "processed",
          event,
          message: `Trigger event received from ${source}`,
        };
        break;

      default:
        result = {
          status: "skipped",
          event,
          message: `Unknown event type: ${event}`,
        };
    }

    await writer?.write({
      type: "webhook-processed",
      event: result.event,
      status: result.status,
    });

    return result;
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
