import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";

const AGENT_SERVER_URL =
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = session.access_token;

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "20";

  try {
    const res = await fetch(
      `${AGENT_SERVER_URL}/conversations?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return NextResponse.json({ chats: [], hasMore: false });
    const data = await res.json();

    const conversations = Array.isArray(data) ? data : (data.conversations || []);
    const chats = conversations.map((conv: { id: string; title?: string; created_at?: string }) => ({
      id: conv.id,
      title: conv.title || "New conversation",
      createdAt: conv.created_at ? new Date(conv.created_at) : new Date(),
      userId: "",
      visibility: "private" as const,
    }));

    return NextResponse.json({ chats, hasMore: data.hasMore || false });
  } catch {
    return NextResponse.json({ chats: [], hasMore: false });
  }
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ success: true }, { status: 200 });
}
