"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState, type ComponentType } from "react";
import { Check, ChevronRight, Globe } from "@/components/icons/hi";
import {
  SlackBrand,
  DiscordBrand,
  TelegramBrand,
  BRAND_COLORS,
} from "@/components/icons/brands";

type ChannelSkin = {
  id: "slack" | "discord" | "telegram" | "web";
  label: string;
  sub: string;
  Icon: ComponentType<{ size?: number; color?: string; className?: string }>;
  brand: string;
  brandText: string;
};

const CHANNEL_SKINS: Record<ChannelSkin["id"], ChannelSkin> = {
  slack: {
    id: "slack",
    label: "Slack",
    sub: "#foreman",
    Icon: SlackBrand,
    brand: BRAND_COLORS.slack,
    brandText: "#ffffff",
  },
  discord: {
    id: "discord",
    label: "Discord",
    sub: "#general",
    Icon: DiscordBrand,
    brand: BRAND_COLORS.discord,
    brandText: "#ffffff",
  },
  telegram: {
    id: "telegram",
    label: "Telegram",
    sub: "@foreman_bot",
    Icon: TelegramBrand,
    brand: BRAND_COLORS.telegram,
    brandText: "#ffffff",
  },
  web: {
    id: "web",
    label: "Foreman",
    sub: "web app",
    Icon: Globe,
    brand: BRAND_COLORS.zapier,
    brandText: "#ffffff",
  },
};

type Scene = {
  id: string;
  channelId: ChannelSkin["id"];
  say: string;
  description: string;
  chat: Array<
    | { role: "user"; text: string }
    | { role: "thinking" }
    | {
        role: "proposal";
        app: string;
        action: string;
        fields: Array<{ key: string; value: string }>;
      }
    | { role: "sent"; text: string }
    | { role: "agent"; text: string }
  >;
};

const SCENES: Scene[] = [
  {
    id: "list-apps",
    channelId: "slack",
    say: "What apps do I have connected?",
    description: "Lists your connected Zapier apps.",
    chat: [
      { role: "user", text: "What apps do I have connected?" },
      { role: "thinking" },
      {
        role: "agent",
        text: "You have 8 connected: Gmail, Slack, Trello, Stripe, Linear, Notion, Google Calendar, Google Drive.",
      },
    ],
  },
  {
    id: "email",
    channelId: "discord",
    say: "Email test@example.com that the project is complete",
    description: "Drafts and sends after approval.",
    chat: [
      { role: "user", text: "Email test@example.com that the project is complete." },
      { role: "thinking" },
      {
        role: "proposal",
        app: "Gmail",
        action: "Send Email",
        fields: [
          { key: "to", value: "test@example.com" },
          { key: "subject", value: "Project complete" },
          { key: "body", value: "Hi — the project is complete..." },
        ],
      },
      { role: "sent", text: "Sent via Gmail." },
    ],
  },
  {
    id: "trello",
    channelId: "telegram",
    say: "Create a Trello card 'Follow up with client' in my To Do list",
    description: "Picks the board and list, creates on approval.",
    chat: [
      { role: "user", text: "Create a Trello card 'Follow up with client' in my To Do list." },
      { role: "thinking" },
      {
        role: "proposal",
        app: "Trello",
        action: "Create Card",
        fields: [
          { key: "board", value: "Personal" },
          { key: "list", value: "To Do" },
          { key: "name", value: "Follow up with client" },
        ],
      },
      { role: "sent", text: "Card created in Personal › To Do." },
    ],
  },
  {
    id: "slack-actions",
    channelId: "web",
    say: "What actions can I do with Slack?",
    description: "Lists every available Slack action.",
    chat: [
      { role: "user", text: "What actions can I do with Slack?" },
      { role: "thinking" },
      {
        role: "agent",
        text: "9 Slack actions: Send message, Create channel, Invite user, Set topic, Pin message, React, Upload file, Get user info, Search messages.",
      },
    ],
  },
  {
    id: "search",
    channelId: "slack",
    say: "Search my recent emails for anything about invoices",
    description: "Runs Gmail search, returns threads.",
    chat: [
      { role: "user", text: "Search my recent emails for anything about invoices." },
      { role: "thinking" },
      {
        role: "agent",
        text: "Found 4: 'March invoice batch' (Mar 28), 'Invoice #INV-2091 paid' (Mar 22), 'Acme invoice follow-up' (Mar 15), 'Re: Jan invoices' (Jan 30).",
      },
    ],
  },
];

