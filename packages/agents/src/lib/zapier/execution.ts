import { getSdkForUser } from "./sdk";
import {
  ZapierActionFailed,
  ZapierCapabilityDenied,
} from "./errors";
import { checkCapability } from "../capabilities";
import { runGuardrails } from "../guardrails";

/** Map Zapier action types to capability names. */
const ACTION_TYPE_CAPABILITY: Record<string, string> = {
  search: "search",
  read: "read",
  read_bulk: "read",
  write: "write",
  search_and_write: "write",
  search_or_write: "write",
  run: "execute",
  filter: "execute",
};

async function requireCapability(
  userId: string,
  capability: string
): Promise<void> {
  const enabled = await checkCapability(userId, capability);
  if (!enabled) {
    throw new ZapierCapabilityDenied(capability, userId);
  }
}

export async function runAction(
  userId: string,
  appKey: string,
  actionType: string,
  actionKey: string,
  inputs: Record<string, unknown>,
  connectionId?: string
) {
  const capability = ACTION_TYPE_CAPABILITY[actionType] ?? "execute";
  await requireCapability(userId, capability);

  // Run guardrails (rate limit, app access, risk assessment)
  const guardrailResult = await runGuardrails(userId, appKey, actionType, actionKey, inputs);
  if (!guardrailResult.allowed) {
    throw new ZapierCapabilityDenied(
      guardrailResult.reason ?? "Action blocked by guardrails",
      userId
    );
  }
  if (guardrailResult.requiresConfirmation) {
    // Return risk info so the agent can present confirmation to the user.
    // The caller (proposal flow) checks for an approved proposal before reaching here,
    // so if we get here with requiresConfirmation=true the action needs a proposal first.
    return {
      __guardrail_confirmation_required: true,
      risk: guardrailResult.risk,
      reason: guardrailResult.risk?.reason ?? "This action requires confirmation",
    };
  }

  const sdk = await getSdkForUser(userId);

  try {
    const result = await sdk.runAction({
      app: appKey,
      actionType: actionType as "search" | "read" | "write" | "run" | "filter" | "read_bulk" | "search_and_write" | "search_or_write",
      action: actionKey,
      inputs,
      ...(connectionId ? { connection: connectionId } : {}),
    });
    return result;
  } catch (err) {
    throw new ZapierActionFailed(
      actionKey,
      err instanceof Error ? err.message : String(err)
    );
  }
}

export async function rawFetch(
  userId: string,
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    connectionId: string;
  }
) {
  await requireCapability(userId, "raw_api");

  const sdk = await getSdkForUser(userId);

  try {
    const result = await sdk.fetch(url, {
      method: (options.method ?? "GET") as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      headers: options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      connection: options.connectionId,
    });
    return result;
  } catch (err) {
    throw new ZapierActionFailed(
      `raw_fetch:${url}`,
      err instanceof Error ? err.message : String(err)
    );
  }
}
