import { Hono } from "hono";
import { getMastra } from "@/mastra";
import type { WebhookPayload } from "@/workflows/webhook-handler";

const webhooks = new Hono();

/**
 * POST /webhooks/zapier
 *
 * Accepts Zapier webhook payloads. Validates an optional shared secret,
 * then kicks off the webhook-handler workflow asynchronously.
 * Returns 200 immediately per webhook best practice.
 */
webhooks.post("/zapier", async (c) => {
  // Validate optional webhook secret
  const secret = process.env.ZAPIER_WEBHOOK_SECRET;
  if (secret) {
    const provided =
      c.req.header("x-webhook-secret") ?? c.req.header("authorization")?.replace(/^Bearer\s+/i, "");

    if (provided !== secret) {
      return c.json({ error: "Invalid webhook secret" }, 401);
    }
  }

  let payload: WebhookPayload;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Basic shape validation before dispatching
  if (!payload.event || !payload.data) {
    return c.json({ error: "Missing required fields: event, data" }, 400);
  }

  // Fire-and-forget: run the workflow asynchronously
  const mastra = getMastra();
  const workflow = mastra.getWorkflow("webhookHandler");

  workflow
    .createRun()
    .start({ inputData: payload })
    .then((result) => {
      console.log(`[Webhook] Workflow completed:`, JSON.stringify(result));
    })
    .catch((err) => {
      console.error(`[Webhook] Workflow failed:`, err);
    });

  return c.json({ received: true }, 200);
});

export default webhooks;
