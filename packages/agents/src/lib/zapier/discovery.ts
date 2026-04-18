import { getSdkForUser } from "./sdk";

export async function listUserConnections(userId: string) {
  const sdk = await getSdkForUser(userId);
  const { data } = await sdk.listConnections();
  return data;
}

export async function listActionsForApp(userId: string, appKey: string) {
  const sdk = await getSdkForUser(userId);
  const { data } = await sdk.listActions({ app: appKey });
  return data;
}

export async function getActionInputSchema(
  userId: string,
  appKey: string,
  actionType: string,
  actionKey: string,
  connectionId?: string
) {
  const sdk = await getSdkForUser(userId);
  const { data } = await sdk.listInputFields({
    app: appKey,
    actionType: actionType as "search" | "read" | "write" | "run" | "filter" | "read_bulk" | "search_and_write" | "search_or_write",
    action: actionKey,
    ...(connectionId ? { connection: connectionId } : {}),
  });
  return data;
}

export async function getInputFieldChoices(
  userId: string,
  appKey: string,
  actionType: string,
  actionKey: string,
  fieldKey: string,
  connectionId?: string
) {
  const sdk = await getSdkForUser(userId);
  const { data } = await sdk.listInputFieldChoices({
    app: appKey,
    actionType: actionType as "search" | "read" | "write" | "run" | "filter" | "read_bulk" | "search_and_write" | "search_or_write",
    action: actionKey,
    inputField: fieldKey,
    ...(connectionId ? { connection: connectionId } : {}),
  });
  return data;
}
