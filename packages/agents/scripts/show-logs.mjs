/**
 * On-demand log viewer — shows recent agent activity from the DB.
 * Usage: node scripts/show-logs.mjs [minutes=10]
 *   node scripts/show-logs.mjs watch   (poll every 3s continuously)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('C:/Users/HamCh/code/foreman/node_modules/pg');

const arg = process.argv[2] || '10';
const watch = arg === 'watch';
const minutes = watch ? 1 : parseInt(arg, 10);
const connStr = 'postgres://postgres:postgres@127.0.0.1:54422/postgres';

async function fetchSince(client, since) {
  const r = await client.query(
    `SELECT m.id, m.role, t."resourceId", m."createdAt", m.content::text as content
     FROM mastra_messages m JOIN mastra_threads t ON t.id = m.thread_id
     WHERE m."createdAt" > $1
     ORDER BY m."createdAt" ASC`,
    [since]
  );
  return r.rows;
}

function printRows(rows) {
  for (const row of rows) {
    let parts = [];
    try { parts = JSON.parse(row.content)?.parts || []; } catch(e) {}
    for (const part of parts) {
      if (part.type === 'text' && part.text?.trim()) {
        const ts = new Date(row.createdAt).toISOString().slice(11, 23);
        const uid = (row.resourceId || '').slice(0, 8);
        console.log(`[${ts}] ${row.role.toUpperCase()}(${uid}): ${part.text.slice(0, 300)}`);
      }
      if (part.type === 'tool-invocation') {
        const ti = part.toolInvocation;
        const ts = new Date(row.createdAt).toISOString().slice(11, 23);
        const detail = ti.state === 'result'
          ? JSON.stringify(ti.result ?? {}).slice(0, 400)
          : JSON.stringify(ti.args ?? {}).slice(0, 200);
        console.log(`[${ts}] TOOL: ${ti.toolName} [${ti.state}] ${detail}`);
      }
    }
  }
}

const client = new Client({ connectionString: connStr });
await client.connect();

if (watch) {
  let last = new Date().toISOString();
  console.log('Watching for new messages (Ctrl+C to stop)...');
  while (true) {
    const rows = await fetchSince(client, last);
    if (rows.length > 0) {
      printRows(rows);
      last = rows[rows.length - 1].createdAt;
    }
    await new Promise(r => setTimeout(r, 3000));
  }
} else {
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  console.log(`Activity in the last ${minutes} minute(s):`);
  const rows = await fetchSince(client, since);
  if (rows.length === 0) {
    console.log('  (none)');
  } else {
    printRows(rows);
  }
  await client.end();
}
