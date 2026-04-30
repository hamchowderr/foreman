import { ChannelConnectPage } from '@/components/settings/channel-connect-page'

export default function TelegramPage() {
  return (
    <ChannelConnectPage
      channel="telegram"
      displayName="Telegram"
      icon="✈️"
      description="Chat with Foreman in Telegram DMs or group chats. Once linked, your Zapier actions and history stay in sync across all your channels."
      botLink="https://t.me/ForemanBot"
      botLinkLabel="Open @ForemanBot"
      steps={[
        'Click "Open @ForemanBot" to start a DM with the bot in Telegram.',
        'Click "Generate Link Code" below and copy the 8-character code.',
        'Send the command /link YOURCODE to the bot in Telegram.',
        'This page will confirm once your account is linked.',
      ]}
    />
  )
}
