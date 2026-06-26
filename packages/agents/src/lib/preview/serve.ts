import { foremanWorkspace } from "@/mastra/agents/workspace";

/**
 * Live-preview server for the sandbox spike (foreman-qq4x). The agent passes a
 * complete HTML document; we write it into the workspace and run a tiny static
 * server *inside the sandbox*, then hand back a URL the chat embeds in an iframe.
 *
 * The server is spawned directly via the process manager (not the agent's
 * `execute_command` tool), so it is NOT tied to the agent's abort signal and keeps
 * running after the turn ends — otherwise the iframe would go dead immediately.
 *
 * SPIKE limits: single shared port/dir (not per-tenant), localhost only (works in
 * local dev where the browser can reach the agent host). Cloud needs a provider
 * preview URL (E2B/Daytona) — see foreman-691a.
 */

const PREVIEW_PORT = Number(process.env.FOREMAN_PREVIEW_PORT ?? 7331);
const PREVIEW_DIR = "preview";

// A dependency-free static file server, written into the workspace and run by node
// in the sandbox. Serves the preview dir on 127.0.0.1:PORT, defaulting to index.html.
// (Kept free of backticks so it embeds cleanly in this template literal.)
const SERVER_MJS = `import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const port = Number(process.argv[2] || 7331);
const root = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log('[preview] listening on ' + port));
`;

let serverStarted = false;

/** Write `html` into the workspace preview dir, ensure the server is running, return the URL. */
export async function startWorkspacePreview(html: string): Promise<{ url: string }> {
  const fs = foremanWorkspace.filesystem;
  const sandbox = foremanWorkspace.sandbox;
  if (!fs) throw new Error("preview: workspace filesystem not available");
  if (!sandbox) throw new Error("preview: workspace sandbox not available");
  const procs = sandbox.processes;
  if (!procs) throw new Error("preview: sandbox has no process manager");

  await fs.writeFile(`${PREVIEW_DIR}/index.html`, html);
  await fs.writeFile(`${PREVIEW_DIR}/server.mjs`, SERVER_MJS);

  if (!serverStarted) {
    await procs.spawn(`node server.mjs ${PREVIEW_PORT}`, { cwd: PREVIEW_DIR });
    serverStarted = true;
  }

  return { url: `http://localhost:${PREVIEW_PORT}` };
}
