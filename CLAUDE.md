@AGENTS.md

## Monorepo Structure

This is a monorepo with two packages:

```
packages/
  agents/   # Standalone Mastra/Hono agent server (port 4111)
  web/      # Next.js frontend (port 3000, calls agent server)
```

### packages/agents/ — Agent Server
- Mastra + Hono, built with `mastra build`
- Exposes: REST API, A2A (`/a2a/foreman`), MCP (`/mcp/*`)
- Custom routes: `/conversations/*`, `/proposals/*`, `/telegram/webhook`
- Auth: validates BetterAuth session tokens via shared DB
- Deploy targets: VPS (default), Vercel (`DEPLOY_TARGET=vercel`), Cloudflare
- Memory: semantic recall (LibSQLVector), working memory, observational memory
- Dev: `npm run dev` (mastra dev) or `npm run dev:mock` (with LLMock)

### packages/web/ — Frontend
- Next.js 16, UI-only — no agent logic
- Calls agent server via `NEXT_PUBLIC_AGENT_SERVER_URL` (default: http://localhost:4111)
- Auth: BetterAuth (sign-up, sign-in, session management)
- Components: chat shell, approval cards, error surfaces, streaming

### Dev Workflow
```bash
# Terminal 1: agent server
cd packages/agents && npm run dev

# Terminal 2: web frontend
cd packages/web && npm run dev
```

### Key Env Vars
**agents/.env:** `DATABASE_URL`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (embeddings), `TELEGRAM_BOT_TOKEN`
**web/.env.local:** `NEXT_PUBLIC_AGENT_SERVER_URL`, `BETTER_AUTH_URL`, `DATABASE_URL`
