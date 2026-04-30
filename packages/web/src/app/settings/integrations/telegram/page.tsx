import { HugeiconsIcon } from '@hugeicons/react'
import { TelegramIcon } from '@hugeicons/core-free-icons'
import { ChannelConnectPage } from '@/components/settings/channel-connect-page'
import { BRAND_COLORS } from '@/components/icons/brands'

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

export default function TelegramPage() {
  return (
    <ChannelConnectPage
      channel="telegram"
      displayName="Telegram"
      iconColor={BRAND_COLORS.telegram}
      icon={<HugeiconsIcon icon={TelegramIcon as any} color={BRAND_COLORS.telegram} size={26} strokeWidth={1.75} />}
      description="Chat with Foreman in Telegram DMs or group chats. Once linked, your Zapier actions and history stay in sync across all your channels."
      botLink={BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : null}
      botLinkLabel={`Open @${BOT_USERNAME ?? 'ForemanBot'}`}
      steps={[
        `Click "Open @${BOT_USERNAME ?? 'ForemanBot'}" to start a DM with the bot in Telegram.`,
        'Click "Generate Link Code" below and copy the 8-character code.',
        'Send the command /link YOURCODE to the bot in Telegram.',
        'This page will confirm once your account is linked.',
      ]}
    />
  )
}
