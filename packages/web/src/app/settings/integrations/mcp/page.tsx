import { createClient } from "@/lib/server";
import { McpPage } from "@/components/settings/mcp-page";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export default async function McpSettingsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let initialKeys: {
    id: string;
    name: string;
    scopes: string[];
    last_used_at: string | null;
    created_at: string;
  }[] = [];
  if (session) {
    try {
      const res = await fetch(`${AGENT_URL}/api-keys`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const { keys } = await res.json();
        initialKeys = keys ?? [];
      }
    } catch {}
  }

  const mcpUrl = `${AGENT_URL}/mcp`;

  return <McpPage mcpUrl={mcpUrl} initialKeys={initialKeys} />;
}
