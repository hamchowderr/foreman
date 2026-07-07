/**
 * Daily digest synthesis (foreman-ufo3.2). Pure + deterministic: given the
 * workspace's recent automation runs, produce a prioritized summary of "what
 * mattered" — failures first (need a fix), then approvals waiting on a human,
 * then in-flight retries, with the successes counted. No LLM, no clock coupling.
 *
 * A digest is stored as the `output` of a `finished` automation_run on the digest
 * automation (no new table); the `kind` discriminator lets the inbox find the
 * latest one. An optional LLM narrative layer can wrap this later (foreman-ufo3.3).
 */

export const DIGEST_KIND = "automation_digest" as const;

/** One run as fed to the synthesizer (normalized from an automation_run + its automation name). */
export interface DigestInputRun {
  automationId: string;
  automationName: string;
  status: string;
  error?: unknown;
  createdAt: string;
}

/** A run surfaced in the digest (failure / waiting / retrying lists). */
export interface DigestRunRef {
  automationId: string;
  automationName: string;
  createdAt: string;
  error?: string | null;
}

export interface AutomationDigest {
  kind: typeof DIGEST_KIND;
  periodStart: string;
  periodEnd: string;
  totals: {
    total: number;
    finished: number;
    failed: number;
    waiting: number;
    retrying: number;
    other: number;
  };
  /** Most important first: failures, then waiting-on-approval, then retrying. */
  failures: DigestRunRef[];
  waiting: DigestRunRef[];
  retrying: DigestRunRef[];
  headline: string;
  /** Optional LLM prose summary (foreman-ufo3, opt-in). Null when disabled or on failure. */
  narrative: string | null;
}

/** Pull a short error string out of a run's `error` json (a {message} or a DurableRunDetail). */
function errorText(error: unknown): string | null {
  if (error == null) return null;
  if (typeof error === "string") return error;
  if (typeof error !== "object") return null;
  const e = error as Record<string, unknown>;
  if (typeof e.message === "string") return e.message;
  const le = e.lastError as { title?: unknown } | undefined;
  if (le && typeof le.title === "string") return le.title;
  return null;
}

function ref(run: DigestInputRun): DigestRunRef {
  return {
    automationId: run.automationId,
    automationName: run.automationName,
    createdAt: run.createdAt,
    error: errorText(run.error),
  };
}

// Most-recent-first within each bucket.
function byNewest(a: DigestInputRun, b: DigestInputRun): number {
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

/**
 * Aggregate recent runs into a prioritized digest. Deterministic and pure — the
 * caller passes the period boundaries (ISO). Runs outside the period should
 * already be filtered out by the query; this counts whatever it's given.
 */
export function buildDigest(
  runs: DigestInputRun[],
  periodStart: string,
  periodEnd: string,
): AutomationDigest {
  const sorted = [...runs].sort(byNewest);
  const failures = sorted.filter((r) => r.status === "failed").map(ref);
  const waiting = sorted.filter((r) => r.status === "waiting").map(ref);
  const retrying = sorted.filter((r) => r.status === "retrying").map(ref);
  const finished = sorted.filter((r) => r.status === "finished").length;
  const other = sorted.length - failures.length - waiting.length - retrying.length - finished;

  const totals = {
    total: sorted.length,
    finished,
    failed: failures.length,
    waiting: waiting.length,
    retrying: retrying.length,
    other,
  };

  // Headline leads with the most important nonzero signal.
  const parts: string[] = [`${totals.total} run${totals.total === 1 ? "" : "s"}`];
  if (totals.failed) parts.push(`${totals.failed} failed`);
  if (totals.waiting) parts.push(`${totals.waiting} waiting for approval`);
  if (totals.retrying) parts.push(`${totals.retrying} retrying`);
  if (totals.finished) parts.push(`${totals.finished} ok`);
  const headline =
    totals.total === 0 ? "No automation activity in the last day" : parts.join(" · ");

  return {
    kind: DIGEST_KIND,
    periodStart,
    periodEnd,
    totals,
    failures,
    waiting,
    retrying,
    headline,
    narrative: null,
  };
}

/** Instructions for the digest narrator LLM — kept next to the shape it summarizes. */
export const DIGEST_NARRATOR_INSTRUCTIONS =
  "You write a short daily digest for a user's automation activity. Given a JSON " +
  "summary of the last day's automation runs, write 1–3 plain sentences a busy " +
  "operator can skim: lead with what needs attention (failures, then approvals " +
  "waiting, then retries), then a one-line reassurance about what ran fine. Name " +
  "specific automations and error reasons when present. Be concrete and calm — no " +
  "preamble, no bullet lists, no markdown, no emojis. If nothing ran, say so in one line.";

/**
 * The prompt fed to the narrator LLM — a compact JSON view of the structured
 * digest. Pure + deterministic so it's unit-testable and the LLM call stays thin.
 */
export function buildDigestNarrativePrompt(digest: AutomationDigest): string {
  const compact = {
    totals: digest.totals,
    failures: digest.failures.map((f) => ({ automation: f.automationName, error: f.error })),
    waiting: digest.waiting.map((w) => ({ automation: w.automationName })),
    retrying: digest.retrying.map((r) => ({ automation: r.automationName })),
  };
  return `Summarize this automation activity for the last day:\n${JSON.stringify(compact, null, 2)}`;
}
