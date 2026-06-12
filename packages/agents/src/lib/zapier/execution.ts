import { checkCapability } from "../capabilities";
import { resolveAppSlug } from "../catalog/resolve";
import { runGuardrails } from "../guardrails";
import { resolveConnection } from "./aliases";
import { ZapierActionFailed, ZapierCapabilityDenied } from "./errors";
import { getSdkForUser } from "./sdk";

type ActionType =
  | "search"
  | "read"
  | "write"
  | "run"
  | "filter"
  | "read_bulk"
  | "search_and_write"
  | "search_or_write";

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

async function requireCapability(userId: string, capability: string): Promise<void> {
  const enabled = await checkCapability(userId, capability);
  if (!enabled) {
    throw new ZapierCapabilityDenied(capability, userId);
  }
}

export async function runAction(
  userId: string,
  app: string,
  actionType: string,
  action: string,
  inputs: Record<string, unknown>,
  connection?: string,
) {
  // Resolve to the canonical slug via the catalog (the source of truth). The SDK
  // accepts both the raw app_key and the slug; only the old string-munged form
  // ("GitHubCLIAPI" → "git-hub") broke. (foreman-c8fo)
  app = await resolveAppSlug(app);
  const capability = ACTION_TYPE_CAPABILITY[actionType] ?? "execute";
  await requireCapability(userId, capability);

  // Run guardrails (rate limit, app access, risk assessment)
  const guardrailResult = await runGuardrails(userId, app, actionType, action, inputs);
  if (!guardrailResult.allowed) {
    throw new ZapierCapabilityDenied(
      guardrailResult.reason ?? "Action blocked by guardrails",
      userId,
    );
  }
  if (guardrailResult.requiresConfirmation) {
    return {
      __guardrail_confirmation_required: true,
      risk: guardrailResult.risk,
      reason: guardrailResult.risk?.reason ?? "This action requires confirmation",
    };
  }

  const sdk = await getSdkForUser(userId);

  // Resolve alias → numeric ID (passes through if already numeric)
  let resolvedConnection = await resolveConnection(userId, connection);

  // Auto-discover connection if not provided
  if (!resolvedConnection) {
    try {
      const { data: conn } = await sdk.findFirstConnection({
        app,
        expired: false,
      });
      if (conn?.id) {
        resolvedConnection = conn.id;
      }
    } catch {
      // Continue without connection — SDK may still work
    }
  }

  try {
    const result = await sdk.runAction({
      app,
      actionType: actionType as ActionType,
      action,
      inputs,
      timeoutMs: 180000,
      ...(resolvedConnection ? { connection: resolvedConnection } : {}),
    });
    return result;
  } catch (err) {
    throw new ZapierActionFailed(action, err instanceof Error ? err.message : String(err));
  }
}

export async function rawFetch(
  userId: string,
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    connection: string;
  },
) {
  await requireCapability(userId, "raw_api");

  const sdk = await getSdkForUser(userId);
  const resolvedConnection = await resolveConnection(userId, options.connection);

  try {
    const result = await sdk.fetch(url, {
      method: (options.method ?? "GET") as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      headers: options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      connection: resolvedConnection,
    });
    return result;
  } catch (err) {
    throw new ZapierActionFailed(
      `raw_fetch:${url}`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
