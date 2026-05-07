import { HugeiconsIcon } from '@hugeicons/react'
import { SlackIcon } from '@hugeicons/core-free-icons'
import { ChannelConnectPage } from '@/components/settings/channel-connect-page'
import { BRAND_COLORS } from '@/components/icons/brands'

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || 'http://localhost:4111'
const SLACK_CLIENT_ID = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID

const SLACK_INSTALL = process.env.NEXT_PUBLIC_SLACK_INSTALL_URL ||
  (SLACK_CLIENT_ID
    ? `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=channels%3Ahistory%2Cchat%3Awrite%2Cim%3Ahistory%2Cim%3Awrite%2Cusers%3Aread&redirect_uri=${encodeURIComponent(`${AGENT_URL}/slack/oauth`)}`
    : null)

export default function SlackPage() {
  return (
    <ChannelConnectPage
      channel="slack"
      displayName="Slack"
      iconColor={BRAND_COLORS.slack}
      icon={<HugeiconsIcon icon={SlackIcon as any} color={BRAND_COLORS.slack} size={26} strokeWidth={1.75} />}
      description="Bring Foreman into your Slack workspace. Mention @Foreman in any channel or message the bot directly to trigger actions."
      botLink={SLACK_INSTALL}
      botLinkLabel="Add to Slack"
      linkCommand="link"
      steps={[
        'Click "Add to Slack" and authorize Foreman for your workspace.',
        'Click "Generate Link Code" below, then click "Copy command".',
        'Open a DM with the Foreman bot in Slack and paste the command (no slash needed).',
        'This page will confirm once your account is linked.',
      ]}
    />
  )
}
