import { getSdkForUser } from "./sdk";
import {
  ZapierActionFailed,
  ZapierCapabilityDenied,
} from "./errors";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "../db";

async function checkCapability(
  userId: string,
  capability: string
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.capabilityFlag)
    .where(
      and(
        eq(schema.capabilityFlag.userId, userId),
        eq(schema.capabilityFlag.capability, capability)
      )
    )
    .limit(1);

  const flag = rows[0];
  if (!flag || !flag.enabled) {
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
  await checkCapability(userId, "execute_action");

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
  await checkCapability(userId, "raw_api_call");

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