export function FiveThingsReplay() {
  const [activeId, setActiveId] = useState<string>(SCENES[0].id);
  const [step, setStep] = useState(0);
  const scene = SCENES.find((s) => s.id === activeId)!;
  const skin = CHANNEL_SKINS[scene.channelId];

  useEffect(() => {
    setStep(0);
    const delays = [900, 1200, 1400, 1400, 1200];
    const timers: ReturnType<typeof setTimeout>[] = [];

    let cumulative = 0;
    for (let i = 1; i < scene.chat.length; i++) {
      cumulative += delays[i - 1] ?? 1000;
      timers.push(setTimeout(() => setStep(i), cumulative));
    }
    return () => timers.forEach(clearTimeout);
  }, [activeId, scene.chat.length]);

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 items-start">
      {/* List */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        {SCENES.map((s, i) => {
          const selected = s.id === activeId;
          const sSkin = CHANNEL_SKINS[s.channelId];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              className={`w-full text-left px-4 py-3.5 flex items-start gap-3 border-b border-border last:border-b-0 transition-colors min-h-[44px] ${
                selected ? "bg-accent/5" : "hover:bg-background"
              }`}
            >
              <span
                className={`text-[10px] font-mono tabular-nums mt-1 w-5 shrink-0 ${
                  selected ? "text-accent font-semibold" : "text-muted"
                }`}
              >
                0{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${selected ? "text-foreground" : ""}`}>
                  "{s.say}"
                </div>
                <div className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center justify-center h-3 w-3 rounded-sm shrink-0"
                    style={{ backgroundColor: sSkin.brand }}
                  >
                    <sSkin.Icon size={8} color={sSkin.brandText} />
                  </span>
                  <span className="truncate">in {sSkin.label}</span>
                </div>
              </div>
              <ChevronRight
                className={`h-4 w-4 shrink-0 mt-1 transition-transform ${
                  selected ? "translate-x-0.5 text-accent" : "text-muted"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Replay pane */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden min-h-[400px] flex flex-col">
        {/* Channel-themed header */}
        <AnimatePresence mode="wait">
          <motion.div
            key={skin.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 py-2.5 flex items-center gap-2.5 shrink-0"
            style={{ backgroundColor: skin.brand, color: skin.brandText }}
          >
            <skin.Icon size={16} color={skin.brandText} />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold leading-tight truncate">
                {skin.label}
              </span>
              <span
                className="text-[10px] leading-tight truncate"
                style={{ color: skin.brandText, opacity: 0.75 }}
              >
                {skin.sub}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="p-4 space-y-3 flex-1">
          {scene.chat.slice(0, step + 1).map((msg, i) => (
            <motion.div
              key={`${activeId}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {msg.role === "user" && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-foreground text-background px-4 py-2 text-sm">
                    {msg.text}
                  </div>
                </div>
              )}
              {msg.role === "thinking" && (
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold">
                    F
                  </div>
                  <div className="rounded-2xl rounded-bl-sm bg-background border border-border px-4 py-2.5 flex items-center gap-1">
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                  </div>
                </div>
              )}
              {msg.role === "agent" && (
                <div className="flex items-start gap-2">
                  <div className="h-7 w-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold shrink-0">
                    F
                  </div>
                  <div className="flex-1 min-w-0 rounded-2xl rounded-bl-sm bg-background border border-border px-4 py-2 text-sm">
                    {msg.text}
                  </div>
                </div>
              )}
              {msg.role === "proposal" && (
                <div className="flex items-start gap-2">
                  <div className="h-7 w-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold shrink-0">
                    F
                  </div>
                  <div className="flex-1 min-w-0 rounded-2xl rounded-bl-sm bg-background border border-border overflow-hidden">
                    <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {msg.app} · {msg.action}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted">
                        needs approval
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-1.5 text-xs font-mono">
                      {msg.fields.map((f) => (
                        <div key={f.key} className="flex gap-2">
                          <span className="text-muted w-16 shrink-0">{f.key}</span>
                          <span className="truncate">{f.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-border flex items-center gap-2">
                      <span className="rounded bg-foreground text-background px-2.5 py-1 text-xs font-medium">
                        Approve
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {msg.role === "sent" && (
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold">
                    F
                  </div>
                  <div className="rounded-2xl rounded-bl-sm bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 px-4 py-2 text-sm flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    {msg.text}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
