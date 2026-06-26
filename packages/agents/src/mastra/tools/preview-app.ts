import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { startWorkspacePreview } from "../../lib/preview/serve";

/**
 * Pull a single complete HTML document out of the builder's reply, tolerating
 * the model occasionally wrapping it in a markdown code fence or adding stray
 * prose. We prefer the <!doctype…</html> (or <html>…</html>) slice; otherwise
 * we strip a leading/trailing ``` fence; otherwise we return the trimmed text.
 */
function extractHtml(raw: string): string {
  let text = raw.trim();

  // Strip a leading fence line (```html / ```) and any trailing fence.
  if (text.startsWith("```")) {
    text = text
      .replace(/^```[a-zA-Z]*\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
  }

  // Prefer the actual document span if the model added commentary around it.
  const lower = text.toLowerCase();
  const startDoctype = lower.indexOf("<!doctype");
  const startHtml = lower.indexOf("<html");
  const start = startDoctype !== -1 ? startDoctype : startHtml;
  const end = lower.lastIndexOf("</html>");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + "</html>".length).trim();
  }
  return text;
}

// No `strict: true` and no `outputSchema` — same Anthropic-grammar constraints
// as the other custom tools. The execute return flows to the UI as part.output
// for inline rendering (a live <iframe> preview); the model only gets a short
// confirm.
//
// The agent passes a BRIEF, not HTML: a cheap Haiku "preview-builder" agent does
// the verbose HTML rendering (foreman-25yw), keeping that token cost off the
// primary Sonnet model.
export const previewAppTool = createTool({
  id: "preview_app",
  description:
    "Build and SHOW a live, interactive web page inline in the chat — a dashboard, chart, report, " +
    "or small tool the user can actually see and click, not just a description. You do NOT write the " +
    "HTML yourself: pass a short, specific BRIEF of what to build, and (when the user wants a view of " +
    "THEIR data) FIRST fetch the data with your Zapier tools, then pass that data here so it gets " +
    "inlined into the page. A fast builder turns the brief + data into a complete page, runs it in the " +
    "sandbox, and embeds the running page as a live preview. Use this whenever the user wants to SEE " +
    "something built.",
  inputSchema: z.object({
    brief: z
      .string()
      .describe(
        "A short, specific description of the page to build — what it shows, the kind of charts/" +
          "layout, and any styling notes. Describe intent; do NOT write HTML.",
      ),
    data: z
      .string()
      .optional()
      .describe(
        "Optional data to render, as a JSON string (or compact text). When the user wants a view of " +
          "their own data, fetch it first with your Zapier tools and pass it here so it is inlined " +
          "into the page rather than fetched at runtime.",
      ),
    title: z.string().optional().describe("Short title shown above the preview panel."),
  }),
  toModelOutput: (output) => {
    const o = output as { url: string; title?: string };
    return {
      type: "text" as const,
      text: `Live preview${o.title ? ` "${o.title}"` : ""} is running and shown inline in the chat (${o.url}).`,
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
      ? `Build the following page:\n\n${brief}\n\nUse ONLY this data — inline it directly into the page (do not fetch anything at runtime):\n\n${data}`
      : `Build the following page:\n\n${brief}`;

    await progress("design", "Designing the page and its data with Haiku…");
    const result = await builder.generate(prompt as string);
    const html = extractHtml(result.text ?? "");
    if (!html) throw new Error("preview_app: builder returned no HTML");

    await progress("build", "Writing the page into the sandbox and starting the server…");
    const { url } = await startWorkspacePreview(html);

    await progress("ready", "Preview is live.");
    return { url, title: (title as string | undefined) ?? "Preview" };
  },
});
