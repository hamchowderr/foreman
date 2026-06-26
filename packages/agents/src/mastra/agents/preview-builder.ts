import { Agent } from "@mastra/core/agent";
import { MODELS } from "../../lib/providers";

/**
 * Preview Builder — a cheap Haiku agent that turns a short brief (+ optional
 * data) into a single, complete, self-contained HTML document for the
 * `preview_app` tool (foreman-qq4x / foreman-25yw).
 *
 * Why a separate agent: making the primary Foreman agent (Sonnet 4.6) emit a
 * full HTML document as a tool argument burns thousands of expensive output
 * tokens on every preview. Sonnet should orchestrate (fetch data, decide what
 * to build) and hand a concise brief here; Haiku does the verbose HTML
 * rendering at ~1/15th the output cost.
 *
 * No tools, no memory — this is a pure text→HTML transformer. It is registered
 * on the Mastra instance so tools can reach it via `ctx.mastra.getAgent`.
 */

const PREVIEW_BUILDER_PROMPT = `You are an expert front-end engineer. You output a SINGLE, COMPLETE, self-contained HTML document and NOTHING else.

Hard rules:
- Start with <!doctype html> and include <html>, <head>, and <body>.
- Inline ALL CSS in a <style> tag and ALL JavaScript in <script> tags. Well-known CDN tags are allowed when genuinely helpful (e.g. Chart.js, Recharts UMD, the Tailwind Play CDN) — nothing that requires a build step.
- The page must render by simply opening the file: no bundler, no server-side code, no imports of local files, no runtime network fetches.
- If data is provided in the request, inline it directly as a JavaScript literal and render from that. Never fetch it at runtime and never invent extra data beyond what is given (you may add small illustrative samples only if NO data was provided).
- Make it clean, modern, and responsive: sensible spacing, a coherent color palette, readable typography, and a sound layout. Prefer system fonts unless a CDN font is clearly warranted.
- Output ONLY the raw HTML. No markdown, no triple-backtick code fences, no commentary before or after the document.`;

export function createPreviewBuilderAgent() {
  return new Agent({
    id: "preview-builder",
    name: "Preview Builder",
    description:
      "Turns a short brief (and optional inline data) into a complete, self-contained HTML page for live previews. Internal helper for the preview_app tool — not a user-facing conversational agent.",
    instructions: PREVIEW_BUILDER_PROMPT,
    // Haiku 4.5 — cheap, fast, strong at HTML/CSS. The whole point of this agent
    // is to keep verbose HTML generation off the primary Sonnet model.
    model: MODELS.fast,
    defaultOptions: {
      // HTML documents (especially data dashboards) run long; the provider's
      // default output cap can truncate mid-document. Give it real headroom.
      // Low temperature keeps the markup stable and well-formed.
      modelSettings: { maxOutputTokens: 16000, temperature: 0.3 },
    },
  });
}
