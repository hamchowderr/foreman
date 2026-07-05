# Project Rules

Imperative coding rules for Foreman — follow these whenever you write or change
code in this repo. They complement the other two root docs, not duplicate them:

- **CLAUDE.md** — where code lives + hard-won debugging gotchas (navigation).
- **AGENTS.md** — agent workflow: beads issue tracking, the Next.js caveat.
- **rules/** (this folder) — conventions to apply while implementing.

Each file here is `@`-imported at the top of `CLAUDE.md`, so Claude Code loads
them every session. Keep each rule short and specific; link to CLAUDE.md for
background instead of restating it. Change a rule in its own file — never fork a copy.

## Files

- `zapier-sdk.md` — generating tools + calling Zapier SDK methods
- `mastra.md` — `createTool`, `@mastra/*` version pinning, server middleware
- `testing-and-db.md` — test tiers, AIMock, generated DB types
