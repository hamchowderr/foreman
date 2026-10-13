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

/** The key the conversation's Mastra thread id is stamped under (the web `/chat`
 *  route sets it alongside `userId`; the proposal approve route sets it too). */
export const THREAD_ID_KEY = "threadId";

/** The key an approved action proposal's id is stamped under while that approved
 *  tool call executes (`POST /proposals/:id/approve`). */
export const PROPOSAL_ID_KEY = "proposalId";

/**
 * Zapier request-tracing ids for the current run (SDK 0.105.0 `correlationId` /
 * `causationId`, sent as `zapier-correlation-id` / `zapier-causation-id` headers).
 *
 * - `correlationId` — the conversation / Mastra thread id, so every Zapier call a
 *   conversation makes can be tied together on Zapier's side. RequestContext
 *   wins; the tool's own `agent.threadId` is the fallback.
 * - `causationId` — the approved proposal's id, set only on the approval path,
 *   so the Zapier run traces back to the human approval that caused it.
 *
 * Per-run values only. The SDK's `ZAPIER_CORRELATION_ID` / `ZAPIER_CAUSATION_ID`
 * env vars are process-wide and this server is multi-tenant — never use them.
 */
export interface ZapierTraceIds {
  correlationId?: string;
  causationId?: string;
}

export function resolveTraceIds(
  requestContext?: ReadableRequestContext | null,
  agentThreadId?: string,
): ZapierTraceIds {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const correlationId = str(requestContext?.get(THREAD_ID_KEY)) ?? str(agentThreadId);
  const causationId = str(requestContext?.get(PROPOSAL_ID_KEY));
  return {
    ...(correlationId ? { correlationId } : {}),
    ...(causationId ? { causationId } : {}),
  };
}
