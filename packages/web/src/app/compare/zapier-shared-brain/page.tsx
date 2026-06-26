import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink } from "@/components/icons/hi";
import { Reveal } from "@/components/landing/reveal";
import { SiteFooter } from "@/components/landing/sections/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Foreman vs Zapier Shared Brain — how they compare",
  description:
    "An honest comparison of Foreman and Zapier Shared Brain. Both put AI on top of the same Zapier connections — see where they differ, including agent editing, prompt versioning, and full observability.",
};

const SHARED_BRAIN_URL = "https://zapier.com/shared-brain";

/** Each row is one dimension; both sides are written to be fair, not slanted. */
const ROWS: Array<{ dimension: string; foreman: string; sidekick: string }> = [
  {
    dimension: "What it is",
    foreman: "An open, multi-channel chat driver for the Zapier account you already have.",
    sidekick: "Zapier's first-party shared-intelligence workspace for teams.",
  },
  {
    dimension: "Where you use it",
    foreman: "Chat apps you already live in — Slack, Discord, Teams, Telegram, and more.",
    sidekick: "Zapier's own hosted workspace.",
  },
  {
    dimension: "Apps it can drive",
    foreman: "The same 9,000+ connections already in your Zapier account.",
    sidekick: "9,000+ app connections.",
  },
  {
    dimension: "Hosting",
    foreman: "Self-host (one Docker container) or our cloud.",
    sidekick: "Fully hosted by Zapier.",
  },
  {
    dimension: "Source",
    foreman: "Open source, MIT-licensed.",
    sidekick: "Proprietary, first-party.",
  },
  {
    dimension: "Your data",
    foreman: "Stays on your own infrastructure when self-hosted.",
    sidekick: "Lives inside the Zapier platform.",
  },
  {
    dimension: "Edit the agent",
    foreman: "Edit the agent, version its prompts, and pick the model — it is your code.",
    sidekick: "A managed first-party agent.",
  },
  {
    dimension: "See what it does",
    foreman: "Test and watch every step, tool call, and decision live in Mastra Studio.",
    sidekick: "Hosted — you see what Zapier surfaces.",
  },
  {
    dimension: "Team knowledge & memory",
    foreman: "Per-conversation memory plus semantic search over everything it has done.",
    sidekick:
      "A shared team brain that accumulates decisions, docs, and context — its core strength.",
  },
  {
    dimension: "Building automations",
    foreman: "Author durable automations from chat; every action is approval-gated and audited.",
    sidekick: "Shared skills — skills anyone builds, everyone on the team can run.",
  },
  {
    dimension: "Relationship to Zapier",
    foreman: "Built on the Zapier SDK — it drives your account, it is not Zapier itself.",
    sidekick: "A native Zapier product.",
  },
];

const CHOOSE_FOREMAN = [
  "You want to reach your agent from the chat tools your team already uses",
  "You want to edit the agent, version its prompts, and choose the model",
  "You want to test and see exactly what the agent does, step by step, in Mastra Studio",
  "You need self-hosting, data control, or open source",
  "You want every action approval-gated and audit-logged",
];

const CHOOSE_SIDEKICK = [
  "You want one hosted, all-in-one AI workspace",
  "You want a shared team brain that remembers decisions and docs across people",
  "You prefer first-party Zapier support and setup",
  "Multi-channel access, self-hosting, and editing the agent are not requirements for you",
];

export default function CompareZapierSharedBrainPage() {
  return (
    <div className="landing-brand-lock flex min-h-screen flex-col overflow-x-hidden bg-background">
      <SiteNav />
      <main className="flex-1 min-w-0">
        {/* Hero */}
        <section className="py-14 sm:py-20 md:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Reveal>
              <Badge variant="accent" className="mb-4">
                Comparison
              </Badge>
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
                Foreman vs Zapier Shared Brain
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                Zapier Shared Brain and Foreman both put AI on top of the same Zapier connections,
                but they are different shapes. Shared Brain is Zapier&apos;s own hosted team
                workspace. Foreman is an open, multi-channel driver for the account you already have
                — one you can edit, version, and watch end to end. Here is an honest side-by-side.
              </p>
            </Reveal>
          </div>
        </section>

        {/* What each is */}
        <section className="pb-6">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <Reveal>
                <div className="h-full rounded-2xl border-2 border-accent/30 bg-accent/5 p-6 sm:p-7">
                  <div className="flex items-center gap-2.5">
                    {/* biome-ignore lint/performance/noImgElement: small static brand asset, next/image is overkill */}
                    <img
                      alt="Foreman"
                      className="h-6 w-6 object-contain"
                      height={24}
                      src="/zapier.svg"
                      width={24}
                    />
                    <h2 className="text-xl font-semibold">Foreman</h2>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                    A chat driver for your Zapier account. Talk to it from Slack, Discord, Teams, or
                    Telegram and it runs your 9,000+ connections — approval-gated, audit-logged,
                    open source, and self-hostable. Edit the agent, version its prompts, and watch
                    every step in Mastra Studio. Built on the Zapier SDK.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="h-full rounded-2xl border border-border/60 bg-surface/40 p-6 sm:p-7">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold">Zapier Shared Brain</h2>
                    <a
                      href={SHARED_BRAIN_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      zapier.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                    Zapier&apos;s shared intelligence for teams — a shared brain that remembers
                    conversations, decisions, and documents, with shared skills anyone can run
                    across 9,000+ app connections. Hosted by Zapier.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Comparison grid */}
        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Reveal>
              <div className="overflow-hidden rounded-2xl border border-border/60">
                <div className="grid grid-cols-3 border-b border-border/60 bg-surface/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <div className="px-4 py-3 sm:px-5" />
                  <div className="px-4 py-3 text-accent sm:px-5">Foreman</div>
                  <div className="px-4 py-3 sm:px-5">Zapier Shared Brain</div>
                </div>
                {ROWS.map((row) => (
                  <div
                    key={row.dimension}
                    className="grid grid-cols-3 border-b border-border/40 text-sm last:border-b-0"
                  >
                    <div className="px-4 py-4 font-medium sm:px-5">{row.dimension}</div>
                    <div className="px-4 py-4 text-muted-foreground text-pretty sm:px-5">
                      {row.foreman}
                    </div>
                    <div className="px-4 py-4 text-muted-foreground text-pretty sm:px-5">
                      {row.sidekick}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* When to choose which */}
        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Reveal className="mb-8 text-center">
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
                When to choose which
              </h2>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <Reveal>
                <div className="h-full rounded-2xl border-2 border-accent/30 bg-accent/5 p-6 sm:p-7">
                  <h3 className="font-semibold">Reach for Foreman if…</h3>
                  <ul className="mt-4 space-y-2.5 text-sm">
                    {CHOOSE_FOREMAN.map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        <span className="text-pretty">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="h-full rounded-2xl border border-border/60 bg-surface/40 p-6 sm:p-7">
                  <h3 className="font-semibold">Reach for Zapier Shared Brain if…</h3>
                  <ul className="mt-4 space-y-2.5 text-sm">
                    {CHOOSE_SIDEKICK.map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-pretty">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Honest note + CTA */}
        <section className="py-10 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Reveal>
              <p className="text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                These are not really rivals. Foreman is built on the Zapier SDK, so it drives the
                same account and the same connections Shared Brain uses — many teams will run both.
                If you want an agent you can edit, version, and watch end to end, in your own
                channels and on your own infrastructure, that is exactly what Foreman is for.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button size="lg" variant="accent" asChild>
                  <Link href="/chat">
                    Try Foreman <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/">Back to overview</Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
