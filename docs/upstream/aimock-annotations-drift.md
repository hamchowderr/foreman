# AIMock upstream issue draft — Responses API `annotations` drift

Save-location for the upstream GitHub issue to file at
`https://github.com/CopilotKit/aimock/issues/new` when ready.

Tracked in `bd` as `foreman-9m8`. Not yet filed pending a decision to
open the issue upstream.

---

## Title

> Responses API `output_text` content parts missing required
> `annotations: []` field (breaks `@ai-sdk/openai` Zod validation)

## Body

**Version:** `@copilotkit/aimock` 1.14.3

**Problem:** OpenAI's Responses API requires `annotations: []` on every
`output_text` content part. `@ai-sdk/openai`'s Zod schema (v6.x) enforces
this. AIMock's `src/responses.ts` emits `output_text` in 4 places without
`annotations`, so any `generateText({ model: openai('gpt-4o'), ... })`
against the mock URL returns 200 but throws:

```
AI_TypeValidationError: Value:
  { output: [{ content: [{ type: 'output_text', text: '...' }] }] }
[expected: array, path: ['output', 0, 'content', 0, 'annotations']]
```

**Emission sites** (installed `dist/responses.cjs`; matching line numbers
should exist in `src/responses.ts`):

- line 362 — `response.content_part.added` event
- line 384 — `response.content_part.done` event
- line 394 — `msgItem.content[0]` in `response.output_item.done`
- line 430 — `buildOutputPrefix` non-streaming path

**Drift classification:** the drift-detection page appears to flag this
as warning-severity, so the auto-fix pipeline has not PR'd it. Consumer
impact is breaking in practice — recommend reclassification to critical,
or a manual patch.

**Suggested fix:** default `annotations: []` on every `output_text`
emission. Shouldn't affect existing consumers.

Happy to open a PR if that would help.

## Evidence gathered locally before filing

- No hits for `annotations` in `ResponseOverrides` (`dist/types.d.ts` —
  only scalar overrides: `id`, `created`, `model`, `usage`,
  `systemFingerprint`, `finishReason`, `role`)
- CHANGELOG 1.14.2 adds field validation that rejects unknown override
  keys, so there is no fixture-level workaround
- GitHub issue search: zero hits for `annotations` + `output_text`
- No `.github/ISSUE_TEMPLATE/` in the repo — plain issue is fine
