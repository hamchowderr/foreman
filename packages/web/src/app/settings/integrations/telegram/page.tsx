import { TelegramIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { BRAND_COLORS } from "@/components/icons/brands";
import { ChannelConnectPage } from "@/components/settings/channel-connect-page";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

export default function TelegramPage() {
  return (
    <ChannelConnectPage
      channel="telegram"
      displayName="Telegram"
      iconColor={BRAND_COLORS.telegram}
      icon={
        <HugeiconsIcon
          icon={TelegramIcon as any}
          color={BRAND_COLORS.telegram}
          size={26}
          strokeWidth={1.75}
        />
      }
      description="Chat with Foreman in Telegram DMs or group chats. Once linked, your Zapier actions and history stay in sync across all your channels."
      botLink={BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : null}
      botLinkLabel={`Open @${BOT_USERNAME ?? "ForemanBot"}`}
      steps={[
        'Click "Generate Link Code" below, then click "Copy command".',
        `Open @${BOT_USERNAME ?? "ForemanBot"} in Telegram and paste the command.`,
        "This page will confirm once your account is linked.",
      ]}
    />
  );
}
