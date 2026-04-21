import { Reveal } from "@/components/landing/reveal";
import { ChannelMemory } from "@/components/landing/demos/channel-memory";
import { Badge } from "@/components/ui/badge";
import { Globe, Terminal, Cpu } from "@/components/icons/hi";
import {
  SlackBrand,
  DiscordBrand,
  TelegramBrand,
  GithubBrand,
  GoogleBrand,
  MicrosoftBrand,
  WhatsappBrand,
  AppleBrand,
  BRAND_COLORS,
} from "@/components/icons/brands";

const CHANNELS = [
  { name: "Slack", avail: true, Icon: SlackBrand },
  { name: "Discord", avail: true, Icon: DiscordBrand },
  { name: "Telegram", avail: true, Icon: TelegramBrand },
  { name: "Google Chat", avail: true, Icon: GoogleBrand },
  { name: "GitHub", avail: true, Icon: GithubBrand },
  { name: "Linear", avail: true, Icon: null, letter: "L", color: BRAND_COLORS.linear },
  { name: "Web", avail: true, Icon: Globe },
  { name: "MCP", avail: true, Icon: Terminal },
  { name: "A2A", avail: true, Icon: Cpu },
  { name: "Teams", avail: false, Icon: MicrosoftBrand },
  { name: "WhatsApp", avail: false, Icon: WhatsappBrand },
  { name: "iMessage", avail: false, Icon: AppleBrand },
] as const;

export function Channels() {
  return (
    <section id="channels" className="py-14 sm:py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <Badge variant="accent" className="mb-4">One brain, everywhere</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Same memory across every channel.
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg leading-relaxed">
            Ask in Slack, follow up from Telegram, approve from your phone.
            Your apps, preferences, and action history travel with you.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-6 md:gap-10 items-start">
          <Reveal>
            <ChannelMemory />
          </Reveal>

          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {CHANNELS.map((c) => (
                <div
                  key={c.name}
                  className={`rounded-lg border px-3 py-2.5 text-xs sm:text-sm transition-colors flex items-center gap-2 ${
                    c.avail
                      ? "border-border bg-surface hover:border-accent/40"
                      : "border-border/40 bg-surface/40 text-muted"
                  }`}
                >
                  <span className={`shrink-0 ${c.avail ? "" : "opacity-50"}`}>
                    {c.Icon ? (
                      <c.Icon size={18} />
                    ) : (
                      <span
                        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.letter}
                      </span>
                    )}
                  </span>
                  <span className="font-medium flex-1 truncate">{c.name}</span>
                  {!c.avail && (
                    <span className="text-[10px] uppercase tracking-wider text-muted shrink-0">
                      soon
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
