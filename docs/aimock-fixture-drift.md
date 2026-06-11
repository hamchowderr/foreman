# AIMock Fixture-Drift Detection — Design & Decision (foreman-v4i4)

> Distinct from `foreman-d4w9` (which checks fixtures match *declarations* — a
> structural/coverage check). This is about fixtures matching **reality**: the
> shape of real Anthropic responses, which the fixtures were recorded against.

## The problem

Foreman's fast test tier runs entirely against recorded AIMock fixtures
(`tests/fixtures/aimock/*.json`), captured against specific provider response
shapes — **Sonnet 4.6** and **Haiku 4.5**. That's deliberate: zero credits, fully
deterministic, runs on every PR.

The risk is **silent drift**: if Anthropic changes a response shape (tool-call
encoding, streaming envelope, a renamed field, reasoning-block format), the
fixtures no longer reflect the real API. The mocked tests **still pass** — they're
asserting against the stale fixture — so CI stays green while the *real*
integration is quietly broken. Mocked coverage gives false confidence exactly when
you'd most want a warning.

This cannot be solved from inside the mock (`d4w9`/strict-mode catch missing or
mismatched-vs-declaration fixtures, but a fixture can be internally consistent and
still not match what Anthropic returns today). Detecting drift requires comparing
the fixtures against **live** API behavior, on a cadence that doesn't tax every PR.

## Options considered

| # | Approach | Pro | Con |
|---|---|---|---|
| 1 | **Scheduled re-record + diff** — a cron job re-records a representative fixture set against the live API and `git diff`s against committed fixtures; any diff = drift alert | Catches real shape changes directly; the diff *is* the new fixture | Costs credits; needs real keys in the scheduled job; re-record must be deterministic enough to diff cleanly |
| 2 | **Live canary tier** — a small `test:live`-style suite that hits the real Anthropic API on a schedule and asserts the response shape the fixtures assume | Cheap (a few calls); fails loudly on shape change | Asserts shape, doesn't auto-update fixtures; can flake on nondeterminism |
| 3 | **Shape contract on bump** — extract the response-shape contract fixtures rely on; validate it against the provider SDK types whenever the AI-SDK/model is bumped | No live calls; ties drift checks to dependency bumps | Only catches drift that surfaces in types; misses behavioral/runtime shape changes |
| 4 | **Pin + manual re-record** — pin model versions; re-record fixtures by hand whenever you bump the model | Zero infra | Relies on humans remembering; drift between bumps goes undetected |

## Decision (recommended)

**Option 2 as the primary signal, with Option 1 as the remediation path — both
scheduled, never on the PR path.**

1. **Keep per-PR tests 100% on fixtures** (fast, free, deterministic). No change.
2. Add a **scheduled live canary** (`schedule:` cron, e.g. weekly, plus
   `workflow_dispatch`) in a *separate* CI workflow that, with real keys from repo
   secrets, runs ~3–5 representative agent turns against the live API and asserts
   the **shape** the fixtures depend on (tool-call structure, text/reasoning parts,
   the `MastraDBMessage.content.parts` shape the scorers read). On mismatch → the
   scheduled run goes red and notifies — that's the drift alarm.
3. On a drift alarm, **re-record** the affected fixtures (Option 1, run manually or
   semi-automated) and open a PR with the new fixtures + any code changes the shape
   change demands.

Rationale: the canary is cheap and gives a loud, dated signal; full re-record is
only paid when drift is actually detected; and the PR path stays fast and free.

## What this needs to ship (follow-up work, not part of v4i4's design)

- A `tests/canary/` (or `test:live`-tagged) suite asserting the fixture-assumed
  response shape, gated behind real keys.
- A `.github/workflows/fixture-drift.yml` with `schedule:` + `workflow_dispatch`,
  pulling `ANTHROPIC_API_KEY` from secrets, with failure notification.
- A documented **re-record procedure** (which script regenerates fixtures, how to
  review the diff) so remediation is a known, repeatable step.

## Open decisions for the maintainer

- **Cadence & budget:** weekly vs monthly canary; acceptable per-run credit spend.
- **Where keys live:** the project deliberately keeps real keys out of CI; the
  canary is the one sanctioned exception (scheduled only, never on PRs).
- **Notification channel:** GitHub's default failed-run email, or wire to a Slack/
  Discord alert.
