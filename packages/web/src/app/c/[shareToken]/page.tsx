import Link from "next/link";
import { notFound } from "next/navigation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { BrandHeader } from "@/components/brand-header";
import { getPublicConversation } from "@/lib/conversations-client";

// Public, logged-out share page for a chat (foreman-mk25). No auth: the token in
// the URL is the capability (validated + expiry-checked by the agent's
// /conversations/public/:token endpoint). Fetched no-store so a share reflects the
// latest state of the thread. Read-only — there is no composer.
export default async function PublicConversationPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const result = await getPublicConversation(shareToken);
  if (!result) notFound();

  const { conversation, messages } = result;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <BrandHeader label={<span className="text-muted-foreground text-sm">Shared chat</span>} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8">
        <h1 className="mb-6 font-semibold text-2xl tracking-tight">
          {conversation.title || "Shared conversation"}
        </h1>

        <div className="flex flex-col gap-6">
          {messages.map((m, i) => {
            const text = (m.parts ?? [])
              .filter((p) => p.type === "text" && typeof p.text === "string")
              .map((p) => p.text)
              .join("");
            if (!text) return null;
            return (
              <Message from={m.role} key={m.id ?? `${m.role}-${i}`}>
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
