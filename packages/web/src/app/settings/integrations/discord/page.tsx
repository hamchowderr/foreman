import { HugeiconsIcon } from '@hugeicons/react'
import { DiscordIcon } from '@hugeicons/core-free-icons'
import { ChannelConnectPage } from '@/components/settings/channel-connect-page'
import { BRAND_COLORS } from '@/components/icons/brands'

const DISCORD_APP_ID = process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID

const BOT_INVITE = process.env.NEXT_PUBLIC_DISCORD_BOT_INVITE ||
  (DISCORD_APP_ID
    ? `https://discord.com/oauth2/authorize?client_id=${DISCORD_APP_ID}&scope=bot&permissions=277025392640`
    : null)

export default function DiscordPage() {
  return (
    <ChannelConnectPage
      channel="discord"
      displayName="Discord"
      iconColor={BRAND_COLORS.discord}
      icon={<HugeiconsIcon icon={DiscordIcon as any} color={BRAND_COLORS.discord} size={26} strokeWidth={1.75} />}
      description="Use Foreman inside Discord — mention @Foreman in any channel or DM the bot directly. Your actions and memory carry over from other channels."
      botLink={BOT_INVITE}
      botLinkLabel="Add Foreman to your server"
      steps={[
        'Click "Add Foreman to your server" and authorize the bot.',
        'Click "Generate Link Code" below, then click "Copy command".',
        'Open a DM with Foreman in Discord and paste the command.',
        'This page will confirm once your account is linked.',
      ]}
    />
  )
}
