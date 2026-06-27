import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";

const AGENT_SERVER_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = session.access_token;

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  try {
    const res = await fetch(`${AGENT_SERVER_URL}/conversations/${chatId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 404) return NextResponse.json({ messages: [], visibility: "private" });
      return NextResponse.json({ error: "Failed to fetch" }, { status: res.status });
    }

    const data = await res.json();

    return NextResponse.json({
      messages: data.messages || [],
      visibility: data.conversation?.visibility || "private",
      title: data.conversation?.title ?? null,
      // Collaborative writing (foreman-whkr): a teammate who can open a
      // workspace-shared chat may also continue it, so it's not read-only.
      // is_owner still gates owner-only controls (visibility, public share).
      isReadonly: false,
      isOwner: data.conversation?.is_owner !== false,
    });
  } catch {
    return NextResponse.json({
      messages: [],
      visibility: "private",
      isReadonly: false,
      isOwner: true,
    });
  }
}
