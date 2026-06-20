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

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ chats: [] });

  try {
    const res = await fetch(`${AGENT_SERVER_URL}/conversations/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return NextResponse.json({ chats: [] });
    const data = await res.json();

    const results = Array.isArray(data?.results) ? data.results : [];
    const chats = results.map(
      (r: {
        id: string;
        title?: string;
        created_at?: string;
        archived_at?: string | null;
        snippet?: string | null;
      }) => ({
        id: r.id,
        title: r.title || "New conversation",
        createdAt: r.created_at ? new Date(r.created_at) : new Date(),
        userId: "",
        visibility: "private" as const,
        archivedAt: r.archived_at ?? null,
        snippet: r.snippet ?? null,
      }),
    );

    return NextResponse.json({ chats });
  } catch {
    return NextResponse.json({ chats: [] });
  }
}
