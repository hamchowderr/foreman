import Link from "next/link";
import { notFound } from "next/navigation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { BrandHeader } from "@/components/brand-header";
import { getSharedChat } from "@/lib/chat-shares-client";

// Public, logged-out page for a shared chat (foreman-mk25). No auth: the token in
// the URL is the capability (checked by the agent's /chat-shares/public/:token).
// Fetched no-store so the page shows the chat as it is now. Read-only.
export default async function SharedChatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const chat = await getSharedChat(token);
  if (!chat) notFound();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <BrandHeader label={<span className="text-muted-foreground text-sm">Shared chat</span>} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8">
        <h1 className="mb-6 text-balance font-semibold text-2xl tracking-tight">{chat.title}</h1>

        <div className="flex flex-col gap-6">
          {chat.messages.map((m) => {
            const text = m.parts.map((p) => p.text).join("");
            return (
              <Message from={m.role} key={m.id}>
                <MessageContent
                  className={m.role === "user" ? "rounded-2xl bg-muted px-4 py-2.5" : undefined}
                >
                  {m.role === "assistant" ? (
                    <div className="prose-sm max-w-none">
                      <MessageResponse>{text}</MessageResponse>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{text}</p>
                  )}
                </MessageContent>
              </Message>
            );
          })}
        </div>
      </main>

      <footer className="border-border border-t px-6 py-4 text-center text-muted-foreground text-xs sm:px-8">
        Built with{" "}
        <Link className="font-medium hover:underline" href="/">
          Foreman
        </Link>
      </footer>
    </div>
  );
}
