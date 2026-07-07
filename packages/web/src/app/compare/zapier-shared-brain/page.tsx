import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Ban, Check, ExternalLink } from "@/components/icons/hi";
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

/**
 * At-a-glance capability matrix. Honest and balanced: Foreman wins the
 * build / own / host rows, Shared Brain wins the fully-managed / first-party
 * rows. "soon" = on Foreman's roadmap, not shipped — never rendered as a check.
 */
type Cell = boolean | "soon";

const MATRIX: Array<{ label: string; foreman: Cell; sidekick: Cell }> = [
  { label: "Drives your 10,000+ Zapier connections", foreman: true, sidekick: true },
  { label: "Use it from Slack, Discord, Telegram & more", foreman: true, sidekick: false },
  { label: "Self-host on your own infrastructure", foreman: true, sidekick: false },
  { label: "Open source (MIT-licensed)", foreman: true, sidekick: false },
  { label: "Edit the agent in full detail", foreman: true, sidekick: false },
  { label: "Version its prompts & configuration", foreman: true, sidekick: false },
  { label: "Choose the model it runs on", foreman: true, sidekick: false },
  { label: "Watch every step, tool call & decision", foreman: true, sidekick: false },
  { label: "Memory & semantic recall", foreman: true, sidekick: true },
  { label: "Shared team brain across people", foreman: "soon", sidekick: true },
  { label: "Fully hosted & managed by Zapier", foreman: false, sidekick: true },
  { label: "First-party Zapier support", foreman: false, sidekick: true },
];

const CHOOSE_FOREMAN = [
  "You're a builder — you want to own, edit, extend, and contribute to your agent, not just use it",
  "You want to edit the agent, version its prompts, and choose the model",
  "You want to reach your agent from the chat tools your team already uses",
  "You want to test and see exactly what the agent does, step by step, in Mastra Studio",
  "You need self-hosting, data control, or open source",
  "You want every action approval-gated and audit-logged",
];

const CHOOSE_SIDEKICK = [
  "You want a finished, hosted product that works out of the box",
  "You're happy using the agent as Zapier designed it — no prompts to edit, no model to pick, no infrastructure to run",
  "You'd rather not build, customize, or maintain anything yourself",
  "You want the agent, connections, and team memory all managed for you in one place",
  "First-party Zapier support and setup matter more to you than ownership or extensibility",
];

function MatrixCell({ value, brand }: { value: Cell; brand?: boolean }) {
  if (value === "soon") {
    return (
      <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
        Soon
      </span>
    );
  }
  if (value) {
    return (
      <>
        <Check className={`h-4 w-4 ${brand ? "text-accent" : "text-foreground/60"}`} />
        <span className="sr-only">Yes</span>
      </>
    );
  }
  return (
    <>
      <Ban className="h-4 w-4 text-muted-foreground/40" />
      <span className="sr-only">No</span>
    </>
  );
}

export default function CompareZapierSharedBrainPage() {
  return (
    <div className="landing-brand-lock flex min-h-screen flex-col overflow-x-clip bg-background">
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
                but they are built for different people. Shared Brain is Zapier&apos;s own hosted
                team workspace — a finished product you use as-is. Foreman is an open, multi-channel
                driver for the account you already have — one you can edit, version, extend, and
                watch end to end. Here is an honest side-by-side.
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
                    Telegram and it runs your 10,000+ connections — approval-gated, audit-logged,
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
                    across 10,000+ app connections. Hosted by Zapier.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* At-a-glance feature matrix */}
        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Reveal className="mb-8 text-center">
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
                At a glance
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
                The same 10,000+ connections on both sides. Where they differ is who gets to build,
                host, and see inside the agent.
              </p>
            </Reveal>
            <Reveal>
              <div className="overflow-hidden rounded-2xl border border-border/60">
                <div className="grid grid-cols-[1.7fr_1fr_1fr] border-b border-border/60 bg-surface/50 text-[11px] font-semibold uppercase tracking-wider">
                  <div className="px-4 py-3 text-muted-foreground sm:px-5">Capability</div>
                  <div className="flex items-center justify-center gap-1.5 bg-accent/5 px-3 py-3 text-center text-accent">
                    {/* biome-ignore lint/performance/noImgElement: small static brand asset, next/image is overkill */}
                    <img
                      alt=""
                      className="h-3.5 w-3.5 object-contain"
                      height={14}
                      src="/zapier.svg"
                      width={14}
                    />
                    Foreman
                  </div>
                  <div className="px-3 py-3 text-center text-muted-foreground">Shared Brain</div>
                </div>
                {MATRIX.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[1.7fr_1fr_1fr] items-center border-b border-border/40 text-sm last:border-b-0"
                  >
                    <div className="px-4 py-3.5 font-medium text-pretty sm:px-5">{row.label}</div>
                    <div className="flex justify-center bg-accent/5 px-3 py-3.5">
                      <MatrixCell value={row.foreman} brand />
                    </div>
                    <div className="flex justify-center px-3 py-3.5">
                      <MatrixCell value={row.sidekick} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-accent" /> Included
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Ban className="h-3.5 w-3.5 text-muted-foreground/40" /> Not available
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded-full border border-accent/30 bg-accent/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Soon
                  </span>{" "}
                  On Foreman&apos;s roadmap
                </span>
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
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
                Neither is better — they fit different people. Shared Brain is for teams who want a
                polished product they don&apos;t have to build. Foreman is for the people who do
                want to build, own, and extend their agent.
              </p>
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
                Foreman is built on the Zapier SDK, so it drives the same account and the same
                connections Shared Brain does. The real difference is who each is for: Shared Brain
                is the better pick if you want a finished product you don&apos;t have to build.
                Foreman is for the people who do — an agent you can edit, version, extend, and watch
                end to end, in your own channels and on your own infrastructure.
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
