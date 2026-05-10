import { getLastModified } from "@/lib/git-last-modified";
import { source } from "@/lib/source";

function xmlEscape(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://foreman.otakusolutions.io").replace(
    /\/$/,
    "",
  );

  const pages = source.getPages();

  const items = pages
    .map((page) => {
      const relPath = `packages/web/content/docs/${page.path}`;
      const lastModified = getLastModified(relPath);
      return {
        title: page.data.title ?? "",
        description: page.data.description ?? "",
        link: `${siteUrl}${page.url}`,
        lastModified,
      };
    })
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

  const channelLink = `${siteUrl}/docs`;
  const channelTitle = "Foreman docs";
  const channelDescription = "Updates to the Foreman documentation";
  const lastBuildDate = (items[0]?.lastModified ?? new Date()).toUTCString();

  const itemsXml = items
    .map(
      (item) =>
        `    <item>\n` +
        `      <title>${xmlEscape(item.title)}</title>\n` +
        `      <link>${xmlEscape(item.link)}</link>\n` +
        `      <description>${xmlEscape(item.description)}</description>\n` +
        `      <pubDate>${item.lastModified.toUTCString()}</pubDate>\n` +
        `      <guid isPermaLink="true">${xmlEscape(item.link)}</guid>\n` +
        `    </item>`,
    )
    .join("\n");

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0">\n` +
    `  <channel>\n` +
    `    <title>${xmlEscape(channelTitle)}</title>\n` +
    `    <link>${xmlEscape(channelLink)}</link>\n` +
    `    <description>${xmlEscape(channelDescription)}</description>\n` +
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>\n` +
    (itemsXml ? `${itemsXml}\n` : "") +
    `  </channel>\n` +
    `</rss>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
