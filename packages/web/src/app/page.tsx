import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { ChatShell } from "@/components/chat-shell";

export default function Home() {
  return (
    <div className="h-screen flex flex-col">
      <Show when="signed-out">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Foreman</h1>
            <p className="text-gray-500">
              AI assistant for 9,000+ apps via Zapier
            </p>
            <SignInButton mode="modal">
              <button className="rounded bg-black px-6 py-2 text-white hover:bg-gray-800">
                Sign In to Get Started
              </button>
            </SignInButton>
          </div>
        </div>
      </Show>
      <Show when="signed-in">
        <header className="flex items-center justify-between px-4 py-2 border-b">
          <h1 className="text-lg font-semibold">Foreman</h1>
          <UserButton />
        </header>
        <div className="flex-1">
          <ChatShell />
        </div>
      </Show>
    </div>
  );
}
