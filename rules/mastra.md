# Mastra & Agent-Server Rules

- **Never set `strict: true` on `createTool`.** It forces Anthropic's
  grammar-constrained tool mode, which rejects `additionalProperties` /
  `propertyNames` and caps optional params at 24 — it broke Foreman's custom
  tools before.
- **Keep the whole `@mastra/*` set on identical pinned versions.** They're pinned
  in the root `overrides`; core/deployer/server drifting apart 500s every authed
  route. `scripts/check-dep-uniqueness.mjs` enforces this — to bump, update every
  pin together, then reinstall from a clean lockfile.
- **`server.middleware` must not consume the request body.** A Web `Request` body
  is single-read; the custom Hono app only pre-routes its own prefixes and lets
  everything else fall through to Mastra with the body intact.
- **Inline images need an explicit `mediaType`.** The `/chat` route forwards
  `{ type: "image", image, mediaType }`; without it the AI SDK assumes JPEG and
  Anthropic rejects PNGs.
- **Models come from `lib/providers/models.ts` (`AGENT_MODELS`), env-overridable.**
  Don't hard-code model ids in agent files.
