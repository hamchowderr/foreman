import {
  DEPRECATION_NOTICE_EVENT,
  type DeprecationNoticePayload,
  type SdkEvent,
} from "@zapier/zapier-sdk";

/**
 * Zapier SDK deprecation-notice relay (SDK >= 0.79).
 *
 * The SDK sniffs `zapier-sdk-deprecation-*` response headers and emits an
 * `api:deprecation_notice` event (`DEPRECATION_NOTICE_EVENT`). We attach a
 * single `onEvent` handler to every SDK instance we build so that when Zapier
 * flags an endpoint Foreman uses as deprecated, it shows up in the server logs
 * with a greppable prefix — before the endpoint breaks — and is recorded for
 * anything that later wants to surface it to users.
 */

/** Deprecation notices seen this process, keyed by stable notice id. */
const seen = new Map<string, DeprecationNoticePayload>();

/**
 * SDK `onEvent` handler. Pass as `createZapierSdk({ onEvent: onZapierSdkEvent })`.
 * Safe to attach to every SDK instance — non-deprecation events return
 * immediately, and each notice id is logged at most once per process.
 */
export function onZapierSdkEvent(event: SdkEvent): void {
  if (event.type !== DEPRECATION_NOTICE_EVENT) return;
  const payload = event.payload as DeprecationNoticePayload | undefined;
  if (!payload?.id || seen.has(payload.id)) return;
  seen.set(payload.id, payload);
  const when = payload.deprecation
    ? ` (deprecated ${new Date(payload.deprecation).toISOString()})`
    : "";
  console.warn(`[zapier:deprecation] ${payload.message}${when}`);
}

/** Deprecation notices seen so far this process (for surfacing to users/UI). */
export function getZapierDeprecations(): DeprecationNoticePayload[] {
  return [...seen.values()];
}

/** Test-only: reset the per-process dedup set. */
export function __resetZapierDeprecations(): void {
  seen.clear();
}
