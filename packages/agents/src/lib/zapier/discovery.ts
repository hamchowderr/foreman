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

export async function listUserConnections(userId: string) {
  const sdk = await getSdkForUser(userId);
  const { data } = await sdk.listConnections();
  return data;
}

export async function listActionsForApp(userId: string, app: string) {
  const sdk = await getSdkForUser(userId);
  const { data } = await sdk.listActions({ app });
  return data;
}

export async function getInputFieldsSchema(
  userId: string,
  app: string,
  actionType: string,
  action: string,
  connection?: string
) {
  const sdk = await getSdkForUser(userId);
  const { data } = await sdk.getInputFieldsSchema({
    app,
    actionType: actionType as ActionType,
    action,
    ...(connection ? { connection } : {}),
  });
  return data;
}

export async function getInputFieldChoices(
  userId: string,
  app: string,
  actionType: string,
  action: string,
  inputField: string,
  connection?: string
) {
  const sdk = await getSdkForUser(userId);
  const { data } = await sdk.listInputFieldChoices({
    app,
    actionType: actionType as ActionType,
    action,
    inputField,
    ...(connection ? { connection } : {}),
  });
  return data;
}

export async function searchApps(userId: string, search: string) {
  const sdk = await getSdkForUser(userId);
  const { data } = await sdk.listApps({ search });
  return data;
}
