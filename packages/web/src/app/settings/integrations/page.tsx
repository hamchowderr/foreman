import { createClient } from "@/lib/server";
import { IntegrationsHub } from "@/components/settings/integrations-hub";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let connectedChannels: string[] = [];
  if (session) {
    try {
      const res = await fetch(`${AGENT_URL}/channel-links/identities`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const { identities } = await res.json();
        connectedChannels = (identities ?? []).map(
          (i: { channel: string }) => i.channel,
        );
      }
    } catch {}
  }

  return <IntegrationsHub connectedChannels={connectedChannels} />;
}
