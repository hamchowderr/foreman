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


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
