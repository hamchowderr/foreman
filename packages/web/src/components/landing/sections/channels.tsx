import {
  AppleBrand,
  BRAND_COLORS,
  DiscordBrand,
  GithubBrand,
  GoogleBrand,
  MicrosoftBrand,
  SlackBrand,
  TelegramBrand,
  WhatsappBrand,
} from "@/components/icons/brands";
import { Cpu, Globe, Terminal } from "@/components/icons/hi";
import { ChannelMemory } from "@/components/landing/demos/channel-memory";
import { Reveal } from "@/components/landing/reveal";
import { TiltedSpotlight } from "@/components/landing/tilted-spotlight";
import { Badge } from "@/components/ui/badge";

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
          <Badge variant="accent" className="mb-4">
            One brain, everywhere
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Same memory across every channel.
          </h2>
          <p className="text-muted-foreground mt-4 text-base sm:text-lg leading-relaxed">
            Ask in Slack, follow up from Telegram, approve from your phone. Your apps, preferences,
            and action history travel with you.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-6 md:gap-10 items-stretch">
          <Reveal className="flex">
            <TiltedSpotlight className="w-full">
              <ChannelMemory />
            </TiltedSpotlight>
          </Reveal>

          <Reveal delay={0.1} className="flex">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 auto-rows-fr w-full">
              {CHANNELS.map((c) => (
                <TiltedSpotlight
                  key={c.name}
                  borderEffect={false}
                  spotlightEffect={false}
                  radius="rounded-xl"
                  maxTilt={3}
                  className="w-full"
                >
                  <div
                    className={`relative rounded-xl border flex flex-col items-center justify-center gap-2 p-3 text-xs sm:text-sm transition-colors ${
                      c.avail
                        ? "border-border bg-surface hover:border-accent/40"
                        : "border-border/40 bg-surface/40 text-muted-foreground"
                    }`}
                  >
                    <span className={`${c.avail ? "" : "opacity-50"}`}>
                      {c.Icon ? (
                        <c.Icon size={22} />
                      ) : (
                        <span
                          className="inline-flex h-[22px] w-[22px] items-center justify-center rounded text-[11px] font-bold text-white"
                          style={{ backgroundColor: c.color }}
                        >
                          {c.letter}
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-center leading-tight">{c.name}</span>
                    {!c.avail && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] uppercase tracking-wider text-muted-foreground/70">
                        soon
                      </span>
                    )}
                  </div>
                </TiltedSpotlight>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
