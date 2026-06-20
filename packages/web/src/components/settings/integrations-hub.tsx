"use client";

import {
  DiscordIcon,
  ElectricPlugsIcon,
  MicrosoftIcon,
  SlackIcon,
  TelegramIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { BRAND_COLORS } from "@/components/icons/brands";
import { Badge } from "@/components/ui/badge";

interface Props {
  connectedChannels: string[];
}

const CHANNELS = [
  {
    key: "mcp",
    label: "MCP / API",
    icon: ElectricPlugsIcon,
    iconColor: "#FF4F00",
    description: "Connect Claude Desktop, Cursor, or any MCP client directly to Foreman.",
    href: "/settings/integrations/mcp",
    available: true,
  },
  {
    key: "telegram",
    label: "Telegram",
    icon: TelegramIcon,
    iconColor: BRAND_COLORS.telegram,
    description: "Chat with Foreman via Telegram DMs or group mentions.",
    href: "/settings/integrations/telegram",
    available: true,
  },
  {
    key: "discord",
    label: "Discord",
    icon: DiscordIcon,
    iconColor: BRAND_COLORS.discord,
    description: "Mention @Foreman in any Discord channel or DM the bot.",
    href: "/settings/integrations/discord",
    available: true,
  },
  {
    key: "slack",
    label: "Slack",
    icon: SlackIcon,
    iconColor: BRAND_COLORS.slack,
    description: "Add Foreman to your Slack workspace and trigger actions from any channel.",
    href: "/settings/integrations/slack",
    available: true,
  },
  {
    key: "teams",
    label: "Microsoft Teams",
    icon: MicrosoftIcon,
    iconColor: BRAND_COLORS.microsoft,
    description: "Coming soon.",
    href: "#",
    available: false,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: WhatsappIcon,
    iconColor: BRAND_COLORS.whatsapp,
    description: "Coming soon.",
    href: "#",
    available: false,
  },
];

export function IntegrationsHub({ connectedChannels }: Props) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "#201515" }}>
        Integrations
      </h1>
      <p className="text-sm mb-8" style={{ color: "#888" }}>
        Connect Foreman to the tools and channels you already use.
      </p>

      <div className="grid gap-4">
        {CHANNELS.map((ch) => {
          const connected = connectedChannels.includes(ch.key);
          return (
            <div
              key={ch.key}
              className="flex items-center justify-between rounded-xl p-5"
              style={{
                border: "1.5px solid #FFF3E6",
                backgroundColor: "#fff",
                opacity: ch.available ? 1 : 0.6,
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${ch.iconColor}18` }}
                >
                  <HugeiconsIcon
                    icon={ch.icon as any}
                    color={ch.iconColor}
                    size={22}
                    strokeWidth={1.75}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: "#201515" }}>
                      {ch.label}
                    </span>
                    {connected && <Badge variant="secondary">Connected</Badge>}
                    {!ch.available && <Badge variant="outline">Coming soon</Badge>}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                    {ch.description}
                  </p>
                </div>
              </div>

              {ch.available && (
                <Link
                  href={ch.href}
                  className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: connected ? "#FFF3E6" : "#FF4F00",
                    color: connected ? "#FF4F00" : "#fff",
                  }}
                >
                  {connected ? "Manage" : "Connect"}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
