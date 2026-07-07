import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { EditorShell } from "@/components/editor/editor-shell";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "Agent Editor — Foreman",
};

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell fullBleed>
      <Suspense fallback={<div className="h-full bg-background" />}>
        <EditorAuthGate>{children}</EditorAuthGate>
      </Suspense>
    </AppShell>
  );
}

// Split out so the dynamic `auth()` read sits inside the Suspense boundary,
// as required by Next 16's cacheComponents mode.
async function EditorAuthGate({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in?redirect_url=/editor");
  }
  return (
    <EditorShell user={{ id: session.user.id, email: session.user.email }}>{children}</EditorShell>
  );
}
