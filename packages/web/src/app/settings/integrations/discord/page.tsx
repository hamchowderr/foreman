import { ChannelConnectPage } from '@/components/settings/channel-connect-page'

const BOT_INVITE =
  process.env.NEXT_PUBLIC_DISCORD_BOT_INVITE ||
  'https://discord.com/oauth2/authorize?scope=bot&permissions=277025392640'

export default function DiscordPage() {
  return (
    <ChannelConnectPage
      channel="discord"
      displayName="Discord"
      icon="🎮"
      description="Use Foreman inside Discord — mention @Foreman in any channel or DM the bot directly. Your actions and memory carry over from other channels."
      botLink={BOT_INVITE}
      botLinkLabel="Add Foreman to your server"
      steps={[
        'Click "Add Foreman to your server" and authorize the bot.',
        'Open a DM with Foreman in Discord.',
        'Click "Generate Link Code" below and copy the 8-character code.',
        'Send /link YOURCODE in the DM. This page will confirm once linked.',
      ]}
    />
  )
}
