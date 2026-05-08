import { McpPage } from '@/components/settings/mcp-page'

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || 'http://localhost:4111'

export default function McpSettingsPage() {
  return <McpPage mcpUrl={`${AGENT_URL}/mcp`} />
}
