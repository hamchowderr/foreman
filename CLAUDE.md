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
- Auth: validates Clerk session tokens via `@mastra/auth-clerk`
- Deploy targets: VPS (default), Vercel (`DEPLOY_TARGET=vercel`), Cloudflare
- Memory: semantic recall (LibSQLVector), working memory, observational memory
- Dev: `npm run dev` (mastra dev) or `npm run dev:mock` (with AIMock)

### packages/web/ — Frontend
- Next.js 16, UI-only — no agent logic
- Calls agent server via `NEXT_PUBLIC_AGENT_SERVER_URL` (default: http://localhost:4111)
- Auth: Clerk (`@clerk/nextjs`) — sign-up, sign-in, org switching, session management
- Components: chat shell, approval cards, error surfaces, streaming

### Dev Workflow
```bash
# Terminal 1: agent server
cd packages/agents && npm run dev

# Terminal 2: web frontend
cd packages/web && npm run dev
```

### Key Env Vars
**agents/.env:** `DATABASE_URL`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (embeddings), `TELEGRAM_BOT_TOKEN`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`
**web/.env.local:** `NEXT_PUBLIC_AGENT_SERVER_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
