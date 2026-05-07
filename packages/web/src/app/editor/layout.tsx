import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { auth } from "@/lib/auth";
import { EditorShell } from "@/components/editor/editor-shell";

export const metadata = {
  title: "Agent Editor — Foreman",
};

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className: "!bg-card !text-foreground !border-border/50",
        }}
      />
      <Suspense fallback={<div className="h-dvh bg-background" />}>
        <EditorAuthGate>{children}</EditorAuthGate>
      </Suspense>
    </>
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
    <EditorShell user={{ id: session.user.id, email: session.user.email }}>
      {children}
    </EditorShell>
  );
}
