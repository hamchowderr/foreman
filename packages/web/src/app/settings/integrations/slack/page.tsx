import { ChannelConnectPage } from '@/components/settings/channel-connect-page'

const SLACK_INSTALL =
  process.env.NEXT_PUBLIC_SLACK_INSTALL_URL ||
  'https://slack.com/oauth/v2/authorize'

export default function SlackPage() {
  return (
    <ChannelConnectPage
      channel="slack"
      displayName="Slack"
      icon="💬"
      description="Bring Foreman into your Slack workspace. Mention @Foreman in any channel or message the bot directly to trigger actions."
      botLink={SLACK_INSTALL}
      botLinkLabel="Add to Slack"
      steps={[
        'Click "Add to Slack" and authorize Foreman for your workspace.',
        'Open a DM with Foreman in Slack.',
        'Click "Generate Link Code" below and copy the 8-character code.',
        'Send /link YOURCODE in the DM. This page will confirm once linked.',
      ]}
    />
  )
}
