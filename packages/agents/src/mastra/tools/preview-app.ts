import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { startReactPreview, typecheckPreview } from "../../lib/preview/serve";

/**
 * Pull the raw TSX out of the builder's reply, tolerating the model occasionally
 * wrapping it in a markdown code fence or adding stray prose. We strip a leading/
 * trailing ``` fence, then slice from the first real code token (an import or the
 * default export) so any preamble is dropped.
 */
function extractComponent(raw: string): string {
  let text = raw.trim();

  if (text.startsWith("```")) {
    text = text
      .replace(/^```[a-zA-Z]*\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
  }

  // Drop any prose before the code: start at the first import / "export default".
  const match = text.match(/^(import\s|export\s+default\b)/m);
  if (match && match.index !== undefined && match.index > 0) {
    text = text.slice(match.index).trim();
  }
  return text;
}

// No `strict: true` and no `outputSchema` — same Anthropic-grammar constraints
// as the other custom tools. The execute return flows to the UI as part.output
// for the live preview panel; the model only gets a short confirm.
//
// The agent passes a BRIEF, not code: a cheap Haiku "preview-builder" agent writes
// the React component (foreman-8nyg), keeping that token cost off the primary
// Sonnet model. The component is rendered live in a real Vite + shadcn app.
export const previewAppTool = createTool({
  id: "preview_app",
  description:
    "Build and SHOW a live, interactive app the user can actually see and click — a dashboard, chart, " +
    "report, or small tool — built from the product's REAL shadcn/ui components and rendered live in a " +
    "side panel. You do NOT write the code yourself: pass a short, specific BRIEF of what to build, and " +
    "(when the user wants a view of THEIR data) FIRST fetch the data with your Zapier tools, then pass " +
    "that data here. A fast builder turns the brief + data into a real React component, compiles it with " +
    "Vite, and shows it live. Use this whenever the user wants to SEE something built.",
  inputSchema: z.object({
    brief: z
      .string()
      .describe(
        "A short, specific description of what to build — what it shows, the charts/KPIs/layout, and " +
          "any notes. Describe intent; do NOT write code.",
      ),
    data: z
      .string()
      .optional()
      .describe(
        "Optional data to render, as a JSON string (or compact text). When the user wants a view of " +
          "their own data, fetch it first with your Zapier tools and pass it here so it is rendered " +
          "rather than invented.",
      ),
    title: z.string().optional().describe("Short title shown above the preview panel."),
  }),
  toModelOutput: (output) => {
    const o = output as { url: string; title?: string };
    return {
      type: "text" as const,
      text: `Live preview${o.title ? ` "${o.title}"` : ""} is running and shown in the side panel (${o.url}).`,
    };
  },
  execute: async ({ brief, data, title }, ctx) => {
    if (!ctx?.mastra) {
      throw new Error("preview_app must run within an agent context to reach the preview builder");
    }
    const builder = ctx.mastra.getAgent("preview-builder");
    if (!builder) throw new Error("preview_app: preview-builder agent is not registered");

    // Live build feed (foreman-7tci): stream a part per stage so the chat shows
    // what's happening instead of a single opaque "Building live preview…".
    const progress = (stage: string, label: string) =>
      ctx?.writer?.custom({ type: "data-preview-progress", data: { stage, label } });

    const prompt = data
      ? `Build this:\n\n${brief}\n\nUse ONLY this data — render from it directly (do not invent extra data):\n\n${data}`
      : `Build this:\n\n${brief}`;

    await progress("design", "Designing the component with shadcn + Haiku…");
    let tsx = extractComponent((await builder.generate(prompt as string)).text ?? "");
    if (!tsx) throw new Error("preview_app: builder returned no component");

    await progress("build", "Compiling and type-checking…");
    const { url } = await startReactPreview(tsx);

    // Self-heal (foreman-8nyg): if the component doesn't compile, feed the real
    // type errors back to the builder and let it fix itself — up to twice.
    let check = await typecheckPreview();
    for (let attempt = 1; !check.ok && attempt <= 2; attempt++) {
      await progress("fix", `Found a build error — fixing it (attempt ${attempt})…`);
      const fixPrompt =
        `The component you just wrote fails to compile with these TypeScript errors:\n\n${check.errors}\n\n` +
        "Return the CORRECTED, COMPLETE component following the exact same import rules. Output only the .tsx, nothing else.";
      const fixed = extractComponent((await builder.generate(fixPrompt)).text ?? "");
      if (!fixed) break;
      tsx = fixed;
      await startReactPreview(tsx);
      check = await typecheckPreview();
    }

    await progress(
      "ready",
      check.ok ? "Preview is live." : "Preview is live (with a known issue).",
    );
    return { url, title: (title as string | undefined) ?? "Preview" };
  },
});
