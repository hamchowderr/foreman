import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "@/components/icons/hi";
import { Reveal } from "@/components/landing/reveal";
import { SiteFooter } from "@/components/landing/sections/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Foreman vs Zapier Sidekick — how they compare",
  description:
    "An honest comparison of Foreman and Zapier Sidekick (the Shared Brain). Two different shapes of AI over Zapier — see which fits how your team works.",
};

/** Each row is one dimension; both sides are written to be fair, not slanted. */
const ROWS: Array<{ dimension: string; foreman: string; sidekick: string }> = [
  {
    dimension: "What it is",
    foreman: "An open, multi-channel chat driver for the Zapier account you already have.",
    sidekick: "Zapier's first-party AI workspace for teams.",
  },
  {
    dimension: "Where you use it",
    foreman: "Chat apps you already live in — Slack, Discord, Teams, Telegram, and more.",
    sidekick: "Zapier's own hosted workspace.",
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
    dimension: "Apps it can drive",
    foreman: "The 9,000+ connections already in your Zapier account.",
    sidekick: "10,000+ Zapier integrations.",
  },
  {
    dimension: "Relationship to Zapier",
    foreman: "Built on the Zapier SDK — it drives your account, it is not Zapier itself.",
    sidekick: "A native Zapier product.",
  },
];

const CHOOSE_FOREMAN = [
  "You want to reach your agent from the chat tools your team already uses",
  "You need self-hosting, data control, or open source",
  "You want every action approval-gated and audit-logged",
  "You want to drive the Zapier account and connections you already built",
];

const CHOOSE_SIDEKICK = [
  "You want one hosted, all-in-one AI workspace",
  "You want a shared team brain that remembers decisions and docs across people",
  "You prefer first-party Zapier support and setup",
  "Multi-channel access and self-hosting are not requirements for you",
];

export default function CompareZapierSidekickPage() {
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
                Foreman vs Zapier Sidekick
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                Zapier Sidekick — the &ldquo;Shared Brain&rdquo; — and Foreman both put AI on top of
                Zapier, but they are different shapes. Sidekick is Zapier&apos;s own hosted team
                workspace. Foreman is an open, multi-channel driver for the account you already
                have. Here is an honest side-by-side so you can pick what fits.
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
                    open source, and self-hostable. Built on the Zapier SDK.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="h-full rounded-2xl border border-border/60 bg-surface/40 p-6 sm:p-7">
                  <h2 className="text-xl font-semibold">Zapier Sidekick</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                    Zapier&apos;s AI workspace that thinks alongside your team — a shared brain that
                    remembers conversations, decisions, and documents, with shared skills anyone can
                    run across 10,000+ integrations. Hosted by Zapier.
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
                  <div className="px-4 py-3 sm:px-5">Zapier Sidekick</div>
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
                  <h3 className="font-semibold">Reach for Zapier Sidekick if…</h3>
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
                same account Sidekick lives in — many teams will run both. If you want an agent in
                your own channels, on your own infrastructure, that is exactly what Foreman is for.
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
