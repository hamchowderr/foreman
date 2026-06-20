"use client";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
};

function format(n: number | undefined): string {
  if (!n) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Context-window usage gauge for the composer — a small ring + percent that
 * expands (on hover) into the input/output/reasoning/cache breakdown. Faithful
 * to Vercel AI Elements' Context component, built on the vendored hover-card
 * primitive (no tokenlens dependency; window size comes from the models config).
 */
export function ContextUsage({
  usage,
  maxTokens,
  className,
}: {
  usage: TokenUsage | null | undefined;
  maxTokens: number;
  className?: string;
}) {
  const used = usage?.totalTokens ?? (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
  if (!usage || !used) return null;

  const pct = Math.min(100, Math.round((used / maxTokens) * 100));
  // 14px ring (r=6 → circumference ≈ 37.7).
  const circumference = 2 * Math.PI * 6;
  const dashoffset = circumference * (1 - pct / 100);

  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger asChild>
        <button
          aria-label={`Context: ${pct}% of ${format(maxTokens)} tokens used`}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
            className,
          )}
          type="button"
        >
          <svg aria-hidden className="-rotate-90 size-3.5" fill="none" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2} />
            <circle
              cx="7"
              cy="7"
              r="6"
              stroke="currentColor"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              strokeWidth={2}
            />
          </svg>
          <span className="tabular-nums">{pct}%</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-52 space-y-1.5 text-xs">
        <div className="font-medium text-foreground">Context usage</div>
        <Row label="Used" value={`${format(used)} / ${format(maxTokens)}`} />
        <Row label="Input" value={format(usage.inputTokens)} />
        <Row label="Output" value={format(usage.outputTokens)} />
        {usage.reasoningTokens ? (
          <Row label="Reasoning" value={format(usage.reasoningTokens)} />
        ) : null}
        {usage.cachedInputTokens ? (
          <Row label="Cached" value={format(usage.cachedInputTokens)} />
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}
