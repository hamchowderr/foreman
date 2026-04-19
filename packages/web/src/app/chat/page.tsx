import Link from "next/link";
import {
  Show,
  SignInButton,
  UserButton,
  OrganizationSwitcher,
} from "@clerk/nextjs";
import { ChatShell } from "@/components/chat-shell";

export default function ChatPage() {
  return (
    <div className="h-screen flex flex-col">
      <Show when="signed-out">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Foreman</h1>
            <p className="text-muted">
              Sign in to start a conversation.
            </p>
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded bg-foreground px-6 py-2 text-background hover:opacity-90"
              >
                Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </Show>
      <Show when="signed-in">
        <header className="flex items-center justify-between px-4 py-2 border-b border-border">
          <Link href="/" className="text-lg font-semibold">
            Foreman
          </Link>
          <div className="flex items-center gap-3">
            <OrganizationSwitcher
              afterSelectOrganizationUrl="/chat"
              afterLeaveOrganizationUrl="/chat"
            />
            <UserButton />
          </div>
        </header>
        <div className="flex-1 min-h-0">
          <ChatShell />
        </div>
      </Show>
    </div>
  );
}
