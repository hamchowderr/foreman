import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestUserContext {
  userId: string;
}

/**
 * Who the current run is acting as, carried out-of-band.
 *
 * Every channel bot wraps its `agent.generate` call in `requestUserContext.run`,
 * which is how a Zapier tool three frames deep knows whose OAuth connection to
 * use. It is a workaround: Mastra had no per-run context a tool could read when
 * the channel bots were written.
 *
 * It does now. Native channels invoke the agent from Mastra's OWN route, so the
 * ALS scope simply is not there — every Zapier tool would silently fall back to
 * the global client-credentials SDK and act as the WRONG Zapier identity. The
 * replacement is `RequestContext`, which a channel handler can stamp before
 * calling `defaultHandler` (`ChannelHandlerContext.requestContext`, core 1.57.0)
 * and which reaches tool execution as `ToolExecuteContext.requestContext`.
 *
 * Read through `resolveRequestUserId` rather than touching either source
 * directly, so the two coexist during the native-channels migration
 * (foreman-3i9k) and the ALS can be deleted in one edit when the last caller of
 * `.run()` is gone.
 */
export const requestUserContext = new AsyncLocalStorage<RequestUserContext>();

/** The key the acting Foreman user id is stamped under on a `RequestContext`. */
export const USER_ID_KEY = "userId";

/** The narrow slice of `RequestContext` this module needs — keeps callers free
 *  to pass a plain `{ get }` in tests without constructing the real class. */
export interface ReadableRequestContext {
  get(key: string): unknown;
}

/**
 * The acting Foreman user id for the current run, or `undefined` when there is
 * none (a shared/system path, e.g. an unauthenticated channel webhook).
 *
 * `RequestContext` wins over the ALS deliberately: it is the explicit, per-run
 * value the caller chose to pass, while the ALS is ambient and can leak across
 * an await boundary that outlives its `run()`. When both are present they agree
 * anyway — the web `/chat` route sets both.
 */
export function resolveRequestUserId(
  requestContext?: ReadableRequestContext | null,
): string | undefined {
  const fromRequest = requestContext?.get(USER_ID_KEY);
  if (typeof fromRequest === "string" && fromRequest) return fromRequest;
  return requestUserContext.getStore()?.userId;
}
