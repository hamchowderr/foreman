import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const AGENT_SERVER_URL =
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export async function GET(request: Request) {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");
  if (!chatId)
    return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  try {
    const res = await fetch(
      `${AGENT_SERVER_URL}/conversations/${chatId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      if (res.status === 404)
        return NextResponse.json({ messages: [], visibility: "private" });
      return NextResponse.json(
        { error: "Failed to fetch" },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Agent server returns { conversation, messages } where messages are
    // already in AI SDK UIMessage format (converted via toAISdkV5Messages).
    return NextResponse.json({
      messages: data.messages || [],
      visibility: data.conversation?.visibility || "private",
      isReadonly: false,
    });
  } catch {
    return NextResponse.json({
      messages: [],
      visibility: "private",
      isReadonly: false,
    });
  }
}
