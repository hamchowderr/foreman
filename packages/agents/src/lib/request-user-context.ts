import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestUserContext {
  userId: string;
}

export const requestUserContext = new AsyncLocalStorage<RequestUserContext>();
