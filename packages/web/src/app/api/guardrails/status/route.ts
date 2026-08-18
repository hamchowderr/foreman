import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";

const AGENT_SERVER_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

/**
 * Proxy for the agent server's `GET /guardrails/status`.
 *
 * The chat UI needs one field from it — `config.maxBulkItems`, the workspace's
 * "this counts as bulk" threshold — so the approval prompt can flag an
 * oversized action (foreman-nz8b). The upstream handler treats this as a read
 * (`peek: true`), so polling it does not spend the caller's rate-limit budget.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch(`${AGENT_SERVER_URL}/guardrails/status`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Agent server unreachable" }, { status: 502 });
  }
}
