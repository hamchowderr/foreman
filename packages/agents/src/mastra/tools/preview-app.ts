import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { startWorkspacePreview } from "../../lib/preview/serve";

// No `strict: true` and no `outputSchema` — same Anthropic-grammar constraints as
// the other custom tools. The execute return flows to the UI as part.output for
// inline rendering (a live <iframe> preview); the model only gets a short confirm.
export const previewAppTool = createTool({
  id: "preview_app",
  description:
    "Build and SHOW a live, interactive web page inline in the chat — a dashboard, chart, report, " +
    "or small tool the user can actually see and click, not just a description. Pass a COMPLETE, " +
    "self-contained HTML document (doctype + <html>/<head>/<body>, with ALL CSS and JS inline; " +
    "CDN <script> tags such as Chart.js or Recharts UMD are allowed). It writes the page into the " +
    "sandbox workspace, runs a local web server, and embeds the running page as a live preview. " +
    "When the user wants a dashboard of THEIR data, FIRST fetch the data with your Zapier tools, " +
    "then inline that data into the HTML you pass here. Use this whenever the user wants to SEE " +
    "something built.",
  inputSchema: z.object({
    html: z
      .string()
      .describe(
        "A complete, self-contained HTML document. Inline all CSS and JS; CDN <script> tags allowed.",
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
  execute: async ({ html, title }) => {
    const { url } = await startWorkspacePreview(html as string);
    return { url, title: (title as string | undefined) ?? "Preview" };
  },
});
