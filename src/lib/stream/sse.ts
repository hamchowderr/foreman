import type { AppChunk } from "./types";

const encoder = new TextEncoder();

/**
 * Encode an AppChunk as an SSE event line.
 */
export function encodeSSE(chunk: AppChunk): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`);
}

/**
 * Create SSE response headers.
 */
export function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}
